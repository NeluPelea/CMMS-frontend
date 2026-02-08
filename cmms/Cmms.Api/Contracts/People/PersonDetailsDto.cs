namespace Cmms.Api.Contracts.People;

public sealed class PersonDetailsDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string JobTitle { get; set; } = "";
    public string Specialization { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Email { get; set; }
    public bool IsActive { get; set; } // HR active/inactive

    public string CurrentStatus { get; set; } = "ACTIVE";
    public PersonScheduleDto? Schedule { get; set; }
}
