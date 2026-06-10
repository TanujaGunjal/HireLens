# 🪟 Windows Setup Instructions

## ⚡ Quick Fix for Your Error

Your `.env` file has formatting issues. Here's how to fix it:

### Step 1: Create Proper .env File

Open Notepad and create a file named `.env` (without .txt extension) with this content:

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb+srv://tanujagunjal2005:tanuja05@cluster0.d1l5gti.mongodb.net/b2world_ats?retryWrites=true&w=majority

JWT_SECRET=b2world_super_secret_jwt_key_change_this_in_production

CORS_ORIGIN=http://localhost:5173

ADMIN_EMAIL=admin@b2world.com
ADMIN_PASSWORD=Admin@123
```

**IMPORTANT:** Make sure each variable is on a NEW LINE with no extra spaces or characters!

### Step 2: Run These Commands

```cmd
cd C:\Users\HP\Downloads\Ats-Resume-Builder\b2world-backend-complete

npm install

npm run seed

npm run dev
```

---

## 🚀 Alternative: Use Setup Script

```cmd
setup.bat
```

This will guide you through the entire setup!

---

## 🔧 If Port 5000 Doesn't Work

Windows might have port 5000 reserved. Change it in `.env`:

```env
PORT=3000
```

Then restart:
```cmd
npm run dev
```

---

## ✅ Verify It's Working

Once running, open your browser:
```
http://localhost:5000/health
```

You should see:
```json
{
  "success": true,
  "message": "B2World ATS Backend is running"
}
```

---

## 🧪 Test All Features

```cmd
node test.js
```

---

## 🆘 Common Windows Issues

### Issue 1: "Cannot find module 'dotenv'"
**Fix:** 
```cmd
npm install
```

### Issue 2: "listen EACCES: permission denied"
**Fix:** Your `.env` file is malformed. Recreate it as shown in Step 1 above.

### Issue 3: "./start.sh not recognized"
**Fix:** That's for Linux/Mac. Use `setup.bat` instead:
```cmd
setup.bat
```

### Issue 4: Port 5000 in use
**Fix:** Change PORT to 3000 in `.env`

### Issue 5: MongoDB connection failed
**Fix:** 
1. Check your internet connection
2. Verify MongoDB Atlas connection string
3. Make sure IP is whitelisted in MongoDB Atlas (0.0.0.0/0 for testing)

---

## 📝 Complete Setup Steps

1. **Extract files**
2. **Open Command Prompt as Administrator** (right-click → Run as administrator)
3. **Navigate to folder:**
   ```cmd
   cd C:\Users\HP\Downloads\Ats-Resume-Builder\b2world-backend-complete
   ```
4. **Run setup:**
   ```cmd
   setup.bat
   ```
   OR manually:
   ```cmd
   npm install
   copy .env.example .env
   REM Edit .env file with Notepad
   npm run seed
   npm run dev
   ```

---

## 🎯 Your MongoDB Connection String

Your connection string is already in the error log:
```
mongodb+srv://tanujagunjal2005:tanuja05@cluster0.d1l5gti.mongodb.net/b2world_ats?retryWrites=true&w=majority
```

Use this EXACT string in your `.env` file!

---

## ✅ Expected Output When Working

```
╔══════════════════════════════════════════════╗
║   🚀 B2World ATS Backend Server Running     ║
║   📍 Port: 5000                             ║
║   🌍 Environment: development               ║
╚══════════════════════════════════════════════╝

✅ MongoDB Connected: cluster0.d1l5gti.mongodb.net
```

---

## 📞 Still Having Issues?

1. Make sure Node.js version is 18+:
   ```cmd
   node -v
   ```

2. Delete `node_modules` and reinstall:
   ```cmd
   rmdir /s /q node_modules
   npm install
   ```

3. Check `.env` file has NO extra spaces or characters

4. Make sure MongoDB Atlas:
   - Has IP 0.0.0.0/0 whitelisted (for testing)
   - Username/password are correct
   - Database name is correct

---

**After fixing, you should be able to run the server successfully! 🎉**
