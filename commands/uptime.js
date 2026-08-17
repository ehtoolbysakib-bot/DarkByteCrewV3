const startTime = Date.now();

module.exports = {
    execute: async (senderId, args, sendMessage) => {
        const uptimeMs = Date.now() - startTime;
        const seconds = Math.floor(uptimeMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const timeStr = `${days} দিন ${hours % 24} ঘন্টা ${minutes % 60} মিনিট ${seconds % 60} সেকেন্ড`;
        await sendMessage(senderId, `⏳ *বট আপটাইম:* ${timeStr}`);
    }
};