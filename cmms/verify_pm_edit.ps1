# verify_pm_edit.ps1

$baseUrl = "http://localhost:5026"
$headers = @{ "Content-Type" = "application/json" }

# 0. Login
$loginBody = @{
    username = "admin"
    password = "Admin123!"
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginBody -Headers $headers
    $token = $loginResp.token
    Write-Host "Login Successful."
}
catch {
    Write-Error "Login Failed: $_"
    exit 1
}

$headers.Add("Authorization", "Bearer $token")

# 1. Get an Asset ID (any active asset)
$assets = Invoke-RestMethod -Uri "$baseUrl/api/as?take=1" -Method Get -Headers $headers
if ($assets.Count -eq 0) {
    Write-Host "No assets found. Cannot test."
    exit
}
$assetId = $assets[0].id
Write-Host "Using AssetId: $assetId"

# 2. Create a PM Plan
$createReq = @{
    assetId   = $assetId
    name      = "Test Plan " + (Get-Date).ToString("yyyyMMddHHmmss")
    frequency = 2 # Weekly
    nextDueAt = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    items     = @("Check A", "Check B")
}
$json = $createReq | ConvertTo-Json
Write-Host "Creating Plan..."
$plan = Invoke-RestMethod -Uri "$baseUrl/api/pm-plans" -Method Post -Body $json -Headers $headers
$planId = $plan.id
Write-Host "Created Plan ID: $planId"
Write-Host "Original Name: $($plan.name)"

# 3. Get Plan Details
Write-Host "Fetching Plan Details..."
$fetched = Invoke-RestMethod -Uri "$baseUrl/api/pm-plans/$planId" -Method Get -Headers $headers
if ($fetched.id -ne $planId) {
    Write-Error "Fetched wrong plan!"
}

# 4. Update Plan
$updateReq = @{
    assetId   = $assetId
    name      = "UPDATED " + $fetched.name
    frequency = 3 # Monthly
    nextDueAt = $fetched.nextDueAt
    isAct     = $true
    items     = @("Check A", "Check B", "Check C - NEW")
}
$updateJson = $updateReq | ConvertTo-Json
Write-Host "Updating Plan..."
$updated = Invoke-RestMethod -Uri "$baseUrl/api/pm-plans/$planId" -Method Put -Body $updateJson -Headers $headers

# 5. Verify Update
Write-Host "Verifying Update..."
if ($updated.name -ne $updateReq.name) {
    Write-Error "Name update failed. Expected '$($updateReq.name)', got '$($updated.name)'"
}
if ($updated.frequency -ne 3) {
    Write-Error "Frequency update failed. Expected 3, got $($updated.frequency)"
}
if ($updated.items.Count -ne 3) {
    Write-Error "Items update failed. Expected 3 items, got $($updated.items.Count)"
}

Write-Host "SUCCESS: Plan created, fetched, and updated correctly."
