# API Response Evidence: BEFORE / AFTER

## Debug Endpoint: Categorization Logic

### BEFORE Fix

**Request**:
```
GET /api/reports/debug-proactive
```

**Response** (excerpt from one proactive WO):
```json
{
  "id": "378345ca-edca-4cf7-a511-93f5131251fb",
  "title": "WO Proactiv v3",
  "typeValue": 2,
  "typeName": "Preventive",
  "classificationValue": 1,
  "classificationName": "Proactive",
  "computedCategory": "PM",  // ❌ BUG: Should be "Proactive"
  "status": 3,
  "startAt": "2026-02-08T18:15:51+00:00",
  "stopAt": "2026-02-08T19:04:10+00:00",
  "durationMinutes": 48,
  "assignedToPersonId": null,
  "assetId": null
}
```

**Problem**: `computedCategory = "PM"` even though `classificationName = "Proactive"`

---

### AFTER Fix

**Request**:
```
GET /api/reports/debug-proactive
```

**Response** (same WO):
```json
{
  "id": "378345ca-edca-4cf7-a511-93f5131251fb",
  "title": "WO Proactiv v3",
  "typeValue": 2,
  "typeName": "Preventive",
  "classificationValue": 1,
  "classificationName": "Proactive",
  "computedCategory": "Proactive",  // ✅ FIXED!
  "status": 3,
  "startAt": "2026-02-08T18:15:51+00:00",
  "stopAt": "2026-02-08T19:04:10+00:00",
  "durationMinutes": 48,
  "assignedToPersonId": null,
  "assignedPersonName": null,
  "assetId": null,
  "assetName": null
}
```

**Fixed**: `computedCategory = "Proactive"` ✅

---

## Report Endpoints: Expected Behavior

### Current Status
The existing 3 proactive WOs are **not assigned** to any person or asset:
```json
{
  "assignedToPersonId": null,
  "assetId": null
}
```

Therefore, they **correctly** do not appear in any reports (unassigned work shouldn't be attributed).

---

### BEFORE Fix (Simulated with assigned WO)

**Assumption**: A proactive WO with:
- `assignedToPersonId = "some-person-id"`
- `durationMinutes = 48`
- `classification = Proactive`
- `type = Preventive`

**Request**:
```
GET /api/reports/labor-by-person?from=2026-02-01&to=2026-02-28
```

**Response** (excerpt):
```json
{
  "personId": "some-person-id",
  "personName": "John Doe",
  "jobTitle": "Technician",
  "minutesPm": 48,              // ❌ Proactive WO counted as PM
  "minutesWoProactive": 0,     // ❌ Should be 48
  "minutesWoReactive": 0,
  "minutesExtra": 0,
  "minutesTotal": 48,
  "workedPct": 2.5,
  "reactivePct": 0,
  "timelineSegments": [
    {
      "type": "PM",             // ❌ Should be "Proactive"
      "startUtc": "2026-02-08T18:15:51+00:00",
      "stopUtc": "2026-02-08T19:04:10+00:00",
      "minutes": 48
    }
  ]
}
```

**Problems**:
1. `minutesPm = 48` instead of 0
2. `minutesWoProactive = 0` instead of 48
3. Timeline segment `type = "PM"` instead of "Proactive"
4. UI would show **green** (PM color) instead of **sky-blue** (Proactive color)

---

### AFTER Fix (Expected with assigned WO)

**Request**:
```
GET /api/reports/labor-by-person?from=2026-02-01&to=2026-02-28
```

**Response** (expected):
```json
{
  "personId": "some-person-id",
  "personName": "John Doe",
  "jobTitle": "Technician",
  "minutesPm": 0,              // ✅ Correct
  "minutesWoProactive": 48,    // ✅ Proactive WO counted correctly
  "minutesWoReactive": 0,
  "minutesExtra": 0,
  "minutesTotal": 48,
  "workedPct": 2.5,
  "reactivePct": 0,
  "timelineSegments": [
    {
      "type": "Proactive",     // ✅ Correct type
      "startUtc": "2026-02-08T18:15:51+00:00",
      "stopUtc": "2026-02-08T19:04:10+00:00",
      "minutes": 48
    }
  ]
}
```

**Fixed**:
1. `minutesPm = 0` ✅
2. `minutesWoProactive = 48` ✅
3. Timeline segment `type = "Proactive"` ✅
4. UI will show **sky-blue** (bg-sky-500) ✅

---

## Asset Report: AFTER Fix (Expected)

**Request**:
```
GET /api/reports/labor-by-asset?from=2026-02-01&to=2026-02-28
```

**Response** (expected with assigned WO):
```json
{
  "assetId": "some-asset-id",
  "assetName": "Machine A",
  "locationName": "Workshop",
  "minutesPm": 0,
  "minutesWoProactive": 48,    // ✅ Proactive minutes
  "minutesWoReactive": 0,
  "reactivePct": 0,
  "timelineSegments": [
    {
      "type": "Proactive",     // ✅ Correct type
      "startUtc": "2026-02-08T18:15:51+00:00",
      "stopUtc": "2026-02-08T19:04:10+00:00",
      "minutes": 48
    }
  ]
}
```

---

## Asset Daily Report: AFTER Fix (Expected)

**Request**:
```
GET /api/reports/labor-by-asset-daily?from=2026-02-01&to=2026-02-28
```

**Response** (expected with assigned WO):
```json
{
  "date": "2026-02-08T00:00:00",
  "assetId": "some-asset-id",
  "assetName": "Machine A",
  "locationName": "Workshop",
  "minutesPm": 0,
  "minutesWoProactive": 48,    // ✅ Proactive minutes for this day
  "minutesWoReactive": 0,
  "reactivePct": 0,
  "timelineSegments": [
    {
      "type": "Proactive",     // ✅ Correct type
      "startUtc": "2026-02-08T18:15:51+00:00",
      "stopUtc": "2026-02-08T19:04:10+00:00",
      "minutes": 48
    }
  ]
}
```

---

## Summary

| Field | BEFORE (Bug) | AFTER (Fixed) |
|-------|--------------|---------------|
| `computedCategory` | "PM" ❌ | "Proactive" ✅ |
| `minutesPm` | 48 ❌ | 0 ✅ |
| `minutesWoProactive` | 0 ❌ | 48 ✅ |
| Timeline `type` | "PM" ❌ | "Proactive" ✅ |
| UI Color | Green (PM) ❌ | Sky-blue (Proactive) ✅ |

**Status**: ✅ **FIX VERIFIED** via debug endpoint. Full integration tests pending WO assignment.
