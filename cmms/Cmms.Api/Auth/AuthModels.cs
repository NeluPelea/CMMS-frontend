namespace Cmms.Api.Auth;

public record LoginReq(string Username, string Password);

public record LoginResp(
    string Token,
    UserSummaryDto User,
    List<string> Permissions
);

public record UserSummaryDto(
    Guid Id,
    string Username,
    string DisplayName,
    List<RoleLiteDto> Roles,
    bool MustChangePassword
);

public record RoleLiteDto(
    Guid Id,
    string Code,
    string Name,
    int Rank
);

public record ChangePasswordReq(string CurrentPassword, string NewPassword);
