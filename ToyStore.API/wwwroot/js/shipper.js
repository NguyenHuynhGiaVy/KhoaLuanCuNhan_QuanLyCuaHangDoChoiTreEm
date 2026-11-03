// ============================================================
// TOYSTORE EXPRESS - SHIPPER PORTAL CLIENT JAVASCRIPT
// Giao diện chuẩn Enterprise (Shopee Express / Grab / Ahamove)
// Siết chặt RBAC, Bộ lọc đơn theo ngày & Loại bỏ icon thừa
// ============================================================

const authUser = JSON.parse(localStorage.getItem('toyStoreUser') || 'null');
const authToken = localStorage.getItem('toyStoreToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
const userRole = String(authUser?.role || '').trim().toLowerCase();

// Không đăng nhập hoặc tài khoản không có quyền giao hàng/quản trị thì trở về trang khách hàng
if (!authToken || !['admin', 'manager', 'staff', 'shipper'].includes(userRole)) {
  location.replace('/customer.html');
}

let currentShipper = null;
let currentShipperId = null;
let availableShippers = [];
let activeTab = 'active'; // 'active' | 'history' | 'wallet'
let allOrders = [];
let trackingHubConnection = null;
let shipperNotifications = [];

// Trạng thái bộ lọc
let dateFilter = 'all'; // 'all' | 'today' | 'yesterday' | 'last7days' | 'custom'
let customStartDate = null;
let customEndDate = null;
let searchQuery = '';

const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = v => v == null ? '0 đ' : Number(v).toLocaleString('vi-VN') + ' đ';

const parseUtcDate = value => {
  if (!value) return null;
  const text = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(text)
    ? text
    : (/^\d{4}-\d{2}-\d{2}T/.test(text) ? `${text}Z` : text);
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const fmtDateTime = s => {
  const date = parseUtcDate(s);
  return date ? date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
};

const fmtDateOnly = s => {
  const date = parseUtcDate(s);
  return date ? date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
};

const formatDeliveryWindow = shipping => {
  if (!shipping) return '—';
  if (shipping.estimatedDeliveryFromDate && shipping.estimatedDeliveryToDate) {
    const f = parseUtcDate(shipping.estimatedDeliveryFromDate);
    const t = parseUtcDate(shipping.estimatedDeliveryToDate);
    if (f && t) {
      const fs = f.toLocaleDateString('vi-VN');
      const ts = t.toLocaleDateString('vi-VN');
      return fs === ts ? fs : `${fs} - ${ts}`;
    }
  }
  if (shipping.estimatedDeliveryAt) {
    const d = parseUtcDate(shipping.estimatedDeliveryAt);
    return d ? d.toLocaleDateString('vi-VN') : '—';
  }
  return '1 - 3 ngày làm việc';
};

const checkIsOverdue = (order, shipping) => {
  const st = Number(shipping?.status || 0);
  const ordSt = Number(order?.status || 0);
  if (ordSt === 4 || ordSt === 5 || st === 4 || st === 5 || st === 6) return false;
  const deadline = parseUtcDate(shipping?.estimatedDeliveryToDate || shipping?.estimatedDeliveryAt);
  if (!deadline) return false;
  return new Date() > deadline;
};

const shipperNotificationStorageKey = () => `toyStoreShipperNotifications:${currentShipperId || 'me'}`;
const canSelectShipper = ['admin', 'manager', 'staff'].includes(userRole);
const selectedShipperQuery = () => currentShipperId ? `?shipperId=${encodeURIComponent(currentShipperId)}` : '';

// Toast Notification chuẩn UI
function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = 'toast-msg';
  
  let iconSvg = '';
  if (type === 'error') {
    t.style.borderLeft = '4px solid #ef4444';
    iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  } else if (type === 'success') {
    t.style.borderLeft = '4px solid #10b981';
    iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
  } else {
    t.style.borderLeft = '4px solid #6366f1';
    iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  t.innerHTML = `<span>${iconSvg}</span> <span>${esc(msg)}</span>`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ── BỘ LỌC ĐƠN HÀNG THEO NGÀY & TÌM KIẾM ────────────────────────
function getOrderRelevantDate(order, tab) {
  if (tab === 'history') {
    return parseUtcDate(order.shipping?.deliveredAt || order.shipping?.failedAt || order.completedAt || order.orderDate || order.createdAt);
  }
  return parseUtcDate(order.shipping?.deliveryStartedAt || order.shipping?.shippedAt || order.orderDate || order.createdAt);
}

function filterOrders(orders, tab) {
  let list = orders;

  // 1. Lọc theo từ khóa tìm kiếm (Mã đơn, Tên khách, SĐT, Địa chỉ, Mã lô)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(order => {
      const code = String(order.orderCode || order.orderId || '').toLowerCase();
      const name = String(order.shipping?.receiverName || order.customerName || '').toLowerCase();
      const phone = String(order.shipping?.receiverPhone || order.phoneNumber || '').toLowerCase();
      const addr = String(order.shipping?.address || '').toLowerCase();
      const batch = String(order.shipping?.deliveryBatchCode || '').toLowerCase();
      return code.includes(q) || name.includes(q) || phone.includes(q) || addr.includes(q) || batch.includes(q);
    });
  }

  // 2. Lọc theo mốc ngày
  if (dateFilter === 'all') return list;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const sevenDaysAgo = new Date(today.getTime() - 6 * 86400000);

  return list.filter(order => {
    const d = getOrderRelevantDate(order, tab);
    if (!d) return false;
    const orderDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (dateFilter === 'today') {
      return orderDay.getTime() === today.getTime();
    }
    if (dateFilter === 'yesterday') {
      return orderDay.getTime() === yesterday.getTime();
    }
    if (dateFilter === 'last7days') {
      return orderDay.getTime() >= sevenDaysAgo.getTime() && orderDay.getTime() <= (today.getTime() + 86400000 - 1);
    }
    if (dateFilter === 'custom') {
      if (customStartDate) {
        const [sy, sm, sd] = customStartDate.split('-').map(Number);
        const startDay = new Date(sy, sm - 1, sd);
        if (orderDay.getTime() < startDay.getTime()) return false;
      }
      if (customEndDate) {
        const [ey, em, ed] = customEndDate.split('-').map(Number);
        const endDay = new Date(ey, em - 1, ed);
        if (orderDay.getTime() > endDay.getTime()) return false;
      }
      return true;
    }
    return true;
  });
}

