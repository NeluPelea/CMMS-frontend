namespace Cmms.Api.Services;

public interface IWorkingCalendar
{
    /// <summary>
    /// Checks if the given date is a working day (Monday-Friday, not a holiday).
    /// </summary>
    Task<bool> IsWorkingDay(DateOnly day);

    /// <summary>
    /// Returns the next working day on or after the given date.
    /// If the given date is a working day, returns it.
    /// Otherwise, finds the next available working day.
    /// </summary>
    Task<DateOnly> GetNextWorkingDay(DateOnly day);
}
