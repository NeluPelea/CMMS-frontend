using System.Linq.Expressions;
using Cmms.Api.Contracts.Common;
using Cmms.Api.Contracts.People;
using Cmms.Api.Services;
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
    private const int MinTake = 1;
    private const int MaxTake = 200;

    private static readonly TimeSpan DefaultMonFriStart = new(8, 0, 0);
    private static readonly TimeSpan DefaultMonFriEnd = new(16, 30, 0);
    private const string DefaultTimezone = "Europe/Bucharest";

    private readonly AppDbContext _db;
    private readonly PeopleAvailability _availability;

    public PeopleController(AppDbContext db, PeopleAvailability availability)
    {
        _db = db;
        _availability = availability;
    }

    // GET /api/people?take=50&skip=0&q=...&includeInactive=false
    [HttpGet]
    public async Task<ActionResult<Paged<PersonDto>>> List(
        [FromQuery] int take = 50,
        [FromQuery] int skip = 0,
        [FromQuery] string? q = null,
        [FromQuery] bool includeInactive = false,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, MinTake, MaxTake);
        skip = Math.Max(0, skip);

        IQueryable<Person> baseQ = _db.People.AsNoTracking();

        if (!includeInactive)
            baseQ = baseQ.Where(p => p.IsActive);

        q = (q ?? "").Trim();
        if (q.Length > 0)
        {
            var pattern = $"%{q}%";
            baseQ = baseQ.Where(p =>
                EF.Functions.ILike(p.FullName ?? "", pattern) ||
                EF.Functions.ILike(p.DisplayName ?? "", pattern) ||
                EF.Functions.ILike(p.JobTitle ?? "", pattern) ||
                EF.Functions.ILike(p.Specialization ?? "", pattern) ||
                EF.Functions.ILike(p.Phone ?? "", pattern) ||
                EF.Functions.ILike(p.Email ?? "", pattern));
        }

        var total = await baseQ.CountAsync(ct);

        // IMPORTANT: evitam N+1; facem LEFT JOIN cu schedule intr-un singur query.
        // Formatam ScheduleSummary in memorie ca sa nu depindem de traducerea EF pentru TimeSpan -> string.
        var rows = await (
            from p in baseQ
            join ws0 in _db.PersonWorkSchedules.AsNoTracking() on p.Id equals ws0.PersonId into wsg
            from ws in wsg.DefaultIfEmpty()
            orderby p.FullName, p.DisplayName
            select new
            {
                p.Id,
                p.FullName,
                p.DisplayName,
                p.JobTitle,
                p.Specialization,
                p.Phone,
                p.Email,
                p.IsActive,

                Ws = ws
            }
        )
        .Skip(skip)
        .Take(take)
        .ToListAsync(ct);

        var items = rows.Select(x =>
        {
            var dto = new PersonDto
            {
                Id = x.Id,
                FullName = x.FullName,
                DisplayName = x.DisplayName,
                JobTitle = x.JobTitle,
                Specialization = x.Specialization,
                Phone = x.Phone,
                Email = x.Email,
                IsActive = x.IsActive,

                // NEW
                HasCustomSchedule = HasCustomSchedule(x.Ws),
                ScheduleSummary = BuildScheduleSummary(x.Ws)
            };

            return dto;
        }).ToList();

        return Ok(new Paged<PersonDto>
        {
            Total = total,
            Take = take,
            Skip = skip,
            Items = items
        });
    }

    // GET /api/people/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PersonDetailsDto>> Get(Guid id, CancellationToken ct = default)
    {
        var p = await _db.People
            .Include(x => x.WorkSchedule)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (p is null) return NotFound("Person not found.");

        var todayUtc = DateOnly.FromDateTime(DateTime.UtcNow);
        var status = await GetCurrentStatusAsync(id, todayUtc, ct);

        return Ok(ToDetailsDto(p, status));
    }

    // GET /api/people/availability?fromUtc=...&toUtc=...
    [HttpGet("availability")]
    public async Task<ActionResult<List<PersonLiteDto>>> Availability(
        [FromQuery] DateTimeOffset fromUtc,
        [FromQuery] DateTimeOffset toUtc,
        CancellationToken ct = default)
    {
        if (!TryValidateSameUtcDay(fromUtc, toUtc, out var error))
            return BadRequest(error);

        var people = await _availability.ListAvailableAsync(fromUtc, toUtc, ct);

        var result = people
            .OrderBy(p => p.FullName)
            .ThenBy(p => p.DisplayName)
            .Select(ToLiteDto)
            .ToList();

        return Ok(result);
    }

    // GET /api/people/availability/details?fromUtc=...&toUtc=...&includeInactive=true
    [HttpGet("availability/details")]
    public async Task<ActionResult<List<PersonAvailabilityDto>>> AvailabilityDetails(
        [FromQuery] DateTimeOffset fromUtc,
        [FromQuery] DateTimeOffset toUtc,
        [FromQuery] bool includeInactive = true,
        CancellationToken ct = default)
    {
        if (!TryValidateSameUtcDay(fromUtc, toUtc, out var error))
            return BadRequest(error);

        IQueryable<Person> peopleQ = _db.People.AsNoTracking();
        if (!includeInactive)
            peopleQ = peopleQ.Where(p => p.IsActive);

        var people = await peopleQ
            .OrderBy(p => p.FullName)
            .ThenBy(p => p.DisplayName)
            .ToListAsync(ct);

        if (people.Count == 0)
            return Ok(new List<PersonAvailabilityDto>());

        var result = new List<PersonAvailabilityDto>(people.Count);

        foreach (var p in people)
        {
            if (!p.IsActive)
            {
                result.Add(ToAvailabilityDto(
                    p,
                    hrIsActive: false,
                    isAssignable: false,
                    status: "INACTIVE",
                    reason: "Person is inactive."));
                continue;
            }

            var can = await _availability.CanAssignAsync(p.Id, fromUtc, toUtc, ct);

            if (can.IsOk)
            {
                result.Add(ToAvailabilityDto(
                    p,
                    hrIsActive: true,
                    isAssignable: true,
                    status: "ACTIVE",
                    reason: null));
                continue;
            }

            result.Add(ToAvailabilityDto(
                p,
                hrIsActive: true,
                isAssignable: false,
                status: MapAvailabilityStatus(can.Reason),
                reason: can.Reason));
        }

        return Ok(result);
    }

    // POST /api/people
    [HttpPost]
    public async Task<ActionResult<PersonDto>> Create([FromBody] CreatePersonReq req, CancellationToken ct = default)
    {
        if (!NormalizeAndValidate(req, out var fullName, out var displayName, out var jobTitle,
                out var specialization, out var phone, out var email, out var isActive, out var error))
            return BadRequest(error);

        var p = new Person
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            DisplayName = displayName,
            JobTitle = jobTitle,
            Specialization = specialization,
            Phone = phone,
            Email = email,
            IsActive = isActive
        };

        _db.People.Add(p);

        // pastreaza comportamentul actual: schedule default creat automat
        _db.PersonWorkSchedules.Add(new PersonWorkSchedule
        {
            PersonId = p.Id,
            MonFriStart = DefaultMonFriStart,
            MonFriEnd = DefaultMonFriEnd,
            SatStart = null,
            SatEnd = null,
            SunStart = null,
            SunEnd = null,
            Timezone = DefaultTimezone
        });

        await _db.SaveChangesAsync(ct);

        // optional: aici nu incarcam schedule; ramanem compatibili
        var dto = ToPersonDto(p);
        dto.HasCustomSchedule = false;
        dto.ScheduleSummary = $"L-V {Fmt(DefaultMonFriStart)}-{Fmt(DefaultMonFriEnd)}; S -; D -";

        return CreatedAtAction(nameof(Get), new { id = p.Id }, dto);
    }

    // PUT /api/people/{id}
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PersonDto>> Update(Guid id, [FromBody] UpdatePersonReq req, CancellationToken ct = default)
    {
        var p = await _db.People.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound("Person not found.");

        if (!NormalizeAndValidate(req, out var fullName, out var displayName, out var jobTitle,
                out var specialization, out var phone, out var email, out var isActive, out var error))
            return BadRequest(error);

        p.FullName = fullName;
        p.DisplayName = displayName;
        p.JobTitle = jobTitle;
        p.Specialization = specialization;
        p.Phone = phone;
        p.Email = email;
        p.IsActive = isActive;

        await _db.SaveChangesAsync(ct);

        // nu atingem schedule aici (ramane prin /schedule)
        var dto = ToPersonDto(p);
        return Ok(dto);
    }

    [HttpPost("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken ct = default)
    {
        var p = await _db.People.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound("Person not found.");

        if (!p.IsActive)
        {
            p.IsActive = true;
            await _db.SaveChangesAsync(ct);
        }

        return NoContent();
    }

    [HttpPost("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct = default)
    {
        var p = await _db.People.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound("Person not found.");

        if (p.IsActive)
        {
            p.IsActive = false;
            await _db.SaveChangesAsync(ct);
        }

        return NoContent();
    }

    // ---------------- Helpers ----------------

    private static bool TryValidateSameUtcDay(DateTimeOffset fromUtc, DateTimeOffset toUtc, out string? error)
    {
        error = null;

        if (toUtc <= fromUtc)
        {
            error = "toUtc must be after fromUtc.";
            return false;
        }

        if (fromUtc.UtcDateTime.Date != toUtc.UtcDateTime.Date)
        {
            error = "Interval must be within the same UTC day (v1).";
            return false;
        }

        return true;
    }

    private async Task<string> GetCurrentStatusAsync(Guid personId, DateOnly day, CancellationToken ct)
    {
        var leave = await _db.PersonLeaves.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PersonId == personId && x.StartDate <= day && x.EndDate >= day, ct);

        if (leave is null) return "ACTIVE";
        return leave.Type == LeaveType.CO ? "CO" : "CM";
    }

    private static bool NormalizeAndValidate(
        CreatePersonReq req,
        out string fullName,
        out string displayName,
        out string jobTitle,
        out string specialization,
        out string phone,
        out string? email,
        out bool isActive,
        out string? error)
    {
        error = null;

        fullName = (req.FullName ?? "").Trim();
        if (fullName.Length < 3)
        {
            displayName = jobTitle = specialization = phone = "";
            email = null;
            isActive = req.IsActive;
            error = "Numele este prea scurt.";
            return false;
        }

        displayName = (req.DisplayName ?? fullName).Trim();
        if (displayName.Length < 2) displayName = fullName;

        jobTitle = (req.JobTitle ?? "").Trim();
        specialization = (req.Specialization ?? "").Trim();
        phone = (req.Phone ?? "").Trim();

        email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim();
        isActive = req.IsActive;

        if (email != null && email.Length > 200)
        {
            error = "Email prea lung.";
            return false;
        }

        return true;
    }

    private static PersonDto ToPersonDto(Person p) => new()
    {
        Id = p.Id,
        FullName = p.FullName,
        DisplayName = p.DisplayName,
        JobTitle = p.JobTitle,
        Specialization = p.Specialization,
        Phone = p.Phone,
        Email = p.Email,
        IsActive = p.IsActive
        // NOTE: schedule info se populeaza in List() unde avem join cu WorkSchedule
    };

    private static PersonLiteDto ToLiteDto(Person p) => new()
    {
        Id = p.Id,
        FullName = p.FullName,
        DisplayName = p.DisplayName
    };

    private static PersonAvailabilityDto ToAvailabilityDto(
        Person p,
        bool hrIsActive,
        bool isAssignable,
        string status,
        string? reason) => new()
        {
            Id = p.Id,
            FullName = p.FullName,
            DisplayName = p.DisplayName,
            JobTitle = p.JobTitle,
            Specialization = p.Specialization,
            Phone = p.Phone,
            Email = p.Email,
            HrIsActive = hrIsActive,
            IsActive = isAssignable,
            Status = status,
            Reason = reason
        };

    private static PersonDetailsDto ToDetailsDto(Person p, string status) => new()
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
        Schedule = p.WorkSchedule == null ? null : ToScheduleDto(p.WorkSchedule)
    };

    private static PersonScheduleDto ToScheduleDto(PersonWorkSchedule s) => new()
    {
        MonFriStartMinutes = (int)s.MonFriStart.TotalMinutes,
        MonFriEndMinutes = (int)s.MonFriEnd.TotalMinutes,
        SatStartMinutes = s.SatStart.HasValue ? (int)s.SatStart.Value.TotalMinutes : (int?)null,
        SatEndMinutes = s.SatEnd.HasValue ? (int)s.SatEnd.Value.TotalMinutes : (int?)null,
        SunStartMinutes = s.SunStart.HasValue ? (int)s.SunStart.Value.TotalMinutes : (int?)null,
        SunEndMinutes = s.SunEnd.HasValue ? (int)s.SunEnd.Value.TotalMinutes : (int?)null,
        Timezone = s.Timezone
    };

    private static bool HasCustomSchedule(PersonWorkSchedule? ws)
    {
        if (ws == null) return false;

        return
            ws.MonFriStart != DefaultMonFriStart ||
            ws.MonFriEnd != DefaultMonFriEnd ||
            ws.SatStart != null ||
            ws.SatEnd != null ||
            ws.SunStart != null ||
            ws.SunEnd != null ||
            !string.Equals(ws.Timezone, DefaultTimezone, StringComparison.Ordinal);
    }

    private static string? BuildScheduleSummary(PersonWorkSchedule? ws)
    {
        if (ws == null) return null;

        return
            $"L-V {Fmt(ws.MonFriStart)}-{Fmt(ws.MonFriEnd)}; " +
            $"S {FmtOpt(ws.SatStart)}-{FmtOpt(ws.SatEnd)}; " +
            $"D {FmtOpt(ws.SunStart)}-{FmtOpt(ws.SunEnd)}";
    }

    private static string Fmt(TimeSpan t)
        => $"{(int)t.TotalHours:00}:{t.Minutes:00}";

    private static string FmtOpt(TimeSpan? t)
        => t.HasValue ? Fmt(t.Value) : "-";

    // Mapping STRICT pe string-urile din PeopleAvailability (as-is)
    private static string MapAvailabilityStatus(string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason)) return "UNAVAILABLE";

        if (reason.Equals("Person not found.", StringComparison.OrdinalIgnoreCase)) return "NOT_FOUND";
        if (reason.Equals("Person is inactive.", StringComparison.OrdinalIgnoreCase)) return "INACTIVE";
        if (reason.Equals("Person has no work schedule.", StringComparison.OrdinalIgnoreCase)) return "NO_SCHEDULE";

        if (reason.StartsWith("Invalid timezone", StringComparison.OrdinalIgnoreCase)) return "BAD_TIMEZONE";

        if (reason.Equals("Interval must be within the same local day (v1).", StringComparison.OrdinalIgnoreCase)) return "CROSS_DAY";
        if (reason.Equals("plannedTo must be after plannedFrom.", StringComparison.OrdinalIgnoreCase)) return "BAD_INTERVAL";

        if (reason.Equals("Date is a national holiday or company blackout day.", StringComparison.OrdinalIgnoreCase)) return "COMPANY_CLOSED";

        if (reason.Equals("Person is on leave (CO/CM).", StringComparison.OrdinalIgnoreCase)) return "LEAVE";

        if (reason.Equals("Outside working hours.", StringComparison.OrdinalIgnoreCase)) return "OUTSIDE_HOURS";

        if (reason.Equals("No Saturday schedule.", StringComparison.OrdinalIgnoreCase)) return "NO_SATURDAY";
        if (reason.Equals("No Sunday schedule.", StringComparison.OrdinalIgnoreCase)) return "NO_SUNDAY";

        return "UNAVAILABLE";
    }

    // pastrat: poate fi folosit in alte locuri / viitor; nu mai e folosit in List()
    private static readonly Expression<Func<Person, PersonDto>> ToPersonDtoExpr =
        p => new PersonDto
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