function setDateFilter(filterType) {
  dateFilter = filterType;
  document.querySelectorAll('.date-pill-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`filterBtn_${filterType}`);
  if (btn) btn.classList.add('active');

  const customRow = document.getElementById('customDateRow');
  if (filterType !== 'custom' && customRow) {
    customRow.classList.remove('show');
  }

  updateFilterStatusBar();
  renderCurrentTab();
  updateMetricsDisplay();
}

function toggleCustomDateRow(show) {
  const customRow = document.getElementById('customDateRow');
  if (!customRow) return;
  const isVisible = customRow.classList.contains('show');
  const shouldShow = show !== undefined ? show : !isVisible;
  
  if (shouldShow) {
    customRow.classList.add('show');
    document.querySelectorAll('.date-pill-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('filterBtn_custom')?.classList.add('active');
  } else {
    customRow.classList.remove('show');
  }
}

function applyCustomDateFilter() {
  const start = document.getElementById('filterStartDate')?.value;
  const end = document.getElementById('filterEndDate')?.value;
  if (!start && !end) {
    toast('Vui lòng chọn ít nhất một mốc ngày bắt đầu hoặc kết thúc', 'info');
    return;
  }
  customStartDate = start || null;
  customEndDate = end || null;
  dateFilter = 'custom';
  
  document.querySelectorAll('.date-pill-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('filterBtn_custom')?.classList.add('active');

  updateFilterStatusBar();
  renderCurrentTab();
  updateMetricsDisplay();
}

function resetFilters() {
  dateFilter = 'all';
  customStartDate = null;
  customEndDate = null;
  searchQuery = '';

  const searchInput = document.getElementById('orderSearchInput');
  if (searchInput) searchInput.value = '';
  document.getElementById('clearSearchBtn')?.classList.remove('show');

  const startInput = document.getElementById('filterStartDate');
  if (startInput) startInput.value = '';
  const endInput = document.getElementById('filterEndDate');
  if (endInput) endInput.value = '';

  document.getElementById('customDateRow')?.classList.remove('show');
  document.querySelectorAll('.date-pill-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('filterBtn_all')?.classList.add('active');

  updateFilterStatusBar();
  renderCurrentTab();
  updateMetricsDisplay();
}

function updateFilterStatusBar() {
  const bar = document.getElementById('filterStatusBar');
  const textEl = document.getElementById('filterStatusText');
  if (!bar || !textEl) return;

  const isFiltered = dateFilter !== 'all' || searchQuery.trim().length > 0;
  if (!isFiltered) {
    bar.classList.remove('show');
    return;
  }

  let textParts = [];
  if (dateFilter === 'today') textParts.push('Hôm nay');
  else if (dateFilter === 'yesterday') textParts.push('Hôm qua');
  else if (dateFilter === 'last7days') textParts.push('7 ngày qua');
  else if (dateFilter === 'custom') {
    const s = customStartDate ? fmtDateOnly(customStartDate) : '...';
    const e = customEndDate ? fmtDateOnly(customEndDate) : '...';
    textParts.push(`Từ ${s} đến ${e}`);
  }

  if (searchQuery.trim()) {
    textParts.push(`Tìm kiếm: "${esc(searchQuery.trim())}"`);
  }

  textEl.textContent = `Đang lọc: ${textParts.join(' · ')}`;
  bar.classList.add('show');
}

// ── CẬP NHẬT THỐNG KÊ CA (SHIFT METRICS KPI) ─────────────────────
function updateMetricsDisplay() {
  const activeOrders = allOrders.filter(o => {
    const st = Number(o.shipping?.status ?? 0);
    return st === 0 || st === 1 || st === 2 || st === 3;
  });

  const deliveredOrders = allOrders.filter(o => {
    const st = Number(o.shipping?.status ?? 0);
    const ordSt = Number(o.status ?? 0);
    return ordSt === 4 || st === 4;
  });

  // Tiền COD đang giữ chưa nộp
  const holdingCod = deliveredOrders
    .filter(o => o.payment?.paymentMethod === 0 && Number(o.payment?.codStatus || 0) === 1)
    .reduce((sum, o) => sum + Math.max(0, (Number(o.payment?.amount || o.finalAmount || o.totalAmount || 0) - Number(o.shipping?.shippingFee || 0))), 0);

  // Phí ship đã hoàn thành thuộc về shipper
  const earnedFee = deliveredOrders
    .reduce((sum, o) => sum + Number(o.shipping?.shippingFee || 0), 0);

  const activeCountEl = document.getElementById('metricActiveCount');
  const deliveredCountEl = document.getElementById('metricDeliveredCount');
  const codHoldingEl = document.getElementById('metricCodHolding');
  const earnedFeeEl = document.getElementById('metricEarnedFee');

  if (activeCountEl) activeCountEl.textContent = activeOrders.length;
  if (deliveredCountEl) deliveredCountEl.textContent = deliveredOrders.length;
  if (codHoldingEl) codHoldingEl.textContent = money(holdingCod);
  if (earnedFeeEl) earnedFeeEl.textContent = money(earnedFee);
}

// ── THÔNG BÁO SIGNALR & LOCAL STORAGE ─────────────────────────
function formatNotificationTime(value) {
  const time = parseUtcDate(value);
  return !time
    ? 'Vừa xong'
    : time.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
}

function saveShipperNotifications() {
  localStorage.setItem(shipperNotificationStorageKey(), JSON.stringify(shipperNotifications));
}

function renderShipperNotifications() {
  const list = document.getElementById('shipperNotificationList');
  const count = document.getElementById('shipperNotificationCount');
  if (count) {
    count.textContent = shipperNotifications.length > 99 ? '99+' : shipperNotifications.length;
    count.classList.toggle('show', shipperNotifications.length > 0);
  }
  if (!list) return;

  if (!shipperNotifications.length) {
    list.innerHTML = '<div class="notification-empty">Chưa có thông báo đơn hàng nào.</div>';
    return;
  }

  list.innerHTML = shipperNotifications.map(item => `
    <article class="notification-item ${item.type === 'assignment' ? 'notification-item--assignment' : ''}">
      <span class="notification-icon-box">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
      </span>
      <div>
        <strong>${esc(item.title)}</strong>
        <p>${esc(item.message)}</p>
        <time>${formatNotificationTime(item.createdAt)}</time>
      </div>
    </article>
  `).join('');
}

function loadShipperNotifications() {
  try {
    const saved = JSON.parse(localStorage.getItem(shipperNotificationStorageKey()) || '[]');
    shipperNotifications = Array.isArray(saved) ? saved : [];
  } catch (_) {
    shipperNotifications = [];
  }
  renderShipperNotifications();
}

function addShipperNotification({ id, title, message, type = 'new', createdAt }) {
  if (id) shipperNotifications = shipperNotifications.filter(item => item.id !== id);
  shipperNotifications.unshift({
    id: id || `notice-${Date.now()}`,
    title,
    message,
    type,
    createdAt: createdAt || new Date().toISOString()
  });
  shipperNotifications = shipperNotifications.slice(0, 20);
  saveShipperNotifications();
  renderShipperNotifications();
  toast(`${title}: ${message}`, type === 'assignment' ? 'success' : 'info');

  if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body: message });
  }
}

function toggleShipperNotificationPanel() {
  const panel = document.getElementById('shipperNotificationPanel');
  const button = document.getElementById('shipperNotificationBtn');
  if (!panel || !button) return;
  const isOpen = !panel.classList.contains('open');
  panel.classList.toggle('open', isOpen);
  button.setAttribute('aria-expanded', String(isOpen));
}

function closeShipperNotificationPanel() {
  const panel = document.getElementById('shipperNotificationPanel');
  const button = document.getElementById('shipperNotificationBtn');
  panel?.classList.remove('open');
  button?.setAttribute('aria-expanded', 'false');
}

function clearShipperNotifications() {
  shipperNotifications = [];
  saveShipperNotifications();
  renderShipperNotifications();
}

// ── API REQUEST WRAPPER ───────────────────────────────────────
async function api(endpoint, options = {}) {
  const token = localStorage.getItem('toyStoreToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/${endpoint}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('toyStoreToken');
    localStorage.removeItem('toyStoreUser');
    localStorage.removeItem('toyStoreShipperId');
    location.replace('/customer.html');
    return null;
  }
  if (!res.ok) {
    let err = 'Yêu cầu không thành công';
    try {
      const data = await res.json();
      err = data.message || data.title || JSON.stringify(data);
    } catch (_) {}
    throw new Error(err);
  }
  return res.status !== 204 ? await res.json() : null;
}

// ── 1. SHIPPER IDENTITY INITIALIZATION (STRICT RBAC) ────────
async function loadShipperProfile() {
  try {
    const profile = await api('Shipper/me');
    if (!profile) {
      toast('Không tìm thấy hồ sơ shipper liên kết với tài khoản này.', 'error');
      return;
    }

    if (canSelectShipper) {
      const shippers = await api('Shipper');
      availableShippers = Array.isArray(shippers) ? shippers : [];
      const selector = document.getElementById('shipperSelector');
      if (selector && availableShippers.length > 0) {
        const savedShipperId = Number(localStorage.getItem('toyStoreShipperId'));
        const selected = availableShippers.find(item => Number(item.shipperId) === savedShipperId)
          || availableShippers.find(item => Number(item.shipperId) === Number(profile.shipperId))
          || availableShippers[0];
        selector.innerHTML = availableShippers.map(shipper =>
          `<option value="${Number(shipper.shipperId)}">${esc(shipper.fullName)} (${esc(shipper.phoneNumber || '—')})</option>`
        ).join('');
        selector.value = String(selected.shipperId);
        selector.style.display = '';
        applySelectedShipper(selected);
      } else {
        applySelectedShipper(profile);
      }
    } else {
      applySelectedShipper(profile);
    }

    initSignalR();
  } catch (err) {
    console.error('Không thể nạp hồ sơ shipper:', err);
    const nameEl = document.getElementById('currentShipperName');
    const subEl = document.getElementById('currentShipperPhone');
    if (nameEl) nameEl.textContent = authUser?.fullName || 'Nhân viên giao hàng';
    if (subEl) subEl.textContent = `Tài khoản: ${authUser?.email || '—'} · Vai trò: ${authUser?.role || 'Shipper'}`;
    toast(`Lỗi xác thực shipper: ${err.message}`, 'error');
  }
}

function applySelectedShipper(shipper) {
  currentShipper = shipper;
  currentShipperId = Number(shipper.shipperId);
  localStorage.setItem('toyStoreShipperId', String(currentShipperId));
  updateProfileDisplay(shipper);
  loadShipperNotifications();
  if (typeof signalR !== 'undefined'
    && trackingHubConnection?.state === signalR.HubConnectionState.Connected) {
    trackingHubConnection.invoke('JoinShipper', currentShipperId).catch(console.warn);
  }
  loadOrders();
}

function changeSelectedShipper(shipperId) {
  const shipper = availableShippers.find(item => Number(item.shipperId) === Number(shipperId));
  if (shipper) applySelectedShipper(shipper);
}

function updateProfileDisplay(shipper) {
  const nameEl = document.getElementById('currentShipperName');
  const subEl = document.getElementById('currentShipperPhone');
  const letterEl = document.getElementById('avatarLetter');
  if (nameEl) nameEl.textContent = shipper.fullName;
  if (subEl) subEl.textContent = `SĐT: ${shipper.phoneNumber || '—'} · Biển số xe: ${shipper.vehicleNumber || '—'} · Tuyến: ${shipper.assignedArea || 'Linh hoạt'}`;
  if (letterEl) {
    const parts = (shipper.fullName || 'NV').trim().split(' ');
    letterEl.textContent = parts[parts.length - 1].slice(0, 2).toUpperCase();
  }
}

// ── 2. ORDER LIST & WORKFLOW RENDERING ──────────────────────
async function loadOrders() {
  const container = document.getElementById('tabContent');
  if (container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-400);">Đang nạp chuyến hàng...</div>';
  }

  try {
    allOrders = await api(`Shipper/my-orders${selectedShipperQuery()}`);
    updateMetricsDisplay();
    renderCurrentTab();
  } catch (err) {
    if (container) {
      container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--danger);font-weight:600;">Lỗi tải đơn hàng: ${esc(err.message)}</div>`;
    }
  }
}

