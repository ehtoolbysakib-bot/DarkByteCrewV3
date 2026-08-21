const User = require('../models/User');

module.exports = {
    execute: async (senderId, args, sendMessage) => {
        try {
            const user = await User.findOne({ fbId: senderId });
            if (!user) {
                await sendMessage(senderId, '❌ আপনার তথ্য ডাটাবেসে পাওয়া যায়নি।');
                return;
            }

            // 🔥 ডাটাবেসের fbId ফিল্ডটি পাঠান (Facebook ID)
            const fbId = user.fbId;
            await sendMessage(senderId, `🔑 আপনার Facebook আইডি: \`${fbId}\``);
        } catch (err) {
            console.error('❌ UID command error:', err);
            await sendMessage(senderId, '❌ আইডি বের করতে ব্যর্থ: ' + err.message);
        }
    }
};