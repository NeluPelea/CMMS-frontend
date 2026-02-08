using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/document-templates")]
[Authorize]
public sealed class DocumentTemplatesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly string _storagePath;

    public DocumentTemplatesController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _storagePath = Path.Combine(env.ContentRootPath, "storage", "templates");
        if (!Directory.Exists(_storagePath)) Directory.CreateDirectory(_storagePath);
    }

    [HttpGet]
    public async Task<ActionResult<List<TemplateDto>>> GetTemplates()
    {
        var templates = await _db.DocumentTemplates
            .AsNoTracking()
            .Select(x => new TemplateDto(
                x.Type,
                x.OriginalFileName,
                x.UpdatedAtUtc
            ))
            .ToListAsync();

        return Ok(templates);
    }

    [HttpPost("header-png")]
    public async Task<IActionResult> UploadHeader(IFormFile file) => await HandleUpload(file, DocumentTemplateType.Header);

    [HttpPost("footer-png")]
    public async Task<IActionResult> UploadFooter(IFormFile file) => await HandleUpload(file, DocumentTemplateType.Footer);

    [HttpGet("header-png")]
    [AllowAnonymous] // Allow PDF generator or public preview if needed
    public async Task<IActionResult> GetHeader() => await GetTemplateFile(DocumentTemplateType.Header);

    [HttpGet("footer-png")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFooter() => await GetTemplateFile(DocumentTemplateType.Footer);

    private async Task<IActionResult> HandleUpload(IFormFile file, DocumentTemplateType type)
    {
        if (file == null || file.Length == 0) return BadRequest("No file uploaded.");
        if (file.ContentType != "image/png") return BadRequest("Only PNG files are allowed.");
        if (file.Length > 5 * 1024 * 1024) return BadRequest("Max file size is 5MB.");

        var ext = Path.GetExtension(file.FileName).ToLower();
        if (ext != ".png") return BadRequest("Only .png extension is allowed.");

        var template = await _db.DocumentTemplates.FirstOrDefaultAsync(x => x.Type == type);
        var isNew = template == null;

        if (isNew)
        {
            template = new DocumentTemplate { Type = type };
            _db.DocumentTemplates.Add(template);
        }

        var fileName = $"{type.ToString().ToLower()}_{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(_storagePath, fileName);

        // Delete old file if exists
        if (!isNew && !string.IsNullOrEmpty(template!.StoredFilePath))
        {
            var oldPath = Path.Combine(_storagePath, template.StoredFilePath);
            if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath);
        }

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        template!.StoredFilePath = fileName;
        template.OriginalFileName = file.FileName;
        template.UpdatedAtUtc = DateTimeOffset.UtcNow;
        template.ContentType = file.ContentType;

        await _db.SaveChangesAsync();

        return Ok(new TemplateDto(template.Type, template.OriginalFileName, template.UpdatedAtUtc));
    }

    private async Task<IActionResult> GetTemplateFile(DocumentTemplateType type)
    {
        var template = await _db.DocumentTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Type == type);
        if (template == null || string.IsNullOrEmpty(template.StoredFilePath)) return NotFound();

        var filePath = Path.Combine(_storagePath, template.StoredFilePath);
        if (!System.IO.File.Exists(filePath)) return NotFound();

        return PhysicalFile(filePath, template.ContentType);
    }

    public record TemplateDto(DocumentTemplateType Type, string FileName, DateTimeOffset UpdatedAt);
}
