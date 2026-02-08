using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/roles")]
[Authorize]
public sealed class RolesController : ControllerBase
{
    private readonly AppDbContext _db;
    public RolesController(AppDbContext db) => _db = db;

    // GET /api/roles?take=200&includeInactive=0&q=...
    [HttpGet]
    public async Task<ActionResult<List<RoleDto>>> List(
        [FromQuery] int take = 200,
        [FromQuery] int includeInactive = 0,
        [FromQuery] string? q = null,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 500);
        q = (q ?? "").Trim();

        var query = _db.AssignmentRoles.AsNoTracking();

        if (includeInactive == 0)
            query = query.Where(r => r.IsActive);

        if (q.Length > 0)
            query = query.Where(r => r.Name.Contains(q));

        var items = await query
            .OrderBy(r => r.Name)
            .Take(take)
            .Select(r => new RoleDto
            {
                Id = r.Id,
                Name = r.Name,
                IsActive = r.IsActive
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    // POST /api/roles
    [HttpPost]
    public async Task<ActionResult<RoleDto>> Create([FromBody] CreateRoleReq req, CancellationToken ct)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length < 2) return BadRequest("name too short.");

        var exists = await _db.AssignmentRoles.AnyAsync(x => x.Name == name, ct);
        if (exists) return Conflict("Role name already exists.");

        var role = new AssignmentRole
        {
            Id = Guid.NewGuid(),
            Name = name,
            IsActive = true
        };

        _db.AssignmentRoles.Add(role);
        await _db.SaveChangesAsync(ct);

        return Ok(new RoleDto { Id = role.Id, Name = role.Name, IsActive = role.IsActive });
    }

    // PUT /api/roles/{id}
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<RoleDto>> Update(Guid id, [FromBody] UpdateRoleReq req, CancellationToken ct)
    {
        var role = await _db.AssignmentRoles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (role == null) return NotFound();

        var name = (req.Name ?? "").Trim();
        if (name.Length < 2) return BadRequest("name too short.");

        var exists = await _db.AssignmentRoles.AnyAsync(x => x.Id != id && x.Name == name, ct);
        if (exists) return Conflict("Role name already exists.");

        role.Name = name;
        role.IsActive = req.IsActive;

        await _db.SaveChangesAsync(ct);

        return Ok(new RoleDto { Id = role.Id, Name = role.Name, IsActive = role.IsActive });
    }

    [HttpPost("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken ct)
    {
        var role = await _db.AssignmentRoles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (role == null) return NotFound();
        role.IsActive = true;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct)
    {
        var role = await _db.AssignmentRoles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (role == null) return NotFound();
        role.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // DTOs
    public sealed class RoleDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = "";
        public bool IsActive { get; set; }
    }

    public sealed class CreateRoleReq
    {
        public string? Name { get; set; }
    }

    public sealed class UpdateRoleReq
    {
        public string? Name { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
