using System;
using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Cmms.Infrastructure
{
    public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext(string[] args)
        {
            // EF tooling may run from various working directories.
            // We locate the API project's appsettings based on the solution structure.
            // This approach is deterministic and avoids brittle relative paths like "..\\..".

            var baseDir = Directory.GetCurrentDirectory();

            // Try to find the solution root by walking up until we find "cmms" folder.
            // Adjust if your repo structure differs.
            var dir = new DirectoryInfo(baseDir);
            DirectoryInfo? solutionRoot = null;

            while (dir != null)
            {
                // Heuristic: solution root contains folder "cmms" AND inside it "Cmms.Api"
                var cmmsDir = Path.Combine(dir.FullName, "cmms");
                var apiDir = Path.Combine(cmmsDir, "Cmms.Api");
                if (Directory.Exists(apiDir))
                {
                    solutionRoot = dir;
                    break;
                }
                dir = dir.Parent;
            }

            if (solutionRoot == null)
                throw new InvalidOperationException($"Could not locate solution root from '{baseDir}'.");

            var apiProjectDir = Path.Combine(solutionRoot.FullName, "cmms", "Cmms.Api");

            var config = new ConfigurationBuilder()
                .SetBasePath(apiProjectDir)
                .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
                .AddJsonFile("appsettings.Development.json", optional: true, reloadOnChange: false)
                .AddEnvironmentVariables()
                .Build();

            var cs = config.GetConnectionString("Default");
            if (string.IsNullOrWhiteSpace(cs))
                throw new InvalidOperationException("Missing ConnectionStrings:Default in appsettings.");

            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(cs)
                .Options;

            return new AppDbContext(options);
        }
    }
}
