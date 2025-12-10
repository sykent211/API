const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Admin-Key');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const ADMIN_KEY = "admin_quco_2024";
const KEYS_FILE = path.join(__dirname, 'keys.json');

// Auto-create keys.json on first run
if (!fs.existsSync(KEYS_FILE)) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify({
        "scriptkey": { 
            active: true, 
            blacklisted: false,
            hwid: null, 
            userId: null,
            executions: 0,
            hwidResets: 0,
            createdAt: new Date().toISOString() 
        }
    }, null, 2));
    console.log('✅ keys.json created automatically');
}

function loadKeys() {
    try {
        const data = fs.readFileSync(KEYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

function saveKeys(keys) {
    try {
        fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
        return true;
    } catch (err) {
        return false;
    }
}

function requireAdmin(req, res, next) {
    const adminKey = req.headers['admin-key'];
    if (adminKey !== ADMIN_KEY) {
        return res.status(403).json({ success: false, message: "Invalid admin key" });
    }
    next();
}

// Admin login
app.post('/admin/login', (req, res) => {
    const { adminKey } = req.body;
    if (adminKey === ADMIN_KEY) {
        return res.json({ success: true, message: "Admin authenticated" });
    }
    res.status(403).json({ success: false, message: "Invalid admin key" });
});

// Get all keys
app.get('/admin/keys', requireAdmin, (req, res) => {
    const keys = loadKeys();
    const keyList = Object.entries(keys).map(([key, data]) => ({
        key: key,
        ...data
    }));
    res.json({ success: true, keys: keyList });
});

// Generate new key (32 random characters)
app.post('/admin/generate', requireAdmin, (req, res) => {
    // Generate 32 random alphanumeric characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let newKey = '';
    for (let i = 0; i < 32; i++) {
        newKey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const keys = loadKeys();
    keys[newKey] = {
        active: true,
        blacklisted: false,
        hwid: null,
        userId: null,
        executions: 0,
        hwidResets: 0,
        createdAt: new Date().toISOString()
    };
    
    if (saveKeys(keys)) {
        console.log(`✅ New key generated: ${newKey}`);
        res.json({ success: true, key: newKey, message: "Key generated successfully" });
    } else {
        res.status(500).json({ success: false, message: "Failed to save key" });
    }
});

// Delete key
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

// Toggle key active status
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

// Blacklist/Unblacklist key
app.post('/admin/keys/:key/blacklist', requireAdmin, (req, res) => {
    const keyToBlacklist = req.params.key;
    const keys = loadKeys();
    
    if (keys[keyToBlacklist]) {
        keys[keyToBlacklist].blacklisted = !keys[keyToBlacklist].blacklisted;
        if (saveKeys(keys)) {
            console.log(`🚫 Key blacklist toggled: ${keyToBlacklist} - Blacklisted: ${keys[keyToBlacklist].blacklisted}`);
            res.json({ success: true, blacklisted: keys[keyToBlacklist].blacklisted });
        } else {
            res.status(500).json({ success: false, message: "Failed to update key" });
        }
    } else {
        res.status(404).json({ success: false, message: "Key not found" });
    }
});

// Reset HWID (with counter)
app.post('/admin/keys/:key/reset-hwid', requireAdmin, (req, res) => {
    const keyToReset = req.params.key;
    const keys = loadKeys();
    
    if (keys[keyToReset]) {
        keys[keyToReset].hwid = null;
        keys[keyToReset].hwidResets = (keys[keyToReset].hwidResets || 0) + 1;
        if (saveKeys(keys)) {
            console.log(`🔓 HWID reset for key: ${keyToReset} (Total resets: ${keys[keyToReset].hwidResets})`);
            res.json({ success: true, message: "HWID reset successfully", resets: keys[keyToReset].hwidResets });
        } else {
            res.status(500).json({ success: false, message: "Failed to reset HWID" });
        }
    } else {
        res.status(404).json({ success: false, message: "Key not found" });
    }
});

// Validate key (NO EXPIRATION CHECK)
app.get('/validate', (req, res) => {
    const { key, hwid, username, userId } = req.query;
    
    console.log(`🔍 Validation - Key: ${key}, User: ${username}, UserID: ${userId}, HWID: ${hwid}`);
    
    if (!key || key === "" || key === "null") {
        return res.json({ success: false, message: "❌ NOT Whitelisted - No key provided" });
    }
    
    const keys = loadKeys();
    const keyData = keys[key];
    
    if (!keyData) {
        console.log(`❌ Invalid key: ${key}`);
        return res.json({ success: false, message: "❌ Invalid key" });
    }

    if (keyData.blacklisted) {
        console.log(`🚫 Blacklisted key: ${key}`);
        return res.json({ success: false, message: "❌ Key has been blacklisted" });
    }
    
    if (!keyData.active) {
        console.log(`❌ Disabled key: ${key}`);
        return res.json({ success: false, message: "❌ Key has been disabled" });
    }
    
    if (keyData.hwid && keyData.hwid !== hwid) {
        console.log(`❌ HWID mismatch: ${key}`);
        return res.json({ success: false, message: "❌ Key is bound to another device" });
    }
    
    // First time use - bind HWID and User ID
    if (!keyData.hwid && hwid) {
        keyData.hwid = hwid;
        console.log(`🔗 Key bound to HWID: ${key}`);
    }

    if (!keyData.userId && userId) {
        keyData.userId = userId;
        console.log(`🔗 Key bound to User ID: ${userId}`);
    }

    // Increment execution count
    keyData.executions = (keyData.executions || 0) + 1;
    
    saveKeys(keys);
    console.log(`✅ Key validated: ${key} for ${username} (Execution #${keyData.executions})`);
    
    res.json({ 
        success: true, 
        message: "✅ Key validated successfully",
        executions: keyData.executions
    });
});

// POST endpoint
app.post('/validate', (req, res) => {
    const { key, hwid, username, userId } = req.body;
    req.query = { key, hwid, username, userId };
    return app._router.handle(req, res);
});

app.get('/api', (req, res) => {
    res.json({ 
        status: "✅ Quco Key System Online",
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Quco Key System running on port ${PORT}`);
    console.log(`🔑 Admin Key: ${ADMIN_KEY}`);
    console.log(`📁 Keys file: ${KEYS_FILE}`);
});
