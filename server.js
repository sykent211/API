const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public')); // This serves your index.html

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Admin-Key');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Admin key (CHANGE THIS!)
const ADMIN_KEY = "admin_quco_2024";

// Keys file path
const KEYS_FILE = path.join(__dirname, 'keys.json');

// Initialize keys.json if it doesn't exist
if (!fs.existsSync(KEYS_FILE)) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify({
        "scriptkey": { active: true, hwid: null, expires: null, owner: "Admin", createdAt: new Date().toISOString() },
        "premium_key_123": { active: true, hwid: null, expires: "2025-12-31", owner: "TestUser", createdAt: new Date().toISOString() }
    }, null, 2));
}

// Load keys from file
function loadKeys() {
    try {
        const data = fs.readFileSync(KEYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading keys:', err);
        return {};
    }
}

// Save keys to file
function saveKeys(keys) {
    try {
        fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
        return true;
    } catch (err) {
        console.error('Error saving keys:', err);
        return false;
    }
}

// Middleware to check admin key
function requireAdmin(req, res, next) {
    const adminKey = req.headers['admin-key'];
    if (adminKey !== ADMIN_KEY) {
        return res.status(403).json({ success: false, message: "Invalid admin key" });
    }
    next();
}

// ===== ADMIN ENDPOINTS =====

// Login / Verify admin key
app.post('/admin/login', (req, res) => {
    const { adminKey } = req.body;
    if (adminKey === ADMIN_KEY) {
        return res.json({ success: true, message: "Admin authenticated" });
    }
    res.status(403).json({ success: false, message: "Invalid admin key" });
});

// Get all keys (admin only)
app.get('/admin/keys', requireAdmin, (req, res) => {
    const keys = loadKeys();
    const keyList = Object.entries(keys).map(([key, data]) => ({
        key: key,
        ...data
    }));
    res.json({ success: true, keys: keyList });
});

// Generate new key (admin only)
app.post('/admin/generate', requireAdmin, (req, res) => {
    const { owner, expires, prefix } = req.body;
    
    // Generate random key
    const randomStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const newKey = (prefix || "quco") + "_" + randomStr;
    
    const keys = loadKeys();
    keys[newKey] = {
        active: true,
        hwid: null,
        expires: expires || null,
        owner: owner || "Unknown",
        createdAt: new Date().toISOString()
    };
    
    if (saveKeys(keys)) {
        console.log(`✅ New key generated: ${newKey} for ${owner}`);
        res.json({ success: true, key: newKey, message: "Key generated successfully" });
    } else {
        res.status(500).json({ success: false, message: "Failed to save key" });
    }
});

// Delete key (admin only)
app.delete('/admin/keys/:key', requireAdmin, (req, res) => {
    const keyToDelete = req.params.key;
    const keys = loadKeys();
    
    if (keys[keyToDelete]) {
        delete keys[keyToDelete];
        if (saveKeys(keys)) {
            console.log(`🗑️ Key deleted: ${keyToDelete}`);
            res.json({ success: true, message: "Key deleted successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to delete key" });
        }
    } else {
        res.status(404).json({ success: false, message: "Key not found" });
    }
});

// Toggle key active status (admin only)
app.post('/admin/keys/:key/toggle', requireAdmin, (req, res) => {
    const keyToToggle = req.params.key;
    const keys = loadKeys();
    
    if (keys[keyToToggle]) {
        keys[keyToToggle].active = !keys[keyToToggle].active;
        if (saveKeys(keys)) {
            console.log(`🔄 Key toggled: ${keyToToggle} - Active: ${keys[keyToToggle].active}`);
            res.json({ success: true, active: keys[keyToToggle].active });
        } else {
            res.status(500).json({ success: false, message: "Failed to update key" });
        }
    } else {
        res.status(404).json({ success: false, message: "Key not found" });
    }
});

// Reset HWID (admin only)
app.post('/admin/keys/:key/reset-hwid', requireAdmin, (req, res) => {
    const keyToReset = req.params.key;
    const keys = loadKeys();
    
    if (keys[keyToReset]) {
        keys[keyToReset].hwid = null;
        if (saveKeys(keys)) {
            console.log(`🔓 HWID reset for key: ${keyToReset}`);
            res.json({ success: true, message: "HWID reset successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to reset HWID" });
        }
    } else {
        res.status(404).json({ success: false, message: "Key not found" });
    }
});

// ===== CLIENT ENDPOINTS =====

// Validate key (GET for Roblox)
app.get('/validate', (req, res) => {
    const { key, hwid, username } = req.query;
    
    console.log(`🔍 Validation - Key: ${key}, User: ${username}, HWID: ${hwid}`);
    
    if (!key || key === "" || key === "null") {
        return res.json({ success: false, message: "❌ NOT Whitelisted - No key provided" });
    }
    
    const keys = loadKeys();
    const keyData = keys[key];
    
    if (!keyData) {
        console.log(`❌ Invalid key: ${key}`);
        return res.json({ success: false, message: "❌ Invalid key" });
    }
    
    if (!keyData.active) {
        console.log(`❌ Disabled key: ${key}`);
        return res.json({ success: false, message: "❌ Key has been disabled" });
    }
    
    if (keyData.hwid && keyData.hwid !== hwid) {
        console.log(`❌ HWID mismatch: ${key}`);
        return res.json({ success: false, message: "❌ Key is bound to another device" });
    }
    
    if (!keyData.hwid && hwid) {
        keyData.hwid = hwid;
        saveKeys(keys);
        console.log(`🔗 Key bound to HWID: ${key}`);
    }
    
    if (keyData.expires) {
        const expireDate = new Date(keyData.expires);
        if (new Date() > expireDate) {
            console.log(`❌ Expired key: ${key}`);
            return res.json({ success: false, message: "❌ Key has expired" });
        }
    }
    
    console.log(`✅ Key validated: ${key} for ${username}`);
    res.json({ 
        success: true, 
        message: "✅ Key validated successfully",
        expires: keyData.expires || "Never",
        owner: keyData.owner
    });
});

// POST endpoint
app.post('/validate', (req, res) => {
    const { key, hwid, username } = req.body;
    req.query = { key, hwid, username };
    return app._router.handle(req, res);
});

// API health check (for JSON response)
app.get('/api', (req, res) => {
    res.json({ 
        status: "✅ Quco Key System Online",
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Quco Key System running on port ${PORT}`);
    console.log(`🔑 Admin Key: ${ADMIN_KEY}`);
});
