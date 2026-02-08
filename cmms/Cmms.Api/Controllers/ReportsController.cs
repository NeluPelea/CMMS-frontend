using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Cmms.Domain;
using Cmms.Infrastructure;
using Cmms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QuestPDF.Previewer;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public sealed class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly IUnitScheduleService _unitSchedule;

    public ReportsController(AppDbContext db, IWebHostEnvironment env, IUnitScheduleService unitSchedule) 
    {
        _db = db;
        _env = env;
        _unitSchedule = unitSchedule;
    }

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

    [HttpGet("debug-proactive")]
    public async Task<IActionResult> DebugProactive()
    {
        var wos = await _db.WorkOrders.AsNoTracking()
            .Include(x => x.Asset)
            .Include(x => x.AssignedToPerson)
            .Where(x => x.Classification == WorkOrderClassification.Proactive)
            .ToListAsync();
        
        var result = wos.Select(x => new {
            x.Id,
            x.Title,
            TypeValue = (int)x.Type,
            TypeName = x.Type.ToString(),
            ClassificationValue = (int)x.Classification,
            ClassificationName = x.Classification.ToString(),
            ComputedCategory = GetLaborCategory(x),
            x.Status,
            x.StartAt,
            x.StopAt,
            x.DurationMinutes,
            x.AssignedToPersonId,
            AssignedPersonName = x.AssignedToPerson?.DisplayName,
            x.AssetId,
            AssetName = x.Asset?.Name
        });
        
        return Ok(result);
    }

    [HttpGet("labor-by-person")]
    public async Task<ActionResult<List<PersonnelLaborItem>>> GetLaborByPerson(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        CancellationToken ct = default)
    {
        AdjustDateRange(ref from, ref to);
        var result = await FetchLaborByPersonAsync(from!.Value, to!.Value, ct);
        return Ok(result.OrderByDescending(x => x.ReactivePct ?? 0).ToList());
    }

    private async Task<List<PersonnelLaborItem>> FetchLaborByPersonAsync(DateTimeOffset fUtc, DateTimeOffset tUtc, CancellationToken ct)
    {
        // 1. Denominator (factory working minutes in range)
        double totalSchedMinutes = await GetTotalUnitWorkingMinutesAsync(fUtc.DateTime, tUtc.DateTime, ct);

        // 2. Fetch all people
        var people = await _db.People.AsNoTracking().Where(x => x.IsActive).ToListAsync(ct);

        // 3. Fetch all WOs in range with their logs
        var wos = await _db.WorkOrders.AsNoTracking()
            .Include(x => x.LaborLogs)
            .Where(x => (x.StartAt ?? x.CreatedAt) <= tUtc && (x.StopAt ?? DateTimeOffset.MaxValue) >= fUtc)
            .ToListAsync(ct);

        // 4. Fetch all Extra Jobs + Events in range
        var extraJobs = await _db.ExtraJobs.AsNoTracking()
            .Where(x => x.CreatedAt >= fUtc.AddDays(-30) || (x.StopAt == null || x.StopAt >= fUtc)) 
            .Include(x => x.ExtraJobEvents)
            .ToListAsync(ct);

        var result = new List<PersonnelLaborItem>();

        foreach (var person in people)
        {
            int pmMins = 0;
            int proactiveMins = 0;
            int reactiveMins = 0;
            int extraMins = 0;
            var segments = new List<TimelineSegmentDto>();

            // Process Work Orders
            foreach (var wo in wos)
            {
                var category = GetLaborCategory(wo);

                // Detailed logs check
                var myLogs = wo.LaborLogs?.Where(x => x.PersonId == person.Id).ToList();
                if (myLogs != null && myLogs.Any())
                {
                    foreach (var log in myLogs)
                    {
                        // Attribute log if it falls in range (logs usually have a timestamp)
                        // For simplicity and consistency with other reports, we include the log if the WO is in range
                        // or better, if the log itself is in range.
                        if (log.CreatedAt < fUtc || log.CreatedAt > tUtc) continue;

                        int mins = log.Minutes;
                        if (category == "PM") pmMins += mins;
                        else if (category == "Proactive") proactiveMins += mins;
                        else if (category == "Reactive") reactiveMins += mins;

                        segments.Add(new TimelineSegmentDto(
                            category,
                            log.CreatedAt.AddMinutes(-mins),
                            log.CreatedAt,
                            mins
                        ));
                    }
                }
                else if (wo.AssignedToPersonId == person.Id && wo.DurationMinutes.HasValue && wo.DurationMinutes.Value > 0)
                {
                    // Fallback to primary assignee if no logs exist
                    int mins = wo.DurationMinutes.Value;
                    
                    var s = wo.StartAt ?? wo.CreatedAt;
                    var e = wo.StopAt ?? s.AddMinutes(mins);

                    // Intersection with period
                    var overlapS = s > fUtc ? s : fUtc;
                    var overlapE = e < tUtc ? e : tUtc;

                    if (overlapE > overlapS)
                    {
                        int effectiveMins = (int)(overlapE - overlapS).TotalMinutes;
                        if (effectiveMins > 0)
                        {
                            if (category == "PM") pmMins += effectiveMins;
                            else if (category == "Proactive") proactiveMins += effectiveMins;
                            else if (category == "Reactive") reactiveMins += effectiveMins;

                            segments.Add(new TimelineSegmentDto(
                                category,
                                overlapS,
                                overlapE,
                                effectiveMins
                            ));
                        }
                    }
                }
            }

            // Process Extra Jobs (attributed to AssignedToPersonId)
            var jobsForPerson = extraJobs.Where(x => x.AssignedToPersonId == person.Id);
            foreach (var job in jobsForPerson)
            {
                var jobEvents = job.ExtraJobEvents.OrderBy(x => x.CreatedAtUtc);
                DateTimeOffset? lastStart = null;

                foreach (var e in jobEvents)
                {
                    if (e.Field != "status") continue;
                    if (e.Kind == WorkOrderEventKind.Started) 
                    {
                        lastStart = e.CreatedAtUtc;
                    }
                    else if ((e.Kind == WorkOrderEventKind.Stopped || e.Kind == WorkOrderEventKind.Cancelled) && lastStart.HasValue)
                    {
                        var s = lastStart.Value;
                        var eTime = e.CreatedAtUtc;

                        var overlapS = s > fUtc ? s : fUtc;
                        var overlapE = eTime < tUtc ? eTime : tUtc;

                        if (overlapE > overlapS)
                        {
                            double dur = (overlapE - overlapS).TotalMinutes;
                            if (dur > 0.01)
                            {
                                int m = (int)Math.Round(dur);
                                extraMins += m;
                                segments.Add(new TimelineSegmentDto(
                                    "Extra",
                                    overlapS,
                                    overlapE,
                                    m
                                ));
                            }
                        }
                        lastStart = null;
                    }
                }
                if (lastStart.HasValue)
                {
                    var s = lastStart.Value;
                    var eTime = DateTimeOffset.UtcNow;

                    var overlapS = s > fUtc ? s : fUtc;
                    var overlapE = eTime < tUtc ? eTime : tUtc;

                    if (overlapE > overlapS)
                    {
                        double dur = (overlapE - overlapS).TotalMinutes;
                        if (dur > 0.01)
                        {
                            int m = (int)Math.Round(dur);
                            extraMins += m;
                            segments.Add(new TimelineSegmentDto(
                                "Extra",
                                overlapS,
                                overlapE,
                                m
                            ));
                        }
                    }
                }
            }

            int totalWorked = pmMins + proactiveMins + reactiveMins + extraMins;
            double? workedPct = totalSchedMinutes > 0 ? (totalWorked / totalSchedMinutes) * 100 : (double?)null;
            double? reactivePct = totalSchedMinutes > 0 ? (reactiveMins / totalSchedMinutes) * 100 : (double?)null;

            result.Add(new PersonnelLaborItem(
                person.Id,
                person.DisplayName ?? person.FullName,
                person.JobTitle,
                pmMins,
                proactiveMins,
                reactiveMins,
                extraMins,
                totalWorked,
                workedPct.HasValue ? Math.Round(workedPct.Value, 1) : null,
                reactivePct.HasValue ? Math.Round(reactivePct.Value, 1) : null,
                segments.OrderBy(x => x.StartUtc).ToList()
            ));
        }

        return result;
    }

    [HttpGet("labor")]
    public async Task<ActionResult<List<LaborReportItem>>> GetLabor(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null)
    {
        AdjustDateRange(ref from, ref to);

        var q = _db.WorkOrderLaborLogs.AsNoTracking();

        if (from.HasValue) q = q.Where(x => x.CreatedAt >= from.Value);
        if (to.HasValue) q = q.Where(x => x.CreatedAt <= to.Value);

        var data = await q
            .GroupBy(x => x.PersonId)  // ✅ Group by ID only
            .Select(g => new
            {
                PersonId = g.Key,
                // Resolve name by taking any log's Person.DisplayName (they're all the same for a given PersonId)
                PersonName = g.Select(x => x.Person != null ? x.Person.DisplayName : null).FirstOrDefault(),
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
        AdjustDateRange(ref from, ref to);

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
    public sealed record AssetLaborItem(
        Guid AssetId,
        string AssetName,
        string LocationName,
        int MinutesPm,
        int MinutesWoProactive,
        int MinutesWoReactive,
        double ReactivePct,
        List<TimelineSegmentDto> TimelineSegments
    );

    public sealed record TimelineSegmentDto(
        string Type, // "PM", "Proactive", "Reactive", "Other"
        DateTimeOffset StartUtc,
        DateTimeOffset StopUtc,
        int Minutes
    );

    public sealed record AssetDowntimeItem(
        Guid AssetId,
        string AssetName,
        double TotalHours,
        int WorkOrderCount
    );

    public sealed record AssetLaborDailyItem(
        DateTime Date,
        Guid AssetId,
        string AssetName,
        string LocationName,
        int MinutesPm,
        int MinutesWoProactive,
        int MinutesWoReactive,
        double ReactivePct,
        List<TimelineSegmentDto> TimelineSegments
    );

    public sealed record PersonnelLaborItem(
        Guid PersonId,
        string PersonName,
        string? JobTitle,
        int MinutesPm,
        int MinutesWoProactive,
        int MinutesWoReactive,
        int MinutesExtra,
        int MinutesTotal,
        double? WorkedPct,
        double? ReactivePct,
        List<TimelineSegmentDto> TimelineSegments
    );

    [HttpGet("labor-by-asset")]
    public async Task<ActionResult<List<AssetLaborItem>>> GetLaborByAsset(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        CancellationToken ct = default)
    {
        AdjustDateRange(ref from, ref to);
        var result = await FetchLaborByAssetAsync(from!.Value, to!.Value, ct);
        return Ok(result.OrderByDescending(x => x.MinutesWoReactive + x.MinutesWoProactive + x.MinutesPm).ToList());
    }

    private async Task<List<AssetLaborItem>> FetchLaborByAssetAsync(DateTimeOffset fUtc, DateTimeOffset tUtc, CancellationToken ct)
    {
        // 1. Denominator (factory working minutes in range)
        double totalSchedMinutes = await GetTotalUnitWorkingMinutesAsync(fUtc.DateTime, tUtc.DateTime, ct);

        // 2. Query WorkOrders that were active in the period and have an Asset
        var wos = await _db.WorkOrders.AsNoTracking()
            .Include(w => w.Asset)
                .ThenInclude(a => a!.Location)
            .Include(w => w.LaborLogs)
            .Where(w => w.AssetId != null)
            // Intersection: started <= to AND (stopped >= from OR not stopped)
            .Where(w => (w.StartAt ?? w.CreatedAt) <= tUtc && (w.StopAt ?? DateTimeOffset.MaxValue) >= fUtc)
            .ToListAsync(ct);

        // 3. Group by Asset
        var result = new List<AssetLaborItem>();
        var groupedByAsset = wos.GroupBy(x => x.AssetId!.Value);

        foreach (var group in groupedByAsset)
        {
            var assetId = group.Key;
            var wosForAsset = group.ToList();
            var first = wosForAsset.First();
            var assetName = first.Asset?.Name ?? "Unknown";
            var locName = first.Asset?.Location?.Name ?? "-";

            int pmMins = 0;
            int proactiveMins = 0;
            int reactiveMins = 0;
            var segments = new List<TimelineSegmentDto>();

            foreach (var wo in wosForAsset)
            {
                var category = GetLaborCategory(wo);

                // Use detailed logs if they exist
                if (wo.LaborLogs != null && wo.LaborLogs.Any())
                {
                    foreach (var log in wo.LaborLogs)
                    {
                        // Filter logs to be strictly in period? For now we include them if the WO is in period.
                        int mins = log.Minutes;
                        if (category == "PM") pmMins += mins;
                        else if (category == "Proactive") proactiveMins += mins;
                        else if (category == "Reactive") reactiveMins += mins;

                        segments.Add(new TimelineSegmentDto(
                            category,
                            log.CreatedAt.AddMinutes(-mins),
                            log.CreatedAt,
                            mins
                        ));
                    }
                }
                else if (wo.DurationMinutes.HasValue && wo.DurationMinutes.Value > 0)
                {
                    // Fallback to WO duration
                    int mins = wo.DurationMinutes.Value;
                    if (category == "PM") pmMins += mins;
                    else if (category == "Proactive") proactiveMins += mins;
                    else if (category == "Reactive") reactiveMins += mins;

                    var s = wo.StartAt ?? wo.CreatedAt;
                    var e = wo.StopAt ?? s.AddMinutes(mins);

                    segments.Add(new TimelineSegmentDto(
                        category,
                        s,
                        e,
                        mins
                    ));
                }
            }

            double reactivePct = totalSchedMinutes > 0 ? (reactiveMins / totalSchedMinutes) * 100 : 0;

            result.Add(new AssetLaborItem(
                assetId,
                assetName,
                locName,
                pmMins,
                proactiveMins,
                reactiveMins,
                Math.Round(reactivePct, 2),
                segments.OrderBy(x => x.StartUtc).ToList()
            ));
        }

        return result;
    }

    [HttpGet("labor-by-asset-daily")]
    public async Task<ActionResult<List<AssetLaborDailyItem>>> GetLaborByAssetDaily(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        CancellationToken ct = default)
    {
        AdjustDateRange(ref from, ref to);
        var result = await FetchLaborByAssetDailyAsync(from!.Value, to!.Value, ct);
        // Sort by Date Asc, then Asset Name Asc
        return Ok(result.OrderBy(x => x.Date).ThenBy(x => x.AssetName).ToList());
    }

    private async Task<List<AssetLaborDailyItem>> FetchLaborByAssetDailyAsync(DateTimeOffset fUtc, DateTimeOffset tUtc, CancellationToken ct)
    {
        // Use Bucharest TimeZone for "Day" logic as requested
        var tzi = GetBucharestTzi();

        // 1. Get all WOs in range to avoid N+1
        var wos = await _db.WorkOrders.AsNoTracking()
            .Include(w => w.Asset)
                .ThenInclude(a => a!.Location)
            .Include(w => w.LaborLogs)
            .Where(w => w.AssetId != null)
            .Where(w => (w.StartAt ?? w.CreatedAt) <= tUtc && (w.StopAt ?? DateTimeOffset.MaxValue) >= fUtc)
            .ToListAsync(ct);

        var result = new List<AssetLaborDailyItem>();

        // 2. Iterate each day in range (local time)
        var localFrom = TimeZoneInfo.ConvertTime(fUtc, tzi).Date;
        var localTo = TimeZoneInfo.ConvertTime(tUtc, tzi).Date;

        for (var date = localFrom; date <= localTo; date = date.AddDays(1))
        {
            // Boundary for this day in UTC
            var dayStartLocal = new DateTime(date.Year, date.Month, date.Day, 0, 0, 0);
            var dayEndLocal = new DateTime(date.Year, date.Month, date.Day, 23, 59, 59).AddTicks(9999);
            
            var dayStartUtc = new DateTimeOffset(dayStartLocal, tzi.GetUtcOffset(dayStartLocal));
            var dayEndUtc = new DateTimeOffset(dayEndLocal, tzi.GetUtcOffset(dayEndLocal));

            // Working minutes for this day
            double daySchedMinutes = await GetTotalUnitWorkingMinutesAsync(date, date, ct);

            // Filter WOs overlapping this specific day
            var wosThisDay = wos.Where(w => (w.StartAt ?? w.CreatedAt) <= dayEndUtc && (w.StopAt ?? DateTimeOffset.MaxValue) >= dayStartUtc).ToList();
            
            var groupedByAsset = wosThisDay.GroupBy(x => x.AssetId!.Value);

            foreach (var group in groupedByAsset)
            {
                var assetId = group.Key;
                var wosForAsset = group.ToList();
                var first = wosForAsset.First();
                var assetName = first.Asset?.Name ?? "Unknown";
                var locName = first.Asset?.Location?.Name ?? "-";

                int pmMins = 0;
                int proactiveMins = 0;
                int reactiveMins = 0;
                var segments = new List<TimelineSegmentDto>();

                foreach (var wo in wosForAsset)
                {
                    var category = GetLaborCategory(wo);

                    if (wo.LaborLogs != null && wo.LaborLogs.Any())
                    {
                        foreach (var log in wo.LaborLogs)
                        {
                            // A log is "assigned" to the day of its CreatedAt
                            var logLocal = TimeZoneInfo.ConvertTime(log.CreatedAt, tzi).Date;
                            if (logLocal != date) continue;

                            int mins = log.Minutes;
                            if (category == "PM") pmMins += mins;
                            else if (category == "Proactive") proactiveMins += mins;
                            else if (category == "Reactive") reactiveMins += mins;

                            segments.Add(new TimelineSegmentDto(
                                category,
                                log.CreatedAt.AddMinutes(-mins),
                                log.CreatedAt,
                                mins
                            ));
                        }
                    }
                    else if (wo.DurationMinutes.HasValue && wo.DurationMinutes.Value > 0)
                    {
                        // Fallback to WO duration. If WO spans days, assign to its Start day?
                        // Or clip it to this day? Clipping is fairer for "Details" report.
                        var s = wo.StartAt ?? wo.CreatedAt;
                        var e = wo.StopAt ?? s.AddMinutes(wo.DurationMinutes.Value);

                        var overlapStart = s > dayStartUtc ? s : dayStartUtc;
                        var overlapEnd = e < dayEndUtc ? e : dayEndUtc;

                        if (overlapEnd > overlapStart)
                        {
                            int mins = (int)(overlapEnd - overlapStart).TotalMinutes;
                            if (mins <= 0) continue;

                            if (category == "PM") pmMins += mins;
                            else if (category == "Proactive") proactiveMins += mins;
                            else if (category == "Reactive") reactiveMins += mins;

                            segments.Add(new TimelineSegmentDto(
                                category,
                                overlapStart,
                                overlapEnd,
                                mins
                            ));
                        }
                    }
                }

                if (pmMins == 0 && proactiveMins == 0 && reactiveMins == 0) continue;

                double reactivePct = daySchedMinutes > 0 ? (reactiveMins / daySchedMinutes) * 100 : 0;

                result.Add(new AssetLaborDailyItem(
                    date,
                    assetId,
                    assetName,
                    locName,
                    pmMins,
                    proactiveMins,
                    reactiveMins,
                    Math.Round(reactivePct, 2),
                    segments.OrderBy(x => x.StartUtc).ToList()
                ));
            }
        }

        return result;
    }

    private TimeZoneInfo GetBucharestTzi()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Europe/Bucharest"); }
        catch { 
            try { return TimeZoneInfo.FindSystemTimeZoneById("GTB Standard Time"); }
            catch { return TimeZoneInfo.Utc; }
        }
    }

    private string GetLaborCategory(WorkOrder wo)
    {
        // Priority 1: Check Classification first (Proactive/Reactive takes precedence)
        if (wo.Classification == WorkOrderClassification.Proactive) return "Proactive";
        if (wo.Classification == WorkOrderClassification.Reactive) return "Reactive";
        
        // Priority 2: Check Type for PM
        if (wo.Type == WorkOrderType.Preventive) return "PM";
        
        return "Other";
    }

    private async Task<double> GetTotalUnitWorkingMinutesAsync(DateTime from, DateTime to, CancellationToken ct)
    {
        var schedule = await _db.UnitWorkSchedule.AsNoTracking().FirstOrDefaultAsync(ct);
        
        // Fetch holidays/blackouts for the range
        var holidays = await _unitSchedule.GetActiveNationalHolidaysAsync(from, to, ct);
        var blackouts = await _unitSchedule.GetActiveCompanyClosedDaysAsync(from, to, ct);
        
        var closedDates = holidays.Concat(blackouts).Select(x => x.Date).ToHashSet();

        double sum = 0;
        for (var d = from.Date; d <= to.Date; d = d.AddDays(1))
        {
            if (closedDates.Contains(d)) continue;

            if (schedule == null)
            {
                // Default behavior if no schedule: 8-17 Mon-Fri
                if (d.DayOfWeek != DayOfWeek.Saturday && d.DayOfWeek != DayOfWeek.Sunday)
                    sum += 540;
                continue;
            }

            switch (d.DayOfWeek)
            {
                case DayOfWeek.Saturday:
                    if (schedule.SatStart.HasValue && schedule.SatEnd.HasValue)
                        sum += (schedule.SatEnd.Value - schedule.SatStart.Value).TotalMinutes;
                    break;
                case DayOfWeek.Sunday:
                    if (schedule.SunStart.HasValue && schedule.SunEnd.HasValue)
                        sum += (schedule.SunEnd.Value - schedule.SunStart.Value).TotalMinutes;
                    break;
                default:
                    sum += (schedule.MonFriEnd - schedule.MonFriStart).TotalMinutes;
                    break;
            }
        }
        return sum;
    }

    [HttpGet("top-assets-downtime")]
    public async Task<ActionResult<List<AssetDowntimeItem>>> GetTopAssetsDowntime(
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int take = 10)
    {
        AdjustDateRange(ref from, ref to);

        // Downtime derived from WorkOrder Start/Stop
        // Only WOs that have both StartAt and StopAt
        var q = _db.WorkOrders.AsNoTracking().Include(x => x.Asset).Where(x => x.AssetId != null && x.StartAt.HasValue && x.StopAt.HasValue);

        if (from.HasValue) q = q.Where(x => x.StopAt >= from.Value); // overlaps or contained? Let's use closed date logic typically
        if (to.HasValue) q = q.Where(x => x.StopAt <= to.Value);

        var raw = await q.Select(x => new
        {
            AssetId = x.AssetId!.Value,
            AssetName = x.Asset!.Name,
            // PostgreSQL Npgsql provider allows subtraction of timestamps to get interval
            DurationMinutes = (x.StopAt!.Value - x.StartAt!.Value).TotalMinutes,
            WoId = x.Id
        }).ToListAsync();

        // Group in memory (or efficient DB query if possible, but DateDiff is provider specific)
        // With EF Core Npgsql, subtraction returns TimeSpan which is good.
        // Let's rely on client evaluation for aggregation if needed, but optimally:
        
        var grouped = raw
            .GroupBy(x => new { x.AssetId, x.AssetName })
            .Select(g => new AssetDowntimeItem(
                g.Key.AssetId,
                g.Key.AssetName,
                Math.Round(g.Sum(x => Math.Max(0, x.DurationMinutes)) / 60.0, 1), // Total hours
                g.Count()
            ))
            .OrderByDescending(x => x.TotalHours)
            .Take(take)
            .ToList();

        return Ok(grouped);
    }

    public sealed record ExtraJobSegment(
        DateTimeOffset StartAt,
        DateTimeOffset? StopAt,
        double DurationMinutes
    );

    public sealed record ExtraJobReportItem(
        Guid Id,
        string Title,
        string? Description,
        DateTimeOffset CreatedAt,
        string CreatedBy,
        string? AssigneeName,
        double TotalMinutes,
        string Status,
        List<ExtraJobSegment> Segments,
        DateTimeOffset? TimelineStart,
        DateTimeOffset? TimelineEnd,
        double? WeightPct,
        double OvertimeMinutes,
        bool IsReopened
    );

    [HttpGet("extra-jobs")]
    public async Task<ActionResult<List<ExtraJobReportItem>>> GetExtraJobsReport(
        [FromQuery(Name = "from")] string? fromStr = null,
        [FromQuery(Name = "to")] string? toStr = null)
    {
        DateTimeOffset? from = null;
        DateTimeOffset? to = null;

        if (!string.IsNullOrEmpty(fromStr))
        {
            if (DateTimeOffset.TryParse(fromStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f))
                from = f;
            else
                return BadRequest(new { message = "Formatul datei 'from' este invalid. Folositi YYYY-MM-DD." });
        }

        if (!string.IsNullOrEmpty(toStr))
        {
            if (DateTimeOffset.TryParse(toStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t))
                to = t;
            else
                return BadRequest(new { message = "Formatul datei 'to' este invalid. Folositi YYYY-MM-DD." });
        }

        var result = await FetchExtraJobReportItemsAsync(from, to);
        return Ok(result);
    }

    [HttpGet("extra-jobs/export/pdf")]
    public async Task<IActionResult> ExportExtraJobsPdf(
        [FromQuery(Name = "from")] string? fromStr = null,
        [FromQuery(Name = "to")] string? toStr = null)
    {
        DateTimeOffset? from = null;
        DateTimeOffset? to = null;

        if (!string.IsNullOrEmpty(fromStr))
        {
            if (DateTimeOffset.TryParse(fromStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f))
                from = f;
            else
                return BadRequest(new { message = "Formatul datei 'from' este invalid. Folositi YYYY-MM-DD." });
        }

        if (!string.IsNullOrEmpty(toStr))
        {
            if (DateTimeOffset.TryParse(toStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t))
                to = t;
            else
                return BadRequest(new { message = "Formatul datei 'to' este invalid. Folositi YYYY-MM-DD." });
        }

        try
        {
            var items = await FetchExtraJobReportItemsAsync(from, to);
            
            // Log for debugging if empty
            if (items == null || items.Count == 0)
            {
                // Proceed anyway to show an empty report instead of 500
                items = new List<ExtraJobReportItem>();
            }

            var header = await GetTemplatePath(DocumentTemplateType.Header);
            var footer = await GetTemplatePath(DocumentTemplateType.Footer);

            var pdf = GenerateExtraJobsPdf(items, from, to, header, footer);
            var fileName = $"Raport_Activitati_Extra_{DateTime.Now:yyyyMMdd_HHmm}.pdf";
            return File(pdf, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
            // Log exception here if we had a logger
            return StatusCode(500, new { 
                message = "Eroare la generarea PDF-ului.", 
                details = ex.Message,
                stackTrace = ex.StackTrace 
            });
        }
    }

    private async Task<string?> GetTemplatePath(DocumentTemplateType type)
    {
        var t = await _db.DocumentTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Type == type);
        if (t == null) return null;
        
        // Try multiple base paths for robustness
        var pathsToTry = new[] {
            Path.Combine(_env.ContentRootPath, "storage", "templates", t.StoredFilePath),
            Path.Combine(AppContext.BaseDirectory, "storage", "templates", t.StoredFilePath),
            Path.Combine(Directory.GetCurrentDirectory(), "storage", "templates", t.StoredFilePath)
        };

        foreach(var p in pathsToTry) {
            var fullPath = Path.GetFullPath(p);
            if (System.IO.File.Exists(fullPath)) return fullPath;
        }

        return null;
    }

    private async Task<List<ExtraJobReportItem>> FetchExtraJobReportItemsAsync(DateTimeOffset? from, DateTimeOffset? to)
    {
        AdjustDateRange(ref from, ref to);

        var q = _db.ExtraJobs.AsNoTracking();

        if (from.HasValue) q = q.Where(x => x.CreatedAt >= from.Value);
        if (to.HasValue) q = q.Where(x => x.CreatedAt <= to.Value);

        var jobs = await q
            .OrderByDescending(x => x.CreatedAt)
            .Include(x => x.AssignedToPerson)
                .ThenInclude(p => p!.WorkSchedule)
            .ToListAsync();

        var jobIds = jobs.Select(x => x.Id).ToList();

        var events = await _db.ExtraJobEvents.AsNoTracking()
            .Where(x => jobIds.Contains(x.ExtraJobId))
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => new { x.ExtraJobId, x.Kind, x.CreatedAtUtc, x.ActorId, x.Field })
            .ToListAsync();

        var result = new List<ExtraJobReportItem>();

        foreach (var job in jobs)
        {
            var jobEvents = events.Where(x => x.ExtraJobId == job.Id).OrderBy(x => x.CreatedAtUtc).ToList();
            var createdEvent = jobEvents.FirstOrDefault(e => e.Kind == WorkOrderEventKind.Created);
            var createdBy = createdEvent?.ActorId ?? "System";

            double totalMinutes = 0;
            var segments = new List<ExtraJobSegment>();
            DateTimeOffset? lastStart = null;

            foreach (var e in jobEvents)
            {
                if (e.Field != "status") continue;
                if (e.Kind == WorkOrderEventKind.Started) lastStart = e.CreatedAtUtc;
                else if ((e.Kind == WorkOrderEventKind.Stopped || e.Kind == WorkOrderEventKind.Cancelled) && lastStart.HasValue)
                {
                    var dur = (e.CreatedAtUtc - lastStart.Value).TotalMinutes;
                    if (dur > 0.01)
                    {
                        segments.Add(new ExtraJobSegment(lastStart.Value, e.CreatedAtUtc, Math.Round(dur, 2)));
                        totalMinutes += dur;
                    }
                    lastStart = null;
                }
            }
            if (lastStart.HasValue)
            {
                var dur = (DateTimeOffset.UtcNow - lastStart.Value).TotalMinutes;
                segments.Add(new ExtraJobSegment(lastStart.Value, null, Math.Round(dur, 1)));
                totalMinutes += dur;
            }

            var isReopened = jobEvents.Any(e => e.Kind == WorkOrderEventKind.Reopened);
            double overtimeMinutes = 0;
            double? weightPct = null;

            // Timeline bounds
            DateTimeOffset? tStart = null;
            DateTimeOffset? tEnd = null;

            if (job.AssignedToPerson?.WorkSchedule != null)
            {
                var sch = job.AssignedToPerson.WorkSchedule;
                var tzId = sch.Timezone ?? "Europe/Bucharest";
                
                TimeZoneInfo tzi;
                try 
                {
                    tzi = TimeZoneInfo.FindSystemTimeZoneById(tzId);
                } 
                catch 
                {
                    try { tzi = TimeZoneInfo.FindSystemTimeZoneById("GTB Standard Time"); }
                    catch { tzi = TimeZoneInfo.Utc; }
                }

                var rawRef = segments.FirstOrDefault()?.StartAt ?? job.CreatedAt;
                var localRef = TimeZoneInfo.ConvertTime(rawRef, tzi);
                var dow = localRef.DayOfWeek;

                TimeSpan? sStart = null;
                TimeSpan? sEnd = null;

                if (dow >= DayOfWeek.Monday && dow <= DayOfWeek.Friday)
                {
                    sStart = sch.MonFriStart;
                    sEnd = sch.MonFriEnd;
                }
                else if (dow == DayOfWeek.Saturday)
                {
                    sStart = sch.SatStart;
                    sEnd = sch.SatEnd;
                }
                else if (dow == DayOfWeek.Sunday)
                {
                    sStart = sch.SunStart;
                    sEnd = sch.SunEnd;
                }

                if (sStart.HasValue && sEnd.HasValue)
                {
                    var dtStart = localRef.Date.Add(sStart.Value);
                    var dtEnd = localRef.Date.Add(sEnd.Value);

                    tStart = new DateTimeOffset(dtStart, tzi.GetUtcOffset(dtStart));
                    var scheduledEnd = new DateTimeOffset(dtEnd, tzi.GetUtcOffset(dtEnd));

                    var latestStop = segments.Any() 
                        ? segments.Max(s => s.StopAt ?? DateTimeOffset.UtcNow) 
                        : DateTimeOffset.MinValue;

                    tEnd = latestStop > scheduledEnd ? latestStop : scheduledEnd;

                    if (latestStop > scheduledEnd)
                    {
                        overtimeMinutes = (latestStop - scheduledEnd).TotalMinutes;
                    }

                    var schedMinutes = (dtEnd - dtStart).TotalMinutes;
                    if (schedMinutes > 0)
                    {
                        weightPct = Math.Round((totalMinutes / schedMinutes) * 100, 1);
                    }
                }
            }

            if (tStart == null && segments.Any()) tStart = segments.Min(s => s.StartAt);
            if (tEnd == null && segments.Any()) tEnd = segments.Max(s => s.StopAt ?? DateTimeOffset.UtcNow);

            result.Add(new ExtraJobReportItem(
                job.Id,
                job.Title,
                job.Description,
                job.CreatedAt,
                createdBy,
                job.AssignedToPerson?.DisplayName,
                Math.Round(totalMinutes, 1),
                job.Status.ToString(),
                segments,
                tStart,
                tEnd,
                weightPct,
                Math.Round(overtimeMinutes, 1),
                isReopened
            ));
        }

        return result;
    }

    private byte[] GenerateExtraJobsPdf(List<ExtraJobReportItem> items, DateTimeOffset? from, DateTimeOffset? to, string? headerPath, string? footerPath)
    {
        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginTop(20, Unit.Millimetre);
                page.MarginBottom(18, Unit.Millimetre);
                page.MarginLeft(15, Unit.Millimetre);
                page.MarginRight(15, Unit.Millimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                // --- HEADER ---
                if (!string.IsNullOrEmpty(headerPath))
                {
                    page.Header().Element(header => 
                    {
                        try 
                        {
                            var bytes = System.IO.File.ReadAllBytes(headerPath);
                            header.Height(90, Unit.Point).Image(bytes, ImageScaling.FitWidth);
                        }
                        catch { /* Fallback */ }
                    });
                }

                // --- FOOTER ---
                page.Footer().Column(col => 
                {
                    if (!string.IsNullOrEmpty(footerPath))
                    {
                        try 
                        {
                            var bytes = System.IO.File.ReadAllBytes(footerPath);
                            col.Item().Image(bytes, ImageScaling.FitWidth);
                        }
                        catch { /* Fallback */ }
                    }
                    col.Item().AlignCenter().Text(x => 
                    {
                        x.Span("Document generat automat din CMMS Rufster · Pagina ").FontSize(7).FontColor(Colors.Grey.Medium);
                        x.CurrentPageNumber().FontSize(7).FontColor(Colors.Grey.Medium);
                        x.Span(" din ").FontSize(7).FontColor(Colors.Grey.Medium);
                        x.TotalPages().FontSize(7).FontColor(Colors.Grey.Medium);
                    });
                });

                // --- CONTENT ---
                page.Content().Column(col =>
                {
                    // PAGE 1: EXECUTIVE SUMMARY
                    col.Item().PaddingBottom(5, Unit.Millimetre).Text("RAPORT ACTIVITATI EXTRA").FontSize(18).SemiBold().FontColor("#1E3A8A"); // Deep Blue
                    col.Item().PaddingBottom(10, Unit.Millimetre).Text($"Perioada: {(from.HasValue ? from.Value.ToString("dd.MM.yyyy") : "Inceput")} – {(to.HasValue ? to.Value.ToString("dd.MM.yyyy") : "Prezent")} | Generat la: {DateTime.Now:dd.MM.yyyy HH:mm}");

                    // KPI Calculation
                    var totalActs = items.Count;
                    var totalTime = items.Sum(x => x.TotalMinutes);
                    var totalPeople = items.Select(x => x.AssigneeName).Distinct().Count(x => !string.IsNullOrEmpty(x));
                    var avgTime = totalActs > 0 ? totalTime / totalActs : 0;
                    var totalOvertime = items.Sum(x => x.OvertimeMinutes);
                    var pctOvertime = totalActs > 0 ? (double)items.Count(x => x.OvertimeMinutes > 0) / totalActs * 100 : 0;
                    var reopenedCount = items.Count(x => x.IsReopened);
                    var missingDetails = items.Count(x => string.IsNullOrWhiteSpace(x.Description));

                    col.Item().PaddingBottom(10, Unit.Millimetre).Table(table => 
                    {
                        table.ColumnsDefinition(columns => {
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                        });

                        // Row 1
                        table.Cell().Element(KpiBox).Column(c => {
                            c.Item().Text("Nr. activitati extra").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text(totalActs.ToString()).FontSize(14).SemiBold();
                        });
                        table.Cell().Element(KpiBox).Column(c => {
                            c.Item().Text("Timp total (ore)").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text((totalTime / 60).ToString("N1")).FontSize(14).SemiBold();
                        });
                        table.Cell().Element(KpiBox).Column(c => {
                            c.Item().Text("Angajati implicati").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text(totalPeople.ToString()).FontSize(14).SemiBold();
                        });
                        table.Cell().Element(KpiBox).Column(c => {
                            c.Item().Text("Timp mediu (min)").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text(avgTime.ToString("N0")).FontSize(14).SemiBold();
                        });

                        // Row 2
                        table.Cell().Element(KpiBox).Column(c => {
                            c.Item().Text("Minute overtime").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text(totalOvertime.ToString("N0")).FontSize(14).SemiBold();
                        });
                        table.Cell().Element(KpiBox).Column(c => {
                            c.Item().Text("% cu overtime").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text($"{pctOvertime:N1}%").FontSize(14).SemiBold();
                        });
                        table.Cell().Element(KpiBox).Column(c => {
                            c.Item().Text("Activitati redeschise").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text(reopenedCount.ToString()).FontSize(14).SemiBold();
                        });
                        table.Cell().Element(KpiBox).Column(c => {
                            c.Item().Text("Fara detalii").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text(missingDetails.ToString()).FontSize(14).SemiBold();
                        });

                        static IContainer KpiBox(IContainer container) => container.Padding(5).Border(0.5f).BorderColor(Colors.Grey.Lighten2).AlignLeft();
                    });

                    col.Item().PaddingBottom(5, Unit.Millimetre).Text("Legenda Timeline:").SemiBold();
                    col.Item().Row(row => 
                    {
                        row.ConstantItem(20).Height(10).Background("#2563EB");
                        row.ConstantItem(5);
                        row.RelativeItem().Text("= timp lucrat (Blue 600)").FontSize(8);
                        row.ConstantItem(10);
                        row.RelativeItem().Text("L = inceput program | R = sfarsit program / overtime").FontSize(8).FontColor(Colors.Grey.Medium);
                    });

                    // START TABLE ON NEW PAGE (or follow summary)
                    col.Item().PageBreak();

                    // PAGES 2+: DETAILED TABLE
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(18); // Activitate
                            columns.RelativeColumn(12); // Responsabil
                            columns.RelativeColumn(30); // Timeline
                            columns.RelativeColumn(8);  // Timp total
                            columns.RelativeColumn(10); // Pondere activitate
                            columns.RelativeColumn(10); // Status
                            columns.RelativeColumn(12); // Observatii
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderStyle).Text("Activitate");
                            header.Cell().Element(HeaderStyle).Text("Responsabil");
                            header.Cell().Element(HeaderStyle).Text("Timeline");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Timp");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Pondere");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Status");
                            header.Cell().Element(HeaderStyle).Text("Observatii");

                            static IContainer HeaderStyle(IContainer container) => container.DefaultTextStyle(x => x.SemiBold().FontSize(8)).PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Black);
                        });

                        foreach (var it in items)
                        {
                            table.Cell().Element(RowStyle).Column(c => {
                                c.Item().Text(it.Title).SemiBold();
                                if (!string.IsNullOrEmpty(it.Description))
                                    c.Item().Text(it.Description).FontSize(7).FontColor(Colors.Grey.Medium);
                            });
                            
                            table.Cell().Element(RowStyle).Text(it.AssigneeName ?? "-");

                            table.Cell().Element(RowStyle).PaddingVertical(2).PaddingHorizontal(2).Column(c => {
                                if (it.TimelineStart.HasValue && it.TimelineEnd.HasValue && it.Segments.Any())
                                {
                                    var tStart = it.TimelineStart.Value.Ticks;
                                    var tEnd = it.TimelineEnd.Value.Ticks;
                                    var range = tEnd - tStart;
                                    
                                    if (range >= TimeSpan.FromMinutes(1).Ticks)
                                    {
                                        c.Item().Row(r => {
                                            r.RelativeItem().Text(it.TimelineStart.Value.ToString("HH:mm")).FontSize(5).FontColor(Colors.Grey.Darken1);
                                            r.RelativeItem().AlignRight().Text(it.TimelineEnd.Value.ToString("HH:mm")).FontSize(5).FontColor(Colors.Grey.Darken1);
                                        });
                                        
                                        c.Item().Height(12).Background(Colors.Grey.Lighten4).Row(row => {
                                            var sortedSegments = it.Segments.OrderBy(s => s.StartAt).ToList();
                                            long currentPos = tStart;

                                            foreach(var seg in sortedSegments)
                                            {
                                                var s = seg.StartAt.Ticks;
                                                var e = (seg.StopAt ?? DateTimeOffset.UtcNow).Ticks;
                                                
                                                if (s > currentPos)
                                                {
                                                    float gapWidth = (float)(s - currentPos) / range;
                                                    if (gapWidth > 0.0001f && !float.IsNaN(gapWidth) && !float.IsInfinity(gapWidth)) 
                                                        row.RelativeItem(gapWidth).Height(12);
                                                }
                                                
                                                var startInRange = Math.Max(tStart, s);
                                                var endInRange = Math.Min(tEnd, e);
                                                
                                                if (endInRange > startInRange)
                                                {
                                                    float segWidth = (float)(endInRange - startInRange) / range;
                                                    if (segWidth > 0.0001f && !float.IsNaN(segWidth) && !float.IsInfinity(segWidth))
                                                    {
                                                        var segment = row.RelativeItem(segWidth)
                                                           .Background(GetStatusColor(it.Status))
                                                           .Height(12)
                                                           .AlignCenter()
                                                           .AlignMiddle();

                                                        if (segWidth > 0.05f) 
                                                        {
                                                            segment.Text($"{Math.Round(seg.DurationMinutes)}m")
                                                                   .FontSize(5).FontColor(Colors.White).SemiBold();
                                                        }
                                                    }
                                                }
                                                currentPos = Math.Max(currentPos, e);
                                            }
                                            
                                            if (tEnd > currentPos)
                                            {
                                                float finalGapWidth = (float)(tEnd - currentPos) / range;
                                                if (finalGapWidth > 0.0001f && !float.IsNaN(finalGapWidth) && !float.IsInfinity(finalGapWidth)) 
                                                    row.RelativeItem(finalGapWidth).Height(12);
                                            }
                                        });
                                    }
                                }
                            });

                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.TotalMinutes:N0}m");
                            table.Cell().Element(RowStyle).AlignRight().Text(it.WeightPct.HasValue ? $"{it.WeightPct:N1}%" : "-");
                            table.Cell().Element(RowStyle).AlignRight().Text(it.Status);
                            table.Cell().Element(RowStyle).Text(it.OvertimeMinutes > 0 ? $"OT: {it.OvertimeMinutes:N0}m" : "");

                            static IContainer RowStyle(IContainer container) => container.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(5).AlignMiddle();
                        }
                    });
                });
            });
        });

        return doc.GeneratePdf();
    }

    private string GetStatusColor(string status)
    {
        return status switch
        {
            "Open" => "#2563EB",       
            "InProgress" => "#2563EB", 
            "Done" => "#2563EB",       
            "Cancelled" => "#EF4444",  
            _ => "#71717A"
        };
    }

    private void AdjustDateRange(ref DateTimeOffset? from, ref DateTimeOffset? to)
    {
        if (from.HasValue) from = from.Value.ToUniversalTime();
        
        if (to.HasValue) 
        {
            if (to.Value.TimeOfDay == TimeSpan.Zero)
            {
                if (to.Value.Date < DateTime.MaxValue.Date)
                {
                    to = to.Value.Date.AddDays(1).AddTicks(-1);
                }
            }
            to = to.Value.ToUniversalTime();
        }
    }

    [HttpGet("activity-in-period/export/pdf")]
    public async Task<IActionResult> ExportActivityInPeriodPdf(
        [FromQuery(Name = "from")] string? fromStr = null,
        [FromQuery(Name = "to")] string? toStr = null,
        CancellationToken ct = default)
    {
        DateTimeOffset? from = null;
        DateTimeOffset? to = null;

        if (!string.IsNullOrEmpty(fromStr))
        {
            if (DateTimeOffset.TryParse(fromStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f))
                from = f;
            else
                return BadRequest(new { message = "Formatul datei 'from' este invalid. Folositi YYYY-MM-DD." });
        }

        if (!string.IsNullOrEmpty(toStr))
        {
            if (DateTimeOffset.TryParse(toStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t))
                to = t;
            else
                return BadRequest(new { message = "Formatul datei 'to' este invalid. Folositi YYYY-MM-DD." });
        }

        AdjustDateRange(ref from, ref to);

        try
        {
            var items = await FetchLaborByPersonAsync(from!.Value, to!.Value, ct);
            
            // Sort as in UI
            items = items.OrderByDescending(x => x.ReactivePct ?? 0).ToList();

            var header = await GetTemplatePath(DocumentTemplateType.Header);
            var footer = await GetTemplatePath(DocumentTemplateType.Footer);

            var pdf = GenerateActivityInPeriodPdf(items, from, to, header, footer);
            var fileName = $"Raport_Activitate_in_perioada_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.pdf";
            return File(pdf, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
             return StatusCode(500, new { 
                message = "Eroare la generarea PDF-ului.", 
                details = ex.Message 
            });
        }
    }

    private byte[] GenerateActivityInPeriodPdf(List<PersonnelLaborItem> items, DateTimeOffset? from, DateTimeOffset? to, string? headerPath, string? footerPath)
    {
        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginTop(20, Unit.Millimetre);
                page.MarginBottom(18, Unit.Millimetre);
                page.MarginLeft(15, Unit.Millimetre);
                page.MarginRight(15, Unit.Millimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                // --- HEADER ---
                if (!string.IsNullOrEmpty(headerPath))
                {
                    page.Header().Element(header => 
                    {
                        try 
                        {
                            var bytes = System.IO.File.ReadAllBytes(headerPath);
                            header.Height(90, Unit.Point).Image(bytes, ImageScaling.FitWidth);
                        }
                        catch { /* Fallback */ }
                    });
                }

                // --- FOOTER ---
                page.Footer().Column(col => 
                {
                    if (!string.IsNullOrEmpty(footerPath))
                    {
                        try 
                        {
                            var bytes = System.IO.File.ReadAllBytes(footerPath);
                            col.Item().Image(bytes, ImageScaling.FitWidth);
                        }
                        catch { /* Fallback */ }
                    }
                    col.Item().AlignCenter().Text(x => 
                    {
                        x.Span("Document generat automat din CMMS Rufster · Pagina ").FontSize(7).FontColor(Colors.Grey.Medium);
                        x.CurrentPageNumber().FontSize(7).FontColor(Colors.Grey.Medium);
                        x.Span(" din ").FontSize(7).FontColor(Colors.Grey.Medium);
                        x.TotalPages().FontSize(7).FontColor(Colors.Grey.Medium);
                    });
                });

                // --- CONTENT ---
                page.Content().Column(col =>
                {
                    col.Item().PaddingBottom(5, Unit.Millimetre).Text("RAPORT ACTIVITATE IN PERIOADA").FontSize(18).SemiBold().FontColor("#1E3A8A");
                    col.Item().PaddingBottom(10, Unit.Millimetre).Text($"Perioada: {(from.HasValue ? from.Value.ToString("dd.MM.yyyy") : "-")} – {(to.HasValue ? to.Value.ToString("dd.MM.yyyy") : "-")} | Generat la: {DateTime.Now:dd.MM.yyyy HH:mm}");

                    // Legend
                    col.Item().PaddingBottom(5, Unit.Millimetre).Text("Legenda:").SemiBold();
                    col.Item().Row(row => 
                    {
                        // PM
                        row.ConstantItem(10).Height(10).Background("#10b981");
                        row.ConstantItem(5);
                        row.AutoItem().Text("PM").FontSize(8);
                        row.ConstantItem(15);
                        
                        // Proactive
                        row.ConstantItem(10).Height(10).Background("#0ea5e9");
                        row.ConstantItem(5);
                        row.AutoItem().Text("WO Proactiv").FontSize(8);
                        row.ConstantItem(15);

                        // Reactive
                        row.ConstantItem(10).Height(10).Background("#f43f5e");
                        row.ConstantItem(5);
                        row.AutoItem().Text("WO Reactiv").FontSize(8);
                        row.ConstantItem(15);

                        // Extra
                        row.ConstantItem(10).Height(10).Background("#2563eb");
                        row.ConstantItem(5);
                        row.AutoItem().Text("Activitati Extra").FontSize(8);
                    });

                    // Table
                    col.Item().PaddingTop(5).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(15); // Angajat
                            columns.RelativeColumn(25); // Timeline
                            columns.RelativeColumn(6);  // PM
                            columns.RelativeColumn(6);  // Pro
                            columns.RelativeColumn(6);  // Rea
                            columns.RelativeColumn(6);  // Ext
                            columns.RelativeColumn(8);  // Total
                            columns.RelativeColumn(6);  // % Lucrat
                            columns.RelativeColumn(6);  // % Reactiv
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderStyle).Text("Angajat");
                            header.Cell().Element(HeaderStyle).Text("Grafic activitate");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("PM");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Pro");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Rea");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Ext");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Total");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("% L");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("% R");

                            static IContainer HeaderStyle(IContainer container) => container.DefaultTextStyle(x => x.SemiBold().FontSize(8)).PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Black);
                        });

                        foreach (var it in items)
                        {
                            table.Cell().Element(RowStyle).Column(c => {
                                c.Item().Text(it.PersonName).SemiBold();
                                if (!string.IsNullOrEmpty(it.JobTitle))
                                    c.Item().Text(it.JobTitle).FontSize(7).FontColor(Colors.Grey.Medium);
                            });

                            // Timeline
                            table.Cell().Element(RowStyle).PaddingVertical(2).PaddingHorizontal(2).Column(c => {
                                if (it.TimelineSegments != null && it.TimelineSegments.Any() && from.HasValue && to.HasValue)
                                {
                                    var fTicks = from.Value.Ticks;
                                    var tTicks = to.Value.Ticks;
                                    var range = tTicks - fTicks;

                                    if (range > 0)
                                    {
                                        c.Item().Height(12).Background(Colors.Grey.Lighten4).Row(row => {
                                            var sortedSegments = it.TimelineSegments.OrderBy(s => s.StartUtc).ToList();
                                            long currentPos = fTicks;

                                            foreach(var seg in sortedSegments)
                                            {
                                                var s = seg.StartUtc.Ticks;
                                                var e = seg.StopUtc.Ticks; 
                                                
                                                if (s > currentPos)
                                                {
                                                    float gapWidth = (float)(s - currentPos) / range;
                                                    if (gapWidth > 0.0001f && !float.IsNaN(gapWidth) && !float.IsInfinity(gapWidth)) 
                                                        row.RelativeItem(gapWidth).Height(12);
                                                }
                                                
                                                var startInRange = Math.Max(fTicks, s);
                                                var endInRange = Math.Min(tTicks, e);
                                                
                                                if (endInRange > startInRange)
                                                {
                                                    float segWidth = (float)(endInRange - startInRange) / range;
                                                    if (segWidth > 0.0001f && !float.IsNaN(segWidth) && !float.IsInfinity(segWidth))
                                                    {
                                                        string color = "#71717a"; // Default zinc
                                                        if (seg.Type == "PM") color = "#10b981";
                                                        else if (seg.Type == "Proactive") color = "#0ea5e9";
                                                        else if (seg.Type == "Reactive") color = "#f43f5e";
                                                        else if (seg.Type == "Extra") color = "#2563eb";

                                                        row.RelativeItem(segWidth)
                                                           .Background(color)
                                                           .Height(12);
                                                    }
                                                }
                                                currentPos = Math.Max(currentPos, e);
                                            }
                                            
                                            // Fill remaining space
                                            if (tTicks > currentPos)
                                            {
                                                float finalGapWidth = (float)(tTicks - currentPos) / range;
                                                if (finalGapWidth > 0.0001f && !float.IsNaN(finalGapWidth) && !float.IsInfinity(finalGapWidth)) 
                                                    row.RelativeItem(finalGapWidth).Height(12);
                                            }
                                        });
                                    }
                                }
                            });

                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.MinutesPm}");
                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.MinutesWoProactive}");
                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.MinutesWoReactive}");
                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.MinutesExtra}");
                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.MinutesTotal}").SemiBold();
                            table.Cell().Element(RowStyle).AlignRight().Text(it.WorkedPct.HasValue ? $"{it.WorkedPct:N1}%" : "-");
                            table.Cell().Element(RowStyle).AlignRight().Text(it.ReactivePct.HasValue ? $"{it.ReactivePct:N1}%" : "-").FontColor(Colors.Red.Medium);

                            static IContainer RowStyle(IContainer container) => container.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(5).AlignMiddle();
                        }
                    });
                });
            });
        });

        return doc.GeneratePdf();
    }

    [HttpGet("interventii-utilaje/export/pdf")]
    public async Task<IActionResult> ExportInterventiiUtilajePdf(
        [FromQuery(Name = "from")] string? fromStr = null,
        [FromQuery(Name = "to")] string? toStr = null,
        CancellationToken ct = default)
    {
        DateTimeOffset? from = null;
        DateTimeOffset? to = null;

        if (!string.IsNullOrEmpty(fromStr) && DateTimeOffset.TryParse(fromStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f))
            from = f;
        if (!string.IsNullOrEmpty(toStr) && DateTimeOffset.TryParse(toStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t))
            to = t;

        AdjustDateRange(ref from, ref to);

        try
        {
            var items = await FetchLaborByAssetAsync(from!.Value, to!.Value, ct);
            items = items.OrderByDescending(x => x.MinutesWoReactive + x.MinutesWoProactive + x.MinutesPm).ToList();

            var header = await GetTemplatePath(DocumentTemplateType.Header);
            var footer = await GetTemplatePath(DocumentTemplateType.Footer);

            var pdf = GenerateLaborByAssetPdf(items, from, to, header, footer);
            var fileName = $"Raport_Interventii_pe_utilaje_in_perioada_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.pdf";
            return File(pdf, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Eroare la generarea PDF-ului.", details = ex.Message });
        }
    }

    [HttpGet("interventii-utilaje-detaliat/export/pdf")]
    public async Task<IActionResult> ExportInterventiiUtilajeDetaliatPdf(
        [FromQuery(Name = "from")] string? fromStr = null,
        [FromQuery(Name = "to")] string? toStr = null,
        CancellationToken ct = default)
    {
        DateTimeOffset? from = null;
        DateTimeOffset? to = null;

        if (!string.IsNullOrEmpty(fromStr) && DateTimeOffset.TryParse(fromStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f))
            from = f;
        if (!string.IsNullOrEmpty(toStr) && DateTimeOffset.TryParse(toStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t))
            to = t;

        AdjustDateRange(ref from, ref to);

        try
        {
            var items = await FetchLaborByAssetDailyAsync(from!.Value, to!.Value, ct);
            items = items.OrderBy(x => x.Date).ThenBy(x => x.AssetName).ToList();

            var header = await GetTemplatePath(DocumentTemplateType.Header);
            var footer = await GetTemplatePath(DocumentTemplateType.Footer);

            var pdf = GenerateLaborByAssetDailyPdf(items, from, to, header, footer);
            var fileName = $"Raport_Interventii_utilaje_detaliat_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.pdf";
            return File(pdf, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Eroare la generarea PDF-ului.", details = ex.Message });
        }
    }

    private byte[] GenerateLaborByAssetPdf(List<AssetLaborItem> items, DateTimeOffset? from, DateTimeOffset? to, string? headerPath, string? footerPath)
    {
        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginTop(20, Unit.Millimetre);
                page.MarginBottom(18, Unit.Millimetre);
                page.MarginLeft(15, Unit.Millimetre);
                page.MarginRight(15, Unit.Millimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                // HEADER
                if (!string.IsNullOrEmpty(headerPath))
                {
                    page.Header().Element(header => 
                    {
                        try {
                            var bytes = System.IO.File.ReadAllBytes(headerPath);
                            header.Height(90, Unit.Point).Image(bytes, ImageScaling.FitWidth);
                        } catch { }
                    });
                }

                // FOOTER
                page.Footer().Column(col => 
                {
                    if (!string.IsNullOrEmpty(footerPath))
                    {
                        try {
                            var bytes = System.IO.File.ReadAllBytes(footerPath);
                            col.Item().Image(bytes, ImageScaling.FitWidth);
                        } catch { }
                    }
                    col.Item().AlignCenter().Text(x => 
                    {
                        x.Span("Document generat automat din CMMS Rufster · Pagina ").FontSize(7).FontColor(Colors.Grey.Medium);
                        x.CurrentPageNumber().FontSize(7).FontColor(Colors.Grey.Medium);
                        x.Span(" din ").FontSize(7).FontColor(Colors.Grey.Medium);
                        x.TotalPages().FontSize(7).FontColor(Colors.Grey.Medium);
                    });
                });

                // CONTENT
                page.Content().Column(col =>
                {
                    col.Item().PaddingBottom(5, Unit.Millimetre).Text("RAPORT INTERVENTII PE UTILAJE IN PERIOADA").FontSize(18).SemiBold().FontColor("#1E3A8A");
                    col.Item().PaddingBottom(10, Unit.Millimetre).Text($"Perioada: {(from.HasValue ? from.Value.ToString("dd.MM.yyyy") : "-")} – {(to.HasValue ? to.Value.ToString("dd.MM.yyyy") : "-")} | Generat la: {DateTime.Now:dd.MM.yyyy HH:mm}");

                    // Legend
                    AddLegend(col);

                    // Table
                    col.Item().PaddingTop(5).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(16); // Utilaj
                            columns.RelativeColumn(10); // Locatie
                            columns.RelativeColumn(30); // Interventii (timeline)
                            columns.RelativeColumn(8);  // Pro
                            columns.RelativeColumn(8);  // Rea
                            columns.RelativeColumn(8);  // PM
                            columns.RelativeColumn(8);  // Total (added)
                            columns.RelativeColumn(8);  // % Reactiv
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderStyle).Text("Utilaj");
                            header.Cell().Element(HeaderStyle).Text("Locatie");
                            header.Cell().Element(HeaderStyle).Text("Interventii in perioada");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Pro");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Rea");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("PM");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Total"); // Extra column
                            header.Cell().Element(HeaderStyle).AlignRight().Text("% Reactiv");

                            static IContainer HeaderStyle(IContainer container) => container.DefaultTextStyle(x => x.SemiBold().FontSize(8)).PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Black);
                        });

                        foreach (var it in items)
                        {
                            table.Cell().Element(RowStyle).Text(it.AssetName).SemiBold();
                            table.Cell().Element(RowStyle).Text(it.LocationName ?? "-").FontSize(8).FontColor(Colors.Grey.Medium);

                            // Timeline
                            table.Cell().Element(RowStyle).PaddingVertical(2).PaddingHorizontal(2).Column(c => {
                                if (it.TimelineSegments != null && it.TimelineSegments.Any() && from.HasValue && to.HasValue)
                                {
                                    RenderTimeline(c, it.TimelineSegments, from.Value, to.Value);
                                }
                            });

                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.MinutesWoProactive}");
                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.MinutesWoReactive}");
                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.MinutesPm}");
                            
                            // Computed Total
                            int total = it.MinutesWoProactive + it.MinutesWoReactive + it.MinutesPm;
                            table.Cell().Element(RowStyle).AlignRight().Text($"{total}").SemiBold();
                            
                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.ReactivePct:N1}%").FontColor(Colors.Red.Medium);

                            static IContainer RowStyle(IContainer container) => container.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(5).AlignMiddle();
                        }
                    });
                });
            });
        });

        return doc.GeneratePdf();
    }

    private byte[] GenerateLaborByAssetDailyPdf(List<AssetLaborDailyItem> items, DateTimeOffset? from, DateTimeOffset? to, string? headerPath, string? footerPath)
    {
        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginTop(20, Unit.Millimetre);
                page.MarginBottom(18, Unit.Millimetre);
                page.MarginLeft(15, Unit.Millimetre);
                page.MarginRight(15, Unit.Millimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                // HEADER
                if (!string.IsNullOrEmpty(headerPath))
                {
                    page.Header().Element(header => 
                    {
                        try {
                            var bytes = System.IO.File.ReadAllBytes(headerPath);
                            header.Height(90, Unit.Point).Image(bytes, ImageScaling.FitWidth);
                        } catch { }
                    });
                }

                // FOOTER
                page.Footer().Column(col => 
                {
                    if (!string.IsNullOrEmpty(footerPath))
                    {
                        try {
                            var bytes = System.IO.File.ReadAllBytes(footerPath);
                            col.Item().Image(bytes, ImageScaling.FitWidth);
                        } catch { }
                    }
                    col.Item().AlignCenter().Text(x => 
                    {
                        x.Span("Document generat automat din CMMS Rufster · Pagina ").FontSize(7).FontColor(Colors.Grey.Medium);
                        x.CurrentPageNumber().FontSize(7).FontColor(Colors.Grey.Medium);
                        x.Span(" din ").FontSize(7).FontColor(Colors.Grey.Medium);
                        x.TotalPages().FontSize(7).FontColor(Colors.Grey.Medium);
                    });
                });

                // CONTENT
                page.Content().Column(col =>
                {
                    col.Item().PaddingBottom(5, Unit.Millimetre).Text("RAPORT INTERVENTII UTILAJE DETALIAT").FontSize(18).SemiBold().FontColor("#1E3A8A");
                    col.Item().PaddingBottom(10, Unit.Millimetre).Text($"Perioada: {(from.HasValue ? from.Value.ToString("dd.MM.yyyy") : "-")} – {(to.HasValue ? to.Value.ToString("dd.MM.yyyy") : "-")} | Generat la: {DateTime.Now:dd.MM.yyyy HH:mm}");

                    // Legend
                    AddLegend(col);

                    // Table
                    col.Item().PaddingTop(5).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(10); // Data
                            columns.RelativeColumn(20); // Utilaj
                            columns.RelativeColumn(10); // Locatie
                            columns.RelativeColumn(20); // Interventii (timeline)
                            columns.RelativeColumn(8);  // Pro
                            columns.RelativeColumn(8);  // Rea
                            columns.RelativeColumn(8);  // PM
                            columns.RelativeColumn(8);  // Total
                            columns.RelativeColumn(8);  // % Reactiv
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderStyle).Text("Data");
                            header.Cell().Element(HeaderStyle).Text("Utilaj");
                            header.Cell().Element(HeaderStyle).Text("Locatie");
                            header.Cell().Element(HeaderStyle).Text("Interventii in zi");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Pro");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Rea");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("PM");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("Total");
                            header.Cell().Element(HeaderStyle).AlignRight().Text("% Reactiv");

                            static IContainer HeaderStyle(IContainer container) => container.DefaultTextStyle(x => x.SemiBold().FontSize(8)).PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Black);
                        });

                        foreach (var it in items)
                        {
                            table.Cell().Element(RowStyle).Text(it.Date.ToString("dd.MM.yyyy")).FontSize(8);
                            table.Cell().Element(RowStyle).Text(it.AssetName).SemiBold();
                            table.Cell().Element(RowStyle).Text(it.LocationName ?? "-").FontSize(7).FontColor(Colors.Grey.Medium);

                            // Timeline for the day
                            table.Cell().Element(RowStyle).PaddingVertical(2).PaddingHorizontal(2).Column(c => {
                                // For daily report, the "range" is just that day (00:00 - 23:59)
                                // We need UTC start/end for that day to match how RenderTimeline works
                                // But RenderTimeline expects DateTimeOffset range.
                                // Construct range for the specific day to ensure the timeline fills the cell
                                var tzi = GetBucharestTzi();
                                var dayStartLocal = new DateTime(it.Date.Year, it.Date.Month, it.Date.Day, 0, 0, 0);
                                var dayEndLocal = new DateTime(it.Date.Year, it.Date.Month, it.Date.Day, 23, 59, 59);
                                
                                var dayStartUtc = new DateTimeOffset(dayStartLocal, tzi.GetUtcOffset(dayStartLocal));
                                var dayEndUtc = new DateTimeOffset(dayEndLocal, tzi.GetUtcOffset(dayEndLocal));

                                if (it.TimelineSegments != null && it.TimelineSegments.Any())
                                {
                                    RenderTimeline(c, it.TimelineSegments, dayStartUtc, dayEndUtc);
                                }
                            });

                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.MinutesWoProactive}");
                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.MinutesWoReactive}");
                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.MinutesPm}");

                            // Computed Total
                            int total = it.MinutesWoProactive + it.MinutesWoReactive + it.MinutesPm;
                            table.Cell().Element(RowStyle).AlignRight().Text($"{total}").SemiBold();

                            table.Cell().Element(RowStyle).AlignRight().Text($"{it.ReactivePct:N1}%").FontColor(Colors.Red.Medium);

                            static IContainer RowStyle(IContainer container) => container.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(5).AlignMiddle();
                        }
                    });
                });
            });
        });

        return doc.GeneratePdf();
    }

    private void AddLegend(ColumnDescriptor col)
    {
        col.Item().PaddingBottom(5, Unit.Millimetre).Text("Legenda:").SemiBold();
        col.Item().Row(row => 
        {
            // PM
            row.ConstantItem(10).Height(10).Background("#10b981");
            row.ConstantItem(5);
            row.AutoItem().Text("PM").FontSize(8);
            row.ConstantItem(15);
            
            // Proactive
            row.ConstantItem(10).Height(10).Background("#0ea5e9");
            row.ConstantItem(5);
            row.AutoItem().Text("WO Proactiv").FontSize(8);
            row.ConstantItem(15);

            // Reactive
            row.ConstantItem(10).Height(10).Background("#f43f5e");
            row.ConstantItem(5);
            row.AutoItem().Text("WO Reactiv").FontSize(8);
            row.ConstantItem(15);

            // Extra
            row.ConstantItem(10).Height(10).Background("#2563eb");
            row.ConstantItem(5);
            row.AutoItem().Text("Activitati Extra").FontSize(8);
        });
    }

    private void RenderTimeline(ColumnDescriptor c, List<TimelineSegmentDto> segments, DateTimeOffset rangeStart, DateTimeOffset rangeEnd)
    {
        var fTicks = rangeStart.Ticks;
        var tTicks = rangeEnd.Ticks;
        var range = tTicks - fTicks;

        if (range <= 0) return;

        c.Item().Height(12).Background(Colors.Grey.Lighten4).Row(row => {
            var sortedSegments = segments.OrderBy(s => s.StartUtc).ToList();
            long currentPos = fTicks;

            foreach(var seg in sortedSegments)
            {
                var s = seg.StartUtc.Ticks;
                var e = seg.StopUtc.Ticks; 
                
                if (s > currentPos)
                {
                    float gapWidth = (float)(s - currentPos) / range;
                    if (gapWidth > 0.0001f && !float.IsNaN(gapWidth) && !float.IsInfinity(gapWidth)) 
                        row.RelativeItem(gapWidth).Height(12);
                }
                
                var startInRange = Math.Max(fTicks, s);
                var endInRange = Math.Min(tTicks, e);
                
                if (endInRange > startInRange)
                {
                    float segWidth = (float)(endInRange - startInRange) / range;
                    if (segWidth > 0.0001f && !float.IsNaN(segWidth) && !float.IsInfinity(segWidth))
                    {
                        string color = "#71717a"; // Default zinc
                        if (seg.Type == "PM") color = "#10b981";
                        else if (seg.Type == "Proactive") color = "#0ea5e9";
                        else if (seg.Type == "Reactive") color = "#f43f5e";
                        else if (seg.Type == "Extra") color = "#2563eb";

                        row.RelativeItem(segWidth)
                            .Background(color)
                            .Height(12);
                    }
                }
                currentPos = Math.Max(currentPos, e);
            }
            
            // Fill remaining space
            if (tTicks > currentPos)
            {
                float finalGapWidth = (float)(tTicks - currentPos) / range;
                if (finalGapWidth > 0.0001f && !float.IsNaN(finalGapWidth) && !float.IsInfinity(finalGapWidth)) 
                    row.RelativeItem(finalGapWidth).Height(12);
            }
        });
    }
}
