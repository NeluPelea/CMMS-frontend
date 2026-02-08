$xmlPath = 'temp_doc_6\word\document.xml'
$outputPath = 'requirements.txt'

if (-not (Test-Path $xmlPath)) {
    Write-Error "Input file not found: $xmlPath"
    exit 1
}

# Load XML
try {
    [xml]$xmlContent = Get-Content $xmlPath -Raw
}
catch {
    Write-Error "Failed to load XML: $_"
    exit 1
}

# Setup Namespace Manager
$ns = New-Object System.Xml.XmlNamespaceManager($xmlContent.NameTable)
$ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

# Select all paragraphs
$paragraphs = $xmlContent.SelectNodes("//w:p", $ns)

$extractedText = @()

foreach ($paragraph in $paragraphs) {
    # Select all text nodes within the paragraph
    $textNodes = $paragraph.SelectNodes(".//w:t", $ns)
    
    if ($textNodes -and $textNodes.Count -gt 0) {
        # Join text parts to form the paragraph text
        $paraText = ($textNodes | ForEach-Object { $_.InnerText }) -join ""
        if (-not [string]::IsNullOrWhiteSpace($paraText)) {
            $extractedText += $paraText
        }
    }
}

# Save to file
$extractedText | Set-Content $outputPath -Encoding UTF8
Write-Host "Extraction complete. Found $($extractedText.Count) paragraphs. Saved to $outputPath"
