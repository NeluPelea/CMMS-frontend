namespace Cmms.Api.Contracts.People;

public sealed class PersonScheduleDto
{
    public int MonFriStartMinutes { get; set; }
    public int MonFriEndMinutes { get; set; }
    public int? SatStartMinutes { get; set; }
    public int? SatEndMinutes { get; set; }
    public int? SunStartMinutes { get; set; }
    public int? SunEndMinutes { get; set; }
    public string Timezone { get; set; } = "Europe/Bucharest";
}
