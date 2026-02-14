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
    [Authorize(Policy = "Perm:ASSET_READ")]
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
            var s = q.Trim();
            qry = qry.Where(x =>
                EF.Functions.ILike(x.Name, $"%{s}%") ||
                (x.Code != null && EF.Functions.ILike(x.Code, $"%{s}%")) ||
                (x.Location != null && EF.Functions.ILike(x.Location.Name, $"%{s}%"))
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
            isAct = x.IsAct,
            ranking = x.Ranking,
            serialNumber = x.SerialNumber,
            inventoryNumber = x.InventoryNumber,
            assetClass = x.AssetClass,
            manufacturer = x.Manufacturer,
            manufactureYear = x.ManufactureYear,
            commissionedAt = x.CommissionedAt,
            status = (int)x.Status
        });

        return Ok(dto);
    }

    public record CreateReq(
        string Name, 
        string? Code, 
        Guid? LocId, 
        string? Ranking, 
        string? SerialNumber, 
        string? InventoryNumber,
        string? AssetClass,
        string? Manufacturer,
        int? ManufactureYear,
        DateOnly? CommissionedAt
    );
    
    public record UpdateReq(
        string Name, 
        string? Code, 
        Guid? LocId, 
        string? Ranking, 
        string? SerialNumber, 
        string? InventoryNumber,
        string? AssetClass,
        string? Manufacturer,
        int? ManufactureYear,
        DateOnly? CommissionedAt
    );

    [HttpPost]
    [Authorize(Policy = "Perm:ASSET_CREATE")]
    public async Task<IActionResult> Create(CreateReq req)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length < 2) return BadRequest("name too short");

        // Validate Ranking
        string? ranking = null;
        if (!string.IsNullOrWhiteSpace(req.Ranking))
        {
            ranking = req.Ranking.Trim().ToUpper();
            if (ranking.Length != 1 || ranking[0] < 'A' || ranking[0] > 'Z')
                return BadRequest("Ranking must be a single letter A-Z");
        }

        // Validate ManufactureYear
        if (req.ManufactureYear.HasValue)
        {
            var year = req.ManufactureYear.Value;
            var currentYear = DateTime.Today.Year;
            if (year < 1950 || year > currentYear + 1)
                return BadRequest($"Invalid ManufactureYear ({year}). Must be between 1950 and {currentYear + 1}.");
        }

        if (req.LocId.HasValue)
        {
            var ok = await _db.Locations.AsNoTracking().AnyAsync(l => l.Id == req.LocId.Value && l.IsAct);
            if (!ok) return BadRequest("bad locId");
        }

        var x = new Asset
        {
            Name = name,
            Code = string.IsNullOrWhiteSpace(req.Code) ? null : req.Code.Trim(),
            LocationId = req.LocId,
            Ranking = ranking,
            SerialNumber = string.IsNullOrWhiteSpace(req.SerialNumber) ? null : req.SerialNumber.Trim(),
            InventoryNumber = string.IsNullOrWhiteSpace(req.InventoryNumber) ? null : req.InventoryNumber.Trim(),
            AssetClass = string.IsNullOrWhiteSpace(req.AssetClass) ? null : req.AssetClass.Trim(),
            Manufacturer = string.IsNullOrWhiteSpace(req.Manufacturer) ? null : req.Manufacturer.Trim(),
            ManufactureYear = req.ManufactureYear,
            CommissionedAt = req.CommissionedAt,
            Status = AssetStatus.Operational
        };

        _db.Assets.Add(x);
        await _db.SaveChangesAsync();

        return Ok(new { 
            id = x.Id, 
            name = x.Name, 
            code = x.Code, 
            locId = x.LocationId, 
            locName = (string?)null, 
            isAct = x.IsAct,
            ranking = x.Ranking,
            serialNumber = x.SerialNumber,
            inventoryNumber = x.InventoryNumber,
            assetClass = x.AssetClass,
            manufacturer = x.Manufacturer,
            manufactureYear = x.ManufactureYear,
            commissionedAt = x.CommissionedAt,
            status = (int)x.Status
        });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Perm:ASSET_UPDATE")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReq req)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length < 2) return BadRequest("name too short");

        // Validate Ranking
        string? ranking = null;
        if (!string.IsNullOrWhiteSpace(req.Ranking))
        {
            ranking = req.Ranking.Trim().ToUpper();
            if (ranking.Length != 1 || ranking[0] < 'A' || ranking[0] > 'Z')
                return BadRequest("Ranking must be a single letter A-Z");
        }

        // Validate ManufactureYear
        if (req.ManufactureYear.HasValue)
        {
            var year = req.ManufactureYear.Value;
            var currentYear = DateTime.Today.Year;
            if (year < 1950 || year > currentYear + 1)
                return BadRequest($"Invalid ManufactureYear ({year}). Must be between 1950 and {currentYear + 1}.");
        }

        var x = await _db.Assets.FirstOrDefaultAsync(a => a.Id == id);
        if (x == null) return NotFound();

        if (req.LocId.HasValue && req.LocId != x.LocationId)
        {
            var ok = await _db.Locations.AsNoTracking().AnyAsync(l => l.Id == req.LocId.Value && l.IsAct);
            if (!ok) return BadRequest("bad locId");
        }

        x.Name = name;
        x.Code = string.IsNullOrWhiteSpace(req.Code) ? null : req.Code.Trim();
        x.LocationId = req.LocId;
        x.Ranking = ranking;
        x.SerialNumber = string.IsNullOrWhiteSpace(req.SerialNumber) ? null : req.SerialNumber.Trim();
        x.InventoryNumber = string.IsNullOrWhiteSpace(req.InventoryNumber) ? null : req.InventoryNumber.Trim();
        x.AssetClass = string.IsNullOrWhiteSpace(req.AssetClass) ? null : req.AssetClass.Trim();
        x.Manufacturer = string.IsNullOrWhiteSpace(req.Manufacturer) ? null : req.Manufacturer.Trim();
        x.ManufactureYear = req.ManufactureYear;
        x.CommissionedAt = req.CommissionedAt;
        
        await _db.SaveChangesAsync();

        return Ok(new { 
            id = x.Id, 
            name = x.Name, 
            code = x.Code, 
            locId = x.LocationId, 
            locName = (string?)null, 
            isAct = x.IsAct,
            ranking = x.Ranking,
            serialNumber = x.SerialNumber,
            inventoryNumber = x.InventoryNumber,
            assetClass = x.AssetClass,
            manufacturer = x.Manufacturer,
            manufactureYear = x.ManufactureYear,
            commissionedAt = x.CommissionedAt,
            status = (int)x.Status
        });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Perm:ASSET_DELETE")]
    public async Task<IActionResult> SoftDelete(Guid id)
    {
        var x = await _db.Assets.FirstOrDefaultAsync(a => a.Id == id);
        if (x == null) return NotFound();
        x.IsAct = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
