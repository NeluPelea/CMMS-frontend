using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/parts")]
[Authorize]
public class PartsController : ControllerBase
{
    private readonly AppDbContext _db;
    public PartsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q = null, [FromQuery] int take = 200, [FromQuery] bool ia = false)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        var qry = _db.Parts.AsNoTracking().AsQueryable();
        if (!ia) qry = qry.Where(x => x.IsAct);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLower();
            qry = qry.Where(x => x.Name.ToLower().Contains(s) || (x.Code != null && x.Code.ToLower().Contains(s)));
        }

        var items = await qry.OrderBy(x => x.Name).Take(take).ToListAsync();
        return Ok(items);
    }

    public record CreateReq(string Name, string? Code, string? Uom);

    [HttpPost]
    public async Task<IActionResult> Create(CreateReq req)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length < 2) return BadRequest("name too short");

        var p = new Part
        {
            Name = name,
            Code = string.IsNullOrWhiteSpace(req.Code) ? null : req.Code.Trim(),
            Uom = string.IsNullOrWhiteSpace(req.Uom) ? null : req.Uom.Trim()
        };

        _db.Parts.Add(p);

        // creeaza automat si inventarul pentru piesa
        _db.Inventory.Add(new InventoryItem { PartId = p.Id, QtyOnHand = 0m });

        await _db.SaveChangesAsync();
        return Ok(p);
    }
}
