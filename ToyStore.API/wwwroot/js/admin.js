/* ============================================================
   ToyStore Admin - admin.js  (Full rewrite)
   ============================================================ */

'use strict';

// ── STATE ────────────────────────────────────────────────────
const app = document.getElementById('app');
let token = localStorage.getItem('toyStoreToken');
let currentUser = JSON.parse(localStorage.getItem('toyStoreUser') || 'null');
let revenueChart = null;
let dashPollTimer = null;
let confirmCallback = null;
let inventoryRealtimeTimer = null;
let variantCatalog = [];

const ref = { categories: [], brands: [], suppliers: [] };
const cache = {};   // keyed by view name

// ── MODULE DEFINITIONS ───────────────────────────────────────
const MODULES = {
  products: {
    title: 'Sản phẩm', kicker: 'HÀNG HÓA',
    desc: 'Quản lý danh sách sản phẩm trong cửa hàng.',
    symbol: '▦', endpoint: 'Product',
    columns: ['Tên sản phẩm', 'Danh mục', 'Thương hiệu', 'Giá bán', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  categories: {
    title: 'Danh mục', kicker: 'HÀNG HÓA',
    desc: 'Phân nhóm sản phẩm để quản lý dễ dàng hơn.',
    symbol: '⊞', endpoint: 'Category',
    columns: ['Tên danh mục', 'Mô tả', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  brands: {
    title: 'Thương hiệu', kicker: 'HÀNG HÓA',
    desc: 'Các thương hiệu đồ chơi kinh doanh tại ToyStore.',
    symbol: '✺', endpoint: 'Brand',
    columns: ['Thương hiệu', 'Mô tả', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
    inventory: {
        title: 'Tồn kho',
        kicker: 'HÀNG HÓA',
        desc: 'Theo dõi số lượng tồn, đã giữ chỗ và số lượng có thể bán.',
        symbol: '▤',
        endpoint: 'Inventory',
        columns: ['SKU', 'Sản phẩm', 'Tồn kho', 'Đã giữ', 'Có thể bán', 'Cập nhật'],
        canAdd: true,
        canEdit: true,
        canDelete: true
    },
  suppliers: {
    title: 'Nhà cung cấp', kicker: 'VẬN HÀNH',
    desc: 'Thông tin các đối tác cung ứng hàng hóa.',
    symbol: '♧', endpoint: 'Supplier',
    columns: ['Nhà cung cấp', 'Số điện thoại', 'Email', 'Mã số thuế', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  orders: {
    title: 'Đơn hàng', kicker: 'VẬN HÀNH',
    desc: 'Theo dõi vòng đời và trạng thái đơn hàng.',
    symbol: '↗', endpoint: 'Order',
    columns: ['Mã đơn', 'Khách hàng', 'Ngày đặt', 'Giá trị', 'Trạng thái'],
    canAdd: false, canEdit: true, canDelete: false
  },
  imports: {
    title: 'Phiếu nhập kho', kicker: 'VẬN HÀNH',
    desc: 'Quản lý phiếu nhập hàng từ nhà cung cấp.',
    symbol: '📦', endpoint: 'ImportReceipt',
    columns: ['Mã phiếu', 'Nhà cung cấp', 'Ngày nhập', 'Tổng tiền', 'Ghi chú'],
    canAdd: true, canEdit: false, canDelete: true
  },
  promotions: {
    title: 'Khuyến mãi', kicker: 'MARKETING',
    desc: 'Quản lý các chương trình giảm giá và khuyến mãi.',
    symbol: '🏷', endpoint: 'Promotion',
    columns: ['Tên chương trình', 'Loại giảm giá', 'Giá trị', 'Thời gian', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  vouchers: {
    title: 'Voucher', kicker: 'MARKETING',
    desc: 'Mã giảm giá dành cho khách hàng.',
    symbol: '🎟', endpoint: 'Voucher',
    columns: ['Mã voucher', 'Tên', 'Loại', 'Giá trị', 'Hạn dùng', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  customers: {
    title: 'Khách hàng', kicker: 'KHÁCH HÀNG',
    desc: 'Hồ sơ khách hàng, hạng thành viên và chi tiêu.',
    symbol: '◎', endpoint: 'Customer',
    columns: ['Khách hàng', 'Email', 'Số điện thoại', 'Hạng', 'Đơn hàng'],
    canAdd: false, canEdit: false, canDelete: false
  },
  users: {
    title: 'Phân quyền người dùng', kicker: 'HỆ THỐNG',
    desc: 'Quản lý tài khoản hệ thống, phân quyền vai trò (Admin, Manager, Staff, Customer) và trạng thái tài khoản.',
    symbol: '👥', endpoint: 'Auth/users',
    columns: ['Tên người dùng', 'Email', 'Số điện thoại', 'Vai trò (Role)', 'Trạng thái'],
    canAdd: false, canEdit: false, canDelete: false
  }
};

const ORDER_STATUS = ['Chờ xác nhận', 'Đã xác nhận', 'Đang xử lý', 'Đang giao', 'Hoàn tất', 'Đã hủy'];
const DISCOUNT_TYPE = { 0: 'Phần trăm (%)', 1: 'Số tiền cố định (đ)' };

// ── UTILITIES ────────────────────────────────────────────────
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

const money = v => v == null ? '—' : Number(v).toLocaleString('vi-VN') + ' đ';

const fmtDate = s => s ? new Date(s).toLocaleDateString('vi-VN') : '—';

const statusLabel = v =>
  (v === true || v === 1 || v === '1' || v === 'true') ? 'Đang hoạt động' : 'Tạm ngưng';

const pillClass = v => {
  if (/hết|hủy|tạm ngưng|lỗi/i.test(v)) return 'danger';
  if (/chờ|sắp|sắp hết/i.test(v)) return 'warning';
  if (/đang|hoàn tất|ổn định|hoạt động|xác nhận/i.test(v)) return 'success';
  if (/thông tin|trung|giao/i.test(v)) return 'info';
  return 'neutral';
};

function pill(text) {
  return `<span class="pill ${pillClass(text)}">${esc(text)}</span>`;
}

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.className = `toast ${type}`;
  document.getElementById('toastIcon').textContent = type === 'error' ? '✕' : '✓';
  document.getElementById('toastMsg').textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ── CONFIRM DIALOG ───────────────────────────────────────────
function confirm(title, msg, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmBackdrop').classList.add('show');
  confirmCallback = cb;
}

document.getElementById('confirmYes').addEventListener('click', () => {
  document.getElementById('confirmBackdrop').classList.remove('show');
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
});
document.getElementById('confirmNo').addEventListener('click', () => {
  document.getElementById('confirmBackdrop').classList.remove('show');
  confirmCallback = null;
});

// ── API FETCH ─────────────────────────────────────────────────
const API_BASE = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '5225'))
    ? 'http://localhost:5225'
    : '';

async function api(path, opt = {}) {
  if (!token) return null;
  const res = await fetch(`${API_BASE}/api/${path}`, {
    ...opt,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opt.headers || {})
    }
  });
  if (res.status === 401) { doLogout(); return null; }
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`;
    try {
      const b = await res.json();
      msg = b.message || (b.errors ? Object.values(b.errors).flat().join(', ') : msg);
    } catch {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

// ── API STATUS CHECK ──────────────────────────────────────────
async function checkApiStatus(manual = false) {
  const btn = document.getElementById('apiBadge');
  const lbl = document.getElementById('apiLabel');
  if (!btn) return;
  btn.className = 'api-check-btn checking';
  lbl.textContent = 'Đang kiểm tra...';
  try {
    const res = await fetch(`${API_BASE}/api/Health`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      btn.className = 'api-check-btn online';
      lbl.textContent = 'API Online';
      if (manual) toast('Kết nối API thành công!', 'success');
    } else {
      btn.className = 'api-check-btn offline';
      lbl.textContent = 'API Offline';
      if (manual) toast('API phản hồi lỗi ' + res.status, 'error');
    }
  } catch {
    btn.className = 'api-check-btn offline';
    lbl.textContent = 'Không kết nối được';
    if (manual) toast('Không thể kết nối tới API server', 'error');
  }
}

// ── AUTH ──────────────────────────────────────────────────────
function doLogout() {
  localStorage.clear();
  location.reload();
}

function showAdmin() {
  document.getElementById('loginScreen').classList.remove('show');
  document.querySelector('.app-shell').classList.add('show');
  const name = currentUser?.fullName || currentUser?.email || 'Admin';
  document.getElementById('currentUserName').textContent = name;
  document.getElementById('userAvatar').textContent =
    name.split(' ').map(p => p[0]).join('').slice(-2).toUpperCase();
  checkApiStatus();
  loadRef();
  navigate();
  clearInterval(inventoryRealtimeTimer);
  inventoryRealtimeTimer = setInterval(() => {
    if (currentView === 'inventory') renderModule('inventory');
  }, 15000);
}

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  const btn = e.target.querySelector('button[type=submit]');
  btn.textContent = 'Đang đăng nhập...';
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/Auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e.target.email.value, password: e.target.password.value })
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      currentUser = data;
      localStorage.setItem('toyStoreToken', token);
      localStorage.setItem('toyStoreUser', JSON.stringify(data));
      showAdmin();
    } else {
      errEl.textContent = data.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.';
    }
  } catch {
    errEl.textContent = 'Không thể kết nối tới server.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Đăng nhập <span>→</span>';
  }
});

document.getElementById('logoutButton').addEventListener('click', () => {
  confirm('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi hệ thống?', doLogout);
});

// ── REFERENCE DATA ────────────────────────────────────────────
async function loadRef() {
  try {
    const [c, b, s] = await Promise.all([api('Category'), api('Brand'), api('Supplier')]);
    ref.categories = c || [];
    ref.brands = b || [];
    ref.suppliers = s || [];
  } catch {}
}

// ── NAVIGATION ────────────────────────────────────────────────
let currentView = '';

function navigate(view) {
  view = view || location.hash.slice(1) || 'dashboard';
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });
  document.getElementById('breadcrumbCurrent').textContent =
    view === 'dashboard' ? 'Dashboard' : (MODULES[view]?.title || view);
  if (view === 'dashboard') renderDashboard();
  else renderModule(view);
}

// Click nav
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-view]');
  if (nav) { e.preventDefault(); location.hash = nav.dataset.view; navigate(nav.dataset.view); }
});

window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));

// Mobile sidebar
const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);
document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  overlay.classList.toggle('show');
});
overlay.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  overlay.classList.remove('show');
});

// ── DASHBOARD ─────────────────────────────────────────────────
function renderDashboard() {
  const now = new Date();
  const greet = now.getHours() < 12 ? 'Chào buổi sáng' : now.getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  app.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">${now.toLocaleDateString('vi-VN', { weekday:'long', year:'numeric', month:'long', day:'numeric' }).toUpperCase()}</p>
        <h1>${greet}! <span style="color:var(--coral)">✦</span></h1>
        <p>Tổng quan hoạt động cửa hàng hôm nay.</p>
      </div>
    </div>
    <div class="stats-grid">
      <article class="stat-card">
        <div class="stat-top">Doanh thu hôm nay <span class="stat-icon green">↗</span></div>
        <div class="stat-value" id="kpiRevenue">—</div>
        <div class="stat-foot">Tổng doanh thu</div>
      </article>
      <article class="stat-card">
        <div class="stat-top">Đơn hàng <span class="stat-icon peach">📋</span></div>
        <div class="stat-value" id="kpiOrders">—</div>
        <div class="stat-foot">Tổng đơn hàng</div>
      </article>
      <article class="stat-card">
        <div class="stat-top">Sản phẩm <span class="stat-icon blue">▦</span></div>
        <div class="stat-value" id="kpiProducts">—</div>
        <div class="stat-foot">Đang kinh doanh</div>
      </article>
      <article class="stat-card">
        <div class="stat-top">Khách hàng <span class="stat-icon yellow">◎</span></div>
        <div class="stat-value" id="kpiCustomers">—</div>
        <div class="stat-foot">Thành viên đã đăng ký</div>
      </article>
    </div>
    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-header">
          <div><h2>Thống kê doanh thu</h2></div>
          <select class="select-control" id="chartPeriod">
            <option value="day">7 ngày qua</option>
            <option value="month" selected>Theo tháng</option>
            <option value="year">Theo năm</option>
          </select>
        </div>
        <div class="chart-wrap"><canvas id="revenueCanvas"></canvas></div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Sản phẩm bán chạy</h2></div>
        <div class="panel-body" id="bestList"><div class="skeleton" style="height:200px;border-radius:8px"></div></div>
      </section>
    </div>
    <section class="panel table-panel">
      <div class="panel-header">
        <h2>Đơn hàng gần đây</h2>
        <button class="ghost-btn" data-view="orders">Xem tất cả</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày đặt</th><th>Giá trị</th><th>Trạng thái</th></tr></thead>
          <tbody id="recentOrders"><tr><td colspan="5" style="text-align:center;padding:24px">Đang tải...</td></tr></tbody>
        </table>
      </div>
    </section>`;
  initChart();
  loadDashboardData();
  clearInterval(dashPollTimer);
  dashPollTimer = setInterval(() => {
    if (currentView === 'dashboard') loadDashboardData();
  }, 30000);
}

function initChart() {
  const ctx = document.getElementById('revenueCanvas')?.getContext('2d');
  if (!ctx) return;
  if (revenueChart) revenueChart.destroy();
  revenueChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Doanh thu', data: [], borderColor: '#173f35', backgroundColor: 'rgba(23,63,53,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#173f35', pointRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => money(ctx.parsed.y) } } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v.toLocaleString('vi-VN') } } }
    }
  });
  document.getElementById('chartPeriod')?.addEventListener('change', e => loadChart(e.target.value));
  loadChart('month');
}

async function loadChart(period) {
  try {
    const data = await api(`Dashboard/revenue-chart?period=${period}`);
    if (data && revenueChart) {
      revenueChart.data.labels = data.labels;
      revenueChart.data.datasets[0].data = data.data;
      revenueChart.update();
    }
  } catch {}
}

async function loadDashboardData() {
  try {
    const [sum, best, orders] = await Promise.all([
      api('Dashboard/summary'), api('Dashboard/best-selling?top=5'), api('Order')
    ]);
    if (sum) {
      const el = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
      el('kpiRevenue', money(sum.totalRevenue));
      el('kpiOrders', sum.totalOrders ?? '—');
      el('kpiProducts', sum.totalProducts ?? '—');
      el('kpiCustomers', sum.totalCustomers ?? '—');
    }
    const bestEl = document.getElementById('bestList');
    if (best && bestEl) {
      bestEl.innerHTML = best.length
        ? best.map((p, i) => `<div class="best-row"><span class="best-rank">#${i+1}</span><span class="best-name">${esc(p.productName)}</span><span class="best-count">${p.totalQuantitySold} sp</span></div>`).join('')
        : '<p style="color:var(--muted);text-align:center;padding:20px 0">Chưa có dữ liệu</p>';
    }
    const tbody = document.getElementById('recentOrders');
    if (orders && tbody) {
      const recent = orders.slice(0, 8);
      tbody.innerHTML = recent.length
        ? recent.map(o => `<tr>
            <td>#${o.id}</td>
            <td>${esc(o.customerName || 'Khách lẻ')}</td>
            <td>${fmtDate(o.orderDate)}</td>
            <td>${money(o.totalAmount)}</td>
            <td>${pill(ORDER_STATUS[o.status] || 'N/A')}</td>
          </tr>`).join('')
        : '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--muted)">Chưa có đơn hàng</td></tr>';
    }
  } catch (err) { console.error(err); }
}

// ── MODULE RENDERER ───────────────────────────────────────────
async function renderModule(key) {
  const m = MODULES[key];
  if (!m) { app.innerHTML = '<p style="padding:40px;color:var(--muted)">Module không tồn tại.</p>'; return; }

  // Show skeleton
  const addBtn = m.canAdd
    ? `<button class="primary-btn" id="addBtn" data-entity="${key}">Thêm mới <span>+</span></button>`
    : '';
  app.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">${m.kicker}</p><h1>${m.title}</h1><p>${m.desc}</p></div>
      <div class="page-head-actions">${addBtn}</div>
    </div>
    <section class="panel">
      <div class="table-toolbar">
        <input class="search-box" id="searchBox" placeholder="Tìm kiếm..." type="search">
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>${m.columns.map(c => `<th>${c}</th>`).join('')}<th></th></tr></thead>
          <tbody id="moduleBody"><tr><td colspan="${m.columns.length+1}" style="text-align:center;padding:32px">
            <div class="skeleton" style="height:180px;border-radius:8px;margin:0"></div>
          </td></tr></tbody>
        </table>
      </div>
    </section>`;

  document.getElementById('addBtn')?.addEventListener('click', () => openModal(key, null));

  // Load data
  try {
    const data = await api(m.endpoint);
    let rows = data || [];
    if (key === 'inventory') {
      const products = await api('Product') || [];
      variantCatalog = products.flatMap(product => (product.productVariants || []).map(variant => ({
        ...variant,
        productName: product.name
      })));
      const inventoryByVariant = new Map(rows.map(item => [item.variantId, item]));
      rows = products.flatMap(product => (product.productVariants || []).map(variant => {
        const inventory = inventoryByVariant.get(variant.variantId);
        return inventory || {
          inventoryId: null,
          variantId: variant.variantId,
          sku: variant.sku,
          productName: product.name,
          quantity: 0,
          reservedQuantity: 0,
          availableQuantity: 0,
          updatedAt: null,
          isMissing: true
        };
      }));
    }
    cache[key] = rows;
    renderTable(key, rows);
    document.getElementById('searchBox')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      renderTable(key, cache[key].filter(r => JSON.stringify(r).toLowerCase().includes(q)));
    });
  } catch (err) {
    document.getElementById('moduleBody').innerHTML =
      `<tr><td colspan="${m.columns.length+1}" style="text-align:center;padding:32px;color:#d63939">Lỗi tải dữ liệu: ${esc(err.message)}</td></tr>`;
  }
}

function renderTable(key, data) {
  const m = MODULES[key];
  const tbody = document.getElementById('moduleBody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="${m.columns.length+1}"><div class="empty-state">
      <div class="empty-icon">📭</div><strong>Chưa có dữ liệu</strong><span>Nhấn "Thêm mới" để bắt đầu.</span>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((r, idx) => {
    const cells = getRowCells(key, r);
    const actions = [
      key === 'users' ? `
        <button class="primary-btn" style="padding:4px 9px;font-size:11px;" onclick="openRoleModal('${r.userId}', '${r.role}')">Đổi vai trò</button>
        <button class="cancel-btn" style="padding:4px 9px;font-size:11px;color:${r.isActive ? '#b44235' : '#24724e'};border-color:${r.isActive ? '#f87171' : '#4ade80'};" onclick="toggleUserStatus('${r.userId}')">${r.isActive ? 'Khóa' : 'Kích hoạt'}</button>
      ` : '',
      key === 'products' ? `<button class="icon-btn" title="Quản lý biến thể" data-action="variants" data-key="${key}" data-idx="${idx}">⌘</button>` : '',
      m.canEdit ? `<button class="icon-btn" title="${r.isMissing ? 'Thiết lập tồn kho' : 'Cập nhật tồn kho'}" data-action="edit" data-key="${key}" data-idx="${idx}">${r.isMissing ? '+' : '✎'}</button>` : '',
      m.canDelete ? `<button class="icon-btn del" title="Xóa" data-action="delete" data-key="${key}" data-idx="${idx}">🗑</button>` : ''
    ].join('');
    return `<tr>${cells.map((c, ci) => `<td>${ci === cells.length - 1 ? (key === 'users' ? c : pill(c)) : (typeof c === 'string' && c.startsWith('<span') ? c : esc(c))}</td>`).join('')}<td class="actions-cell">${actions}</td></tr>`;
  }).join('');
}

function getRowCells(key, r) {
  switch (key) {
    case 'products':
      return [r.name, r.categoryName || 'N/A', r.brandName || 'N/A', money(r.basePrice), statusLabel(r.status)];
    case 'categories':
      return [r.name, r.description || '—', statusLabel(r.isActive)];
    case 'brands':
      return [r.name, r.description || '—', statusLabel(r.isActive)];
    case 'inventory':
      return [r.sku || '—', r.productName || '—', r.quantity ?? 0, r.reservedQuantity ?? 0, r.availableQuantity ?? 0, r.updatedAt ? fmtDate(r.updatedAt) : 'Chưa thiết lập'];
    case 'suppliers':
      return [r.name, r.phone || '—', r.email || '—', r.taxCode || '—', statusLabel(r.isActive)];
    case 'orders':
      return [`#${r.id}`, r.customerName || 'Khách lẻ', fmtDate(r.orderDate), money(r.totalAmount), ORDER_STATUS[r.status] || '?'];
    case 'imports':
      return [r.importReceiptId ? `#${r.importReceiptId}` : '—', r.supplierName || '—', fmtDate(r.importDate), money(r.totalAmount), r.note || '—'];
    case 'promotions':
      return [r.name, DISCOUNT_TYPE[r.discountType] || '—', r.discountType === 0 ? `${r.discountValue}%` : money(r.discountValue), fmtDate(r.startDate) + ' – ' + fmtDate(r.endDate), r.isActive ? 'Đang hoạt động' : 'Tạm ngưng'];
    case 'vouchers':
      return [r.code, r.name || '—', DISCOUNT_TYPE[r.discountType] || '—', r.discountType === 0 ? `${r.discountValue}%` : money(r.discountValue), fmtDate(r.expiryDate), r.isActive ? 'Đang hoạt động' : 'Hết hạn'];
    case 'customers':
      return [r.fullName || r.name || '—', r.email || '—', r.phone || '—', r.loyaltyTier || r.tier || 'Thường', r.totalOrders ?? 0];
    case 'users':
      const rolePill = `<span class="pill ${r.role === 'Admin' ? 'danger' : r.role === 'Manager' ? 'warning' : r.role === 'Staff' ? 'info' : 'success'}">${r.role || 'Customer'}</span>`;
      const statusPill = r.isActive ? 'Đang hoạt động' : 'Đã khóa';
      return [r.fullName || '—', r.email || '—', r.phoneNumber || '—', rolePill, statusPill];
    default: return [JSON.stringify(r)];
  }
}

// ── TABLE ACTIONS ─────────────────────────────────────────────
document.addEventListener('click', e => {
  const variantAction = e.target.closest('[data-variant-action]');
  if (variantAction) {
    const form = document.getElementById('entityForm');
    if (variantAction.dataset.variantAction === 'edit') {
      fillVariantForm(form._variantRecords[Number(variantAction.dataset.variantIndex)]);
    } else {
      confirm('Xác nhận xóa', 'Bạn có chắc muốn xóa biến thể này không?', async () => {
        try {
          await api(`Product/variants/${variantAction.dataset.variantId}`, { method: 'DELETE' });
          toast('Xóa biến thể thành công!', 'success');
          await openVariantManager({ productId: form.dataset.productId, name: document.getElementById('modalTitle').textContent.replace('Biến thể: ', '') });
        } catch (err) { toast(err.message, 'error'); }
      });
    }
    return;
  }
  const action = e.target.closest('[data-action]');
  if (!action) return;
  const key = action.dataset.key;
  const idx = Number(action.dataset.idx);
  const record = cache[key]?.[idx];
  if (action.dataset.action === 'variants') {
    openVariantManager(record);
    return;
  }
  if (action.dataset.action === 'edit') openModal(key, record);
  if (action.dataset.action === 'delete') {
    confirm('Xác nhận xóa', `Bạn có chắc muốn xóa mục này không?`, async () => {
      try {
        const m = MODULES[key];
        const id = getRecordId(key, record);
        await api(`${m.endpoint}/${id}`, { method: 'DELETE' });
        toast('Xóa thành công!', 'success');
        await loadRef();
        renderModule(key);
      } catch (err) { toast(err.message, 'error'); }
    });
  }
});

function getRecordId(key, r) {
  if (key === 'suppliers') return r.supplierId;
  if (key === 'imports') return r.importReceiptId;
  if (key === 'promotions') return r.promotionId;
  if (key === 'vouchers') return r.voucherId;
  if (key === 'customers') return r.customerId;
  if (key === 'inventory') return r.inventoryId;
  if (key === 'orders') return r.id || r.orderId;
  return r.id ?? r.productId ?? r.categoryId ?? r.brandId;
}

// ── MODAL ─────────────────────────────────────────────────────
function openModal(entity, record) {
  const isEdit = !!record;
  const titles = {
    products: 'Sản phẩm', categories: 'Danh mục', brands: 'Thương hiệu', inventory: 'Tồn kho',
    suppliers: 'Nhà cung cấp', orders: 'Đơn hàng', imports: 'Phiếu nhập kho',
    promotions: 'Khuyến mãi', vouchers: 'Voucher'
  };
  document.getElementById('modalKicker').textContent = isEdit ? 'CHỈNH SỬA' : 'THÊM MỚI';
  document.getElementById('modalTitle').textContent = (isEdit ? 'Chỉnh sửa ' : 'Thêm ') + (titles[entity] || entity);
  document.getElementById('modalSubtitle').textContent = 'Vui lòng điền đầy đủ thông tin bắt buộc (*).';

  const form = document.getElementById('entityForm');
  form.dataset.entity = entity;
  form.dataset.mode = isEdit ? 'edit' : 'create';
  form.dataset.id = isEdit ? getRecordId(entity, record) : '';

  document.getElementById('modalFormFields').innerHTML = buildFormFields(entity, record);
  document.getElementById('modalBackdrop').classList.add('show');
}

function buildVariantOptions(selectedId) {
  if (!variantCatalog.length) return '<option value="">Chưa có variant</option>';
  return variantCatalog.map(variant => {
    const label = `${variant.productName} - ${variant.sku || `Variant #${variant.variantId}`}`;
    return `<option value="${variant.variantId}" ${String(selectedId) === String(variant.variantId) ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

async function openVariantManager(product) {
  const current = await api(`Product/${product.productId}`) || product;
  const variants = current.productVariants || [];
  const form = document.getElementById('entityForm');
  form.dataset.entity = 'variants';
  form.dataset.mode = 'create';
  form.dataset.productId = current.productId;
  form.dataset.id = '';
  document.getElementById('modalKicker').textContent = 'SẢN PHẨM / BIẾN THỂ';
  document.getElementById('modalTitle').textContent = `Biến thể: ${current.name}`;
  document.getElementById('modalSubtitle').textContent = variants.length ? `${variants.length} biến thể đang có` : 'Sản phẩm chưa có biến thể nào.';
  document.getElementById('modalFormFields').innerHTML = `
    <div class="variant-list">${variants.length ? variants.map((variant, index) => `<div class="variant-row"><div><b>${esc(variant.sku)}</b><small>${esc(variant.color || 'Không màu')} / ${esc(variant.size || 'Không size')} · ${money(variant.price)}</small></div><div><button type="button" class="icon-btn" data-variant-action="edit" data-variant-index="${index}">✎</button><button type="button" class="icon-btn del" data-variant-action="delete" data-variant-id="${variant.variantId}">🗑</button></div></div>`).join('') : '<p class="empty-state">Chưa có biến thể.</p>'}</div>
    <hr>
    <h3 id="variantFormTitle">Thêm biến thể</h3>
    <input type="hidden" name="variantId">
    <div class="form-grid"><label>SKU *<input name="sku" required placeholder="VD: TOY-001"></label><label>Giá bán *<input name="price" type="number" min="0" required></label></div>
    <div class="form-grid"><label>Màu sắc<input name="color"></label><label>Kích thước<input name="size"></label></div>
    <div class="variant-editor-heading"><strong>Loại thuộc tính khác</strong><button type="button" class="ghost-btn" data-variant-editor-action="add-attribute">+ Thêm loại</button></div>
    <div class="variant-attributes"></div>
    <div class="form-grid"><label>Giá vốn *<input name="costPrice" type="number" min="0" required></label><label>Khối lượng<input name="weight" type="number" min="0" step="0.01"></label></div>
    <label>Link hình ảnh<input name="variantImageUrl" type="url" placeholder="https://..."></label>
    <label>Trạng thái<select name="variantStatus"><option value="1">Đang hoạt động</option><option value="0">Tạm ngưng</option></select></label>`;
  document.getElementById('modalBackdrop').classList.add('show');
  form._variantRecords = variants;
}

function fillVariantForm(variant) {
  const form = document.getElementById('entityForm');
  form.dataset.mode = 'edit';
  form.dataset.id = variant.variantId;
  form.elements.variantId.value = variant.variantId;
  form.elements.sku.value = variant.sku || '';
  form.elements.price.value = variant.price ?? '';
  form.elements.color.value = variant.color || '';
  form.elements.size.value = variant.size || '';
  form.elements.costPrice.value = variant.costPrice ?? '';
  form.elements.weight.value = variant.weight ?? '';
  form.elements.variantImageUrl.value = variant.imageUrl || '';
  form.elements.variantStatus.value = variant.status ?? 1;
  form.querySelector('.variant-attributes').innerHTML = (variant.attributes || []).filter(attribute => !['màu sắc', 'color', 'kích thước', 'size'].includes(String(attribute.attributeName).toLowerCase())).map(productVariantAttributeRow).join('');
  document.getElementById('variantFormTitle').textContent = 'Chỉnh sửa biến thể';
}

function productVariantAttributeRow(attribute = {}) {
  return `<div class="variant-attribute-row">
    <input name="variantAttributeName" placeholder="Tên loại (ví dụ: Chất liệu)" value="${esc(attribute.attributeName || '')}">
    <input name="variantAttributeValue" placeholder="Giá trị (ví dụ: Nhựa ABS)" value="${esc(attribute.attributeValue || '')}">
    <button type="button" class="icon-btn del" data-variant-editor-action="remove-attribute" title="Xóa thuộc tính">×</button>
  </div>`;
}

function productVariantEditorRow() {
  return `<div class="product-variant-row">
    <div class="form-grid"><label>SKU variant *<input name="variantSku" required placeholder="VD: TOY-001"></label><label>Giá variant *<input name="variantPrice" type="number" min="0" required placeholder="150000"></label></div>
    <div class="form-grid"><label>Giá vốn *<input name="variantCostPrice" type="number" min="0" required placeholder="100000"></label><label>Link hình ảnh<input name="variantImageUrl" type="url" placeholder="https://..."></label></div>
    <div class="form-grid"><label>Tồn kho ban đầu<input name="initialQuantity" type="number" min="0" value="0"></label><label>Đã giữ<input name="initialReservedQuantity" type="number" min="0" value="0"></label></div>
    <div class="variant-editor-heading"><strong>Thuộc tính biến thể</strong><button type="button" class="ghost-btn" data-variant-editor-action="add-attribute">+ Thêm loại</button><button type="button" class="icon-btn del" data-variant-editor-action="remove" title="Xóa variant">×</button></div>
    <div class="variant-attributes">${productVariantAttributeRow()}</div>
  </div>`;
}

function readProductVariants(form) {
  return [...form.querySelectorAll('.product-variant-row')].map(row => ({
    sku: row.querySelector('[name="variantSku"]').value.trim(),
    price: Number(row.querySelector('[name="variantPrice"]').value),
    costPrice: Number(row.querySelector('[name="variantCostPrice"]').value),
    imageUrl: row.querySelector('[name="variantImageUrl"]').value.trim() || null,
    status: 1,
    initialQuantity: Number(row.querySelector('[name="initialQuantity"]').value || 0),
    initialReservedQuantity: Number(row.querySelector('[name="initialReservedQuantity"]').value || 0),
    attributes: [...row.querySelectorAll('.variant-attribute-row')].map((attribute, index) => ({
      attributeName: attribute.querySelector('[name="variantAttributeName"]').value.trim(),
      attributeValue: attribute.querySelector('[name="variantAttributeValue"]').value.trim(),
      displayOrder: index
    })).filter(attribute => attribute.attributeName && attribute.attributeValue)
  }));
}

function buildFormFields(entity, r) {
  const v = r || {};
  const catOpts = ref.categories.map(c => `<option value="${c.id}" ${v.categoryId == c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const brandOpts = ref.brands.map(b => `<option value="${b.id}" ${v.brandId == b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  const supOpts = '<option value="">-- Không chọn --</option>' + ref.suppliers.map(s => `<option value="${s.supplierId}" ${v.supplierId == s.supplierId ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

  const activeField = (val) => `
    <label>Trạng thái
      <select name="isActive">
        <option value="true" ${val !== false && val !== 'false' ? 'selected' : ''}>Đang hoạt động</option>
        <option value="false" ${val === false || val === 'false' ? 'selected' : ''}>Tạm ngưng</option>
      </select>
    </label>`;

  switch (entity) {
    case 'products':
      return `
        <label>Tên sản phẩm *<input name="name" required placeholder="Ví dụ: Robot lắp ráp Technic" value="${esc(v.name||'')}"></label>
        <div class="form-grid">
          <label>
    Danh mục *
    <div class="d-flex gap-2">
        <select name="categoryId" required class="form-control">
            ${catOpts}
        </select>

        <button
            type="button"
            class="icon-btn"
            title="Thêm danh mục"
            data-add-reference="category">
            +
        </button>
    </div>
</label>
          <label>
    Thương hiệu *
    <div class="d-flex gap-2">
        <select name="brandId" required class="form-control">
            ${brandOpts}
        </select>

        <button
            type="button"
            class="icon-btn"
            title="Thêm thương hiệu"
            data-add-reference="brand">
            +
        </button>
    </div>
</label>
        </div>
        <div class="form-grid">
          <label>Nhà cung cấp<select name="supplierId">${supOpts}</select></label>
          <label>Giới tính<select name="gender">
            <option value="3" ${v.gender==3?'selected':''}>Unisex</option>
            <option value="1" ${v.gender==1?'selected':''}>Bé trai</option>
            <option value="2" ${v.gender==2?'selected':''}>Bé gái</option>
          </select></label>
        </div>
        <div class="form-grid">
          <label>Độ tuổi từ (tháng)<input name="ageFrom" type="number" min="0" placeholder="0" value="${esc(v.ageFrom??'')}"></label>
          <label>Đến (tháng)<input name="ageTo" type="number" min="0" placeholder="36" value="${esc(v.ageTo??'')}"></label>
        </div>
        <div class="form-grid">
          <label>Giá bán (đ) *<input name="basePrice" type="number" min="0" step="1000" required placeholder="150000" value="${esc(v.basePrice??'')}"></label>
          <label>Trạng thái<select name="status">
            <option value="1" ${v.status==1||v.status==null?'selected':''}>Đang kinh doanh</option>
            <option value="0" ${v.status==0?'selected':''}>Tạm ngưng</option>
          </select></label>
        </div>
        <label>Link hình ảnh (URL)<input name="imageUrl" type="url" placeholder="https://..." value="${esc(v.imageUrl||'')}"></label>
        <label>Mô tả sản phẩm *<textarea name="description" required rows="3" placeholder="Mô tả chi tiết sản phẩm...">${esc(v.description||'')}</textarea></label>
        ${!r ? `<section class="product-variants-editor"><div class="variant-editor-title"><strong>Biến thể sản phẩm</strong><button type="button" class="primary-btn" data-variant-editor-action="add">+ Thêm variant</button></div><p class="form-hint">Mỗi variant có thể có một hoặc nhiều loại thuộc tính tùy ý.</p><div id="productVariantsEditor">${productVariantEditorRow()}</div></section>` : ''}`;

    case 'categories':
      return `
        <label>Tên danh mục *<input name="name" required placeholder="Ví dụ: Đồ chơi xếp hình" value="${esc(v.name||'')}"></label>
        <label>Mô tả<textarea name="description" rows="3" placeholder="Mô tả về danh mục...">${esc(v.description||'')}</textarea></label>
        ${activeField(v.isActive)}`;

    case 'brands':
      return `
        <label>Tên thương hiệu *<input name="name" required placeholder="Ví dụ: LEGO" value="${esc(v.name||'')}"></label>
        <label>Xuất xứ<input name="origin" placeholder="Ví dụ: Đan Mạch" value="${esc(v.origin||'')}"></label>
        <label>Website thương hiệu<input name="website" type="url" placeholder="https://..." value="${esc(v.website||'')}"></label>
        <label>Mô tả<textarea name="description" rows="3" placeholder="Thông tin về thương hiệu...">${esc(v.description||'')}</textarea></label>
        ${activeField(v.isActive)}`;

    case 'inventory':
      return `
        <label>Sản phẩm / SKU *<select name="variantId" required>${buildVariantOptions(v.variantId)}</select></label>
        <div class="form-grid">
          <label>Số lượng tồn *<input name="quantity" type="number" min="0" required value="${esc(v.quantity ?? 0)}"></label>
          <label>Số lượng đã giữ<input name="reservedQuantity" type="number" min="0" required value="${esc(v.reservedQuantity ?? 0)}"></label>
        </div>`;

    case 'suppliers':
      return `
        <label>Tên nhà cung cấp *<input name="name" required placeholder="Công ty TNHH ABC" value="${esc(v.name||'')}"></label>
        <div class="form-grid">
          <label>Số điện thoại *<input name="phone" required placeholder="0901234567" value="${esc(v.phone||'')}"></label>
          <label>Email *<input name="email" type="email" required placeholder="contact@abc.com" value="${esc(v.email||'')}"></label>
        </div>
        <label>Địa chỉ *<input name="address" required placeholder="Số 1 đường ABC, Quận 1, TP.HCM" value="${esc(v.address||'')}"></label>
        <div class="form-grid">
          <label>Mã số thuế *<input name="taxCode" required placeholder="0123456789" value="${esc(v.taxCode||'')}"></label>
          <label>Người liên hệ<input name="contactPerson" placeholder="Nguyễn Văn A" value="${esc(v.contactPerson||'')}"></label>
        </div>
        ${activeField(v.isActive)}`;

    case 'orders':
      return `
        <label>Trạng thái đơn hàng
          <select name="status">
            ${ORDER_STATUS.map((s, i) => `<option value="${i}" ${v.status==i?'selected':''}>${s}</option>`).join('')}
          </select>
        </label>
        <label>Ghi chú<textarea name="note" rows="3" placeholder="Ghi chú cho đơn hàng...">${esc(v.note||'')}</textarea></label>`;

    case 'imports':
      return `
        <label>Nhà cung cấp *<select name="supplierId" required>${supOpts}</select></label>
        <div class="form-grid">
          <label>Ngày nhập *<input name="importDate" type="date" required value="${v.importDate ? v.importDate.slice(0,10) : new Date().toISOString().slice(0,10)}"></label>
          <label>Tổng tiền (đ)<input name="totalAmount" type="number" min="0" step="1000" placeholder="0" value="${esc(v.totalAmount??'')}"></label>
        </div>
        <label>Ghi chú<textarea name="note" rows="3" placeholder="Ghi chú phiếu nhập...">${esc(v.note||'')}</textarea></label>`;

    case 'promotions':
      return `
        <label>Tên chương trình *<input name="name" required placeholder="Ví dụ: Khuyến mãi Tết 2026" value="${esc(v.name||'')}"></label>
        <label>Mô tả<textarea name="description" rows="2" placeholder="Mô tả chương trình khuyến mãi...">${esc(v.description||'')}</textarea></label>
        <div class="form-grid">
          <label>Loại giảm giá *<select name="discountType" required>
            <option value="0" ${v.discountType==0?'selected':''}>Phần trăm (%)</option>
            <option value="1" ${v.discountType==1?'selected':''}>Số tiền cố định (đ)</option>
          </select></label>
          <label>Giá trị giảm *<input name="discountValue" type="number" min="0" required placeholder="10" value="${esc(v.discountValue??'')}"></label>
        </div>
        <div class="form-grid">
          <label>Ngày bắt đầu *<input name="startDate" type="date" required value="${v.startDate ? v.startDate.slice(0,10) : ''}"></label>
          <label>Ngày kết thúc *<input name="endDate" type="date" required value="${v.endDate ? v.endDate.slice(0,10) : ''}"></label>
        </div>
        <div class="form-grid">
          <label>Giảm tối đa (đ)<input name="maxDiscountAmount" type="number" min="0" step="1000" placeholder="Không giới hạn" value="${esc(v.maxDiscountAmount??'')}"></label>
          <label>Đơn tối thiểu (đ)<input name="minOrderAmount" type="number" min="0" step="1000" placeholder="0" value="${esc(v.minOrderAmount??'')}"></label>
        </div>
        ${activeField(v.isActive)}`;

    case 'vouchers':
      return `
        <div class="form-grid">
          <label>Mã voucher *<input name="code" required placeholder="TOYSTORE2026" style="text-transform:uppercase" value="${esc(v.code||'')}"></label>
          <label>Tên voucher *<input name="name" required placeholder="Voucher giảm 50%" value="${esc(v.name||'')}"></label>
        </div>
        <label>Mô tả<textarea name="description" rows="2" placeholder="Mô tả voucher...">${esc(v.description||'')}</textarea></label>
        <div class="form-grid">
          <label>Loại giảm giá *<select name="discountType" required>
            <option value="0" ${v.discountType==0?'selected':''}>Phần trăm (%)</option>
            <option value="1" ${v.discountType==1?'selected':''}>Số tiền cố định (đ)</option>
          </select></label>
          <label>Giá trị giảm *<input name="discountValue" type="number" min="0" required placeholder="10" value="${esc(v.discountValue??'')}"></label>
        </div>
        <div class="form-grid">
          <label>Giảm tối đa (đ)<input name="maxDiscountAmount" type="number" min="0" step="1000" placeholder="Không giới hạn" value="${esc(v.maxDiscountAmount??'')}"></label>
          <label>Đơn tối thiểu (đ)<input name="minOrderAmount" type="number" min="0" step="1000" placeholder="0" value="${esc(v.minOrderAmount??'')}"></label>
        </div>
        <div class="form-grid">
          <label>Ngày bắt đầu<input name="startDate" type="date" value="${v.startDate ? v.startDate.slice(0,10) : ''}"></label>
          <label>Hạn sử dụng *<input name="expiryDate" type="date" required value="${v.expiryDate ? v.expiryDate.slice(0,10) : ''}"></label>
        </div>
        <div class="form-grid">
          <label>Số lượng phát hành<input name="totalQuantity" type="number" min="1" placeholder="Không giới hạn" value="${esc(v.totalQuantity??'')}"></label>
          <label>Giới hạn dùng/người<input name="usageLimitPerUser" type="number" min="1" placeholder="1" value="${esc(v.usageLimitPerUser??'')}"></label>
        </div>
        ${activeField(v.isActive)}`;

    default:
      return '<p style="color:var(--muted)">Không có form cho module này.</p>';
  }
}

// ── MODAL EVENTS ──────────────────────────────────────────────
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalBackdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('modalBackdrop')) closeModal();
});

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('show');
}

document.getElementById('modalFormFields').addEventListener('click', e => {
  const action = e.target.closest('[data-variant-editor-action]');
  if (!action) return;

  const editor = document.getElementById('productVariantsEditor');
  if (!editor) return;

  if (action.dataset.variantEditorAction === 'add') {
    editor.insertAdjacentHTML('beforeend', productVariantEditorRow());
  } else if (action.dataset.variantEditorAction === 'remove') {
    const rows = editor.querySelectorAll('.product-variant-row');
    if (rows.length > 1) action.closest('.product-variant-row').remove();
  } else if (action.dataset.variantEditorAction === 'add-attribute') {
    action.closest('.product-variant-row').querySelector('.variant-attributes').insertAdjacentHTML('beforeend', productVariantAttributeRow());
  } else if (action.dataset.variantEditorAction === 'remove-attribute') {
    action.closest('.variant-attribute-row').remove();
  }
});

document.getElementById('entityForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const entity = form.dataset.entity;
  const isEdit = form.dataset.mode === 'edit';
  const id = form.dataset.id;
  const fd = new FormData(form);
  const g = name => fd.get(name);
  const m = MODULES[entity];

  let payload = {};
  let productVariants = [];

  try {
    switch (entity) {
      case 'products':
        productVariants = !isEdit ? readProductVariants(form) : [];
        payload = {
          name: g('name'), categoryId: Number(g('categoryId')), brandId: Number(g('brandId')),
          supplierId: g('supplierId') ? Number(g('supplierId')) : null,
          basePrice: Number(g('basePrice')), description: g('description'),
          status: Number(g('status')), imageUrl: g('imageUrl') || null,
          gender: Number(g('gender')),
          ageFrom: g('ageFrom') ? Number(g('ageFrom')) : null,
          ageTo: g('ageTo') ? Number(g('ageTo')) : null, isNew: !isEdit,
          variants: productVariants.map(({ initialQuantity, initialReservedQuantity, ...variant }) => variant)
        };
        break;
      case 'categories':
        payload = { name: g('name'), description: g('description') || null, isActive: g('isActive') === 'true' };
        break;
      case 'brands':
        payload = { name: g('name'), description: g('description') || null, origin: g('origin') || null, website: g('website') || null, isActive: g('isActive') === 'true' };
        break;
      case 'inventory':
        payload = { variantId: Number(g('variantId')), quantity: Number(g('quantity')), reservedQuantity: Number(g('reservedQuantity')) };
        break;
      case 'variants':
        payload = { sku: g('sku'), price: Number(g('price')), costPrice: Number(g('costPrice')), weight: g('weight') ? Number(g('weight')) : null, imageUrl: g('variantImageUrl') || '', status: Number(g('variantStatus')), attributes: [...form.querySelectorAll('.variant-attribute-row')].map((row, index) => ({ attributeName: row.querySelector('[name="variantAttributeName"]').value.trim(), attributeValue: row.querySelector('[name="variantAttributeValue"]').value.trim(), displayOrder: index })).filter(attribute => attribute.attributeName && attribute.attributeValue) };
        if (g('color')) payload.attributes.push({ attributeName: 'Màu sắc', attributeValue: g('color'), displayOrder: payload.attributes.length });
        if (g('size')) payload.attributes.push({ attributeName: 'Kích thước', attributeValue: g('size'), displayOrder: payload.attributes.length });
        break;
      case 'suppliers':
        payload = { name: g('name'), phone: g('phone'), email: g('email'), address: g('address'), taxCode: g('taxCode'), contactPerson: g('contactPerson') || null, isActive: g('isActive') === 'true' };
        break;
      case 'orders':
        payload = { status: Number(g('status')), note: g('note') || null };
        break;
      case 'imports':
        payload = { supplierId: Number(g('supplierId')), importDate: g('importDate'), totalAmount: g('totalAmount') ? Number(g('totalAmount')) : null, note: g('note') || null };
        break;
      case 'promotions':
        payload = { name: g('name'), description: g('description') || null, discountType: Number(g('discountType')), discountValue: Number(g('discountValue')), startDate: g('startDate'), endDate: g('endDate'), maxDiscountAmount: g('maxDiscountAmount') ? Number(g('maxDiscountAmount')) : null, minOrderAmount: g('minOrderAmount') ? Number(g('minOrderAmount')) : 0, isActive: g('isActive') === 'true' };
        break;
      case 'vouchers':
        payload = { code: g('code').toUpperCase(), name: g('name'), description: g('description') || null, discountType: Number(g('discountType')), discountValue: Number(g('discountValue')), maxDiscountAmount: g('maxDiscountAmount') ? Number(g('maxDiscountAmount')) : null, minOrderAmount: g('minOrderAmount') ? Number(g('minOrderAmount')) : 0, startDate: g('startDate') || null, expiryDate: g('expiryDate'), totalQuantity: g('totalQuantity') ? Number(g('totalQuantity')) : null, usageLimitPerUser: g('usageLimitPerUser') ? Number(g('usageLimitPerUser')) : 1, isActive: g('isActive') === 'true' };
        break;
    }

    const method = isEdit ? 'PUT' : 'POST';
    const url = entity === 'variants'
      ? (isEdit ? `Product/variants/${id}` : `Product/${form.dataset.productId}/variants`)
      : (isEdit ? `${m.endpoint}/${id}` : m.endpoint);
    const savedProduct = await api(url, { method, body: JSON.stringify(payload) });
    if (entity === 'products' && !isEdit && savedProduct?.productId) {
      const createdProduct = await api(`Product/${savedProduct.productId}`);
      const createdVariants = createdProduct?.productVariants || [];
      for (const variantInput of productVariants) {
        const variant = createdVariants.find(item => item.sku === variantInput.sku);
        if (variant?.variantId) {
          await api('Inventory', {
            method: 'POST',
            body: JSON.stringify({
              variantId: variant.variantId,
              quantity: variantInput.initialQuantity,
              reservedQuantity: variantInput.initialReservedQuantity
            })
          });
        }
      }
    }
    closeModal();
    toast(isEdit ? 'Cập nhật thành công!' : 'Thêm mới thành công!', 'success');
    if (entity === 'variants') {
      await openVariantManager({ productId: form.dataset.productId, name: document.getElementById('modalTitle').textContent.replace('Biến thể: ', '') });
      return;
    }
    await loadRef();
    renderModule(entity);
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ── INIT ──────────────────────────────────────────────────────
if (token) {
  showAdmin();
} else {
  document.getElementById('loginScreen').classList.add('show');
}

if (false) {
const escapeHtml = v => String(v || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const statusClass = v => /hết|hủy|tạm ngưng|cảnh báo/i.test(v) ? 'danger' : /chờ|sắp/i.test(v) ? 'warning' : /đang|hoàn tất|ổn định|hoạt động|hợp tác/i.test(v) ? 'success' : 'neutral';
const statusLabel = v => (v === true || v === 1 || String(v) === '1' || String(v) === 'true') ? 'Đang hoạt động' : 'Tạm ngưng';
const money = v => v == null ? '0 đ' : `${Number(v).toLocaleString('vi-VN')} đ`;

function showAdmin() {
    document.getElementById('loginScreen').classList.remove('show');
    document.querySelector('.app-shell').style.display = '';
    const name = currentUser?.fullName || currentUser?.email || 'Admin';
    document.getElementById('currentUserName').textContent = name;
    document.getElementById('userAvatar').textContent = name.split(' ').map(p => p[0]).join('').slice(-2).toUpperCase();
    checkApiStatus();
    startRealtimeUpdates();
}

async function checkApiStatus() {
    const badge = document.getElementById('apiStatusBadge');
    if (!badge) return;
    try {
        const res = await fetch('/api/Health', { cache: 'no-store' });
        badge.className = res.ok ? 'api-badge online' : 'api-badge offline';
    } catch (e) { badge.className = 'api-badge offline'; }
}

async function apiFetch(path, opt = {}) {
    if (!token) return;
    const res = await fetch(`/api/${path}`, {
        ...opt,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opt.headers || {}) }
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) {
        let msg = `Lỗi ${res.status}`;
        try { const body = await res.json(); msg = body.message || (body.errors ? Object.values(body.errors).flat().join(', ') : msg); } catch {}
        throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
}

function logout() { localStorage.clear(); location.reload(); }

async function loadModuleData(key) {
    if (!modules[key] || !token) return;
    const epMap = { products:'Product', categories:'Category', brands:'Brand', suppliers:'Supplier', orders:'Order', customers:'Customer' };
    try {
        const data = await apiFetch(epMap[key]);
        modules[key].records = data || [];
        if (key === 'products') modules[key].rows = data.map(i => [i.name, i.categoryName || 'N/A', i.brandName || 'N/A', money(i.basePrice), statusLabel(i.status)]);
        if (key === 'categories') modules[key].rows = data.map(i => [i.name, i.description || 'N/A', `${i.productCount || 0} sp`, statusLabel(i.isActive)]);
        if (key === 'brands') modules[key].rows = data.map(i => [i.name, i.description || '', statusLabel(i.isActive)]);
        if (key === 'suppliers') modules[key].rows = data.map(i => [i.name, i.phone, i.email, i.taxCode, statusLabel(i.isActive)]);
        if (key === 'orders') modules[key].rows = data.map(i => [`#${i.id}`, i.customerName || 'Khách', new Date(i.orderDate).toLocaleDateString('vi-VN'), money(i.totalAmount), ['Chờ', 'Xác nhận', 'Xử lý', 'Giao', 'Xong', 'Hủy'][i.status]]);
        if (location.hash.slice(1) === key) renderModule(key);
    } catch (e) { console.error(e); }
}

function renderDashboard() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  app.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">${dateStr.toUpperCase()}</p><h1>Chào buổi sáng! <span>✦</span></h1><p>Dữ liệu cửa hàng hôm nay.</p></div></div>
    <div class="stats-grid">
      <article class="stat-card"><div class="stat-top">Doanh thu <span class="stat-icon green">↗</span></div><div class="stat-value" id="totalRevenue">0 đ</div></article>
      <article class="stat-card"><div class="stat-top">Đơn hàng <span class="stat-icon peach">↗</span></div><div class="stat-value" id="totalOrders">0</div></article>
      <article class="stat-card"><div class="stat-top">Sản phẩm <span class="stat-icon blue">▦</span></div><div class="stat-value" id="totalProducts">0</div></article>
      <article class="stat-card"><div class="stat-top">Khách hàng <span class="stat-icon yellow">◎</span></div><div class="stat-value" id="totalCustomers">0</div></article>
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-header"><div><h2>Thống kê doanh thu</h2></div>
          <select class="select-control" id="chartPeriod"><option value="day">7 ngày qua</option><option value="month" selected>Theo tháng</option><option value="year">Theo năm</option></select>
      </div><div style="height:280px; padding:15px"><canvas id="revenueChartCanvas"></canvas></div></section>
      <section class="panel"><div class="panel-header"><h2>Top bán chạy</h2></div><div id="bestSellingList" style="padding:15px">Đang tải...</div></section>
    </div>
    <section class="panel table-panel" style="margin-top:20px">
      <div class="panel-header"><h2>Đơn hàng gần đây</h2><button class="ghost-btn" data-view="orders">Quản lý đơn hàng</button></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày</th><th>Giá trị</th><th>Trạng thái</th></tr></thead><tbody id="recentOrdersBody"><tr><td colspan="5" style="text-align:center; padding:20px">Đang cập nhật...</td></tr></tbody></table></div>
    </section>
  `;
  initChart(); updateDashboardData();
}

function initChart() {
    const ctx = document.getElementById('revenueChartCanvas')?.getContext('2d');
    if (!ctx) return;
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Doanh thu', data: [], borderColor: '#173f35', backgroundColor: 'rgba(23, 63, 53, 0.1)', fill: true, tension: 0.4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, min: 0, ticks: { callback: (v) => v.toLocaleString('vi-VN') + ' đ' } } }
        }
    });
    document.getElementById('chartPeriod').addEventListener('change', (e) => updateChartData(e.target.value));
    updateChartData('month');
}

async function updateChartData(period) {
    try {
        const data = await apiFetch(`Dashboard/revenue-chart?period=${period}`);
        if (data && revenueChart) { revenueChart.data.labels = data.labels; revenueChart.data.datasets[0].data = data.data; revenueChart.update(); }
    } catch (e) {}
}

async function updateDashboardData() {
    const view = location.hash.slice(1) || 'dashboard';
    if (view !== 'dashboard') return;
    try {
        const [sum, best, orders] = await Promise.all([apiFetch('Dashboard/summary'), apiFetch('Dashboard/best-selling?top=5'), apiFetch('Order')]);
        if (sum) {
            document.getElementById('totalRevenue').textContent = money(sum.totalRevenue);
            document.getElementById('totalOrders').textContent = sum.totalOrders;
            document.getElementById('totalProducts').textContent = sum.totalProducts;
            document.getElementById('totalCustomers').textContent = sum.totalCustomers;
        }
        if (best) {
            document.getElementById('bestSellingList').innerHTML = best.map(p => `<div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid #eee;"><span>${escapeHtml(p.productName)}</span><b>${p.totalQuantitySold} sp</b></div>`).join('') || 'Chưa có giao dịch';
        }
        if (orders) {
            const recent = orders.slice(0, 5);
            document.getElementById('recentOrdersBody').innerHTML = recent.map(o => `<tr><td>#${o.id}</td><td>${escapeHtml(o.customerName || 'Khách')}</td><td>${new Date(o.orderDate).toLocaleDateString()}</td><td>${money(o.totalAmount)}</td><td><span class="pill ${statusClass(['Chờ','Xong','Xử lý','Giao','Xong','Hủy'][o.status])}">${['Chờ xác nhận', 'Đã xác nhận', 'Đang xử lý', 'Đang giao', 'Hoàn tất', 'Đã hủy'][o.status]}</span></td></tr>`).join('');
        }
    } catch (e) {}
}

function startRealtimeUpdates() {
    clearInterval(dashboardPollInterval);
    dashboardPollInterval = setInterval(() => {
        checkApiStatus();
        const v = location.hash.slice(1) || 'dashboard';
        if (v === 'dashboard') {
            updateDashboardData();
            updateChartData(document.getElementById('chartPeriod')?.value || 'month');
        } else { loadModuleData(v); }
    }, 20000);
}

function renderModule(key) {
    const m = modules[key];
    const btn = ['products', 'categories', 'brands', 'suppliers'].includes(key) ? `<button class="primary-btn" data-action="add" data-entity="${key}">Thêm mới <span>+</span></button>` : '';
    app.innerHTML = `<div class="page-head"><div><h1>${m.title}</h1><p>${m.desc}</p></div>${btn}</div>
    <div class="panel"><div class="table-wrap">
    <table class="data-table"><thead><tr>${m.columns.map(c=>`<th>${c}</th>`).join('')}<th></th></tr></thead>
    <tbody id="moduleTableBody">${m.rows.map((r, idx)=>`<tr>${r.map((cell, cidx)=>`<td>${cidx===r.length-1?`<span class="pill ${statusClass(cell)}">${cell}</span>`:escapeHtml(cell)}</td>`).join('')}
    <td><button class="icon-btn row-action" data-action="edit" data-entity="${key}" data-index="${idx}">✎</button></td></tr>`).join('')}</tbody>
    </table></div></div>`;
}

function navigate(v = location.hash.slice(1) || 'dashboard') {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === v));
    document.getElementById('breadcrumbCurrent').textContent = v === 'dashboard' ? 'Dashboard' : (modules[v]?.title || v);
    if(v === 'dashboard') renderDashboard();
    else if(modules[v]) { loadModuleData(v); renderModule(v); }
}

function showToast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); }

async function loadReferenceData() {
    try {
        const [c, b, s] = await Promise.all([apiFetch('Category'), apiFetch('Brand'), apiFetch('Supplier')]);
        apiState.categories = c || []; apiState.brands = b || []; apiState.suppliers = s || [];
    } catch(e) {}
}

function openModal(entity, record = null) {
    const isProduct = entity === 'products';
    const form = document.getElementById('entityForm');
    form.dataset.entity = entity;
    form.dataset.mode = record ? 'edit' : 'create';
    form.dataset.id = record ? (record.id || record.productId || record.supplierId) : '';
    document.getElementById('productFields').style.display = isProduct ? 'block' : 'none';
    document.getElementById('productFields').querySelectorAll('input, select, textarea').forEach(f => f.disabled = !isProduct);
    if (isProduct) {
        form.querySelector('[name="categoryId"]').innerHTML = apiState.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        form.querySelector('[name="brandId"]').innerHTML = apiState.brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        form.querySelector('[name="supplierId"]').innerHTML = `<option value="">Không chọn</option>` + apiState.suppliers.map(s => `<option value="${s.supplierId}">${s.name}</option>`).join('');
    }
    const genericFields = document.getElementById('genericFields');
    if (!isProduct) {
        genericFields.innerHTML = entity === 'suppliers' ?
            `<label>Tên nhà cung cấp *<input name="name" required></label><div class="form-grid"><label>SĐT *<input name="phone" required></label><label>Email *<input name="email" type="email" required></label></div><label>Địa chỉ *<input name="address" required></label><label>Mã số thuế *<input name="taxCode" required></label>` :
            `<label>Tên hiển thị *<input name="name" required></label><label>Mô tả *<textarea name="description" required rows="3"></textarea></label>`;
        genericFields.innerHTML += `<label>Trạng thái<select name="isActive"><option value="true">Đang hoạt động</option><option value="false">Tạm ngưng</option></select></label>`;
    } else { genericFields.innerHTML = ''; }
    if (record) {
        form.elements.name.value = record.name || '';
        if (form.elements.description) form.elements.description.value = record.description || '';
        if (isProduct) {
            form.elements.categoryId.value = record.categoryId; form.elements.brandId.value = record.brandId;
            form.elements.basePrice.value = record.basePrice; form.elements.status.value = record.status;
            form.elements.imageUrl.value = record.imageUrl || '';
        }
    }
    document.getElementById('modalBackdrop').classList.add('show');
}

document.addEventListener('click', e => {
  const variantAction = e.target.closest('[data-variant-action]');
  if (variantAction) {
    const form = document.getElementById('entityForm');
    if (variantAction.dataset.variantAction === 'edit') {
      fillVariantForm(form._variantRecords[Number(variantAction.dataset.variantIndex)]);
    } else {
      confirm('Xác nhận xóa', 'Bạn có chắc muốn xóa biến thể này không?', async () => {
        try {
          await api(`Product/variants/${variantAction.dataset.variantId}`, { method: 'DELETE' });
          toast('Xóa biến thể thành công!', 'success');
          await openVariantManager({ productId: form.dataset.productId, name: document.getElementById('modalTitle').textContent.replace('Biến thể: ', '') });
        } catch (err) { toast(err.message, 'error'); }
      });
    }
    return;
  }
    const v = e.target.closest('[data-view]'); if(v) { location.hash = v.dataset.view; navigate(v.dataset.view); }
    const a = e.target.closest('[data-action="add"]'); if(a) openModal(a.dataset.entity);
    const ed = e.target.closest('[data-action="edit"]'); if(ed) openModal(ed.dataset.entity, modules[ed.dataset.entity].records[ed.dataset.index]);
    if(e.target.closest('#modalClose')) document.getElementById('modalBackdrop').classList.remove('show');
});

document.getElementById('entityForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget; const entity = f.dataset.entity; const fd = new FormData(f); const isEdit = f.dataset.mode === 'edit';
    const ep = { products:'Product', categories:'Category', brands:'Brand', suppliers:'Supplier' }[entity];
    let payload = { name: fd.get('name'), description: fd.get('description'), isActive: fd.get('isActive') === 'true' };
    if (entity === 'products') {
        payload = {
            name: fd.get('name'), categoryId: Number(fd.get('categoryId')), brandId: Number(fd.get('brandId')),
            supplierId: fd.get('supplierId') ? Number(fd.get('supplierId')) : null,
            basePrice: Number(fd.get('basePrice')), description: fd.get('description'),
            status: Number(fd.get('status')), imageUrl: fd.get('imageUrl'),
            gender: Number(fd.get('gender')), ageFrom: fd.get('ageFrom') ? Number(fd.get('ageFrom')) : null,
            ageTo: fd.get('ageTo') ? Number(fd.get('ageTo')) : null, isNew: true
        };
    } else if (entity === 'suppliers') {
        payload = { name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'), address: fd.get('address'), taxCode: fd.get('taxCode'), isActive: fd.get('isActive') === 'true' };
    }
    try {
        const method = isEdit ? 'PUT' : 'POST'; const url = isEdit ? `${ep}/${f.dataset.id}` : ep;
        await apiFetch(url, { method, body: JSON.stringify(payload) });
        document.getElementById('modalBackdrop').classList.remove('show');
        showToast("Lưu thành công!");
        await loadReferenceData(); loadModuleData(entity);
        if (entity === 'products') loadModuleData('categories');
    } catch (err) { showToast(err.message); }
});

document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const res = await fetch('/api/Auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:e.target.email.value, password:e.target.password.value}) });
    const data = await res.json();
    if(res.ok) { token = data.token; currentUser = data; localStorage.setItem('toyStoreToken', token); localStorage.setItem('toyStoreUser', JSON.stringify(data)); location.reload(); }
    else alert(data.message);
});

if (token) { showAdmin(); navigate(); loadReferenceData(); } else { document.getElementById('loginScreen').classList.add('show'); }
}

