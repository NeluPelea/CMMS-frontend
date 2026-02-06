namespace Cmms.Api.Contracts.People;

public class CreatePersonReq
{
    public string? FullName { get; set; }
    public string? DisplayName { get; set; }
    public string? JobTitle { get; set; }
    public string? Specialization { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true; // HR active/inactive
}
