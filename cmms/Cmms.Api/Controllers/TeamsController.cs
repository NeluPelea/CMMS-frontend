using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/teams")]
[Authorize]
public sealed class TeamsController : ControllerBase
{
    private readonly AppDbContext _db;

    public TeamsController(AppDbContext db) => _db = db;

    public sealed record TeamMemberDto(Guid PersonId, string DisplayName);
    public sealed record TeamDto(Guid Id, string Name, string? Description, List<TeamMemberDto> Members);

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var teams = await _db.Teams.AsNoTracking()
            .Where(t => t.IsActive)
            .Include(t => t.Members)
            .ThenInclude(m => m.Person)
            .OrderBy(t => t.Name)
            .ToListAsync();

        var dtos = teams.Select(t => new TeamDto(
            t.Id,
            t.Name,
            t.Description,
            t.Members
                .Where(m => m.IsActive && m.Person.IsActive)
                .Select(m => new TeamMemberDto(m.Person.Id, m.Person.DisplayName))
                .ToList()
        ));

        return Ok(dtos);
    }
}