function renderCurrentTab() {
  const activeOrders = allOrders.filter(o => {
    const st = Number(o.shipping?.status ?? 0);
    return st === 0 || st === 1 || st === 2 || st === 3;
  });

  const historyOrders = allOrders.filter(o => {
    const st = Number(o.shipping?.status ?? 0);
    const ordSt = Number(o.status ?? 0);
    return ordSt === 4 || ordSt === 5 || st === 4 || st === 5 || st === 6;
  });

  const badgeActive = document.getElementById('badgeActiveCount');
  const badgeHistory = document.getElementById('badgeHistoryCount');
  if (badgeActive) badgeActive.textContent = activeOrders.length;
  if (badgeHistory) badgeHistory.textContent = historyOrders.length;

  const container = document.getElementById('tabContent');
  if (!container) return;

  if (activeTab === 'active') {
    const filtered = filterOrders(activeOrders, 'active');
    renderActiveOrders(filtered, container);
  } else if (activeTab === 'history') {
    const filtered = filterOrders(historyOrders, 'history');
    renderHistoryOrders(filtered, container);
  } else if (activeTab === 'wallet') {
    renderWallet(container);
  }
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (tab === 'active') document.getElementById('tabBtnActive')?.classList.add('active');
  if (tab === 'history') document.getElementById('tabBtnHistory')?.classList.add('active');
  if (tab === 'wallet') document.getElementById('tabBtnWallet')?.classList.add('active');
  renderCurrentTab();
}

