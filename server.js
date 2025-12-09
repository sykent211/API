const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS headers for Roblox
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Valid keys database
const validKeys = {
    "scriptkey": { 
        active: true, 
        hwid: null, 
        expires: null,
        owner: "Admin"
    },
    "premium_key_123": { 
        active: true, 
        hwid: null, 
        expires: "2025-12-31",
        owner: "TestUser"
    },
    "testkey456": { 
        active: true, 
        hwid: "ABC123XYZ", 
        expires: null,
        owner: "BoundUser"
    }
};

// Key validation endpoint (POST)
app.post('/validate', (req, res) => {
    const { key, hwid, username } = req.body;
    
    console.log(`🔍 Validation attempt - Key: ${key}, User: ${username || 'Unknown'}, HWID: ${hwid || 'None'}`);
    
    if (!key) {
        return res.json({ 
            success: false, 
            message: "❌ No key provided" 
        });
    }
    
    const keyData = validKeys[key];
    
    // Check if key exists
    if (!keyData) {
        console.log(`❌ Invalid key: ${key}`);
        return res.json({ 
            success: false, 
            message: "❌ Invalid key" 
        });
    }
    
    // Check if key is active
    if (!keyData.active) {
        console.log(`❌ Disabled key: ${key}`);
        return res.json({ 
            success: false, 
            message: "❌ Key has been disabled" 
        });
    }
    
    // Check HWID binding
    if (keyData.hwid) {
        if (keyData.hwid !== hwid) {
            console.log(`❌ HWID mismatch for key: ${key}`);
            return res.json({ 
                success: false, 
                message: "❌ Key is bound to another device" 
            });
        }
    } else if (hwid) {
        // First time use - bind to HWID
        keyData.hwid = hwid;
        console.log(`🔗 Key ${key} bound to HWID: ${hwid}`);
    }
    
    // Check expiration
    if (keyData.expires) {
        const expireDate = new Date(keyData.expires);
        if (new Date() > expireDate) {
            console.log(`❌ Expired key: ${key}`);
            return res.json({ 
                success: false, 
                message: "❌ Key has expired" 
            });
        }
    }
    
    // Success!
    console.log(`✅ Key validated successfully: ${key} for ${username || 'Unknown'}`);
    
    return res.json({ 
        success: true, 
        message: "✅ Key validated successfully",
        expires: keyData.expires || "Never",
        owner: keyData.owner
    });
});

// Test endpoint (GET) - for browser testing
app.get('/validate', (req, res) => {
    res.json({ 
        info: "This endpoint requires POST request",
        usage: "Send POST request with JSON body: { key, hwid, username }",
        test_keys: ["scriptkey", "premium_key_123", "testkey456"]
    });
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: "✅ Key system online",
        timestamp: new Date().toISOString(),
        endpoints: {
            validate: "/validate (POST)",
            keys: "/keys (GET)",
            health: "/ (GET)"
        }
    });
});

// Get all keys (admin only - remove in production or add auth)
app.get('/keys', (req, res) => {
    const keyList = Object.entries(validKeys).map(([key, data]) => ({
        key: key.substring(0, 4) + "***", // Partially hide keys
        active: data.active,
        hwid: data.hwid ? "Bound" : "Unbound",
        expires: data.expires || "Never",
        owner: data.owner
    }));
    
    res.json({ 
        total: keyList.length,
        keys: keyList 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Key system running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/`);
    console.log(`🔑 Validation endpoint: http://localhost:${PORT}/validate`);
});
