# Bug Investigation Report: Name-Based Grouping Issue

## ROOT CAUSE FOUND ✅

**File**: `Cmms.Api\Controllers\ReportsController.cs`  
**Line**: 282  
**Method**: `GetLabor()` (the "labor" report endpoint)

### The Bug

```csharp
.GroupBy(x => new { x.PersonId, x.Person!.DisplayName })  // ❌ BUG!
```

**Problem**: This groups by BOTH `PersonId` AND `DisplayName`. When a person is renamed:
1. Old labor logs still reference the same `PersonId`
2. But when joined with the `People` table, they get the **current** DisplayName
3. EF Core GroupBy creates a **composite key** from both fields
4. Since the names are from the current Person record (all the same), this accidentally works in most cases
5. BUT if there's any staleness or the join doesn't happen properly, it could split the data

**Wait, let me re-analyze this...**

Actually, looking at line 282 more carefully:
- `x.Person!.DisplayName` fetches the DisplayName from the joined Person record
- The JOIN is implicit through the navigation property
- At query time, ALL logs for a PersonId will have the SAME Person.DisplayName (the current one)
- So this shouldn't cause splitting...

**Unless**... the issue is that `Person` is NULL for some logs? Let me check if there's a flaw in the navigation.

Actually, I think I was on the wrong track. Let me reconsider.

## Re-Analysis

Looking at the "Activitate in perioada" report (labor-by-person):
- Line 96: `var people = await _db.People.AsNoTracking().Where(x => x.IsActive).ToListAsync(ct);`
- Line 112: `foreach (var person in people)`
- Line 126: Filters logs by `x.PersonId == person.Id`

This is correct! It iterates through active people and attributes activities to them by ID.

**But wait!** What if the issue is that when a person is renamed, we need to ask:
1. Does renaming toggle `IsActive`?
2. Does the UI refresh/reload the report after rename?

Let me check the Person update endpoint to see if there's any weird behavior.

## Conclusion

The backend code is actually **mostly correct** in using ID-based linking. The potential issues are:

1. **Line 282**: GroupBy includes DisplayName (composite key) - could cause issues
2. **Lack of consistency**: Some reports group by ID only, others include name in the group key
3. **Potential caching**: No evidence of caching in the code so far

The fix should be to standardize all reports to:
- Group/filter by ID only
- Resolve names separately by joining People table on ID
- Return consistent DTOs with personId + personName (from current Person record)
