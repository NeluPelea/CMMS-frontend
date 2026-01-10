using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/pm-plans")]
[Authorize]
public class PmPlansController : ControllerBase
{
    private readonly AppDbContext _db;
    public PmPlansController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid? assetId = null, [FromQuery] int take = 200)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        var qry = _db.PmPlans.AsNoTracking()
            .Include(x => x.Asset)
            .Include(x => x.Items)
            .Where(x => x.IsAct)
            .AsQueryable();

        if (assetId.HasValue) qry = qry.Where(x => x.AssetId == assetId.Value);

        var items = await qry.OrderBy(x => x.NextDueAt).Take(take).ToListAsync();
        return Ok(items);
    }

    public record CreateReq(Guid AssetId, string Name, PmFrequency Frequency, DateTimeOffset? NextDueAt, List<string>? Items);

    [HttpPost]
    public async Task<IActionResult> Create(CreateReq req)
    {
        var ok = await _db.Assets.AsNoTracking().AnyAsync(a => a.Id == req.AssetId && a.IsAct);
        if (!ok) return BadRequest("bad assetId");

        var name = (req.Name ?? "").Trim();
        if (name.Length < 2) return BadRequest("name too short");

        var plan = new PmPlan
        {
            AssetId = req.AssetId,
            Name = name,
            Frequency = req.Frequency,
            NextDueAt = (req.NextDueAt ?? DateTimeOffset.UtcNow).ToUniversalTime(),
            IsAct = true
        };

        if (req.Items != null)
        {
            var i = 0;
            foreach (var t in req.Items.Where(x => !string.IsNullOrWhiteSpace(x)))
            {
                plan.Items.Add(new PmPlanItem { Text = t.Trim(), Sort = i++ });
            }
        }

        _db.PmPlans.Add(plan);
        await _db.SaveChangesAsync();
        return Ok(plan);
    }

    // Manual generator: creeaza WO Preventive pentru planurile scadente
    [HttpPost("generate-due")]
    public async Task<IActionResult> GenerateDue()
    {
        var now = DateTimeOffset.UtcNow;

        var duePlans = await _db.PmPlans
            .Include(x => x.Items)
            .Where(x => x.IsAct && x.NextDueAt <= now)
            .ToListAsync();

        var created = 0;

        foreach (var p in duePlans)
        {
            var desc = p.Items.Count == 0
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

            // bump NextDueAt
            p.NextDueAt = p.Frequency switch
            {
                PmFrequency.Daily => p.NextDueAt.AddDays(1),
                PmFrequency.Weekly => p.NextDueAt.AddDays(7),
                _ => p.NextDueAt.AddMonths(1)
            };
        }

        await _db.SaveChangesAsync();
        return Ok(new { created });
    }
}
