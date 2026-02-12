using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/locs")]
[Authorize]
public sealed class LocsController : ControllerBase
{
    private readonly AppDbContext _db;
    public LocsController(AppDbContext db) => _db = db;

    public sealed record LocDto(Guid Id, string Name, string? Code, bool IsAct);
    public sealed record CreateReq(string Name, string? Code);
    public sealed record UpdateReq(string Name, string? Code);

    // GET /api/locs?q=...&take=200&ia=true|false
    [HttpGet]
    [Authorize(Policy = "Perm:LOC_READ")]
    public async Task<IActionResult> List(
        [FromQuery] string? q = null,
        [FromQuery] int take = 200,
        [FromQuery] bool ia = false
    )
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        // Folosim _db (așa cum l-ai definit în constructor)
        var qry = _db.Locations.AsNoTracking().AsQueryable();

        if (!ia)
            qry = qry.Where(x => x.IsAct);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim();
            qry = qry.Where(x =>
                (x.Name != null && EF.Functions.ILike(x.Name, $"%{s}%")) ||
                (x.Code != null && EF.Functions.ILike(x.Code, $"%{s}%"))
            );
        }

        var items = await qry
            .OrderBy(x => x.Name)
            .Take(take)
            // Constructorul de record folosește paranteze rotunde, nu acolade
            .Select(x => new LocDto(x.Id, x.Name, x.Code, x.IsAct))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    [Authorize(Policy = "Perm:LOC_CREATE")]
    public async Task<IActionResult> Create([FromBody] CreateReq req)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length < 2) return BadRequest("name too short");

        var code = string.IsNullOrWhiteSpace(req.Code) ? null : req.Code.Trim();
        if (code != null && code.Length > 40) return BadRequest("code too long");

        if (code != null)
        {
            var exists = await _db.Locations.AsNoTracking().AnyAsync(x => x.Code == code);
            if (exists) return Conflict("code exists");
        }

        var loc = new Location
        {
            Name = name,
            Code = code,
            IsAct = true
        };

        _db.Locations.Add(loc);
        await _db.SaveChangesAsync();

        return Ok(new LocDto(loc.Id, loc.Name, loc.Code, loc.IsAct));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Perm:LOC_UPDATE")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReq req)
    {
        var loc = await _db.Locations.FirstOrDefaultAsync(x => x.Id == id);
        if (loc == null) return NotFound();

        var name = (req.Name ?? "").Trim();
        if (name.Length < 2) return BadRequest("name too short");

        var code = string.IsNullOrWhiteSpace(req.Code) ? null : req.Code.Trim();
        if (code != null && code.Length > 40) return BadRequest("code too long");

        if (code != null)
        {
            var exists = await _db.Locations.AsNoTracking()
                .AnyAsync(x => x.Id != id && x.Code == code);
            if (exists) return Conflict("code exists");
        }

        loc.Name = name;
        loc.Code = code;

        await _db.SaveChangesAsync();

        return Ok(new LocDto(loc.Id, loc.Name, loc.Code, loc.IsAct));
    }

    // soft delete
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Perm:LOC_DELETE")]
    public async Task<IActionResult> SoftDelete(Guid id)
    {
        var loc = await _db.Locations.FirstOrDefaultAsync(x => x.Id == id);
        if (loc == null) return NotFound();

        loc.IsAct = false;
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
