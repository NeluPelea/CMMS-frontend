namespace Cmms.Api.Contracts.Common;

public sealed class Paged<T>
{
    public int Total { get; set; }
    public int Take { get; set; }
    public int Skip { get; set; }
    public List<T> Items { get; set; } = new();
}