document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-add-reference]');
    if (!btn) return;

    const type = btn.dataset.addReference;

    const name = prompt(
        type === 'category'
            ? 'Nhập tên danh mục mới:'
            : 'Nhập tên thương hiệu mới:'
    );

    if (!name || !name.trim()) {
        return;
    }

    try {
        let result;

        if (type === 'category') {
            result = await api('Category', {
                method: 'POST',
                body: JSON.stringify({
                    name: name.trim(),
                    description: ""
                })
            });
        } else {
            result = await api('Brand', {
                method: 'POST',
                body: JSON.stringify({
                    name: name.trim(),
                    description: ""
                })
            });
        }

        await loadRef();

        const selectName =
            type === 'category'
                ? 'categoryId'
                : 'brandId';

        const select =
            document.querySelector(
                `#entityForm select[name="${selectName}"]`
            );

        if (select && result?.id) {
            select.innerHTML =
                type === 'category'
                    ? ref.categories.map(c =>
                        `<option value="${c.id}">
                            ${esc(c.name)}
                        </option>`
                    ).join('')
                    : ref.brands.map(b =>
                        `<option value="${b.id}">
                            ${esc(b.name)}
                        </option>`
                    ).join('');

            select.value = result.id;
        }

        toast(
            type === 'category'
                ? 'Thêm danh mục thành công!'
                : 'Thêm thương hiệu thành công!',
            'success'
        );
    }
    catch (err) {
        toast(err.message, 'error');
    }
});

