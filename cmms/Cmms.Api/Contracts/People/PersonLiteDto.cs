namespace Cmms.Api.Contracts.People;

public sealed class PersonLiteDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = "";
    public string DisplayName { get; set; } = "";
}