// Quy trình 5 bước chuẩn Enterprise (Loại bỏ icon emoji rườm rà)
function renderWorkflowStepper(shippingStatus, isCod, codStatus) {
  const s = Number(shippingStatus || 0);
  const step1Done = s >= 1;
  const step2Done = s >= 2;
  const step3Done = s >= 3;
  const step4Done = s >= 4;
  const step5Done = isCod ? (codStatus >= 2) : step4Done;

  const checkSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';

  return `
    <div class="stepper-container">
      <div class="stepper-item ${step1Done ? (s === 1 ? 'active' : 'done') : ''}">
        <div class="stepper-circle">${step1Done && s > 1 ? checkSvg : '1'}</div>
        <div class="stepper-label">Nhận đơn</div>
      </div>
      <div class="stepper-item ${step2Done ? (s === 2 ? 'active' : 'done') : ''}">
        <div class="stepper-circle">${step2Done && s > 2 ? checkSvg : '2'}</div>
        <div class="stepper-label">Lấy hàng</div>
      </div>
      <div class="stepper-item ${step3Done ? (s === 3 ? 'active' : 'done') : ''}">
        <div class="stepper-circle">${step3Done && s > 3 ? checkSvg : '3'}</div>
        <div class="stepper-label">Đang giao</div>
      </div>
      <div class="stepper-item ${step4Done ? (s === 4 && !step5Done ? 'active' : 'done') : ''}">
        <div class="stepper-circle">${step4Done ? checkSvg : '4'}</div>
        <div class="stepper-label">${isCod ? 'Thu COD' : 'Đã giao'}</div>
      </div>
      <div class="stepper-item ${step5Done ? 'done' : ''}">
        <div class="stepper-circle">${step5Done ? checkSvg : '5'}</div>
        <div class="stepper-label">Nộp tiền</div>
      </div>
    </div>
  `;
}

// Gom nhóm đơn hàng theo lô vận chuyển (Batching)
function renderOrdersGroupedByBatch(orders, renderOrderCard) {
  const groups = new Map();
  for (const order of orders) {
    const batchCode = order.shipping?.deliveryBatchCode?.trim() || '';
    const key = batchCode || `order-${order.orderId}`;
    if (!groups.has(key)) groups.set(key, { batchCode, orders: [] });
    groups.get(key).orders.push(order);
  }

  return Array.from(groups.values()).map(group => {
    const orderCards = group.orders.map(renderOrderCard).join('');
    if (!group.batchCode) return orderCards;

    const products = new Map();
    for (const order of group.orders) {
      for (const detail of order.orderDetails || []) {
        const name = detail.productName || 'Sản phẩm';
        const variant = detail.variantAttributes || '';
        const key = `${name}|${variant}`;
        const item = products.get(key) || { name, variant, quantity: 0 };
        item.quantity += Number(detail.quantity) || 0;
        products.set(key, item);
      }
    }

    const productSummary = products.size
      ? Array.from(products.values()).map(item =>
        `${esc(item.name)}${item.variant ? ` (${esc(item.variant)})` : ''} × ${item.quantity}`
      ).join(' · ')
      : 'Chưa có thông tin sản phẩm';
    const totalItems = Array.from(products.values()).reduce((sum, item) => sum + item.quantity, 0);

    return `
      <section class="batch-container">
        <div class="batch-header">
          <div class="batch-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <span>Lô vận chuyển: ${esc(group.batchCode)}</span>
          </div>
          <span style="font-size:12px;color:var(--primary);font-weight:700;">${group.orders.length} đơn · ${totalItems} món</span>
        </div>
        <div class="batch-summary">
          <b>Sản phẩm trong lô:</b> ${productSummary}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">${orderCards}</div>
      </section>
    `;
  }).join('');
}

