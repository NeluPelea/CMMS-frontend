using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Cmms.Api.Auth;

public class JwtTokenService
{
    private readonly IConfiguration _cfg;

    public JwtTokenService(IConfiguration cfg)
    {
        _cfg = cfg;
    }

    public string CreateToken(string email)
    {
        var keyStr = _cfg["Jwt:Key"] ?? "";
        if (Encoding.UTF8.GetByteCount(keyStr) < 32)
            throw new InvalidOperationException("Jwt:Key must be at least 32 bytes for HS256.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyStr));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var issuer = _cfg["Jwt:Issuer"] ?? "cmms";
        var audience = _cfg["Jwt:Audience"] ?? "cmms";

        var claims = new[]
        {
            new Claim(ClaimTypes.Name, email),
            new Claim(ClaimTypes.Email, email),
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
