$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:5026/api"
$creds = @{
    email    = "admin@cmms.local"
    password = "Parola123"
}

Write-Host "1. Logging in..." -ForegroundColor Cyan
$loginResp = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ($creds | ConvertTo-Json) -ContentType "application/json"
Write-Host "Login Response Object:"
Write-Output $loginResp

$token = $loginResp.accessToken
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Error "Token is null or empty! Response was: $($loginResp | ConvertTo-Json -Depth 1)"
}
Write-Host "Token Length: $($token.Length)"
$headers = @{ Authorization = "Bearer $token" }
Write-Host "Using Headers:"
$headers | Out-String | Write-Host

Write-Host "2. Fetching Inventory..." -ForegroundColor Cyan
$inv = Invoke-RestMethod -Uri "$baseUrl/inventory?take=1" -Method Get -Headers $headers
if ($inv.Count -eq 0) {
    Write-Error "No inventory items found! Cannot test."
}
$item = $inv[0]
$id = $item.id
$initialQty = $item.qtyOnHand
Write-Host "   Selected Part: $($item.partName)"
Write-Host "   Initial Qty:   $initialQty"

Write-Host "3. Simulating 'Receive Stock' (+10)..." -ForegroundColor Cyan
$body = @{ delta = 10 }
Invoke-RestMethod -Uri "$baseUrl/inventory/$id/adjust" -Method Post -Headers $headers -Body ($body | ConvertTo-Json) -ContentType "application/json"

Write-Host "4. Verifying New Quantity..." -ForegroundColor Cyan
$inv2 = Invoke-RestMethod -Uri "$baseUrl/inventory?take=1" -Method Get -Headers $headers
$item2 = $inv2 | Where-Object { $_.id -eq $id }
$newQty = $item2.qtyOnHand

Write-Host "   New Qty:       $newQty"

if ($newQty -eq ($initialQty + 10)) {
    Write-Host "SUCCESS: Stock updated correctly!" -ForegroundColor Green
}
else {
    Write-Error "FAILURE: Quantity did not update as expected."
}
