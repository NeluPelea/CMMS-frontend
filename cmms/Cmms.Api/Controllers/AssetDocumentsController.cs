using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/assets/{assetId:guid}/documents")]
[Authorize]
public class AssetDocumentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AssetDocumentsController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    // GET /api/assets/{assetId}/documents
    [HttpGet]
    [Authorize(Policy = "Perm:ASSET_READ")]
    public async Task<IActionResult> List(Guid assetId)
    {
        var docs = await _db.AssetDocuments
            .AsNoTracking()
            .Where(x => x.AssetId == assetId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                id = x.Id,
                title = x.Title,
                fileName = x.FileName,
                contentType = x.ContentType,
                sizeBytes = x.SizeBytes,
                createdAt = x.CreatedAt,
                createdByUserId = x.CreatedByUserId,
                createdByName = x.CreatedByUser != null ? x.CreatedByUser.DisplayName : null
            })
            .ToListAsync();

        return Ok(docs);
    }

    private Guid? GetActorUserId()
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("uid")?.Value
                  ?? User.FindFirst("sub")?.Value;

        if (Guid.TryParse(uid, out var guid)) return guid;
        return null;
    }

    public class UploadDocModel
    {
        public string Title { get; set; } = "";
        public IFormFile File { get; set; } = null!;
    }

    // POST /api/assets/{assetId}/documents
    [HttpPost]
    [Authorize(Policy = "Perm:ASSET_UPDATE")]
    public async Task<IActionResult> Upload(Guid assetId, [FromForm] UploadDocModel req)
    {
        // 1. Validate
        if (req.File == null || req.File.Length == 0)
            return BadRequest("File is required");
        
        if (string.IsNullOrWhiteSpace(req.Title))
            return BadRequest("Title is required");

        // 20MB limit
        if (req.File.Length > 20 * 1024 * 1024)
            return BadRequest("File too large (max 20MB)");

        // Allowed extensions
        var ext = Path.GetExtension(req.File.FileName).ToLowerInvariant();
        var allowed = new[] { ".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv" };
        if (!allowed.Contains(ext))
            return BadRequest($"File type '{ext}' not allowed");

        var userId = GetActorUserId();

        var docId = Guid.NewGuid();
        var safeFileName = $"{docId}{ext}";
        
        // Storage path
        var storageRoot = _config["Storage:AssetsPath"] 
                          ?? Environment.GetEnvironmentVariable("ASSETS_STORAGE_PATH") 
                          ?? Path.Combine(Directory.GetCurrentDirectory(), "data", "uploads", "assets");
        
        var assetFolder = Path.Combine(storageRoot, assetId.ToString());
        if (!Directory.Exists(assetFolder))
            Directory.CreateDirectory(assetFolder);

        var fullPath = Path.Combine(assetFolder, safeFileName);

        try 
        {
            // 3. Save File
            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await req.File.CopyToAsync(stream);
            }

            // 4. Save DB Entity
            var entity = new AssetDocument
            {
                Id = docId,
                AssetId = assetId,
                Title = req.Title.Trim(),
                FileName = req.File.FileName, // original name
                ContentType = req.File.ContentType,
                SizeBytes = req.File.Length,
                StoragePath = fullPath,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedByUserId = userId
            };

            _db.AssetDocuments.Add(entity);
            await _db.SaveChangesAsync();

            return Ok(new { id = entity.Id });
        }
        catch (Exception ex)
        {
            // Cleanup file if DB save fails
            if (System.IO.File.Exists(fullPath))
                System.IO.File.Delete(fullPath);
                
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    public record UpdateTitleReq(string Title);

    // PUT /api/assets/{assetId}/documents/{docId}
    [HttpPut("{docId:guid}")]
    [Authorize(Policy = "Perm:ASSET_UPDATE")]
    public async Task<IActionResult> UpdateTitle(Guid assetId, Guid docId, [FromBody] UpdateTitleReq req)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            return BadRequest("Title required");

        var doc = await _db.AssetDocuments.FirstOrDefaultAsync(x => x.Id == docId && x.AssetId == assetId);
        if (doc == null) return NotFound();

        doc.Title = req.Title.Trim();
        await _db.SaveChangesAsync();
        return Ok();
    }

    // DELETE /api/assets/{assetId}/documents/{docId}
    [HttpDelete("{docId:guid}")]
    [Authorize(Policy = "Perm:ASSET_UPDATE")] // Assuming Edit permission allows deleting docs
    public async Task<IActionResult> Delete(Guid assetId, Guid docId)
    {
        var doc = await _db.AssetDocuments.FirstOrDefaultAsync(x => x.Id == docId && x.AssetId == assetId);
        if (doc == null) return NotFound();

        // Delete file from disk
        try
        {
            if (System.IO.File.Exists(doc.StoragePath))
            {
                System.IO.File.Delete(doc.StoragePath);
            }
        }
        catch (Exception ex)
        {
            // Log error but continue to delete from DB? or fail?
            // Usually safe to delete from DB if file is gone or inaccessible, 
            // but let's log to console for now
            Console.WriteLine($"Error deleting file: {ex.Message}");
        }

        _db.AssetDocuments.Remove(doc);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // GET /api/assets/{assetId}/documents/{docId}/download
    [HttpGet("{docId:guid}/download")]
    [Authorize(Policy = "Perm:ASSET_READ")]
    public async Task<IActionResult> Download(Guid assetId, Guid docId)
    {
        var doc = await _db.AssetDocuments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == docId && x.AssetId == assetId);
        if (doc == null) return NotFound();

        if (!System.IO.File.Exists(doc.StoragePath))
            return NotFound("File not found on server");

        var stream = new FileStream(doc.StoragePath, FileMode.Open, FileAccess.Read);
        return File(stream, doc.ContentType, doc.FileName); // Force download with original name
    }
    
    // GET /api/assets/{assetId}/documents/{docId}/preview
    [HttpGet("{docId:guid}/preview")]
    [Authorize(Policy = "Perm:ASSET_READ")]
    public async Task<IActionResult> Preview(Guid assetId, Guid docId)
    {
        var doc = await _db.AssetDocuments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == docId && x.AssetId == assetId);
        if (doc == null) return NotFound();

        if (!System.IO.File.Exists(doc.StoragePath))
            return NotFound("File not found on server");

        var stream = new FileStream(doc.StoragePath, FileMode.Open, FileAccess.Read);
        return File(stream, doc.ContentType); // Inline preview (no filename arg)
    }
}
