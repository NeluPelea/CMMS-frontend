using System.Text;
using Cmms.Infrastructure;
using Cmms.Api.Auth;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
//builder.Services.AddSwaggerGen();
builder.Services.AddSwaggerGen(c =>
{
    // 1) evita conflicte intre tipuri cu acelasi nume (CreateReq, UpdateReq etc.)
    c.CustomSchemaIds(t => t.FullName);

    // 2) evita crash daca exista conflicte de actiuni (route/method)
    c.ResolveConflictingActions(apiDescriptions => apiDescriptions.First());
});


builder.Services.AddCors(opt =>
{
    opt.AddPolicy("dev", p =>
        p.WithOrigins("http://localhost:5173")
         .AllowAnyHeader()
         .AllowAnyMethod());
});

var cs = builder.Configuration.GetConnectionString("Default")
         ?? throw new Exception("Missing ConnectionStrings:Default");

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(cs));

builder.Services.AddScoped<JwtTokenService>();

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
    throw new Exception("Missing Jwt:Key in appsettings.json");

var keyBytes = Encoding.UTF8.GetBytes(jwtKey);
if (keyBytes.Length < 32)
    throw new Exception("Jwt:Key must be at least 32 bytes (32+ characters) for HS256.");


builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
            ValidateLifetime = true
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseCors("dev");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
