using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using System;
using System.IO;
using System.Threading.Tasks;

namespace Cmms.Api.Services;

public interface IFileStorageService
{
    Task<string> SaveFileAsync(Stream fileStream, string fileName);
    Task<(Stream Stream, string ContentType)> GetFileAsync(string storedFileName);
    Task DeleteFileAsync(string storedFileName);
}

public class LocalFileStorageService : IFileStorageService
{
    private readonly string _uploadPath;

    public LocalFileStorageService(IWebHostEnvironment env)
    {
        // Store files in "uploads" folder in wwwroot or content root
        _uploadPath = Path.Combine(env.ContentRootPath, "Storage", "Uploads");
        if (!Directory.Exists(_uploadPath))
        {
            Directory.CreateDirectory(_uploadPath);
        }
    }

    public async Task<string> SaveFileAsync(Stream fileStream, string fileName)
    {
        var ext = Path.GetExtension(fileName);
        var storedName = $"{Guid.NewGuid()}{ext}"; // Prevent collision
        var filePath = Path.Combine(_uploadPath, storedName);

        using (var fs = new FileStream(filePath, FileMode.Create))
        {
            await fileStream.CopyToAsync(fs);
        }

        return storedName;
    }

    public Task<(Stream Stream, string ContentType)> GetFileAsync(string storedFileName)
    {
        var filePath = Path.Combine(_uploadPath, storedFileName);
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException("File not found", storedFileName);
        }

        var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
        var contentType = GetContentType(filePath);
        return Task.FromResult((stream as Stream, contentType));
    }

    public Task DeleteFileAsync(string storedFileName)
    {
        var filePath = Path.Combine(_uploadPath, storedFileName);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }
        return Task.CompletedTask;
    }

    private string GetContentType(string path)
    {
        var ext = Path.GetExtension(path).ToLowerInvariant();
        return ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".pdf" => "application/pdf",
            ".txt" => "text/plain",
            _ => "application/octet-stream"
        };
    }
}
