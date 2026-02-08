$baseUrl = "http://localhost:5026"
$headers = @{ "Content-Type" = "application/json" }

# 1. Login
$loginBody = @{
    email    = "admin@cmms.local"
    password = "Parola123"
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginBody -Headers $headers
    $token = $loginResp.token
    Write-Host "Login Successful. Token: $($token.Substring(0, 10))..."
}
catch {
    Write-Error "Login Failed: $_"
    exit 1
}

$headers.Add("Authorization", "Bearer $token")

# 2. Create Activity
$createBody = @{
    title       = "Test Automation Job"
    description = "Created by verification script"
} | ConvertTo-Json

try {
    $job = Invoke-RestMethod -Uri "$baseUrl/api/extra-jobs" -Method Post -Body $createBody -Headers $headers
    $jobId = $job.id
    Write-Host "Created Job: $jobId"
}
catch {
    Write-Error "Create Job Failed: $_"
    exit 1
}

# 3. Start
try {
    Invoke-RestMethod -Uri "$baseUrl/api/extra-jobs/$jobId/start" -Method Put -Headers $headers
    Write-Host "Job Started"
}
catch {
    Write-Error "Start Job Failed: $_"
    exit 1
}

Write-Host "Waiting 3 seconds..."
Start-Sleep -Seconds 3

# 4. Stop
try {
    Invoke-RestMethod -Uri "$baseUrl/api/extra-jobs/$jobId/stop" -Method Put -Headers $headers
    Write-Host "Job Stopped"
}
catch {
    Write-Error "Stop Job Failed: $_"
    exit 1
}

# 5. Get Report
$today = Get-Date -Format "yyyy-MM-dd"
$url = "$baseUrl/api/reports/extra-jobs?from=${today}&to=${today}"
Write-Host "Fetching report from: $url"

try {
    $report = Invoke-RestMethod -Uri $url -Method Get -Headers $headers
    Write-Host "Report Retrieved. Count: $($report.Count)"
    
    $myJob = $report | Where-Object { $_.id -eq $jobId }
    if ($myJob) {
        Write-Host "FOUND JOB IN REPORT:"
        $myJob | Format-List
        
        if ($myJob.totalMinutes -gt 0) {
            Write-Host "SUCCESS: Duration is registered."
            exit 0
        }
        else {
            Write-Error "FAILURE: Duration is 0."
            exit 1
        }
    }
    else {
        Write-Error "FAILURE: Job not found in report."
        exit 1
    }
}
catch {
    Write-Error "Get Report Failed: $_"
    exit 1
}
