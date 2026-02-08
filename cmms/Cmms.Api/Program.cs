using System.Text;
using Cmms.Infrastructure;
using Cmms.Api.Auth;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using QuestPDF.Infrastructure;

QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------
// 1. SERVICII DE BAZA (Controllers & Swagger)
// ---------------------------------------------------------
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.CustomSchemaIds(t => t.FullName);
    c.ResolveConflictingActions(apiDescriptions => apiDescriptions.First());

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Introduceti token-ul JWT astfel: Bearer {cheie}"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// ---------------------------------------------------------
// 2. CONFIGURARE CORS (Podul catre Frontend)
// ---------------------------------------------------------
builder.Services.AddCors(opt =>
{
    opt.AddPolicy("dev", p =>
        p.WithOrigins("http://localhost:5173") // Portul Vite
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials());
});

// ---------------------------------------------------------
// 3. BAZA DE DATE & SERVICII DOMAIN
// ---------------------------------------------------------
var cs = builder.Configuration.GetConnectionString("Default")
         ?? throw new Exception("Lipsa ConnectionStrings:Default in appsettings.json");

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(cs));

builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<Cmms.Api.Services.PeopleAvailability>();
builder.Services.AddScoped<Cmms.Api.Services.IUnitScheduleService, Cmms.Api.Services.UnitScheduleService>();
builder.Services.AddHostedService<Cmms.Api.Services.PmBackgroundService>();

// ---------------------------------------------------------
// 4. SECURITATE JWT (UTF-8 Enforced)
// ---------------------------------------------------------
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
    throw new Exception("Eroare: Jwt:Key lipseste din configuratie!");

// Fortam citirea cheii folosind codificarea UTF-8
var keyBytes = Encoding.UTF8.GetBytes(jwtKey);

if (keyBytes.Length < 32)
    throw new Exception("Eroare: Jwt:Key trebuie sa aiba minim 32 caractere.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// ---------------------------------------------------------
// 5. CONSTRUIRE APLICATIE (Middleware Pipeline)
// ---------------------------------------------------------
var app = builder.Build();

// Executam Seeding-ul intr-un context de memorie protejat
if (app.Environment.IsDevelopment())
{
    using (var scope = app.Services.CreateScope())
    {
        await Cmms.Api.Seed.DevDataSeeder.SeedAsync(scope.ServiceProvider);
    }

    app.UseSwagger();
    app.UseSwaggerUI();
}

// ORDINE CRITICA: CORS trebuie sa fie inainte de Auth si MapControllers
app.UseCors("dev");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();