using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/people")]
[Authorize]
public class PeopleController : ControllerBase
{
    private readonly AppDbContext _db;
    public PeopleController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int take = 200)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;
        var items = await _db.People.AsNoTracking().OrderBy(x => x.DisplayName).Take(take).ToListAsync();
        return Ok(items);
    }

    public record CreateReq(string DisplayName);

    [HttpPost]
    public async Task<IActionResult> Create(CreateReq req)
    {
        var n = (req.DisplayName ?? "").Trim();
        if (n.Length < 2) return BadRequest("displayName too short");

        var p = new Person { DisplayName = n };
        _db.People.Add(p);
        await _db.SaveChangesAsync();
        return Ok(p);
    }
}