// Danh sách đơn hàng đang giao
function renderActiveOrders(orders, container) {
  if (!orders.length) {
    const isFiltered = dateFilter !== 'all' || searchQuery.trim().length > 0;
    container.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="3" width="15" height="13" rx="2"/>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        <h3>${isFiltered ? 'Không tìm thấy đơn hàng phù hợp' : 'Không có chuyến giao nào cần xử lý'}</h3>
        <p>${isFiltered ? 'Vui lòng kiểm tra lại mốc ngày lọc hoặc từ khóa tìm kiếm.' : 'Khi cửa hàng phân công đơn hàng hoặc lô giao mới, bạn sẽ nhận được thông báo ngay lập tức.'}</p>
        ${isFiltered ? `
          <button type="button" class="date-pill-btn active" style="margin-top:14px;" onclick="resetFilters()">
            Xóa bộ lọc để xem tất cả
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = renderOrdersGroupedByBatch(orders, renderActiveOrderCard);
}

// Card đơn hàng đang giao (Shopee / Grab / Ahamove style)
function renderActiveOrderCard(order) {
  const shipping = order.shipping || {};
  const payment = order.payment || {};
  const isCod = payment.paymentMethod === 0;
  const st = Number(shipping.status || 0);
  const isOverdue = checkIsOverdue(order, shipping);
  const deliveryWindow = formatDeliveryWindow(shipping);

  const address = shipping.address || 'Chưa có địa chỉ giao hàng';
  const receiverName = shipping.receiverName || order.customerName || 'Khách nhận';
  const receiverPhone = shipping.receiverPhone || order.phoneNumber || '';
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('123 Nguyễn Thị Minh Khai, Quận 1, TP.HCM')}&destination=${encodeURIComponent(address)}`;

  let statusBadgeHtml = '';
  if (st === 0) statusBadgeHtml = `<span class="status-badge amber">Chờ tiếp nhận</span>`;
  else if (st === 1) statusBadgeHtml = `<span class="status-badge amber">Đã nhận · Chờ lấy hàng</span>`;
  else if (st === 2) statusBadgeHtml = `<span class="status-badge sky">Đã lấy hàng · Sẵn sàng giao</span>`;
  else if (st === 3) statusBadgeHtml = `<span class="status-badge indigo">Đang giao cho khách</span>`;
  else statusBadgeHtml = `<span class="status-badge neutral">Đang xử lý</span>`;

  // Tóm tắt sản phẩm trong đơn
  const itemsText = (order.orderDetails || []).map(d => 
    `${esc(d.productName || 'Sản phẩm')}${d.variantAttributes ? ` (${esc(d.variantAttributes)})` : ''} × ${Number(d.quantity || 1)}`
  ).join(' · ');

  return `
    <div class="order-card in-transit ${isOverdue ? 'overdue-card' : ''}" id="orderCard_${order.orderId}">
      <div class="card-top">
        <div class="order-code-wrapper">
          <span class="order-code">#${esc(order.orderCode || order.orderId)}</span>
          ${shipping.deliveryBatchCode ? `<span class="batch-pill">Lô ${esc(shipping.deliveryBatchCode)}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${statusBadgeHtml}
          ${isOverdue ? `<span class="status-badge overdue">Quá hạn</span>` : ''}
        </div>
      </div>

      ${renderWorkflowStepper(st, isCod, payment.codStatus)}

      <!-- Lộ trình Điểm lấy hàng -> Điểm giao (Grab / Ahamove Route Layout) -->
      <div class="route-box">
        <div class="route-node">
          <div class="route-marker origin"></div>
          <div class="route-content">
            <div class="route-title">Kho xuất phát</div>
            <div class="route-detail" style="font-weight:600;font-size:12.5px;">Cửa hàng ToyStore · 123 Nguyễn Thị Minh Khai, Q.1</div>
          </div>
        </div>
        
        <div class="route-line"></div>

        <div class="route-node">
          <div class="route-marker destination"></div>
          <div class="route-content">
            <div class="route-title">Điểm giao hàng</div>
            <div class="route-detail">
              <span>${esc(receiverName)}</span>
              ${receiverPhone ? `
                <a href="tel:${esc(receiverPhone)}" class="route-phone-link" title="Gọi điện">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>${esc(receiverPhone)}</span>
                </a>
              ` : ''}
            </div>
            <div style="font-size:12.5px;color:var(--slate-600);margin-top:2px;">${esc(address)}</div>
          </div>
        </div>

        <div class="route-actions-row">
          <a href="${mapsUrl}" target="_blank" rel="noopener" class="route-action-btn nav-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            <span>Chỉ đường</span>
          </a>
          <button type="button" class="route-action-btn" onclick="viewOrderTrackingLogs(${order.orderId})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Lịch sử hành trình</span>
          </button>
        </div>
      </div>

      <!-- Tóm tắt kiện hàng & Thời gian -->
      ${itemsText ? `
        <div class="order-items-preview">
          <b>Kiện hàng:</b> ${itemsText}
        </div>
      ` : ''}

      <div class="timestamps-box">
        <div>Hẹn giao: <b style="color:var(--slate-800);">${esc(deliveryWindow)}</b> ${isOverdue ? '<span style="color:var(--danger);font-weight:700;">(Đã trễ hẹn)</span>' : ''}</div>
        <div>Lấy kho: ${shipping.shippedAt ? `<b style="color:var(--success);">${fmtDateTime(shipping.shippedAt)}</b>` : '<span style="color:var(--slate-400);">Chưa lấy hàng</span>'}</div>
      </div>

      <!-- Khối tiền COD nổi bật -->
      <div class="cod-box ${isCod ? 'cod-active' : 'cod-paid'}">
        <span class="cod-label-text">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
          <span>${isCod ? 'Thu hộ tiền mặt (COD)' : 'Đã thanh toán trực tuyến'}</span>
        </span>
        <span class="cod-amount-num">${isCod ? money(order.finalAmount || order.totalAmount) : '0 đ'}</span>
      </div>

      ${shipping.failReason ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:12px;">
          <strong>Lần giao trước thất bại:</strong> ${esc(shipping.failReason)} (Đã thử: ${shipping.attemptCount || 1}/3 lần)
        </div>
      ` : ''}

      <!-- Nút hành động chuẩn từng bước -->
      <div class="actions-grid">
        ${st === 0 ? `
          <button class="btn-action btn-primary-action" onclick="acceptOrder(${order.orderId})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Tiếp nhận đơn hàng</span>
          </button>
        ` : st === 1 ? `
          <button class="btn-action btn-primary-action" onclick="pickupOrder(${order.orderId})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <span>Xác nhận đã lấy hàng tại kho</span>
          </button>
        ` : st === 2 ? `
          <button class="btn-action btn-primary-action" onclick="startDelivery(${order.orderId})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            <span>Bắt đầu giao cho khách</span>
          </button>
        ` : `
          <button class="btn-action btn-fail-action" onclick="openFailModal(${order.orderId})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <span>Báo giao thất bại</span>
          </button>
          <button class="btn-action btn-success-action" onclick="openCompleteDeliveryModal(${order.orderId}, ${isCod ? (order.finalAmount || order.totalAmount) : 0})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Giao thành công</span>
          </button>
        `}
      </div>
    </div>
  `;
}

// Danh sách lịch sử giao hàng
function renderHistoryOrders(orders, container) {
  if (!orders.length) {
    const isFiltered = dateFilter !== 'all' || searchQuery.trim().length > 0;
    container.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h3>${isFiltered ? 'Không có lịch sử phù hợp bộ lọc' : 'Chưa có lịch sử giao hàng'}</h3>
        <p>${isFiltered ? 'Thử chọn khoảng thời gian khác hoặc kiểm tra lại từ khóa tìm kiếm.' : 'Các chuyến giao hoàn tất hoặc thất bại sẽ được ghi nhận chi tiết tại đây.'}</p>
        ${isFiltered ? `
          <button type="button" class="date-pill-btn active" style="margin-top:14px;" onclick="resetFilters()">
            Xóa bộ lọc để xem tất cả
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = renderOrdersGroupedByBatch(orders, renderHistoryOrderCard);
}

// Card lịch sử giao hàng
function renderHistoryOrderCard(order) {
  const shipping = order.shipping || {};
  const payment = order.payment || {};
  const isSuccess = Number(order.status) === 4 || shipping.status === 4;
  const receiverName = shipping.receiverName || order.customerName || 'Khách nhận';
  const isCod = payment.paymentMethod === 0;
  const codStatus = Number(payment.codStatus || 0);

  const itemsText = (order.orderDetails || []).map(d => 
    `${esc(d.productName || 'Sản phẩm')} × ${Number(d.quantity || 1)}`
  ).join(' · ');

  return `
    <div class="order-card ${isSuccess ? 'delivered' : 'failed'}">
      <div class="card-top">
        <div class="order-code-wrapper">
          <span class="order-code">#${esc(order.orderCode || order.orderId)}</span>
          ${shipping.deliveryBatchCode ? `<span class="batch-pill">Lô ${esc(shipping.deliveryBatchCode)}</span>` : ''}
        </div>
        <div>
          ${isSuccess 
            ? `<span class="status-badge emerald">Giao thành công</span>` 
            : `<span class="status-badge rose">Giao thất bại</span>`}
        </div>
      </div>

      <div style="font-size:13px;color:var(--slate-800);font-weight:600;margin-bottom:6px;">
        <span>Khách: ${esc(receiverName)} (${esc(shipping.receiverPhone || order.phoneNumber || '—')})</span>
      </div>

      <div style="font-size:12.5px;color:var(--slate-600);margin-bottom:8px;">
        Địa chỉ: ${esc(shipping.address || '—')}
      </div>

      ${itemsText ? `
        <div class="order-items-preview">
          <b>Kiện hàng:</b> ${itemsText}
        </div>
      ` : ''}

      <div class="timestamps-box">
        <div>Lấy kho: ${shipping.shippedAt ? fmtDateTime(shipping.shippedAt) : '—'}</div>
        <div>Thời điểm giao: ${shipping.deliveredAt ? fmtDateTime(shipping.deliveredAt) : (order.completedAt ? fmtDateTime(order.completedAt) : '—')}</div>
      </div>

      ${!isSuccess && shipping.failReason ? `
        <div style="font-size:12px;color:var(--danger);background:#fef2f2;padding:6px 10px;border-radius:6px;border:1px solid #fecaca;margin-bottom:8px;">
          Lý do: <b>${esc(shipping.failReason)}</b> (Thử: ${shipping.attemptCount || 1} lần)
        </div>
      ` : ''}

      ${isSuccess && isCod ? `
        <div style="display:flex;justify-content:space-between;align-items:center;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;">
          <div>
            <span style="font-weight:700;color:#b45309;">COD: ${money(payment.amount || order.finalAmount || order.totalAmount)}</span>
            <span style="display:block;font-size:11px;color:#92400e;">Phí ship: ${money(shipping.shippingFee)} · Nộp shop: ${money(Math.max(0, Number(payment.amount || order.totalAmount || 0) - Number(shipping.shippingFee || 0)))}</span>
            <span style="display:block;font-size:11px;font-weight:600;color:#92400e;">
              ${codStatus === 3 ? 'Đã xác nhận tiền vào quỹ' : codStatus === 2 ? 'Đã báo nộp — Chờ admin kiểm tra' : 'Đang giữ tiền mặt COD'}
            </span>
          </div>
          ${codStatus === 1 ? `
            <button type="button" class="date-apply-btn" style="padding:5px 10px;font-size:11px;" onclick="submitCod(${order.orderId})">
              Báo nộp tiền shop
            </button>
          ` : ''}
        </div>
      ` : ''}

      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--slate-500);border-top:1px dashed var(--slate-200);padding-top:8px;">
        <button type="button" class="route-action-btn" onclick="viewOrderTrackingLogs(${order.orderId})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Hành trình chi tiết</span>
        </button>
        <span style="font-weight:800;color:var(--slate-900);font-family:'Space Grotesk',sans-serif;font-size:13px;">${money(order.finalAmount || order.totalAmount)}</span>
      </div>
    </div>
  `;
}

// ── 3. VÍ COD & ĐỐI SOÁT CỦA SHIPPER ─────────────────────────
async function renderWallet(container) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-400);">Đang tổng hợp ví COD...</div>';

  try {
    const codList = await api(`Shipper/cod-reconciliation${selectedShipperQuery()}`);
    let items = Array.isArray(codList) ? codList : [];

    // Lọc ví COD theo từ khóa và ngày nếu có
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(it => 
        String(it.orderCode || '').toLowerCase().includes(q) ||
        String(it.receiverName || '').toLowerCase().includes(q) ||
        String(it.receiverPhone || '').toLowerCase().includes(q)
      );
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 86400000);
      const sevenDaysAgo = new Date(today.getTime() - 6 * 86400000);

      items = items.filter(it => {
        const d = parseUtcDate(it.codCollectedAt || it.createdAt);
        if (!d) return false;
        const itDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        if (dateFilter === 'today') return itDay.getTime() === today.getTime();
        if (dateFilter === 'yesterday') return itDay.getTime() === yesterday.getTime();
        if (dateFilter === 'last7days') return itDay.getTime() >= sevenDaysAgo.getTime() && itDay.getTime() <= (today.getTime() + 86400000 - 1);
        if (dateFilter === 'custom') {
          if (customStartDate) {
            const [sy, sm, sd] = customStartDate.split('-').map(Number);
            if (itDay.getTime() < new Date(sy, sm - 1, sd).getTime()) return false;
          }
          if (customEndDate) {
            const [ey, em, ed] = customEndDate.split('-').map(Number);
            if (itDay.getTime() > new Date(ey, em - 1, ed).getTime()) return false;
          }
          return true;
        }
        return true;
      });
    }

    const holdingAmount = items.filter(x => x.codStatus === 1).reduce((sum, x) => sum + (Number(x.storeAmount) || 0), 0);
    const pendingVerificationAmount = items.filter(x => x.codStatus === 2).reduce((sum, x) => sum + (Number(x.storeAmount) || 0), 0);
    const submittedAmount = items.filter(x => x.codStatus === 3).reduce((sum, x) => sum + (Number(x.storeAmount) || 0), 0);
    const shippingEarnings = items.reduce((sum, x) => sum + (Number(x.shippingFee) || 0), 0);
    const totalCollected = items.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);

    container.innerHTML = `
      <div class="wallet-card">
        <div class="wallet-title">Tiền hàng cần đối soát cửa hàng</div>
        <div class="wallet-amount">${money(holdingAmount + pendingVerificationAmount)}</div>
        <div class="wallet-breakdown">
          <div>Chờ admin duyệt: <strong>${money(pendingVerificationAmount)}</strong></div>
          <div>Đã vào quỹ shop: <strong>${money(submittedAmount)}</strong></div>
          <div>Phí ship của bạn: <strong>${money(shippingEarnings)}</strong></div>
          <div>Tổng COD thu hộ: <strong>${money(totalCollected)}</strong></div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 10px;">
        <h4 style="font-size:13.5px;font-weight:700;color:var(--slate-800);">Danh sách các khoản thu tiền COD:</h4>
        <button type="button" class="date-pill-btn" onclick="renderWallet(document.getElementById('tabContent'))">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          <span>Làm mới</span>
        </button>
      </div>

      ${!items.length ? `
        <div class="empty-state-box">
          <p>Không có khoản thu COD nào trong khoảng thời gian đã chọn.</p>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${items.map(item => {
            const codStatus = Number(item.codStatus);
            return `
            <div style="background:white;border-radius:12px;border:1px solid var(--slate-200);padding:14px;box-shadow:var(--shadow-sm);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                <div>
                  <strong style="font-size:14px;color:var(--slate-900);">#${esc(item.orderCode)}</strong>
                  <div style="font-size:12px;color:var(--slate-600);margin-top:2px;">Khách: ${esc(item.receiverName)} (${esc(item.receiverPhone)})</div>
                  <div style="font-size:11.5px;color:var(--slate-400);margin-top:2px;">Thu lúc: ${fmtDateTime(item.codCollectedAt)}</div>
                  <div style="font-size:11.5px;font-weight:700;margin-top:5px;color:${codStatus === 3 ? '#047857' : codStatus === 2 ? '#1d4ed8' : '#b45309'};">
                    ${codStatus === 3 ? 'Admin đã xác nhận nhận tiền' : codStatus === 2 ? 'Đã báo nộp — Chờ admin duyệt' : codStatus === 1 ? 'Đang giữ tiền — Cần nộp về shop' : 'Chưa ghi nhận thu COD'}
                  </div>
                </div>
                <div style="text-align:right;">
                  <strong style="font-size:15px;color:#b45309;font-family:'Space Grotesk',sans-serif;">Nộp shop: ${money(item.storeAmount)}</strong>
                  <div style="font-size:11px;color:var(--slate-500);margin-top:1px;">COD: ${money(item.amount)} · Phí ship: ${money(item.shippingFee)}</div>
                </div>
              </div>
              ${codStatus === 1 ? `
                <button type="button" class="date-apply-btn" style="display:block;width:100%;margin-top:12px;padding:9px 12px;text-align:center;" onclick="submitCod(${Number(item.orderId)})">
                  Xác nhận đã nộp tiền mặt về cửa hàng
                </button>
              ` : ''}
            </div>
          `}).join('')}
        </div>
      `}
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state-box">
        <h3 style="color:var(--danger);">Không thể tải dữ liệu ví COD</h3>
        <p>${esc(err.message)}</p>
        <button type="button" class="date-pill-btn active" style="margin-top:12px;" onclick="renderWallet(document.getElementById('tabContent'))">Thử lại</button>
      </div>
    `;
  }
}

// ── 4. WORKFLOW ACTIONS (BƯỚC 1 ĐẾN BƯỚC 5) ───────────────────
async function acceptOrder(orderId) {
  try {
    await api(`Shipper/orders/${orderId}/accept-order${selectedShipperQuery()}`, { method: 'POST' });
    toast('Đã xác nhận tiếp nhận đơn hàng thành công!', 'success');
    loadOrders();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

async function pickupOrder(orderId) {
  try {
    await api(`Shipper/orders/${orderId}/pickup${selectedShipperQuery()}`, { method: 'POST' });
    toast('Đã xác nhận lấy hàng tại kho cửa hàng!', 'success');
    loadOrders();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

async function startDelivery(orderId) {
  try {
    await api(`Shipper/orders/${orderId}/start-delivery${selectedShipperQuery()}`, { method: 'POST' });
    toast('Đã bắt đầu lộ trình giao hàng tới khách!', 'success');
    loadOrders();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// Bước 4: Modal Hoàn tất giao hàng kèm minh chứng ảnh
let completeModalState = { orderId: null, codAmount: 0, uploadedProofUrl: null };

function openCompleteDeliveryModal(orderId, codAmount) {
  completeModalState = { orderId, codAmount, uploadedProofUrl: null };

  const modal = document.createElement('div');
  modal.id = 'completeModalOverlay';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Xác nhận Giao Hàng Thành Công</h3>
        <button type="button" class="modal-close-btn" onclick="document.getElementById('completeModalOverlay').remove()">✕</button>
      </div>

      <div style="background:${codAmount > 0 ? '#fffbeb' : '#ecfdf5'};border:1px solid ${codAmount > 0 ? '#fde68a' : '#a7f3d0'};border-radius:10px;padding:12px;margin-bottom:14px;">
        ${codAmount > 0 ? `
          <div style="font-size:12.5px;color:#92400e;font-weight:700;">Thu hộ tiền mặt (COD):</div>
          <div style="font-size:20px;font-weight:800;color:#b45309;font-family:'Space Grotesk',sans-serif;margin-top:2px;">${money(codAmount)}</div>
          <div style="font-size:11.5px;color:#92400e;margin-top:2px;">Vui lòng đảm bảo đã nhận đủ số tiền mặt này từ khách hàng.</div>
        ` : `
          <div style="font-size:12.5px;color:#047857;font-weight:700;">Đơn đã thanh toán online: 0 đ</div>
          <div style="font-size:11.5px;color:#065f46;margin-top:2px;">Kiện hàng đã giao thành công tới tay người nhận.</div>
        `}
      </div>

      <label style="display:block;font-size:12px;font-weight:700;color:var(--slate-700);margin-bottom:6px;">Ảnh chụp minh chứng giao hàng (Tùy chọn):</label>
      <div class="photo-upload-box" onclick="document.getElementById('proofFileInput').click()">
        <input type="file" id="proofFileInput" accept="image/*" style="display:none;" onchange="handleProofImageSelected(this)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" style="margin:0 auto 4px;">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <div style="font-size:12.5px;font-weight:700;color:var(--primary);">Nhấn để tải ảnh minh chứng</div>
        <div style="font-size:11px;color:var(--slate-400);margin-top:2px;">Hỗ trợ JPG, PNG, WEBP</div>
        <img id="proofPreviewImg" class="photo-preview-img" alt="Xem trước minh chứng">
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--slate-700);margin-bottom:4px;">Ghi chú bàn giao (nếu có):</label>
        <input type="text" id="deliveryNoteInput" style="width:100%;padding:9px 12px;border:1px solid var(--slate-300);border-radius:8px;font-family:inherit;font-size:12.5px;" placeholder="VD: Gửi bảo vệ / Khách nhận trực tiếp...">
      </div>

      <div style="display:flex;gap:8px;">
        <button type="button" class="date-cancel-btn" style="flex:1;padding:11px;" onclick="document.getElementById('completeModalOverlay').remove()">Hủy bỏ</button>
        <button type="button" class="btn-action btn-success-action" style="flex:2;padding:11px;" onclick="submitCompleteDelivery()">
          Xác nhận hoàn thành
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function handleProofImageSelected(input) {
  const file = input.files?.[0];
  if (!file) return;

  const preview = document.getElementById('proofPreviewImg');
  if (preview) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'proofs');

  try {
    toast('Đang tải ảnh minh chứng lên máy chủ...', 'info');
    const token = localStorage.getItem('toyStoreToken') || localStorage.getItem('token');
    let res = await fetch('/api/Upload/image', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    if (res.status === 401) {
      res = await fetch('/api/Upload/image', { method: 'POST', body: formData });
    }
    if (!res.ok) throw new Error(`Không thể tải ảnh lên (Mã: ${res.status})`);
    const data = await res.json();
    completeModalState.uploadedProofUrl = data.url;
    toast('Đã tải ảnh minh chứng thành công!', 'success');
  } catch (err) {
    toast(`Tải ảnh thất bại: ${err.message}`, 'error');
  }
}

async function submitCompleteDelivery() {
  const { orderId } = completeModalState;
  const note = document.getElementById('deliveryNoteInput')?.value || '';
  const fullNote = completeModalState.uploadedProofUrl 
    ? `${note} (Ảnh minh chứng: ${completeModalState.uploadedProofUrl})`.trim()
    : note;

  try {
    await api(`Shipper/orders/${orderId}/complete-delivery${selectedShipperQuery()}`, {
      method: 'POST',
      body: JSON.stringify({ note: fullNote })
    });
    document.getElementById('completeModalOverlay')?.remove();
    toast('Chúc mừng bạn đã hoàn thành giao đơn hàng!', 'success');
    loadOrders();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// Bước 5: Báo nộp tiền COD về cửa hàng
async function submitCod(orderId) {
  if (!confirm('Xác nhận đã nộp cho cửa hàng phần tiền hàng (không bao gồm phí ship của bạn)? Admin sẽ kiểm tra và đối soát vào quỹ shop.')) return;

  try {
    await api(`Shipper/orders/${orderId}/submit-cod${selectedShipperQuery()}`, {
      method: 'POST',
      body: JSON.stringify({ note: 'Shipper đã nộp lại tiền mặt COD về cửa hàng' })
    });
    toast('Đã báo nộp tiền COD. Khoản tiền sẽ vào quỹ sau khi admin duyệt.', 'success');
    loadOrders();
    if (activeTab === 'wallet') renderWallet(document.getElementById('tabContent'));
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// Báo cáo giao hàng thất bại
let activeFailOrderId = null;
let selectedFailReasonText = 'Không liên lạc được (Thuê bao / Không nghe máy)';

function openFailModal(orderId) {
  activeFailOrderId = orderId;
  selectedFailReasonText = 'Không liên lạc được (Thuê bao / Không nghe máy)';

  const modal = document.createElement('div');
  modal.id = 'failModalOverlay';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Báo cáo Giao Hàng Thất Bại</h3>
        <button type="button" class="modal-close-btn" onclick="document.getElementById('failModalOverlay').remove()">✕</button>
      </div>
      <p style="font-size:12.5px;color:var(--slate-500);margin-bottom:12px;">Vui lòng chọn lý do giao hàng không thành công:</p>

      <div id="failReasonsList">
        <button type="button" class="reason-btn selected" onclick="selectFailReason(this, 'Không liên lạc được (Thuê bao / Không nghe máy)')">
          <span>Không liên lạc được người nhận</span>
          <span style="font-size:11px;color:var(--slate-400);">Gọi không nghe máy / Thuê bao</span>
        </button>
        <button type="button" class="reason-btn" onclick="selectFailReason(this, 'Khách hẹn giao lại vào thời gian khác')">
          <span>Khách hẹn giao vào ngày khác</span>
          <span style="font-size:11px;color:var(--slate-400);">Đổi lịch hẹn</span>
        </button>
        <button type="button" class="reason-btn" onclick="selectFailReason(this, 'Khách từ chối nhận hàng (Hủy đơn / Đổi ý)')">
          <span>Khách từ chối nhận hàng</span>
          <span style="font-size:11px;color:var(--slate-400);">Đổi ý / Không đặt</span>
        </button>
        <button type="button" class="reason-btn" onclick="selectFailReason(this, 'Sai địa chỉ hoặc khu vực không thể tiếp cận')">
          <span>Sai thông tin địa chỉ giao</span>
          <span style="font-size:11px;color:var(--slate-400);">Không tìm thấy địa chỉ</span>
        </button>
      </div>

      <div style="margin-top:12px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--slate-700);margin-bottom:4px;">Ghi chú chi tiết thêm:</label>
        <input type="text" id="failNoteInput" style="width:100%;padding:9px 12px;border:1px solid var(--slate-300);border-radius:8px;font-family:inherit;font-size:12.5px;" placeholder="Nhập thêm chi tiết nếu cần...">
      </div>

      <div style="display:flex;gap:8px;margin-top:16px;">
        <button type="button" class="date-cancel-btn" style="flex:1;padding:11px;" onclick="document.getElementById('failModalOverlay').remove()">Hủy</button>
        <button type="button" class="btn-action btn-fail-action" style="flex:2;padding:11px;" onclick="submitFailReport()">Gửi báo cáo</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function selectFailReason(btn, text) {
  document.querySelectorAll('.reason-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedFailReasonText = text;
}

async function submitFailReport() {
  if (!activeFailOrderId) return;
  const note = document.getElementById('failNoteInput')?.value || '';

  try {
    await api(`Shipper/orders/${activeFailOrderId}/fail-delivery${selectedShipperQuery()}`, {
      method: 'POST',
      body: JSON.stringify({
        failReason: selectedFailReasonText,
        note: note
      })
    });
    document.getElementById('failModalOverlay')?.remove();
    toast('Đã ghi nhận báo cáo giao hàng thất bại.', 'info');
    loadOrders();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// ── 5. TIMELINE / AUDIT LOG VIEWER ──────────────────────────
async function viewOrderTrackingLogs(orderId) {
  const modal = document.createElement('div');
  modal.id = 'trackingModalOverlay';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Lịch sử hành trình đơn #${orderId}</h3>
        <button type="button" class="modal-close-btn" onclick="document.getElementById('trackingModalOverlay').remove()">✕</button>
      </div>
      <div id="trackingLogsContent" style="max-height:400px;overflow-y:auto;padding-right:4px;">
        <div style="text-align:center;padding:30px;color:var(--slate-400);">Đang tải lịch sử...</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const logs = await api(`Shipper/orders/${orderId}/tracking-logs`);
    const container = document.getElementById('trackingLogsContent');
    if (!container) return;

    if (!Array.isArray(logs) || !logs.length) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--slate-400);">Chưa có bản ghi lịch sử nào cho đơn này.</div>';
      return;
    }

    container.innerHTML = `
      <div class="timeline-list">
        ${logs.map(log => `
          <div class="timeline-item">
            <div class="timeline-node"></div>
            <div class="timeline-action">${esc(log.action)} → <span style="color:var(--primary);">${esc(log.newStatus)}</span></div>
            <div class="timeline-performer">
              <b>${esc(log.performedByName || 'Hệ thống')}</b> (${esc(log.performedByRole || 'System')}) · ${fmtDateTime(log.createdAt)}
            </div>
            ${log.note ? `<div class="timeline-note">${esc(log.note)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    const container = document.getElementById('trackingLogsContent');
    if (container) container.innerHTML = `<div style="color:var(--danger);padding:20px;">Lỗi tải timeline: ${esc(err.message)}</div>`;
  }
}

// ── 6. REALTIME SIGNALR CONNECTION ──────────────────────────
function initSignalR() {
  if (typeof signalR === 'undefined') return;

  const token = localStorage.getItem('toyStoreToken') || localStorage.getItem('token');
  trackingHubConnection = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/order-tracking', {
      accessTokenFactory: () => token
    })
    .withAutomaticReconnect()
    .build();

  trackingHubConnection.on('ReceiveNewOrderAssignment', data => {
    addShipperNotification({
      id: `assign-${data.orderId || Date.now()}`,
      title: 'Đơn hàng mới được phân công',
      message: data.message || `Đơn hàng #${data.orderId} đã được gán cho bạn.`,
      type: 'assignment'
    });
    loadOrders();
  });

  trackingHubConnection.on('ReceiveOrderTrackingUpdate', () => {
    loadOrders();
  });

  trackingHubConnection.start()
    .then(() => {
      console.log('[SignalR Shipper] Kết nối thành công.');
      if (currentShipperId) {
        trackingHubConnection.invoke('JoinShipper', currentShipperId).catch(console.warn);
      }
    })
    .catch(err => console.warn('[SignalR Shipper] Không thể kết nối:', err));
}

// ── 7. DOM CONTENT LOADED EVENT LISTENERS ───────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Shipper selector (cho admin/manager thử nghiệm)
  document.getElementById('shipperSelector')?.addEventListener('change', event => {
    changeSelectedShipper(event.target.value);
  });

  // Nút đăng xuất
  document.getElementById('shipperLogoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('toyStoreToken');
    localStorage.removeItem('toyStoreUser');
    localStorage.removeItem('toyStoreShipperId');
    location.replace('/customer.html');
  });

  // Notification menu toggle
  document.getElementById('shipperNotificationBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    toggleShipperNotificationPanel();
  });

  document.getElementById('clearShipperNotificationsBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    clearShipperNotifications();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.shipper-notification-menu')) {
      closeShipperNotificationPanel();
    }
  });

  // Tìm kiếm đơn hàng
  const searchInput = document.getElementById('orderSearchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value;
      if (clearBtn) clearBtn.classList.toggle('show', searchQuery.length > 0);
      updateFilterStatusBar();
      renderCurrentTab();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchQuery = '';
      clearBtn.classList.remove('show');
      updateFilterStatusBar();
      renderCurrentTab();
    });
  }

  loadShipperProfile();
});
