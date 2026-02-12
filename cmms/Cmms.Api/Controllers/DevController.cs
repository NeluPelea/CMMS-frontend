using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Cmms.Infrastructure;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DevController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHostEnvironment _env;

    public DevController(AppDbContext db, IHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    [HttpPost("clear-suppliers")]
    public async Task<IActionResult> ClearSuppliers()
    {
        // Only allow in Development
        if (!_env.IsDevelopment())
            return Forbid();

        try
        {
            // Delete in correct order due to foreign keys
            // First delete NC orders that might reference suppliers
            await _db.Database.ExecuteSqlRawAsync("DELETE FROM nc_order_attachments");
            await _db.Database.ExecuteSqlRawAsync("DELETE FROM nc_order_lines");
            await _db.Database.ExecuteSqlRawAsync("DELETE FROM nc_orders");
            
            // Then delete supplier-related data
            await _db.Database.ExecuteSqlRawAsync("DELETE FROM supplier_parts");
            await _db.Database.ExecuteSqlRawAsync("DELETE FROM supplier_contacts");
            await _db.Database.ExecuteSqlRawAsync("DELETE FROM suppliers");

            var remaining = await _db.Suppliers.CountAsync();

            return Ok(new
            {
                message = "All suppliers deleted successfully",
                remainingSuppliers = remaining,
                instruction = "Now restart the API to trigger re-seeding of 10 suppliers"
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message, stackTrace = ex.StackTrace });
        }
    }
}
