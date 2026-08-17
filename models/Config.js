const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    key: { type: String, unique: true, default: 'bot_config' },
    pageAccessToken: { type: String, default: '' },
    verifyToken: { type: String, default: 'Sakib_Verify' },
    adminPassword: { type: String, default: 'Sakib@7890' },
    baseUrl: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Config', configSchema);