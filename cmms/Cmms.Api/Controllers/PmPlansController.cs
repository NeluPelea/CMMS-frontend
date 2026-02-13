using Cmms.Domain;
using Cmms.Infrastructure;
using Cmms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/pm-plans")]
[Authorize]
public sealed class PmPlansController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PmSchedulingService _scheduler;
    private readonly IWorkingCalendar _calendar;

    public PmPlansController(AppDbContext db, PmSchedulingService scheduler, IWorkingCalendar calendar)
    {
        _db = db;
        _scheduler = scheduler;
        _calendar = calendar;
    }

    // ---------------- DTOs (NO CYCLES) ----------------

    public sealed record PmPlanItemDto(Guid Id, string Text, int Sort);

    public sealed record PmPlanDto(
        Guid Id,
        Guid AssetId,
        string Name,
        PmFrequency Frequency,
        DateTimeOffset NextDueAt,
        bool IsAct,
        IReadOnlyList<PmPlanItemDto> Items
    );

    public sealed record CreateReq(
        Guid AssetId,
        string Name,
        PmFrequency Frequency,
        DateTimeOffset? NextDueAt,
        List<string>? Items
    );

    public sealed record GenerateResp(int Created, int UpdatedPlans);

    public sealed record UpdateReq(
        Guid AssetId,
        string Name,
        PmFrequency Frequency,
        DateTimeOffset? NextDueAt,
        bool IsAct,
        List<string>? Items
    );

    // EF-translatable projection (reutilizabil)
    private static readonly Expression<Func<PmPlan, PmPlanDto>> PlanToDto =
        p => new PmPlanDto(
            p.Id,
            p.AssetId,
            p.Name,
            p.Frequency,
            p.NextDueAt,
            p.IsAct,
            p.Items
                .OrderBy(i => i.Sort)
                .Select(i => new PmPlanItemDto(i.Id, i.Text, i.Sort))
                .ToList()
        );

    // ---------------- Helpers ----------------

    private static DateTimeOffset Utc(DateTimeOffset x) => x.ToUniversalTime();
    private static DateTimeOffset UtcNow() => DateTimeOffset.UtcNow;

    private async Task<DateTimeOffset> NormalizeScheduleTime(DateTimeOffset inputDate)
    {
        // 1. Convert to Local
        var roZone = TimeZoneInfo.FindSystemTimeZoneById("E. Europe Standard Time");
        var localTime = TimeZoneInfo.ConvertTime(inputDate, roZone);
        var localDate = DateOnly.FromDateTime(localTime.DateTime);
        
        // 2. Ensure Working Day
        var validDate = await _calendar.GetNextWorkingDay(localDate);
        
        // 3. Set 08:00
        var validLocal = validDate.ToDateTime(new TimeOnly(8, 0, 0));
        var validUtc = TimeZoneInfo.ConvertTimeToUtc(validLocal, roZone);
        return new DateTimeOffset(validUtc, TimeSpan.Zero);
    }

    // ---------------- Endpoints ----------------

    [HttpGet]
    [Authorize(Policy = "Perm:PM_READ")]
    public async Task<IActionResult> List([FromQuery] Guid? assetId = null, [FromQuery] int take = 200)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        var qry = _db.PmPlans.AsNoTracking()
            //.Where(x => x.IsAct) // Allow seeing inactive plans
            .AsQueryable();

        if (assetId.HasValue)
            qry = qry.Where(x => x.AssetId == assetId.Value);

        var items = await qry
            .OrderBy(x => x.NextDueAt)
            .Take(take)
            .Select(PlanToDto)
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Perm:PM_READ")]
    public async Task<IActionResult> Get(Guid id)
    {
        var item = await _db.PmPlans.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(PlanToDto)
            .FirstOrDefaultAsync();

        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost]
    [Authorize(Policy = "Perm:PM_CREATE")]
    public async Task<IActionResult> Create([FromBody] CreateReq req)
    {
        if (req == null) return BadRequest("req null");

        // validate asset
        var ok = await _db.Assets.AsNoTracking()
            .AnyAsync(a => a.Id == req.AssetId && a.IsAct);
        if (!ok) return BadRequest("bad assetId");

        // validate name
        var name = (req.Name ?? "").Trim();
        if (name.Length < 2) return BadRequest("name too short");
        if (name.Length > 200) return BadRequest("name too long");

        // normalize time
        var inputDate = req.NextDueAt ?? UtcNow();
        var validUtc = await NormalizeScheduleTime(inputDate);

        var plan = new PmPlan
        {
            AssetId = req.AssetId,
            Name = name,
            Frequency = req.Frequency,
            NextDueAt = validUtc,
            IsAct = true
        };

        // items
        if (req.Items != null)
        {
            var i = 0;
            foreach (var t in req.Items.Select(x => (x ?? "").Trim()).Where(x => x.Length > 0))
            {
                var text = t.Length > 300 ? t.Substring(0, 300) : t;
                plan.Items.Add(new PmPlanItem
                {
                    Text = text,
                    Sort = i++
                });
            }
        }

        _db.PmPlans.Add(plan);
        await _db.SaveChangesAsync();

        var dto = await _db.PmPlans.AsNoTracking()
            .Where(x => x.Id == plan.Id)
            .Select(PlanToDto)
            .FirstAsync();

        return Ok(dto);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Perm:PM_UPDATE")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] UpdateReq req)
    {
        if (req == null) return BadRequest("req null");

        // Validate basic inputs
        var name = (req.Name ?? "").Trim();
        if (name.Length < 2) return BadRequest("name too short");

        // Use a transaction + pessimistic locking (SELECT FOR UPDATE) to serialize edits.
        // This prevents "DbUpdateConcurrencyException" on child items because
        // the second request will wait for the first to commit.
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            // 1. Lock the row
            // We use a raw query to acquire the lock. 
            // Postgres syntax: SELECT 1 FROM "PmPlans" WHERE "Id" = @id FOR UPDATE
            await _db.Database.ExecuteSqlRawAsync(
                "SELECT 1 FROM \"PmPlans\" WHERE \"Id\" = {0} FOR UPDATE", id);

            // 2. Load entity (now we own the lock)
            var plan = await _db.PmPlans
                .Include(p => p.Items)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (plan == null) return NotFound();

            // validate asset (if changed)
            if (plan.AssetId != req.AssetId)
            {
                var ok = await _db.Assets.AsNoTracking()
                    .AnyAsync(a => a.Id == req.AssetId && a.IsAct);
                if (!ok) return BadRequest("bad assetId");
            }

            // normalize time
            DateTimeOffset validUtc;
            if (req.NextDueAt.HasValue)
            {
                validUtc = await NormalizeScheduleTime(req.NextDueAt.Value);
            }
            else
            {
                validUtc = plan.NextDueAt;
            }

            // 4. Update parent
            plan.Name = name;
            plan.AssetId = req.AssetId;
            plan.Frequency = req.Frequency;
            plan.NextDueAt = validUtc;
            plan.IsAct = req.IsAct;

            // 5. Update items (Full Replace)
            // Since we have a lock, no one else can be deleting/adding items to THIS plan right now.
            _db.PmPlanItems.RemoveRange(plan.Items);
            
            if (req.Items != null && req.Items.Count > 0)
            {
                var newItems = req.Items.Select((text, idx) => new PmPlanItem
                {
                    PmPlanId = plan.Id,
                    Text = text,
                    Sort = idx
                }).ToList();
                _db.PmPlanItems.AddRange(newItems);
            }

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            var dto = await _db.PmPlans.AsNoTracking()
                .Where(x => x.Id == plan.Id)
                .Select(PlanToDto)
                .FirstAsync();

            return Ok(dto);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            Console.WriteLine($"Error updating plan {id}: {ex}");
            // Use 500 for unexpected errors; 
            return StatusCode(500, new { message = "Eroare interna la salvare: " + ex.Message });
        }
    }

    // Manual generator: creeaza WO Preventive pentru planurile scadente
    [HttpPost("generate-due")]
    [Authorize(Policy = "Perm:PM_EXECUTE")]
    public async Task<IActionResult> GenerateDue([FromQuery] int take = 200)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        var count = await _scheduler.GenerateDuePlans(take, User.Identity?.Name ?? "Manual");
        
        return Ok(new GenerateResp(count, 0)); // UpdatedPlans logic is internal now
    }
}
