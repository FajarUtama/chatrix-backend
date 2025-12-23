$baseUrl = "http://localhost:3000"

Write-Host "Fetching all conversations (including corrupted ones)..." -ForegroundColor Yellow

# We need to delete the corrupted conversation
# The corrupted one has participant_ids as a string "6937b497ea818b602ba87b65" instead of an array

Write-Host "`nTo fix this, we need to access MongoDB directly." -ForegroundColor Red
Write-Host "Run this command in MongoDB:" -ForegroundColor Yellow
Write-Host ""
Write-Host "db.conversations.deleteMany({ type: 'direct', participant_ids: { `$type: 'string' } })" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or if you have mongosh installed:" -ForegroundColor Yellow
Write-Host "mongosh chatrix --eval `"db.conversations.deleteMany({ type: 'direct', participant_ids: { `$type: 'string' } })`"" -ForegroundColor Cyan
