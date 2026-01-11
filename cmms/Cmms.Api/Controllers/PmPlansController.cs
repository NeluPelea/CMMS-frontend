using Cmms.Domain;
using Cmms.Infrastructure;
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
    public PmPlansController(AppDbContext db) => _db = db;

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

    private static DateTimeOffset NextAfterBump(DateTimeOffset currentUtc, PmFrequency f)
    {
        // currentUtc trebuie sa fie UTC
        return f switch
        {
            PmFrequency.Daily => currentUtc.AddDays(1),
            PmFrequency.Weekly => currentUtc.AddDays(7),
            _ => currentUtc.AddMonths(1)
        };
    }

    // ---------------- Endpoints ----------------

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid? assetId = null, [FromQuery] int take = 200)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        var qry = _db.PmPlans.AsNoTracking()
            .Where(x => x.IsAct)
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

    [HttpPost]
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
        var nextDueAtUtc = Utc(req.NextDueAt ?? UtcNow());

        var plan = new PmPlan
        {
            AssetId = req.AssetId,
            Name = name,
            Frequency = req.Frequency,
            NextDueAt = nextDueAtUtc,
            IsAct = true
        };

        // items
        if (req.Items != null)
        {
            var i = 0;
            foreach (var t in req.Items.Select(x => (x ?? "").Trim()).Where(x => x.Length > 0))
            {
                // OPTIONAL: limit length to keep DB sane
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

        // return DTO (no cycles)
        var dto = await _db.PmPlans.AsNoTracking()
            .Where(x => x.Id == plan.Id)
            .Select(PlanToDto)
            .FirstAsync();

        return Ok(dto);
    }

    // Manual generator: creeaza WO Preventive pentru planurile scadente
    [HttpPost("generate-due")]
    public async Task<IActionResult> GenerateDue([FromQuery] int take = 200)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        var now = UtcNow();

        // luam planurile scadente
        var duePlans = await _db.PmPlans
            .Include(x => x.Items) // avem nevoie de items pentru descriere
            .Where(x => x.IsAct && x.NextDueAt <= now)
            .OrderBy(x => x.NextDueAt)
            .Take(take)
            .ToListAsync();

        var created = 0;

        foreach (var p in duePlans)
        {
            // Description din checklist
            var desc = (p.Items == null || p.Items.Count == 0)
                ? null
                : string.Join("\n", p.Items.OrderBy(i => i.Sort).Select(i => "- " + i.Text));

            var wo = new WorkOrder
            {
                Title = $"PM: {p.Name}",
                Description = desc,
                Type = WorkOrderType.Preventive,
                Status = WorkOrderStatus.Open,
                AssetId = p.AssetId,
                PmPlanId = p.Id
            };

            _db.WorkOrders.Add(wo);
            created++;

            // bump NextDueAt; asiguram UTC
            p.NextDueAt = NextAfterBump(Utc(p.NextDueAt), p.Frequency);
        }

        await _db.SaveChangesAsync();

        return Ok(new GenerateResp(created, duePlans.Count));
    }
}
