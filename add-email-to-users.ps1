# PowerShell script to add email field to existing users
# This script connects to MongoDB and adds email field to users who don't have it

Write-Host "=== Add Email Field to Users ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Error: .env file not found!" -ForegroundColor Red
    exit 1
}

# Read MongoDB URI from .env
$envContent = Get-Content .env -Raw
$mongoUri = if ($envContent -match 'MONGO_URI=(.+)') { $matches[1].Trim() } else { "mongodb://localhost:27017/chatrix" }

Write-Host "MongoDB URI: $mongoUri" -ForegroundColor Yellow
Write-Host ""

# Create a temporary JavaScript file for MongoDB shell
$jsScript = @"
const db = db.getSiblingDB('chatrix');

print('Connected to database: chatrix');
print('');

// Find users without email
const usersWithoutEmail = db.users.find({ email: { `$exists: false } }).toArray();

print('Found ' + usersWithoutEmail.length + ' users without email field');
print('');

if (usersWithoutEmail.length === 0) {
    print('✅ All users already have email field');
} else {
    let updatedCount = 0;
    
    usersWithoutEmail.forEach(user => {
        const defaultEmail = user.username + '@chatrix.local';
        
        db.users.updateOne(
            { _id: user._id },
            { 
                `$set: { 
                    email: defaultEmail,
                    email_verified: false 
                } 
            }
        );
        
        updatedCount++;
        print('✓ Updated user: ' + user.username + ' -> ' + defaultEmail);
    });
    
    print('');
    print('✅ Successfully updated ' + updatedCount + ' users');
    print('');
    print('⚠️  Note: Default emails use format: username@chatrix.local');
    print('   Users should update their email addresses through the profile.');
}
"@

$jsScript | Out-File -FilePath "temp-add-email.js" -Encoding UTF8

Write-Host "Running migration..." -ForegroundColor Yellow
Write-Host ""

# Run MongoDB shell script
try {
    if (Get-Command mongosh -ErrorAction SilentlyContinue) {
        mongosh $mongoUri --quiet --file temp-add-email.js
    }
    elseif (Get-Command mongo -ErrorAction SilentlyContinue) {
        mongo $mongoUri --quiet temp-add-email.js
    }
    else {
        Write-Host "Error: MongoDB shell (mongosh or mongo) not found!" -ForegroundColor Red
        Write-Host "Please install MongoDB shell or use the TypeScript migration script." -ForegroundColor Yellow
        Remove-Item temp-add-email.js -ErrorAction SilentlyContinue
        exit 1
    }
    
    Write-Host ""
    Write-Host "✅ Migration completed!" -ForegroundColor Green
}
catch {
    Write-Host "Error running migration: $_" -ForegroundColor Red
    exit 1
}
finally {
    # Clean up temporary file
    Remove-Item temp-add-email.js -ErrorAction SilentlyContinue
}
