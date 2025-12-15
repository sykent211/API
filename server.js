const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Admin-Key');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const ADMIN_KEY = "SUIWEY";
const KEYS_FILE = path.join(__dirname, 'keys.json');
const PANEL_CONFIG_FILE = path.join(__dirname, 'panel-config.json');

// Auto-create keys.json on first run
if (!fs.existsSync(KEYS_FILE)) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify({}, null, 2));
}

// Auto-create panel-config.json on first run
if (!fs.existsSync(PANEL_CONFIG_FILE)) {
    fs.writeFileSync(PANEL_CONFIG_FILE, JSON.stringify({
        name: 'Quco Key System',
        description: 'Click the buttons below to interact with the key system'
    }, null, 2));
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
        console.error('Error saving keys:', err);
        return false;
    }
}

function loadPanelConfig() {
    try {
        const data = fs.readFileSync(PANEL_CONFIG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {
            name: 'Quco Key System',
            description: 'Click the buttons below to interact with the key system'
        };
    }
}

function savePanelConfig(config) {
    try {
        fs.writeFileSync(PANEL_CONFIG_FILE, JSON.stringify(config, null, 2));
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

// ==================== API STATUS ====================
app.get('/api', (req, res) => {
    res.json({ 
        success: true,
        status: "Quco Key System Online",
        timestamp: new Date().toISOString()
    });
});

// ==================== ADMIN LOGIN ====================
app.post('/admin/login', (req, res) => {
    try {
        const { adminKey } = req.body;
        console.log('Login attempt with key:', adminKey ? 'PROVIDED' : 'MISSING');
        
        if (adminKey === ADMIN_KEY) {
            return res.json({ success: true, message: "Admin authenticated" });
        }
        res.status(403).json({ success: false, message: "Invalid admin key" });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ==================== KEY MANAGEMENT ====================

// Get all keys
app.get('/admin/keys', requireAdmin, (req, res) => {
    try {
        const keys = loadKeys();
        const keyList = Object.entries(keys).map(([key, data]) => ({
            key: key,
            ...data
        }));
        res.json({ success: true, keys: keyList });
    } catch (err) {
        console.error('Get keys error:', err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Generate new key - LETTERS ONLY
app.post('/admin/generate', requireAdmin, (req, res) => {
    try {
        const { prefix } = req.body;
        
        // Generate random string with letters only (no numbers)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let randomStr = '';
        for (let i = 0; i < 16; i++) {
            randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const newKey = (prefix || "quco") + "_" + randomStr;
        
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
            console.log(`New key generated: ${newKey}`);
            res.json({ success: true, key: newKey, message: "Key generated successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to save key" });
        }
    } catch (err) {
        console.error('Generate key error:', err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Delete key
app.delete('/admin/keys/:key', requireAdmin, (req, res) => {
    try {
        const keyToDelete = req.params.key;
        const keys = loadKeys();
        
        if (keys[keyToDelete]) {
            delete keys[keyToDelete];
            if (saveKeys(keys)) {
                console.log(`Key deleted: ${keyToDelete}`);
                res.json({ success: true, message: "Key deleted successfully" });
            } else {
                res.status(500).json({ success: false, message: "Failed to delete key" });
            }
        } else {
            res.status(404).json({ success: false, message: "Key not found" });
        }
    } catch (err) {
        console.error('Delete key error:', err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Toggle key active status
app.post('/admin/keys/:key/toggle', requireAdmin, (req, res) => {
    try {
        const keyToToggle = req.params.key;
        const keys = loadKeys();
        
        if (keys[keyToToggle]) {
            keys[keyToToggle].active = !keys[keyToToggle].active;
            if (saveKeys(keys)) {
                console.log(`Key toggled: ${keyToToggle} - Active: ${keys[keyToToggle].active}`);
                res.json({ success: true, active: keys[keyToToggle].active });
            } else {
                res.status(500).json({ success: false, message: "Failed to update key" });
            }
        } else {
            res.status(404).json({ success: false, message: "Key not found" });
        }
    } catch (err) {
        console.error('Toggle key error:', err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Blacklist/Unblacklist key
app.post('/admin/keys/:key/blacklist', requireAdmin, (req, res) => {
    try {
        const keyToBlacklist = req.params.key;
        const keys = loadKeys();
        
        if (keys[keyToBlacklist]) {
            keys[keyToBlacklist].blacklisted = !keys[keyToBlacklist].blacklisted;
            if (saveKeys(keys)) {
                console.log(`Key blacklist toggled: ${keyToBlacklist} - Blacklisted: ${keys[keyToBlacklist].blacklisted}`);
                res.json({ success: true, blacklisted: keys[keyToBlacklist].blacklisted });
            } else {
                res.status(500).json({ success: false, message: "Failed to update key" });
            }
        } else {
            res.status(404).json({ success: false, message: "Key not found" });
        }
    } catch (err) {
        console.error('Blacklist key error:', err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Reset HWID
app.post('/admin/keys/:key/reset-hwid', requireAdmin, (req, res) => {
    try {
        const keyToReset = req.params.key;
        const keys = loadKeys();
        
        if (keys[keyToReset]) {
            keys[keyToReset].hwid = null;
            keys[keyToReset].hwidResets = (keys[keyToReset].hwidResets || 0) + 1;
            if (saveKeys(keys)) {
                console.log(`HWID reset for key: ${keyToReset} (Total resets: ${keys[keyToReset].hwidResets})`);
                res.json({ success: true, message: "HWID reset successfully", resets: keys[keyToReset].hwidResets });
            } else {
                res.status(500).json({ success: false, message: "Failed to reset HWID" });
            }
        } else {
            res.status(404).json({ success: false, message: "Key not found" });
        }
    } catch (err) {
        console.error('Reset HWID error:', err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ==================== PANEL CONFIGURATION ====================

// Get panel configuration
app.get('/panel/config', (req, res) => {
    try {
        const config = loadPanelConfig();
        res.json({
            success: true,
            config: config
        });
    } catch (error) {
        console.error('Get panel config error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Update panel configuration
app.post('/panel/config', requireAdmin, (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name || !description) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name and description are required' 
            });
        }
        
        const config = {
            name: name.trim(),
            description: description.trim()
        };
        
        if (savePanelConfig(config)) {
            console.log('Panel config updated:', config);
            res.json({
                success: true,
                message: 'Panel configuration updated successfully',
                config: config
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to save panel configuration'
            });
        }
    } catch (error) {
        console.error('Save panel config error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ==================== KEY VALIDATION ====================

// Validate key
app.get('/validate', (req, res) => {
    try {
        const { key, hwid, username, userId } = req.query;
        
        console.log(`Validation - Key: ${key}, User: ${username}, UserID: ${userId}, HWID: ${hwid}`);
        
        if (!key || key === "" || key === "null") {
            return res.json({ success: false, message: "Invalid license" });
        }
        
        const keys = loadKeys();
        const keyData = keys[key];
        
        if (!keyData) {
            console.log(`Invalid key: ${key}`);
            return res.json({ success: false, message: "Invalid key" });
        }

        if (keyData.blacklisted) {
            console.log(`Blacklisted key: ${key}`);
            return res.json({ success: false, message: "Key has been blacklisted" });
        }
        
        if (!keyData.active) {
            console.log(`Disabled key: ${key}`);
            return res.json({ success: false, message: "Key has been disabled" });
        }
        
        if (keyData.hwid && keyData.hwid !== hwid) {
            console.log(`HWID mismatch: ${key}`);
            return res.json({ success: false, message: "Key is bound to another device" });
        }
        
        // First time use - bind HWID and User ID
        if (!keyData.hwid && hwid) {
            keyData.hwid = hwid;
            console.log(`Key bound to HWID: ${key}`);
        }

        if (!keyData.userId && userId) {
            keyData.userId = userId;
            console.log(`Key bound to User ID: ${userId}`);
        }

        // Increment execution count
        keyData.executions = (keyData.executions || 0) + 1;
        
        saveKeys(keys);
        console.log(`Key validated: ${key} for ${username} (Execution #${keyData.executions})`);
        
        res.json({ 
            success: true, 
            message: "Key validated successfully",
            executions: keyData.executions
        });
    } catch (err) {
        console.error('Validation error:', err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// POST validation endpoint
app.post('/validate', (req, res) => {
    try {
        const { key, hwid, username, userId } = req.body;
        req.query = { key, hwid, username, userId };
        
        // Call the GET handler
        const getHandler = app._router.stack.find(
            layer => layer.route && layer.route.path === '/validate' && layer.route.methods.get
        );
        
        if (getHandler) {
            getHandler.handle(req, res);
        } else {
            res.status(500).json({ success: false, message: "Server error" });
        }
    } catch (err) {
        console.error('POST validation error:', err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`Quco Key System running on port ${PORT}`);
    console.log(`Admin Key: ${ADMIN_KEY}`);
    console.log(`Keys file: ${KEYS_FILE}`);
    console.log(`Panel config file: ${PANEL_CONFIG_FILE}`);
    console.log(`========================================`);
});
