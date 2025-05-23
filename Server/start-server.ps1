# OpenScribe License Server Startup Script
# This script activates the conda environment and starts the server

Write-Host "🚀 Starting OpenScribe License Server..." -ForegroundColor Green

# Activate the conda environment
conda activate openscribe-server

# Check if activation was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Environment activated: openscribe-server" -ForegroundColor Green
    
    # Start the server
    Write-Host "🔥 Starting server on port 3001..." -ForegroundColor Yellow
    node src/index.js
} else {
    Write-Host "❌ Failed to activate environment. Please run:" -ForegroundColor Red
    Write-Host "   conda create -n openscribe-server nodejs=18" -ForegroundColor Yellow
    Write-Host "   conda activate openscribe-server" -ForegroundColor Yellow
    Write-Host "   npm install" -ForegroundColor Yellow
} 