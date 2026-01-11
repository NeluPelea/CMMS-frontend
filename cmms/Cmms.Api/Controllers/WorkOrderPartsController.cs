using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/work-orders/{workOrderId:guid}/parts")]
[Authorize]
public sealed class WorkOrderPartsController : ControllerBase
{
	private readonly AppDbContext _db;
	public WorkOrderPartsController(AppDbContext db) => _db = db;

	public sealed record WoPartDto(
		Guid Id,
		Guid WorkOrderId,
		Guid PartId,
		string PartName,
		string? PartCode,
		string? Uom,
		decimal QtyUsed
	);

	public sealed record AddReq(Guid PartId, decimal QtyUsed);

	[HttpGet]
	public async Task<IActionResult> List(Guid workOrderId)
	{
		var ok = await _db.WorkOrders.AsNoTracking().AnyAsync(x => x.Id == workOrderId);
		if (!ok) return NotFound("work order not found");

		var items = await _db.WorkOrderParts.AsNoTracking()
			.Where(x => x.WorkOrderId == workOrderId)
			.Join(_db.Parts.AsNoTracking(),
				wop => wop.PartId,
				p => p.Id,
				(wop, p) => new WoPartDto(
					wop.Id,
					wop.WorkOrderId,
					wop.PartId,
					p.Name,
					p.Code,
					p.Uom,
					wop.QtyUsed
				))
			.OrderBy(x => x.PartName)
			.ToListAsync();

		return Ok(items);
	}

	[HttpPost]
	public async Task<IActionResult> Add(Guid workOrderId, [FromBody] AddReq req)
	{
		if (req.QtyUsed <= 0m) return BadRequest("QtyUsed must be > 0");

		var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == workOrderId);
		if (wo == null) return NotFound("work order not found");

		var partOk = await _db.Parts.AsNoTracking().AnyAsync(x => x.Id == req.PartId && x.IsAct);
		if (!partOk) return BadRequest("bad partId");

		// upsert: daca exista deja rand pentru (WO, Part), adunam
		var row = await _db.WorkOrderParts
			.FirstOrDefaultAsync(x => x.WorkOrderId == workOrderId && x.PartId == req.PartId);

		if (row == null)
		{
			row = new WorkOrderPart
			{
				WorkOrderId = workOrderId,
				PartId = req.PartId,
				QtyUsed = req.QtyUsed
			};
			_db.WorkOrderParts.Add(row);
		}
		else
		{
			row.QtyUsed += req.QtyUsed;
		}

		await _db.SaveChangesAsync();
		return NoContent();
	}

	[HttpDelete("{id:guid}")]
	public async Task<IActionResult> Delete(Guid workOrderId, Guid id)
	{
		var row = await _db.WorkOrderParts.FirstOrDefaultAsync(x => x.Id == id && x.WorkOrderId == workOrderId);
		if (row == null) return NotFound();

		_db.WorkOrderParts.Remove(row);
		await _db.SaveChangesAsync();
		return NoContent();
	}

	public sealed record SetQtyReq(decimal QtyUsed);

	[HttpPost("{id:guid}/set-qty")]
	public async Task<IActionResult> SetQty(Guid workOrderId, Guid id, [FromBody] SetQtyReq req)
	{
		if (req.QtyUsed < 0m) return BadRequest("QtyUsed must be >= 0");

		var row = await _db.WorkOrderParts.FirstOrDefaultAsync(x => x.Id == id && x.WorkOrderId == workOrderId);
		if (row == null) return NotFound();

		row.QtyUsed = req.QtyUsed;
		await _db.SaveChangesAsync();
		return NoContent();
	}
}
