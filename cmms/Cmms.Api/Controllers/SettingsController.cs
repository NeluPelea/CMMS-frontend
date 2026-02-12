using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public sealed class SettingsController : ControllerBase
{
    private readonly AppDbContext _db;

    public SettingsController(AppDbContext db)
    {
        _db = db;
    }

    public sealed record SettingsDto(
        decimal VatRate,
        decimal FxRonEur,
        decimal FxRonUsd
    );

    [HttpGet]
    [Authorize(Policy = "Perm:SETTINGS_READ")]
    public async Task<IActionResult> Get()
    {
        var all = await _db.AppSettings.ToDictionaryAsync(x => x.Key, x => x.Value);

        decimal Parse(string key, decimal def)
        {
            if (all.TryGetValue(key, out var val) && val != null)
            {
                if (decimal.TryParse(val, NumberStyles.Any, CultureInfo.InvariantCulture, out var d))
                    return d;
            }
            return def;
        }

        return Ok(new SettingsDto(
            Parse("VAT_RATE", 19m),
            Parse("FX_RON_EUR", 4.95m),
            Parse("FX_RON_USD", 4.60m)
        ));
    }

    [HttpPut]
    [Authorize(Policy = "Perm:SETTINGS_UPDATE")]
    public async Task<IActionResult> Update([FromBody] SettingsDto req)
    {
        if (req.VatRate < 0 || req.VatRate > 100)
            return BadRequest("TVA invalid (0-100)");

        if (req.FxRonEur <= 0 || req.FxRonUsd <= 0)
            return BadRequest("Rate must be > 0");

        async Task Upsert(string key, decimal val)
        {
            var existing = await _db.AppSettings.FindAsync(key);
            var strVal = val.ToString(CultureInfo.InvariantCulture);
            if (existing == null)
            {
                _db.AppSettings.Add(new AppSetting { Key = key, Value = strVal });
            }
            else
            {
                existing.Value = strVal;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        await Upsert("VAT_RATE", req.VatRate);
        await Upsert("FX_RON_EUR", req.FxRonEur);
        await Upsert("FX_RON_USD", req.FxRonUsd);

        await _db.SaveChangesAsync();
        return Ok();
    }
}
