using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/as")]
[Authorize]
public class AssetsController : ControllerBase
{
    private readonly AppDbContext _db;
    public AssetsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q = null, [FromQuery] Guid? locId = null, [FromQuery] int take = 200, [FromQuery] bool ia = false)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        var qry = _db.Assets.AsNoTracking()
            .Include(a => a.Location)
            .AsQueryable();

        if (!ia) qry = qry.Where(x => x.IsAct);
        if (locId.HasValue) qry = qry.Where(x => x.LocationId == locId.Value);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLower();
            qry = qry.Where(x =>
                x.Name.ToLower().Contains(s) ||
                (x.Code != null && x.Code.ToLower().Contains(s)) ||
                (x.Location != null && x.Location.Name.ToLower().Contains(s))
            );
        }

        var items = await qry.OrderBy(x => x.Name).Take(take).ToListAsync();

        // flatten pentru UI
        var dto = items.Select(x => new
        {
            id = x.Id,
            name = x.Name,
            code = x.Code,
            locId = x.LocationId,
            locName = x.Location != null ? x.Location.Name : null,
            isAct = x.IsAct
        });

        return Ok(dto);
    }

    public record CreateReq(string Name, string? Code, Guid? LocId);

    [HttpPost]
    public async Task<IActionResult> Create(CreateReq req)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length < 2) return BadRequest("name too short");

        if (req.LocId.HasValue)
        {
            var ok = await _db.Locations.AsNoTracking().AnyAsync(l => l.Id == req.LocId.Value && l.IsAct);
            if (!ok) return BadRequest("bad locId");
        }

        var x = new Asset
        {
            Name = name,
            Code = string.IsNullOrWhiteSpace(req.Code) ? null : req.Code.Trim(),
            LocationId = req.LocId
        };

        _db.Assets.Add(x);
        await _db.SaveChangesAsync();

        return Ok(new { id = x.Id, name = x.Name, code = x.Code, locId = x.LocationId, locName = (string?)null, isAct = x.IsAct });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> SoftDelete(Guid id)
    {
        var x = await _db.Assets.FirstOrDefaultAsync(a => a.Id == id);
        if (x == null) return NotFound();
        x.IsAct = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
