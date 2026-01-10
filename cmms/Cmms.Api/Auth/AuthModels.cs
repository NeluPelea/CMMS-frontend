namespace Cmms.Api.Auth;

public record LoginReq(string Email, string Password);
public record LoginResp(string AccessToken);
