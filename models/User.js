const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fbId: { type: String, unique: true, required: true },
    firstName: { type: String, default: 'বন্ধু' },
    allowed: { type: Boolean, default: false },
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date },
    messageCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);