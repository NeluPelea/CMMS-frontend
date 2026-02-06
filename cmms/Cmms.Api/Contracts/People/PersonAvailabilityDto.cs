namespace Cmms.Api.Contracts.People;

public sealed class PersonAvailabilityDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = "";
    public string DisplayName { get; set; } = "";

    public string JobTitle { get; set; } = "";
    public string Specialization { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Email { get; set; }

    public bool HrIsActive { get; set; } // manual
    public bool IsActive { get; set; }   // assignable on interval

    public string Status { get; set; } = "UNAVAILABLE";
    public string? Reason { get; set; }
}
