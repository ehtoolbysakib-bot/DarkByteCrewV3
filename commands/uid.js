const User = require('../models/User');

module.exports = {
    execute: async (senderId, args, sendMessage) => {
        try {
            const user = await User.findOne({ fbId: senderId });
            if (!user) {
                await sendMessage(senderId, '❌ আপনার তথ্য ডাটাবেসে পাওয়া যায়নি।');
                return;
            }

            // MongoDB ডকুমেন্টের _id ফিল্ডটি রিটার্ন করুন
            const uid = user._id.toString();
            await sendMessage(senderId, `🔑 আপনার ইউজার আইডি: \`${uid}\``);
        } catch (err) {
            console.error('❌ UID command error:', err);
            await sendMessage(senderId, '❌ ইউজার আইডি বের করতে ব্যর্থ: ' + err.message);
        }
    }
};