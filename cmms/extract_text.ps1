$content = Get-Content 'temp_doc_6\word\document.xml' -Raw
$matches = [regex]::Matches($content, '<w:t.*?>(.*?)</w:t>')
$text = $matches | ForEach-Object { $_.Groups[1].Value }
$text -join " " | Set-Content 'requirements.txt'
Write-Host "Extracted to requirements.txt"
