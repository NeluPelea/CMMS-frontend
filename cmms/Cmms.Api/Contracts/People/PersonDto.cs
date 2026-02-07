namespace Cmms.Api.Contracts.People;

public sealed class PersonDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string JobTitle { get; set; } = "";
    public string Specialization { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Email { get; set; }
    public bool HasCustomSchedule { get; set; }
    public string? ScheduleSummary { get; set; }

    public bool IsActive { get; set; } // HR active/inactive
}
