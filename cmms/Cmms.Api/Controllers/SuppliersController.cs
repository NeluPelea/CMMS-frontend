using Cmms.Domain;
using Cmms.Infrastructure;
using Cmms.Api.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http;
using Microsoft.Extensions.Caching.Memory;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/suppliers")]
[Authorize]
public class SuppliersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly Microsoft.Extensions.Caching.Memory.IMemoryCache _cache;

    public SuppliersController(
        AppDbContext db, 
        IHttpClientFactory httpClientFactory,
        Microsoft.Extensions.Caching.Memory.IMemoryCache cache)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _cache = cache;
    }

    [HttpGet]
    [Authorize(Policy = "Perm:SUPPLIERS_READ")]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] bool? isActive,
        [FromQuery] bool? isPreferred,
        [FromQuery] bool? hasParts,
        [FromQuery] int take = 100,
        [FromQuery] int skip = 0)
    {
        var query = _db.Suppliers.AsQueryable();

        if (!string.IsNullOrEmpty(q))
        {
            var term = q.ToLower();
            query = query.Where(s => 
                s.Name.ToLower().Contains(term) || 
                (s.TaxId != null && s.TaxId.ToLower().Contains(term)) ||
                (s.Code != null && s.Code.ToLower().Contains(term)) ||
                s.Contacts.Any(c => c.FullName.ToLower().Contains(term) || (c.Email != null && c.Email.ToLower().Contains(term))));
        }

        if (isActive.HasValue)
            query = query.Where(s => s.IsActive == isActive.Value);

        if (isPreferred.HasValue)
            query = query.Where(s => s.IsPreferred == isPreferred.Value);

        if (hasParts.HasValue)
        {
            if (hasParts.Value) query = query.Where(s => s.SupplierParts.Any());
            else query = query.Where(s => !s.SupplierParts.Any());
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(s => s.Name)
            .Skip(skip)
            .Take(take)
            .Select(s => new SupplierSummaryDto(
                s.Id,
                s.Name,
                s.Code,
                s.IsActive,
                s.IsPreferred,
                s.City,
                s.WebsiteUrl,
                s.Contacts
                    .Where(c => c.IsActive)
                    .OrderByDescending(c => c.IsPrimary)
                    .ThenBy(c => c.FullName)
                    .Select(c => new SupplierSummaryContactDto(c.FullName, c.Phone, c.Email))
                    .ToList()
            ))
            .ToListAsync();

        return Ok(new { total, items });
    }

    [HttpGet("{id}")]
    [Authorize(Policy = "Perm:SUPPLIERS_READ")]
    public async Task<IActionResult> GetDetails(Guid id)
    {
        var s = await _db.Suppliers
            .Include(x => x.Contacts)
            .Include(x => x.SupplierParts)
                .ThenInclude(p => p.Part)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (s == null) return NotFound();

        var dto = new SupplierDetailsDto(
            s.Id,
            s.Name,
            s.Code,
            s.IsActive,
            s.IsPreferred,
            s.WebsiteUrl,
            s.TaxId,
            s.RegCom,
            s.AddressLine1,
            s.City,
            s.County,
            s.Country,
            s.PostalCode,
            s.PaymentTermsDays,
            s.Currency,
            s.Iban,
            s.BankName,
            s.Notes,
            s.CreatedAt,
            s.UpdatedAt,
            s.Contacts.Select(c => new SupplierContactDto(
                c.Id, c.FullName, c.RoleTitle, c.Phone, c.Email, c.IsPrimary, c.IsActive, c.Notes, c.CreatedAt, c.UpdatedAt
            )).ToList(),
            s.SupplierParts.Select(p => new SupplierPartDto(
                p.Id, p.PartId, p.Part?.Name ?? "Unknown", p.Part?.Code, p.SupplierSku, p.LastUnitPrice, p.Currency, p.DiscountPercent, p.LeadTimeDays, p.Moq, p.ProductUrl, p.Notes, p.LastPriceUpdatedAt, p.IsActive
            )).ToList()
        );

        return Ok(dto);
    }

    [HttpPost("{id}/favorite")]
    [Authorize(Policy = "Perm:SUPPLIERS_UPDATE")]
    public async Task<IActionResult> ToggleFavorite(Guid id, [FromBody] bool isPreferred)
    {
        var s = await _db.Suppliers.FindAsync(id);
        if (s == null) return NotFound();

        s.IsPreferred = isPreferred;
        s.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { s.Id, s.IsPreferred });
    }

    [HttpGet("logo")]
    [Authorize(Policy = "Perm:SUPPLIERS_READ")]
    public async Task<IActionResult> GetLogo([FromQuery] string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return BadRequest();
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return BadRequest();

        var host = uri.Host.ToLower();
        var cacheKey = $"supplier_logo_{host}";

        if (_cache.TryGetValue(cacheKey, out byte[]? cachedBytes))
        {
            return File(cachedBytes!, "image/x-icon"); // Simplification
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(3);

            // Try common favicon locations
            var faviconUrl = $"{uri.Scheme}://{uri.Host}/favicon.ico";
            var response = await client.GetAsync(faviconUrl);

            if (response.IsSuccessStatusCode)
            {
                var bytes = await response.Content.ReadAsByteArrayAsync();
                var contentType = response.Content.Headers.ContentType?.ToString() ?? "image/x-icon";

                _cache.Set(cacheKey, bytes, TimeSpan.FromHours(24));
                return File(bytes, contentType);
            }
        }
        catch { /* Best effort only */ }

        return NotFound();
    }

    [HttpPost]
    [Authorize(Policy = "Perm:SUPPLIERS_CREATE")]
    public async Task<IActionResult> Create(SupplierCreateReq req)
    {
        var s = new Supplier
        {
            Name = req.Name,
            Code = Nullify(req.Code),
            IsPreferred = req.IsPreferred,
            WebsiteUrl = NormalizeUrl(req.WebsiteUrl),
            TaxId = Nullify(req.TaxId),
            RegCom = Nullify(req.RegCom),
            AddressLine1 = req.AddressLine1,
            City = req.City,
            County = req.County,
            Country = req.Country,
            PostalCode = req.PostalCode,
            PaymentTermsDays = req.PaymentTermsDays,
            Currency = req.Currency,
            Iban = req.Iban,
            BankName = req.BankName,
            Notes = req.Notes
        };

        // Sync old fields for backward compatibility
        s.Address = s.AddressLine1;
        s.Website = s.WebsiteUrl;

        _db.Suppliers.Add(s);
        await _db.SaveChangesAsync();

        return Ok(new { id = s.Id });
    }

    [HttpPut("{id}")]
    [Authorize(Policy = "Perm:SUPPLIERS_UPDATE")]
    public async Task<IActionResult> Update(Guid id, SupplierUpdateReq req)
    {
        var s = await _db.Suppliers.FindAsync(id);
        if (s == null) return NotFound();

        // Validation
        if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length < 2)
            return BadRequest("Numele furnizorului trebuie să aibă minim 2 caractere.");

        s.Name = req.Name.Trim();
        s.Code = Nullify(req.Code);
        s.IsActive = req.IsActive;
        s.IsPreferred = req.IsPreferred;
        s.WebsiteUrl = NormalizeUrl(req.WebsiteUrl);
        s.TaxId = Nullify(req.TaxId);
        s.RegCom = Nullify(req.RegCom);
        s.AddressLine1 = req.AddressLine1;
        s.City = req.City;
        s.County = req.County;
        s.Country = req.Country;
        s.PostalCode = req.PostalCode;
        s.PaymentTermsDays = req.PaymentTermsDays;
        s.Currency = req.Currency;
        s.Iban = req.Iban;
        s.BankName = req.BankName;
        s.Notes = req.Notes;
        s.UpdatedAt = DateTime.UtcNow;

        // Sync old fields
        s.Address = s.AddressLine1;
        s.Website = s.WebsiteUrl;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = "Perm:SUPPLIERS_DELETE")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var s = await _db.Suppliers.FindAsync(id);
        if (s == null) return NotFound();

        // Soft delete
        s.IsActive = false;
        s.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // --- Contacts ---

    [HttpPost("{id}/contacts")]
    [Authorize(Policy = "Perm:SUPPLIER_CONTACTS_UPDATE")]
    public async Task<IActionResult> AddContact(Guid id, ContactSaveReq req)
    {
        var s = await _db.Suppliers.Include(x => x.Contacts).FirstOrDefaultAsync(x => x.Id == id);
        if (s == null) return NotFound();

        if (req.IsPrimary) 
        {
            var others = await _db.SupplierContacts.Where(c => c.SupplierId == id && c.IsPrimary).ToListAsync();
            foreach (var c in others) c.IsPrimary = false;
        }

        var contact = new SupplierContact
        {
            SupplierId = id,
            FullName = req.FullName,
            RoleTitle = req.RoleTitle,
            Phone = req.Phone,
            Email = req.Email,
            IsPrimary = req.IsPrimary,
            IsActive = req.IsActive,
            Notes = req.Notes
        };

        _db.SupplierContacts.Add(contact);
        await _db.SaveChangesAsync();

        return Ok(new { id = contact.Id });
    }

    [HttpPut("{id}/contacts/{contactId}")]
    [Authorize(Policy = "Perm:SUPPLIER_CONTACTS_UPDATE")]
    public async Task<IActionResult> UpdateContact(Guid id, Guid contactId, ContactSaveReq req)
    {
        var s = await _db.Suppliers.Include(x => x.Contacts).FirstOrDefaultAsync(x => x.Id == id);
        if (s == null) return NotFound();

        var contact = s.Contacts.FirstOrDefault(x => x.Id == contactId);
        if (contact == null) return NotFound();

        if (req.IsPrimary) 
        {
            var others = await _db.SupplierContacts.Where(c => c.SupplierId == id && c.Id != contactId && c.IsPrimary).ToListAsync();
            foreach (var c in others) c.IsPrimary = false;
        }
        else if (contact.IsPrimary)
        {
            // If we are unsetting primary, but it's the only one, maybe keep it?
        }

        contact.FullName = req.FullName;
        contact.RoleTitle = req.RoleTitle;
        contact.Phone = req.Phone;
        contact.Email = req.Email;
        contact.IsPrimary = req.IsPrimary;
        contact.IsActive = req.IsActive;
        contact.Notes = req.Notes;
        contact.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}/contacts/{contactId}")]
    [Authorize(Policy = "Perm:SUPPLIER_CONTACTS_UPDATE")]
    public async Task<IActionResult> DeleteContact(Guid id, Guid contactId)
    {
        var contact = await _db.SupplierContacts.FirstOrDefaultAsync(x => x.Id == contactId && x.SupplierId == id);
        if (contact == null) return NotFound();

        contact.IsActive = false;
        contact.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // --- Supplier Parts ---

    [HttpGet("{id}/parts")]
    [Authorize(Policy = "Perm:SUPPLIER_PARTS_READ")]
    public async Task<IActionResult> GetParts(Guid id)
    {
        var items = await _db.SupplierParts
            .Include(x => x.Part)
            .Where(x => x.SupplierId == id)
            .Select(p => new SupplierPartDto(
                p.Id, p.PartId, p.Part!.Name, p.Part.Code, p.SupplierSku, p.LastUnitPrice, p.Currency, p.DiscountPercent, p.LeadTimeDays, p.Moq, p.ProductUrl, p.Notes, p.LastPriceUpdatedAt, p.IsActive
            ))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("{id}/parts")]
    [Authorize(Policy = "Perm:SUPPLIER_PARTS_UPDATE")]
    public async Task<IActionResult> AddPart(Guid id, SupplierPartSaveReq req)
    {
        var exists = await _db.SupplierParts.AnyAsync(x => x.SupplierId == id && x.PartId == req.PartId);
        if (exists) return BadRequest("This part is already associated with this supplier.");

        var sp = new SupplierPart
        {
            SupplierId = id,
            PartId = req.PartId,
            SupplierSku = req.SupplierSku,
            LastUnitPrice = req.LastUnitPrice,
            Currency = req.Currency,
            DiscountPercent = req.DiscountPercent,
            LeadTimeDays = req.LeadTimeDays,
            Moq = req.Moq,
            ProductUrl = req.ProductUrl,
            Notes = req.Notes,
            IsActive = req.IsActive,
            LastPriceUpdatedAt = req.LastUnitPrice.HasValue ? DateTimeOffset.UtcNow : null
        };

        _db.SupplierParts.Add(sp);
        await _db.SaveChangesAsync();

        return Ok(new { id = sp.Id });
    }

    [HttpPut("{id}/parts/{supplierPartId}")]
    [Authorize(Policy = "Perm:SUPPLIER_PARTS_UPDATE")]
    public async Task<IActionResult> UpdatePart(Guid id, Guid supplierPartId, SupplierPartSaveReq req)
    {
        var sp = await _db.SupplierParts.FirstOrDefaultAsync(x => x.Id == supplierPartId && x.SupplierId == id);
        if (sp == null) return NotFound();

        // Check if user is changing PartId to someone else
        if (sp.PartId != req.PartId)
        {
            var exists = await _db.SupplierParts.AnyAsync(x => x.SupplierId == id && x.PartId == req.PartId && x.Id != supplierPartId);
            if (exists) return BadRequest("Target part is already associated with this supplier.");
            sp.PartId = req.PartId;
        }

        if (sp.LastUnitPrice != req.LastUnitPrice)
        {
            sp.LastPriceUpdatedAt = DateTimeOffset.UtcNow;
        }

        sp.SupplierSku = req.SupplierSku;
        sp.LastUnitPrice = req.LastUnitPrice;
        sp.Currency = req.Currency;
        sp.DiscountPercent = req.DiscountPercent;
        sp.LeadTimeDays = req.LeadTimeDays;
        sp.Moq = req.Moq;
        sp.ProductUrl = req.ProductUrl;
        sp.Notes = req.Notes;
        sp.IsActive = req.IsActive;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}/parts/{supplierPartId}")]
    [Authorize(Policy = "Perm:SUPPLIER_PARTS_UPDATE")]
    public async Task<IActionResult> DeleteSupplierPart(Guid id, Guid supplierPartId)
    {
        var sp = await _db.SupplierParts.FirstOrDefaultAsync(x => x.Id == supplierPartId && x.SupplierId == id);
        if (sp == null) return NotFound();

        sp.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // GET /api/suppliers/{supplierId}/parts/lookup?partId={partId}
    [HttpGet("{supplierId}/parts/lookup")]
    [Authorize(Policy = "Perm:SUPPLIER_PARTS_READ")]
    public async Task<IActionResult> LookupPartCatalog(Guid supplierId, [FromQuery] Guid partId)
    {
        var supplierPart = await _db.SupplierParts
            .Where(x => x.SupplierId == supplierId && x.PartId == partId && x.IsActive)
            .Select(x => new
            {
                x.Id,
                x.SupplierSku,
                x.LastUnitPrice,
                x.Currency,
                x.LeadTimeDays,
                x.Moq,
                x.DiscountPercent,
                x.Notes
            })
            .FirstOrDefaultAsync();

        if (supplierPart == null)
        {
            return Ok(new { exists = false });
        }

        return Ok(new
        {
            exists = true,
            supplierPartId = supplierPart.Id,
            supplierSku = supplierPart.SupplierSku,
            unitPrice = supplierPart.LastUnitPrice,
            currency = supplierPart.Currency,
            leadTimeDays = supplierPart.LeadTimeDays,
            moq = supplierPart.Moq,
            discountPercent = supplierPart.DiscountPercent,
            notes = supplierPart.Notes
        });
    }

    private string? Nullify(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private string? NormalizeUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        url = url.Trim();
        if (!url.StartsWith("http://") && !url.StartsWith("https://"))
        {
            return "https://" + url;
        }
        return url;
    }
}
