using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/parts")]
[Authorize]
public sealed class PartsController : ControllerBase
{
    private readonly AppDbContext _db;
    public PartsController(AppDbContext db) => _db = db;

    public sealed record PartDto(
        Guid Id,
        string Name,
        string? Code,
        string? Uom,
        bool IsAct
    );

    public sealed record CreateReq(
        string? Name,
        string? Code,
        string? Uom
    );

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? q = null,
        [FromQuery] int take = 200,
        [FromQuery] bool ia = false)
    {
        if (take <= 0) take = 200;
        if (take > 500) take = 500;

        var qry = _db.Parts.AsNoTracking().AsQueryable();

        if (!ia)
            qry = qry.Where(x => x.IsAct);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim();
            qry = qry.Where(x =>
                EF.Functions.ILike(x.Name, $"%{s}%") ||
                (x.Code != null && EF.Functions.ILike(x.Code, $"%{s}%"))
            );
        }

        var items = await qry
            .OrderBy(x => x.Name)
            .Take(take)
            .Select(x => new PartDto(
                x.Id,
                x.Name,
                x.Code,
                x.Uom,
                x.IsAct))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReq req)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length < 2)
            return BadRequest("name too short");

        var part = new Part
        {
            Name = name,
            Code = string.IsNullOrWhiteSpace(req.Code) ? null : req.Code.Trim(),
            Uom = string.IsNullOrWhiteSpace(req.Uom) ? null : req.Uom.Trim(),
            IsAct = true
        };

        _db.Parts.Add(part);

        _db.Inventory.Add(new InventoryItem
        {
            PartId = part.Id,
            QtyOnHand = 0m,
            MinQty = null
        });

        await _db.SaveChangesAsync();

        return Ok(new PartDto(
            part.Id,
            part.Name,
            part.Code,
            part.Uom,
            part.IsAct));
    }
}
