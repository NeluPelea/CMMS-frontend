$ErrorActionPreference = "Stop"

# Setup
$g = Invoke-RestMethod http://localhost:5026/api/people/debug-georgescu
$personId = $g.personId

$wogen = @{ title = "Regression Test WO"; priority = 2 } | ConvertTo-Json
$wo = Invoke-RestMethod -Method Post -Uri "http://localhost:5026/api/work-orders" -Body $wogen -ContentType "application/json"
$woid = $wo.id

$roles = Invoke-RestMethod "http://localhost:5026/api/roles"
$rid = $roles[0].id

echo "Testing Straddle Case (Assignment Start inside, End outside)..."
# 16:00 PM Bucharest (Inside) -> 17:00 PM (Outside, > 16:30)
$start = "2026-02-09T16:00:00+02:00"
$end = "2026-02-09T17:00:00+02:00"

$assignBody = @{
    personId    = $personId
    roleId      = $rid
    plannedFrom = $start
    plannedTo   = $end
} | ConvertTo-Json

try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:5026/api/work-orders/$woid/assignments" -Body $assignBody -ContentType "application/json"
    echo "SUCCESS: Straddle assignment allowed as expected."
}
catch {
    echo "FAIL: Straddle assignment blocked."
    $_.Exception.Response.StatusCode
    exit 1
}

echo "Testing Outside Case (Start outside)..."
# 07:00 AM Bucharest (Outside)
$start = "2026-02-09T07:00:00+02:00"
$twoHoursLater = "2026-02-09T09:00:00+02:00"

$assignBodyFailure = @{
    personId    = $personId
    roleId      = $rid
    plannedFrom = $start
    plannedTo   = $twoHoursLater
} | ConvertTo-Json

try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:5026/api/work-orders/$woid/assignments" -Body $assignBodyFailure -ContentType "application/json"
    echo "FAIL: Assignment should have been blocked but succeeded."
    exit 1
}
catch {
    echo "SUCCESS: Assignment correctly blocked."
}

echo "All Regression Tests Passed."
