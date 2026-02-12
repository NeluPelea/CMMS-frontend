using Cmms.Domain;
using Cmms.Infrastructure;
using Cmms.Api.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/nc")]
[Authorize]
public class NcController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly Cmms.Api.Services.NcPdfService _pdfService;

    public NcController(AppDbContext db, Cmms.Api.Services.NcPdfService pdfService)
    {
        _db = db;
        _pdfService = pdfService;
    }

    [HttpGet("{id}/pdf")]
    [Authorize(Policy = "Perm:NC_PDF_GENERATE")]
    public async Task<IActionResult> GetPdf(Guid id)
    {
        var order = await _db.NcOrders
            .Include(o => o.Supplier)
            .Include(o => o.DeliveryLocation)
            .Include(o => o.ReceiverPerson)
            .Include(o => o.WorkOrder)
            .Include(o => o.Asset)
            .Include(o => o.Lines)
                .ThenInclude(l => l.Part)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound();
        if (order.SupplierId == Guid.Empty || !order.Lines.Any())
            return BadRequest("Cannot generate PDF: Missing supplier or lines.");

        var pdfBytes = _pdfService.GenerateNcPdf(order);
        return File(pdfBytes, "application/pdf", $"{order.NcNumber}.pdf");
    }

    [HttpGet]
    [Authorize(Policy = "Perm:NC_READ")]
    public async Task<IActionResult> List(
        [FromQuery] string? query,
        [FromQuery] NcOrderStatus? status,
        [FromQuery] Guid? supplierId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
    {
        var q = _db.NcOrders
            .Include(o => o.Supplier)
            .AsQueryable();

        if (!string.IsNullOrEmpty(query))
            q = q.Where(o => o.NcNumber.Contains(query) || o.Notes!.Contains(query));

        if (status.HasValue)
            q = q.Where(o => o.Status == status.Value);

        if (supplierId.HasValue)
            q = q.Where(o => o.SupplierId == supplierId.Value);

        if (from.HasValue)
            q = q.Where(o => o.OrderDate >= from.Value);

        if (to.HasValue)
            q = q.Where(o => o.OrderDate <= to.Value);

        var list = await q
            .OrderByDescending(o => o.OrderDate)
            .Select(o => new NcOrderSummaryDto(
                o.Id,
                o.NcNumber,
                o.Status,
                o.Supplier!.Name,
                o.Currency,
                o.Total,
                o.OrderDate,
                o.NeededByDate,
                o.Priority
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id}")]
    [Authorize(Policy = "Perm:NC_READ")]
    public async Task<IActionResult> GetDetails(Guid id)
    {
        var order = await _db.NcOrders
            .Include(o => o.Supplier)
            .Include(o => o.DeliveryLocation)
            .Include(o => o.ReceiverPerson)
            .Include(o => o.WorkOrder)
            .Include(o => o.Asset)
            .Include(o => o.Lines)
                .ThenInclude(l => l.Part)
            .Include(o => o.Lines)
                .ThenInclude(l => l.SupplierPart)
            .Include(o => o.Attachments)
                .ThenInclude(a => a.UploadedByUser)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound();

        var dto = new NcOrderDetailsDto(
            order.Id,
            order.NcNumber,
            order.Status,
            order.SupplierId,
            order.Supplier?.Name ?? "",
            order.Currency,
            order.OrderDate,
            order.NeededByDate,
            order.Priority,
            order.Notes,
            order.DeliveryLocationId,
            order.DeliveryLocation?.Name,
            order.DeliveryAddressOverride,
            order.ReceiverPersonId,
            order.ReceiverPerson?.FullName,
            order.ReceiverPhone,
            order.WorkOrderId,
            order.WorkOrder?.Title,
            order.AssetId,
            order.Asset?.Name,
            order.Reason,
            order.Subtotal,
            order.VatPercent,
            order.VatAmount,
            order.Total,
            order.CreatedAt,
            order.UpdatedAt,
            order.Lines.OrderBy(l => l.SortOrder).Select(l => new NcOrderLineDto(
                l.Id,
                l.PartId,
                l.SupplierPartId,
                l.PartNameManual,
                l.SupplierSku,
                l.Uom,
                l.Qty,
                l.UnitPrice,
                l.Currency,
                l.DiscountPercent,
                l.LineTotal,
                l.LeadTimeDays,
                l.Notes,
                l.SortOrder
            )).ToList(),
            order.Attachments.OrderByDescending(a => a.UploadedAt).Select(a => new NcOrderAttachmentDto(
                a.Id,
                a.FileName,
                a.ContentType,
                a.UploadedByUserId,
                a.UploadedByUser?.DisplayName ?? "System",
                a.UploadedAt
            )).ToList()
        );

        return Ok(dto);
    }

    [HttpPost]
    [Authorize(Policy = "Perm:NC_CREATE")]
    public async Task<IActionResult> Create(CreateNcOrderReq req)
    {
        var ncNumber = req.NcNumber;
        if (string.IsNullOrEmpty(ncNumber))
        {
            // Auto generate format: NC-2024-001
            var year = DateTime.UtcNow.Year;
            var count = await _db.NcOrders.CountAsync(x => x.OrderDate.Year == year) + 1;
            ncNumber = $"NC-{year}-{count:D3}";
        }

        var order = new NcOrder
        {
            NcNumber = ncNumber,
            SupplierId = req.SupplierId,
            Currency = req.Currency,
            OrderDate = req.OrderDate,
            NeededByDate = req.NeededByDate,
            Priority = req.Priority,
            Notes = req.Notes,
            DeliveryLocationId = req.DeliveryLocationId,
            DeliveryAddressOverride = req.DeliveryAddressOverride,
            ReceiverPersonId = req.ReceiverPersonId,
            ReceiverPhone = req.ReceiverPhone,
            WorkOrderId = req.WorkOrderId,
            AssetId = req.AssetId,
            Reason = req.Reason,
            Status = NcOrderStatus.Draft
        };

        _db.NcOrders.Add(order);
        await _db.SaveChangesAsync();

        return Ok(new { id = order.Id });
    }

    [HttpPut("{id}")]
    [Authorize(Policy = "Perm:NC_UPDATE")]
    public async Task<IActionResult> Update(Guid id, UpdateNcOrderReq req)
    {
        var order = await _db.NcOrders.FindAsync(id);
        if (order == null) return NotFound();
        
        if (order.Status != NcOrderStatus.Draft && order.Status != NcOrderStatus.Sent)
            return BadRequest("Cannot update NC in current status.");

        order.SupplierId = req.SupplierId;
        order.Currency = req.Currency;
        order.OrderDate = req.OrderDate;
        order.NeededByDate = req.NeededByDate;
        order.Priority = req.Priority;
        order.Notes = req.Notes;
        order.DeliveryLocationId = req.DeliveryLocationId;
        order.DeliveryAddressOverride = req.DeliveryAddressOverride;
        order.ReceiverPersonId = req.ReceiverPersonId;
        order.ReceiverPhone = req.ReceiverPhone;
        order.WorkOrderId = req.WorkOrderId;
        order.AssetId = req.AssetId;
        order.Reason = req.Reason;
        order.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/lines")]
    [Authorize(Policy = "Perm:NC_UPDATE")]
    public async Task<IActionResult> AddLine(Guid id, SaveNcOrderLineReq req)
    {
        var order = await _db.NcOrders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();

        var line = new NcOrderLine
        {
            NcOrderId = id,
            PartId = req.PartId,
            SupplierPartId = req.SupplierPartId,
            PartNameManual = req.PartNameManual,
            SupplierSku = req.SupplierSku,
            Uom = req.Uom,
            Qty = req.Qty,
            UnitPrice = req.UnitPrice,
            Currency = req.Currency,
            DiscountPercent = req.DiscountPercent,
            LeadTimeDays = req.LeadTimeDays,
            Notes = req.Notes,
            SortOrder = req.SortOrder,
            LineTotal = req.Qty * req.UnitPrice * (1 - req.DiscountPercent / 100)
        };

        order.Lines.Add(line);
        RecalculateTotals(order);
        
        await _db.SaveChangesAsync();
        return Ok(new { id = line.Id });
    }

    [HttpPut("{id}/lines/{lineId}")]
    [Authorize(Policy = "Perm:NC_UPDATE")]
    public async Task<IActionResult> UpdateLine(Guid id, Guid lineId, SaveNcOrderLineReq req)
    {
        var order = await _db.NcOrders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();

        var line = order.Lines.FirstOrDefault(l => l.Id == lineId);
        if (line == null) return NotFound();

        line.PartId = req.PartId;
        line.SupplierPartId = req.SupplierPartId;
        line.PartNameManual = req.PartNameManual;
        line.SupplierSku = req.SupplierSku;
        line.Uom = req.Uom;
        line.Qty = req.Qty;
        line.UnitPrice = req.UnitPrice;
        line.Currency = req.Currency;
        line.DiscountPercent = req.DiscountPercent;
        line.LeadTimeDays = req.LeadTimeDays;
        line.Notes = req.Notes;
        line.SortOrder = req.SortOrder;
        line.LineTotal = req.Qty * req.UnitPrice * (1 - req.DiscountPercent / 100);

        RecalculateTotals(order);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}/lines/{lineId}")]
    [Authorize(Policy = "Perm:NC_UPDATE")]
    public async Task<IActionResult> DeleteLine(Guid id, Guid lineId)
    {
        var order = await _db.NcOrders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();

        var line = order.Lines.FirstOrDefault(l => l.Id == lineId);
        if (line == null) return NotFound();

        order.Lines.Remove(line);
        RecalculateTotals(order);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/status")]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromQuery] NcOrderStatus newStatus)
    {
        var order = await _db.NcOrders.FindAsync(id);
        if (order == null) return NotFound();

        // Validation Rules
        bool allowed = false;
        if (order.Status == NcOrderStatus.Draft && (newStatus == NcOrderStatus.Sent || newStatus == NcOrderStatus.Cancelled)) 
            allowed = true;
        else if (order.Status == NcOrderStatus.Sent && (newStatus == NcOrderStatus.Confirmed || newStatus == NcOrderStatus.Cancelled))
            allowed = true;
        else if (order.Status == NcOrderStatus.Confirmed && (newStatus == NcOrderStatus.PartiallyReceived || newStatus == NcOrderStatus.Received))
            allowed = true;
        else if (order.Status == NcOrderStatus.PartiallyReceived && newStatus == NcOrderStatus.Received)
            allowed = true;

        if (!allowed) return BadRequest("Transition not allowed.");

        if (newStatus == NcOrderStatus.Cancelled)
        {
            if (!User.HasClaim("Perm", "NC_CANCEL")) return Forbid();
        }

        order.Status = newStatus;
        await _db.SaveChangesAsync();
        return Ok();
    }

    private void RecalculateTotals(NcOrder order)
    {
        order.Subtotal = order.Lines.Sum(l => l.LineTotal);
        order.VatAmount = order.Subtotal * (order.VatPercent / 100);
        order.Total = order.Subtotal + order.VatAmount;
        order.UpdatedAt = DateTime.UtcNow;
    }

    [HttpGet("suppliers")]
    public async Task<IActionResult> ListSuppliers()
    {
        var list = await _db.Suppliers
            .Where(s => s.IsActive)
            .OrderBy(s => s.Name)
            .Select(s => new SupplierDto(s.Id, s.Name, s.Code, s.ContactName, s.Email, s.Phone, s.Address, s.Website, s.IsActive))
            .ToListAsync();
        return Ok(list);
    }
}
