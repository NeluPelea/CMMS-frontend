using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public sealed class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ReportsController(AppDbContext db) => _db = db;

    public sealed record LaborReportItem(
        Guid PersonId,
        string PersonName,
        int TotalMinutes,
        int WorkOrderCount
    );

    public sealed record PartReportItem(
        Guid PartId,
        string PartName,
        string? PartCode,
        decimal TotalQty,
        int WorkOrderCount
    );

    [HttpGet("labor")]
    public async Task<ActionResult<List<LaborReportItem>>> GetLabor(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null)
    {
        var q = _db.WorkOrderLaborLogs.AsNoTracking();

        if (from.HasValue) q = q.Where(x => x.CreatedAt >= from.Value);
        if (to.HasValue) q = q.Where(x => x.CreatedAt <= to.Value);

        var data = await q
            .GroupBy(x => new { x.PersonId, x.Person!.DisplayName })
            .Select(g => new
            {
                g.Key.PersonId,
                PersonName = g.Key.DisplayName,
                TotalMinutes = g.Sum(x => x.Minutes),
                WoCount = g.Select(x => x.WorkOrderId).Distinct().Count()
            })
            .OrderByDescending(x => x.TotalMinutes)
            .ToListAsync();

        return Ok(data.Select(x => new LaborReportItem(
            x.PersonId,
            x.PersonName ?? "Unknown",
            x.TotalMinutes,
            x.WoCount
        )));
    }

    [HttpGet("parts")]
    public async Task<ActionResult<List<PartReportItem>>> GetParts(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null)
    {
        IQueryable<WorkOrderPart> q = _db.WorkOrderParts.AsNoTracking().Include(x => x.WorkOrder).Include(x => x.Part);

        // Filter by WorkOrder dates
        if (from.HasValue) q = q.Where(x => x.WorkOrder!.CreatedAt >= from.Value);
        if (to.HasValue) q = q.Where(x => x.WorkOrder!.CreatedAt <= to.Value);

        var data = await q
            .GroupBy(x => new { x.PartId, x.Part!.Name, x.Part.Code })
            .Select(g => new
            {
                g.Key.PartId,
                PartName = g.Key.Name,
                PartCode = g.Key.Code,
                TotalQty = g.Sum(x => x.QtyUsed),
                WoCount = g.Select(x => x.WorkOrderId).Distinct().Count()
            })
            .OrderByDescending(x => x.TotalQty)
            .ToListAsync();

        return Ok(data.Select(x => new PartReportItem(
            x.PartId,
            x.PartName ?? "Unknown",
            x.PartCode,
            x.TotalQty,
            x.WoCount
        )));
    }
}
