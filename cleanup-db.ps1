$baseUrl = "http://localhost:3000"

Write-Host "Inspecting conversations..." -ForegroundColor Yellow
$inspectResponse = Invoke-RestMethod -Uri "$baseUrl/admin/conversations/inspect" -Method Get
$inspectResponse | ConvertTo-Json -Depth 10

Write-Host "`nCleaning up corrupted conversations..." -ForegroundColor Yellow
$cleanupResponse = Invoke-RestMethod -Uri "$baseUrl/admin/conversations/cleanup" -Method Delete
$cleanupResponse | ConvertTo-Json -Depth 10

Write-Host "`nCleanup complete!" -ForegroundColor Green
