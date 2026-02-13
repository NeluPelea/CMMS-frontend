using System;
using System.Linq;
using Cmms.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateDefaultBuilder();
builder.ConfigureServices((context, services) =>
{
    services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql("Host=localhost;Database=cmms_db;Username=postgres;Password=postgres"));
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var count = db.PmPlans.Count();
    Console.WriteLine($"Total PM Plans: {count}");
    
    var plans = db.PmPlans.OrderByDescending(x => x.NextDueAt).Take(5).ToList();
    foreach(var p in plans)
    {
        Console.WriteLine($" - {p.Name} (Active: {p.IsAct}, Asset: {p.AssetId})");
    }
    
    var assets = db.Assets.Count();
    Console.WriteLine($"Total Assets: {assets}");
}
