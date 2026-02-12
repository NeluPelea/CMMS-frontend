using Microsoft.EntityFrameworkCore;
using Cmms.Infrastructure;
using Cmms.Domain;

var builder = WebApplication.CreateBuilder(args);
var cs = builder.Configuration.GetConnectionString("Default") ?? throw new Exception("No connection string");
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(cs));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    
    Console.WriteLine("Deleting all suppliers...");
    
    // Delete in correct order due to foreign keys
    var partsDeleted = await db.Database.ExecuteSqlRawAsync("DELETE FROM \"SupplierParts\"");
    Console.WriteLine($"Deleted {partsDeleted} supplier parts");
    
    var contactsDeleted = await db.Database.ExecuteSqlRawAsync("DELETE FROM \"SupplierContacts\"");
    Console.WriteLine($"Deleted {contactsDeleted} supplier contacts");
    
    var suppliersDeleted = await db.Database.ExecuteSqlRawAsync("DELETE FROM \"Suppliers\"");
    Console.WriteLine($"Deleted {suppliersDeleted} suppliers");
    
    var remaining = await db.Suppliers.CountAsync();
    Console.WriteLine($"Remaining suppliers: {remaining}");
    
    Console.WriteLine("\nDone! Now restart the API to trigger re-seeding.");
}