/* ============================================================
   USER ROLE MANAGEMENT & ADMIN CHANGE PASSWORD
   ============================================================ */

window.openRoleModal = function(userId, currentRole) {
  const roles = ['Admin', 'Manager', 'Staff', 'Customer'];
  const roleLabels = { Admin: 'Admin (Quản trị hệ thống)', Manager: 'Manager (Quản lý cửa hàng)', Staff: 'Staff (Nhân viên cửa hàng)', Customer: 'Customer (Khách hàng)' };
  
  const optionsHtml = roles.map(r => `<option value="${r}" ${r === currentRole ? 'selected' : ''}>${roleLabels[r]}</option>`).join('');

  document.getElementById('modalTitle').textContent = 'Đổi vai trò người dùng';
  document.getElementById('modalKicker').textContent = 'PHÂN QUYỀN';
  document.getElementById('modalSubtitle').textContent = 'Chọn vai trò mới cho tài khoản này.';
  document.getElementById('modalFormFields').innerHTML = `
    <div class="form-group full">
      <label>Vai trò mới *</label>
      <select class="input-control" id="newRoleSelect">${optionsHtml}</select>
    </div>
  `;

  document.getElementById('modalBackdrop').classList.add('show');

  const form = document.getElementById('entityForm');
  const onSubmit = async (e) => {
    e.preventDefault();
    const newRole = document.getElementById('newRoleSelect').value;
    try {
      await api('Auth/assign-role', {
        method: 'POST',
        body: JSON.stringify({ userId: userId, role: newRole })
      });
      document.getElementById('modalBackdrop').classList.remove('show');
      toast('Cập nhật vai trò người dùng thành công!', 'success');
      renderModule('users');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      form.removeEventListener('submit', onSubmit);
    }
  };
  form.addEventListener('submit', onSubmit, { once: true });
};

