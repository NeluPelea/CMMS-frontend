using Cmms.Api.Auth;
using Cmms.Api.Services;
using Cmms.Domain;
using Cmms.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly JwtTokenService _jwt;
    private readonly AppDbContext _db;
    private readonly PasswordHasher<User> _passwordHasher;
    private readonly SecurityService _securityService;

    public AuthController(
        JwtTokenService jwt, 
        AppDbContext db, 
        PasswordHasher<User> passwordHasher,
        SecurityService securityService)
    {
        _jwt = jwt;
        _db = db;
        _passwordHasher = passwordHasher;
        _securityService = securityService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResp>> Login([FromBody] LoginReq req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest("Username and password are required.");

        var user = await _db.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Username.ToLower() == req.Username.Trim().ToLower());

        if (user == null)
            return Unauthorized("Invalid credentials.");

        if (!user.IsActive)
            return StatusCode(403, "Acces restricionat!!! Contactati Admin pentru detalii.");

        var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
        if (result == PasswordVerificationResult.Failed)
            return Unauthorized("Invalid credentials.");

        var roleCodes = user.UserRoles.Select(ur => ur.Role.Code).ToList();
        var permissions = await _securityService.GetEffectivePermissionsAsync(user.Id);

        var personId = await _db.People.Where(p => p.UserId == user.Id).Select(p => (Guid?)p.Id).FirstOrDefaultAsync();
        var token = _jwt.CreateToken(user, roleCodes, permissions);

        return Ok(new LoginResp(
            Token: token,
            User: MapToUserSummary(user, personId),
            Permissions: permissions
        ));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<LoginResp>> GetMe()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdStr, out var userId)) 
            return Unauthorized();

        var user = await _db.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null || !user.IsActive)
            return Unauthorized();

        var permissions = await _securityService.GetEffectivePermissionsAsync(user.Id);
        var personId = await _db.People.Where(p => p.UserId == user.Id).Select(p => (Guid?)p.Id).FirstOrDefaultAsync();
        
        // We don't necessarily need to issue a NEW token on 'me' unless we want to refresh it.
        // For now, return the summary.
        return Ok(new 
        {
            User = MapToUserSummary(user, personId),
            Permissions = permissions
        });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordReq req)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdStr, out var userId)) 
            return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Unauthorized();

        var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, req.CurrentPassword);
        if (result == PasswordVerificationResult.Failed)
            return BadRequest("Current password is incorrect.");

        user.PasswordHash = _passwordHasher.HashPassword(user, req.NewPassword);
        user.MustChangePassword = false;
        
        await _db.SaveChangesAsync();
        return Ok("Password changed successfully.");
    }

    private UserSummaryDto MapToUserSummary(User user, Guid? personId)
    {
        return new UserSummaryDto(
            user.Id,
            user.Username,
            user.DisplayName ?? user.Username,
            user.UserRoles.Select(ur => new RoleLiteDto(ur.Role.Id, ur.Role.Code, ur.Role.Name, ur.Role.Rank)).ToList(),
            user.MustChangePassword,
            personId
        );
    }
}
