using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/people")]
[Authorize]
public sealed class PeopleController : ControllerBase
{
    private readonly AppDbContext _db;
    public PeopleController(AppDbContext db) => _db = db;

    // Listare paginata + cautare + filtru inactivi
    [HttpGet]
    public async Task<ActionResult<Paged<PersonDto>>> List(
        [FromQuery] int take = 50,
        [FromQuery] int skip = 0,
        [FromQuery] string? q = null,
        [FromQuery] bool includeInactive = false, // Am schimbat din int in bool
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 200);
        skip = Math.Max(0, skip);
        q = (q ?? "").Trim();

        var query = _db.People.AsNoTracking();

        // Aplicare filtru inactivi
        if (!includeInactive)
            query = query.Where(p => p.IsActive);

        if (q.Length > 0)
        {
            var qq = q.ToLower();

            query = query.Where(p =>
                (p.FullName ?? "").ToLower().Contains(qq) ||
                (p.DisplayName ?? "").ToLower().Contains(qq) ||
                (p.JobTitle ?? "").ToLower().Contains(qq) ||
                (p.Specialization ?? "").ToLower().Contains(qq) ||
                (p.Phone ?? "").ToLower().Contains(qq) ||
                ((p.Email ?? "").ToLower().Contains(qq)));
        }

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderBy(p => p.FullName)
            .Skip(skip)
            .Take(take)
            .Select(p => new PersonDto
            {
                Id = p.Id,
                FullName = p.FullName,
                DisplayName = p.DisplayName,
                JobTitle = p.JobTitle,
                Specialization = p.Specialization,
                Phone = p.Phone,
                Email = p.Email,
                IsActive = p.IsActive
            })
            .ToListAsync(ct);