window.toggleUserStatus = function(userId) {
  confirm('Xác nhận cập nhật', 'Bạn có chắc muốn thay đổi trạng thái kích hoạt của tài khoản này?', async () => {
    try {
      await api(`Auth/users/${userId}/toggle-status`, { method: 'POST' });
      toast('Cập nhật trạng thái tài khoản thành công!', 'success');
      renderModule('users');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
};

document.getElementById('adminChangePassBtn')?.addEventListener('click', () => {
  document.getElementById('modalTitle').textContent = 'Đổi mật khẩu tài khoản';
  document.getElementById('modalKicker').textContent = 'TÀI KHOẢN';
  document.getElementById('modalSubtitle').textContent = 'Nhập mật khẩu hiện tại và mật khẩu mới.';
  document.getElementById('modalFormFields').innerHTML = `
    <div class="form-group full">
      <label>Mật khẩu hiện tại *</label>
      <input class="input-control" type="password" id="adminCurPass" required>
    </div>
    <div class="form-group full">
      <label>Mật khẩu mới *</label>
      <input class="input-control" type="password" id="adminNewPass" required minlength="6">
    </div>
    <div class="form-group full">
      <label>Xác nhận mật khẩu mới *</label>
      <input class="input-control" type="password" id="adminConfPass" required>
    </div>
  `;

  document.getElementById('modalBackdrop').classList.add('show');

  const form = document.getElementById('entityForm');
  const onSubmit = async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('adminCurPass').value;
    const newPassword = document.getElementById('adminNewPass').value;
    const confirmPassword = document.getElementById('adminConfPass').value;

    if (newPassword !== confirmPassword) {
      toast('Mật khẩu xác nhận không khớp.', 'error');
      return;
    }

    try {
      await api('Auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      document.getElementById('modalBackdrop').classList.remove('show');
      toast('🔒 Đổi mật khẩu thành công!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      form.removeEventListener('submit', onSubmit);
    }
  };
  form.addEventListener('submit', onSubmit, { once: true });
});
