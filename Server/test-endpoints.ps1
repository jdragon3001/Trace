# OpenScribe License Server - Endpoint Testing Script
# This script tests all available endpoints

Write-Host "🧪 Testing OpenScribe License Server Endpoints" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Yellow

$baseUrl = "http://localhost:3001"

# Test 1: Health Check
Write-Host "`n🔍 Testing Health Check..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "✅ Health Check: " -ForegroundColor Green -NoNewline
    Write-Host ($health | ConvertTo-Json) -ForegroundColor White
} catch {
    Write-Host "❌ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: User Registration
Write-Host "`n🔍 Testing User Registration..." -ForegroundColor Cyan
$registerData = @{
    email = "test@example.com"
    password = "testpassword123"
    name = "Test User"
} | ConvertTo-Json

try {
    $register = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body $registerData -ContentType "application/json"
    Write-Host "✅ Registration: " -ForegroundColor Green -NoNewline
    Write-Host ($register | ConvertTo-Json) -ForegroundColor White
    $global:testToken = $register.token
} catch {
    Write-Host "❌ Registration Failed: $($_.Exception.Message)" -ForegroundColor Red
    # Try login instead if user already exists
    Write-Host "🔄 Trying login instead..." -ForegroundColor Yellow
    $loginData = @{
        email = "test@example.com"
        password = "testpassword123"
    } | ConvertTo-Json
    
    try {
        $login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json"
        Write-Host "✅ Login: " -ForegroundColor Green -NoNewline
        Write-Host ($login | ConvertTo-Json) -ForegroundColor White
        $global:testToken = $login.token
    } catch {
        Write-Host "❌ Login Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 3: Token Validation (if we have a token)
if ($global:testToken) {
    Write-Host "`n🔍 Testing Token Validation..." -ForegroundColor Cyan
    try {
        $headers = @{ Authorization = "Bearer $global:testToken" }
        $validate = Invoke-RestMethod -Uri "$baseUrl/auth/validate" -Method POST -Headers $headers
        Write-Host "✅ Token Validation: " -ForegroundColor Green -NoNewline
        Write-Host ($validate | ConvertTo-Json) -ForegroundColor White
    } catch {
        Write-Host "❌ Token Validation Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 4: Subscription Check
    Write-Host "`n🔍 Testing Subscription Check..." -ForegroundColor Cyan
    try {
        $subscription = Invoke-RestMethod -Uri "$baseUrl/subscriptions/check" -Method GET -Headers $headers
        Write-Host "✅ Subscription Check: " -ForegroundColor Green -NoNewline
        Write-Host ($subscription | ConvertTo-Json) -ForegroundColor White
    } catch {
        Write-Host "❌ Subscription Check Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 5: Machine Registration
    Write-Host "`n🔍 Testing Machine Registration..." -ForegroundColor Cyan
    $machineData = @{
        machineId = "test-machine-$(Get-Random)"
        machineInfo = @{
            name = "Test Machine"
            osVersion = "Windows 10"
            cpuInfo = "Intel i7"
            hostname = $env:COMPUTERNAME
        }
    } | ConvertTo-Json -Depth 3
    
    try {
        $machine = Invoke-RestMethod -Uri "$baseUrl/machines/register" -Method POST -Body $machineData -ContentType "application/json" -Headers $headers
        Write-Host "✅ Machine Registration: " -ForegroundColor Green -NoNewline
        Write-Host ($machine | ConvertTo-Json) -ForegroundColor White
    } catch {
        Write-Host "❌ Machine Registration Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 6: Machine List
    Write-Host "`n🔍 Testing Machine List..." -ForegroundColor Cyan
    try {
        $machines = Invoke-RestMethod -Uri "$baseUrl/machines/list" -Method GET -Headers $headers
        Write-Host "✅ Machine List: " -ForegroundColor Green -NoNewline
        Write-Host ($machines | ConvertTo-Json) -ForegroundColor White
    } catch {
        Write-Host "❌ Machine List Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎯 Test Summary:" -ForegroundColor Yellow
Write-Host "- Health check tests basic server connectivity" -ForegroundColor White
Write-Host "- Registration/Login tests user authentication" -ForegroundColor White
Write-Host "- Token validation tests JWT security" -ForegroundColor White
Write-Host "- Subscription check tests billing integration" -ForegroundColor White
Write-Host "- Machine registration tests device licensing" -ForegroundColor White

Write-Host "`n📝 Next Steps:" -ForegroundColor Green
Write-Host "1. Update .env with real Stripe keys for payment testing" -ForegroundColor White
Write-Host "2. Configure your OpenScribe app to use: http://localhost:3001" -ForegroundColor White
Write-Host "3. Test the integration from your Electron app" -ForegroundColor White 