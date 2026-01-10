using Cmms.Api.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cmms.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly JwtTokenService _jwt;
    public AuthController(JwtTokenService jwt) => _jwt = jwt;

    [HttpPost("login")]
    [AllowAnonymous]
    public ActionResult<LoginResp> Login([FromBody] LoginReq req)
    {
        if (req == null) return BadRequest("req null");

        // DEV account fix (ulterior trecem la users+roles in DB)
        if (req.Email != "admin@cmms.local" || req.Password != "Parola123")
            return Unauthorized("bad credentials");

        var token = _jwt.CreateToken(req.Email);
        return Ok(new LoginResp(token));
    }
}
