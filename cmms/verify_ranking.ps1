$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:5026"

function Test-AssetRanking {
    Write-Host "1. Testing Create Asset with Ranking..." -ForegroundColor Cyan
    $name = "RankTest-" + (Get-Random)
    
    # 1. Create with Ranking 'A'
    $body = @{
        name    = $name
        code    = "TEST01"
        ranking = "A"
    } | ConvertTo-Json

    $resp = Invoke-RestMethod -Uri "$baseUrl/api/as" -Method Post -Body $body -ContentType "application/json"
    if ($resp.ranking -ne "A") { throw "Failed: Expected A, got $($resp.ranking)" }
    Write-Host "   -> Create OK (Rank A)." -ForegroundColor Green
    $id = $resp.id

    # 2. Update to Ranking 'B'
    Write-Host "2. Testing Update Asset Ranking..." -ForegroundColor Cyan
    $updateBody = @{
        name    = $name
        code    = "TEST01"
        ranking = "B"
    } | ConvertTo-Json

    $resp2 = Invoke-RestMethod -Uri "$baseUrl/api/as/$id" -Method Put -Body $updateBody -ContentType "application/json"
    if ($resp2.ranking -ne "B") { throw "Failed: Expected B, got $($resp2.ranking)" }
    Write-Host "   -> Update OK (Rank B)." -ForegroundColor Green

    # 3. Test Validation (Invalid Rank)
    Write-Host "3. Testing Validation (Invalid Rank)..." -ForegroundColor Cyan
    try {
        $badBody = @{
            name    = $name
            ranking = "XX" # Invalid
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$baseUrl/api/as/$id" -Method Put -Body $badBody -ContentType "application/json"
        throw "Validation Failed: Should have rejected 'XX'"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::BadRequest) {
            Write-Host "   -> Validation OK (Rejected 'XX')." -ForegroundColor Green
        }
        else {
            throw $_
        }
    }

    # 4. Verify List contains Ranking
    Write-Host "4. Verifying List Output..." -ForegroundColor Cyan
    $list = Invoke-RestMethod -Uri "$baseUrl/api/as?q=$name" -Method Get
    $item = $list | Where-Object { $_.id -eq $id }
    if ($item.ranking -ne "B") { throw "List Failed: Expected B, got $($item.ranking)" }
    Write-Host "   -> List OK." -ForegroundColor Green

    # Cleanup
    Invoke-RestMethod -Uri "$baseUrl/api/as/$id" -Method Delete
    Write-Host "Cleanup OK." -ForegroundColor Gray
}

try {
    Test-AssetRanking
    Write-Host "`nAll Asset Ranking Tests Passed!" -ForegroundColor Green
}
catch {
    Write-Host "`nTest Failed: $($_.Exception.Message)" -ForegroundColor Red
}
