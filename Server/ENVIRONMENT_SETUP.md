# OpenScribe License Server - Environment Setup

## ✅ Current Status
Your license server is **successfully set up** and running in an isolated conda environment!

## 🔧 Environment Details

- **Environment Name**: `openscribe-server`
- **Node.js Version**: 18.18.2 (stable, compatible)
- **Location**: `C:\Users\jackw\miniconda3\envs\openscribe-server`
- **Port**: 3001

## 🚀 Quick Start Commands

### Start the Server
```powershell
# Option 1: Use the startup script
.\start-server.ps1

# Option 2: Manual activation
conda activate openscribe-server
node src/index.js
```

### Stop the Server
```powershell
# Press Ctrl+C in the terminal running the server
# Or kill the process if running in background:
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F
```

## 📦 Installed Dependencies

All dependencies are installed in the isolated environment:

- express@4.18.2 (stable, compatible version)
- cors@2.8.5
- helmet@8.0.0
- bcrypt@5.1.1
- jsonwebtoken@9.0.2
- sqlite3@5.1.7
- stripe@17.5.0
- dotenv@16.5.0
- express-rate-limit@7.5.0
- uuid@11.1.0

## 🔒 Environment Isolation Benefits

✅ **No conflicts** with other Node.js projects  
✅ **Stable dependencies** that won't interfere with global packages  
✅ **Easy to reproduce** on other machines  
✅ **Clean uninstall** - just delete the conda environment  

## 🗄️ Database

- **Type**: SQLite
- **Location**: `./data/license.db`
- **Auto-created**: Yes (with all tables and indexes)

## 🌐 API Endpoints Available

- **Health Check**: http://localhost:3001/health
- **Authentication**: /auth/login, /auth/register, /auth/validate
- **Subscriptions**: /subscriptions/check, /subscriptions/billing-portal
- **Machines**: /machines/register, /machines/validate, /machines/list

## 🔄 Moving the Server

To deploy this server elsewhere:

1. **Copy the entire Server folder**
2. **On the new machine**:
   ```bash
   conda create -n openscribe-server nodejs=18
   conda activate openscribe-server
   cd Server
   npm install
   ```
3. **Update .env** with production values
4. **Start**: `node src/index.js`

## 🧹 Cleanup (if needed)

To completely remove this setup:
```powershell
conda env remove -n openscribe-server
```

## 🆘 Troubleshooting

### Port Already in Use
```powershell
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Environment Not Found
```powershell
conda create -n openscribe-server nodejs=18
conda activate openscribe-server
npm install
```

### Database Issues
Delete `./data/license.db` - it will be recreated on next startup.

## 🎯 Next Steps

1. **Configure Stripe** (add real keys to .env)
2. **Update OpenScribe app** to use: `http://localhost:3001`
3. **Test login/registration** from your Electron app
4. **Deploy to production** when ready 