        return new Paged<PersonDto> { Total = total, Take = take, Skip = skip, Items = items };
    }

    // Detalii persoana (include program + status)
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PersonDetailsDto>> Get(Guid id, CancellationToken ct)
    {
        var p = await _db.People
            .Include(x => x.WorkSchedule)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (p == null) return NotFound();

        var status = await GetCurrentStatusAsync(id, DateTime.UtcNow.Date, ct);

        return new PersonDetailsDto
        {
            Id = p.Id,
            FullName = p.FullName,
            DisplayName = p.DisplayName,
            JobTitle = p.JobTitle,
            Specialization = p.Specialization,
            Phone = p.Phone,
            Email = p.Email,
            IsActive = p.IsActive,
            CurrentStatus = status,
            Schedule = p.WorkSchedule == null ? null : new PersonScheduleDto
            {
                MonFriStartMinutes = (int)p.WorkSchedule.MonFriStart.TotalMinutes,
                MonFriEndMinutes = (int)p.WorkSchedule.MonFriEnd.TotalMinutes,
                SatStartMinutes = p.WorkSchedule.SatStart.HasValue ? (int)p.WorkSchedule.SatStart.Value.TotalMinutes : (int?)null,
                SatEndMinutes = p.WorkSchedule.SatEnd.HasValue ? (int)p.WorkSchedule.SatEnd.Value.TotalMinutes : (int?)null,
                Timezone = p.WorkSchedule.Timezone
            }
        };
    }

    [HttpPost]
    public async Task<ActionResult<PersonDto>> Create([FromBody] CreatePersonReq req, CancellationToken ct)
    {
        var fullName = (req.FullName ?? "").Trim();
        if (fullName.Length < 3) return BadRequest("Numele este prea scurt.");

        var display = (req.DisplayName ?? fullName).Trim();
        if (display.Length < 2) display = fullName;

        var p = new Person
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            DisplayName = display,
            JobTitle = (req.JobTitle ?? "").Trim(),
            Specialization = (req.Specialization ?? "").Trim(),
            Phone = (req.Phone ?? "").Trim(),
            Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim(),
            IsActive = req.IsActive
        };

        _db.People.Add(p);

        // Program implicit (L-V 08:00-16:30)
        _db.PersonWorkSchedules.Add(new PersonWorkSchedule
        {
            PersonId = p.Id,
            MonFriStart = new TimeSpan(8, 0, 0),
            MonFriEnd = new TimeSpan(16, 30, 0),
            SatStart = null,
            SatEnd = null,
            Timezone = "Europe/Bucharest"
        });

        await _db.SaveChangesAsync(ct);

        var dto = new PersonDto
        {
            Id = p.Id,
            FullName = p.FullName,
            DisplayName = p.DisplayName,
            JobTitle = p.JobTitle,
            Specialization = p.Specialization,
            Phone = p.Phone,
            Email = p.Email,
            IsActive = p.IsActive
        };

        return CreatedAtAction(nameof(Get), new { id = p.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PersonDto>> Update(Guid id, [FromBody] UpdatePersonReq req, CancellationToken ct)
    {
        var p = await _db.People.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p == null) return NotFound();

        var fullName = (req.FullName ?? "").Trim();
        if (fullName.Length < 3) return BadRequest("Numele este prea scurt.");

        p.FullName = fullName;

        var display = (req.DisplayName ?? fullName).Trim();
        p.DisplayName = display.Length >= 2 ? display : fullName;

        p.JobTitle = (req.JobTitle ?? "").Trim();
        p.Specialization = (req.Specialization ?? "").Trim();
        p.Phone = (req.Phone ?? "").Trim();
        p.Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim();
        p.IsActive = req.IsActive;

        await _db.SaveChangesAsync(ct);

        return new PersonDto
        {
            Id = p.Id,
            FullName = p.FullName,
            DisplayName = p.DisplayName,
            JobTitle = p.JobTitle,
            Specialization = p.Specialization,
            Phone = p.Phone,
            Email = p.Email,
            IsActive = p.IsActive
        };
    }

    [HttpPost("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken ct)
    {
        var p = await _db.People.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p == null) return NotFound();
        p.IsActive = true;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct)
    {
        var p = await _db.People.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p == null) return NotFound();
        p.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---------- Helpers ----------

    private async Task<string> GetCurrentStatusAsync(Guid personId, DateTime dayUtc, CancellationToken ct)
    {
        var d = DateTime.SpecifyKind(dayUtc.Date, DateTimeKind.Utc);

        var leave = await _db.PersonLeaves.AsNoTracking()
            .Where(x => x.PersonId == personId && x.StartDate <= d && x.EndDate >= d)
            .FirstOrDefaultAsync(ct);

        if (leave == null) return "ACTIVE";
        return leave.Type == LeaveType.CO ? "CO" : "CM";
    }

    // ---------- DTOs ----------

    public sealed class Paged<T>
    {
        public int Total { get; set; }
        public int Take { get; set; }
        public int Skip { get; set; }
        public List<T> Items { get; set; } = new();
    }

    public class PersonDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string JobTitle { get; set; } = "";
        public string Specialization { get; set; } = "";
        public string Phone { get; set; } = "";
        public string? Email { get; set; }
        public bool IsActive { get; set; }
    }

    public sealed class PersonDetailsDto : PersonDto
    {
        public string CurrentStatus { get; set; } = "ACTIVE";
        public PersonScheduleDto? Schedule { get; set; }
    }

    public sealed class PersonScheduleDto
    {
        public int MonFriStartMinutes { get; set; }
        public int MonFriEndMinutes { get; set; }
        public int? SatStartMinutes { get; set; }
        public int? SatEndMinutes { get; set; }
        public string Timezone { get; set; } = "Europe/Bucharest";
    }

    public class CreatePersonReq
    {
        public string? FullName { get; set; }
        public string? DisplayName { get; set; }
        public string? JobTitle { get; set; }
        public string? Specialization { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public sealed class UpdatePersonReq : CreatePersonReq { }
}