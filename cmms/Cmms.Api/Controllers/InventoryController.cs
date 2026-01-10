using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/inv")]
[Authorize]
public class InventoryController : ControllerBase
{
    private readonly AppDbContext _db;
    public InventoryController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q = null, [FromQuery] int take = 200)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        var qry = _db.Inventory.AsNoTracking()
            .Include(x => x.Part)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLower();
            qry = qry.Where(x => x.Part != null && (x.Part.Name.ToLower().Contains(s) || (x.Part.Code != null && x.Part.Code.ToLower().Contains(s))));
        }

        var items = await qry.OrderBy(x => x.Part!.Name).Take(take).ToListAsync();

        var dto = items.Select(x => new
        {
            id = x.Id,
            partId = x.PartId,
            partName = x.Part != null ? x.Part.Name : "",
            partCode = x.Part != null ? x.Part.Code : null,
            uom = x.Part != null ? x.Part.Uom : null,
            qtyOnHand = x.QtyOnHand,
            minQty = x.MinQty
        });

        return Ok(dto);
    }

    public record AdjustReq(decimal Delta);

    [HttpPost("{id:guid}/adjust")]
    public async Task<IActionResult> Adjust(Guid id, AdjustReq req)
    {
        var it = await _db.Inventory.FirstOrDefaultAsync(x => x.Id == id);
        if (it == null) return NotFound();

        it.QtyOnHand += req.Delta;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
