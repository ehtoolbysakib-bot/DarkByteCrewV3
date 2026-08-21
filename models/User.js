const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fbId: { type: String, unique: true, required: true },
    firstName: { type: String, default: 'বন্ধু' },
    allowed: { type: Boolean, default: false },
    permissionExpiresAt: { type: Date, default: null }, // 🔥 পারমিশনের মেয়াদ
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date },
    messageCount: { type: Number, default: 0 }
});

// 🔥 হেল্পার: পারমিশন অ্যাক্টিভ কিনা চেক করুন
userSchema.methods.isPermissionActive = function() {
    if (!this.allowed) return false;
    if (!this.permissionExpiresAt) return true; // এক্সপাইরি না থাকলে চিরস্থায়ী
    return new Date() < this.permissionExpiresAt;
};

module.exports = mongoose.model('User', userSchema);