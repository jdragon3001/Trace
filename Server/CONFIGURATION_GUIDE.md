# OpenScribe License Server - Configuration Guide

## 🔑 Where to Add Your Keys

### 1. Environment Configuration (`.env` file)

The `.env` file in the Server directory contains all the configuration. **This is where you add your keys:**

```bash
# JWT Secret - CHANGE THIS!
JWT_SECRET=your-super-secret-jwt-key-here

# Stripe Keys - Get from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_your_actual_stripe_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# For production, use live keys:
# STRIPE_SECRET_KEY=sk_live_your_live_key
```

### 2. Stripe Dashboard Setup

1. **Go to**: https://dashboard.stripe.com/apikeys
2. **Copy**:
   - **Publishable key**: `pk_test_...` (for your frontend)
   - **Secret key**: `sk_test_...` (goes in `.env`)
3. **Set up webhook**:
   - URL: `https://yourdomain.com/subscriptions/webhook`
   - Events: `customer.subscription.*`, `invoice.*`, `checkout.session.completed`

## 🧪 Testing Steps

### Step 1: Start the Server
```powershell
# Navigate to server directory
cd "C:\Users\jackw\OneDrive\Python Projects\Trace\Server"

# Activate environment  
conda activate openscribe-server

# Start server
node src/index.js
```

**Expected output:**
```
📄 Connected to SQLite database
✅ Database tables created successfully
✅ Database indexes created successfully
🚀 OpenScribe License Server running on port 3001
```

### Step 2: Test Basic Connectivity
```powershell
# In a new terminal:
Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T...",
  "version": "1.0.0"
}
```

### Step 3: Test User Registration
```powershell
$body = @{
    email = "test@example.com"
    password = "test123"
    name = "Test User"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/auth/register" -Method POST -Body $body -ContentType "application/json"
```

## 🐛 Troubleshooting

### Server Won't Start
```powershell
# Check if port is in use
netstat -ano | findstr :3001

# Kill existing process
taskkill /PID <PID_NUMBER> /F

# Check environment
conda activate openscribe-server
node --version  # Should be 18.x
```

### "Cannot GET /health" Error
- Server is running but routes aren't registered
- Restart server with proper environment
- Check console for error messages

### Database Errors
```powershell
# Delete database to recreate
Remove-Item ./data/license.db -Force
# Restart server - will recreate database
```

### Connection Refused
- Server isn't running
- Wrong port (should be 3001)
- Firewall blocking connection

## 🔗 Integration with OpenScribe App

### Update Your Electron App Configuration

In your OpenScribe app, update the license server URL:

```typescript
// In your environment config or constants file
export const LICENSE_SERVER_URL = 'http://localhost:3001';

// Or in your LicenseService
const licenseService = new LicenseService('http://localhost:3001');
```

### Test Integration Steps

1. **Start the license server** (this server)
2. **Update your OpenScribe app** to use `http://localhost:3001`
3. **Test login flow** in your app
4. **Check server logs** for incoming requests

## 📋 Quick Reference

| What | Where | Example |
|------|-------|---------|
| **JWT Secret** | `.env` → `JWT_SECRET` | `your-secret-key-123` |
| **Stripe Test Key** | `.env` → `STRIPE_SECRET_KEY` | `sk_test_51Ab...` |
| **Server URL** | OpenScribe app config | `http://localhost:3001` |
| **Health Check** | Browser/curl | `http://localhost:3001/health` |

## 🚀 Production Deployment

When ready for production:

1. **Copy entire Server folder** to your production server
2. **Update `.env`**:
   - Change `NODE_ENV=production`
   - Use live Stripe keys (`sk_live_...`)
   - Set strong `JWT_SECRET`
   - Update `CORS_ORIGINS` to your app's domain
3. **Install dependencies**: `npm install`
4. **Start with PM2**: `pm2 start src/index.js --name openscribe-license`

## 🎯 Next Actions

1. ✅ Server is built and ready
2. 🔧 Add your Stripe keys to `.env`
3. 🧪 Test endpoints with the provided script
4. 🔗 Update OpenScribe app to use `http://localhost:3001`
5. 🚀 Test full integration flow 