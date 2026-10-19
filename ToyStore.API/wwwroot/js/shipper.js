// ============================================================
// TOYSTORE SHIPPER PORTAL CLIENT JAVASCRIPT
// ============================================================

const authUser = JSON.parse(localStorage.getItem('toyStoreUser') || 'null');
const authToken = localStorage.getItem('toyStoreToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
const userRole = String(authUser?.role || '').trim().toLowerCase();

// Không đăng nhập hoặc tài khoản không có quyền giao hàng/quản trị thì trở về trang khách hàng
if (!authToken || !['admin', 'manager', 'staff', 'shipper'].includes(userRole)) {
  location.replace('/customer.html');
}

let currentShipperId = Number(localStorage.getItem('toyStoreShipperId') || 1);
let activeTab = 'active'; // 'active' | 'history' | 'wallet'
let allOrders = [];
let shippersList = [];
let trackingHubConnection = null;
let shipperNotifications = [];

const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = v => v == null ? '0 đ' : Number(v).toLocaleString('vi-VN') + ' đ';
const fmtDateTime = s => s ? new Date(s).toLocaleString('vi-VN') : '—';
const shipperNotificationStorageKey = () => `toyStoreShipperNotifications:${currentShipperId}`;

function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = 'toast-msg';
  t.style.borderLeft = type === 'error' ? '4px solid #ef4444' : (type === 'success' ? '4px solid #10b981' : '4px solid #6366f1');
  t.innerHTML = `<span>${type === 'error' ? '⚠️' : (type === 'success' ? '✅' : '🔔')}</span> <span>${esc(msg)}</span>`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function formatNotificationTime(value) {
  const time = new Date(value);
  return Number.isNaN(time.getTime())
    ? 'Vừa xong'
    : time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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
    list.innerHTML = '<div class="notification-empty">Chưa có thông báo đơn hàng.</div>';
    return;
  }

  list.innerHTML = shipperNotifications.map(item => `
    <article class="notification-item">
      <span class="notification-icon ${item.type === 'assignment' ? 'assignment' : ''}">${item.type === 'assignment' ? '📦' : '🛎️'}</span>
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

// ── 1. SHIPPER PROFILE INITIALIZATION ───────────────────────
async function loadShipperProfiles() {
  try {
    const list = await api('Shipper');
    shippersList = Array.isArray(list) ? list : [];
    const select = document.getElementById('shipperSelector');
    if (!shippersList.length) {
      if (select) select.innerHTML = '<option value="">Chưa có shipper</option>';
      return;
    }

    if (select) {
      select.innerHTML = shippersList.map(s => `
        <option value="${s.shipperId}" ${s.shipperId === currentShipperId ? 'selected' : ''}>
          ${esc(s.fullName)} (${esc(s.phoneNumber)})
        </option>
      `).join('');
    }

    // Ưu tiên chọn hồ sơ Shipper khớp với tài khoản đăng nhập (userId)
    const matchingShipper = authUser?.userId ? shippersList.find(s => s.userId === authUser.userId) : null;
    const current = matchingShipper || shippersList.find(s => s.shipperId === currentShipperId) || shippersList[0];
    if (current) {
      currentShipperId = current.shipperId;
      localStorage.setItem('toyStoreShipperId', currentShipperId);
      if (select) select.value = currentShipperId;
      updateProfileDisplay(current);
    }

    loadShipperNotifications();
    initSignalR();
    loadOrders();
  } catch (err) {
    console.error('Không thể nạp hồ sơ shipper:', err);
    toast(`Lỗi kết nối máy chủ: ${err.message}`, 'error');
  }
}

function updateProfileDisplay(shipper) {
  const nameEl = document.getElementById('currentShipperName');
  const subEl = document.getElementById('currentShipperPhone');
  const letterEl = document.getElementById('avatarLetter');
  if (nameEl) nameEl.textContent = shipper.fullName;
  if (subEl) subEl.textContent = `SĐT: ${shipper.phoneNumber} · Xe: ${shipper.vehicleNumber || '—'} · Tuyến: ${shipper.assignedArea || 'Linh hoạt'}`;
  if (letterEl) {
    const parts = (shipper.fullName || 'NV').split(' ');
    letterEl.textContent = parts[parts.length - 1].slice(0, 2).toUpperCase();
  }
}

function switchShipperProfile(id) {
  const previousShipperId = currentShipperId;
  currentShipperId = Number(id);
  localStorage.setItem('toyStoreShipperId', currentShipperId);
  const found = shippersList.find(s => s.shipperId === currentShipperId);
  if (found) updateProfileDisplay(found);

  loadShipperNotifications();
  if (trackingHubConnection) {
    const joinCurrentShipper = () => trackingHubConnection.invoke('JoinShipper', currentShipperId).catch(console.warn);
    if (previousShipperId !== currentShipperId) {
      trackingHubConnection.invoke('LeaveShipper', previousShipperId).catch(console.warn).finally(joinCurrentShipper);
    } else {
      joinCurrentShipper();
    }
  }
  loadOrders();
}

// ── 2. ORDER LIST & ACTIONS ─────────────────────────────────
async function loadOrders() {
  const container = document.getElementById('tabContent');
  if (container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-400);">Đang nạp chuyến hàng...</div>';
  }

  try {
    allOrders = await api(`Shipper/my-orders?shipperId=${currentShipperId}`);
    renderCurrentTab();
  } catch (err) {
    if (container) {
      container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--danger);">Lỗi tải đơn hàng: ${esc(err.message)}</div>`;
    }
  }
}

function renderCurrentTab() {
  const activeOrders = allOrders.filter(o => {
    const st = Number(o.shipping?.status ?? 0);
    return st === 0 || st === 1 || st === 4;
  });

  const historyOrders = allOrders.filter(o => {
    const st = Number(o.shipping?.status ?? 0);
    return st === 2 || st === 3 || st === 5;
  });

  const badgeActive = document.getElementById('badgeActiveCount');
  const badgeHistory = document.getElementById('badgeHistoryCount');
  if (badgeActive) badgeActive.textContent = activeOrders.length;
  if (badgeHistory) badgeHistory.textContent = historyOrders.length;

  const container = document.getElementById('tabContent');
  if (!container) return;

  if (activeTab === 'active') {
    renderActiveOrders(activeOrders, container);
  } else if (activeTab === 'history') {
    renderHistoryOrders(historyOrders, container);
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

function renderActiveOrders(orders, container) {
  if (!orders.length) {
    container.innerHTML = `
      <div style="background:white;border-radius:16px;padding:50px 20px;text-align:center;border:1px solid var(--slate-200);">
        <div style="font-size:48px;margin-bottom:12px;">🎉</div>
        <h3 style="font-size:17px;font-weight:700;color:var(--slate-800);">Hiện không có đơn nào đang chờ giao</h3>
        <p style="font-size:13px;color:var(--slate-500);margin-top:4px;">Khi quản trị viên phân công đơn hoặc lô hàng mới, bạn sẽ nhận được thông báo ngay lập tức.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(order => {
    const shipping = order.shipping || {};
    const payment = order.payment || {};
    const isCod = payment.paymentMethod === 0;
    const isDelivering = shipping.status === 1 || shipping.status === 4;
    const address = shipping.address || 'Chưa có địa chỉ';
    const receiverName = shipping.receiverName || order.customerName || 'Khách nhận';
    const receiverPhone = shipping.receiverPhone || order.phoneNumber || '';
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('123 Nguyễn Thị Minh Khai, Quận 1, TP.HCM')}&destination=${encodeURIComponent(address)}`;

    return `
      <div class="order-card in-transit">
        <div class="card-top">
          <div>
            <div class="order-code">#${esc(order.orderCode || order.orderId)}</div>
            ${shipping.deliveryBatchCode ? `<span class="batch-tag">📦 Lô: ${esc(shipping.deliveryBatchCode)}</span>` : ''}
          </div>
          <div>
            ${isDelivering 
              ? `<span class="badge" style="background:#e0e7ff;color:#3730a3;font-weight:700;font-size:11.5px;padding:3px 8px;border-radius:6px;">⚡ Đang giao</span>` 
              : `<span class="badge" style="background:#fef3c7;color:#92400e;font-weight:700;font-size:11.5px;padding:3px 8px;border-radius:6px;">Chờ xuất phát</span>`}
          </div>
        </div>

        <div class="customer-info">
          <div class="customer-name">
            <span>👤 ${esc(receiverName)}</span>
            ${receiverPhone ? `<a href="tel:${esc(receiverPhone)}" class="customer-phone-btn">📞 ${esc(receiverPhone)}</a>` : ''}
          </div>
          <div class="customer-address">
            <span>📍</span>
            <div>${esc(address)}</div>
          </div>
          <div>
            <a href="${mapsUrl}" target="_blank" class="maps-link-btn">
              <span>🗺️ Chỉ đường Google Maps</span>
              <span>↗</span>
            </a>
          </div>
        </div>

        <div class="cod-box">
          <span class="cod-label">${isCod ? '💵 CẦN THU TIỀN MẶT (COD)' : '💳 ĐÃ THANH TOÁN ONLINE'}</span>
          <span class="cod-amount">${isCod ? money(order.finalAmount || order.totalAmount) : '0 đ'}</span>
        </div>

        ${shipping.failReason ? `
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:12px;">
            <strong>⚠️ Lần giao trước thất bại:</strong> ${esc(shipping.failReason)} (Đã thử: ${shipping.attemptCount}/3)
          </div>
        ` : ''}

        <div class="card-actions">
          ${!isDelivering ? `
            <button class="btn-action btn-start" onclick="startDelivery(${order.orderId})">
              <span>🚀 Bắt đầu giao đơn này</span>
            </button>
          ` : `
            <button class="btn-action btn-fail" onclick="openFailModal(${order.orderId})">
              <span>✕ Giao thất bại</span>
            </button>
            <button class="btn-action btn-success" onclick="completeDelivery(${order.orderId}, ${isCod ? (order.finalAmount || order.totalAmount) : 0})">
              <span>✓ Giao thành công</span>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function renderHistoryOrders(orders, container) {
  if (!orders.length) {
    container.innerHTML = `
      <div style="background:white;border-radius:16px;padding:40px 20px;text-align:center;border:1px solid var(--slate-200);color:var(--slate-400);">
        Chưa có lịch sử giao hàng nào.
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(order => {
    const shipping = order.shipping || {};
    const isSuccess = shipping.status === 2;
    const receiverName = shipping.receiverName || order.customerName || 'Khách nhận';

    return `
      <div class="order-card ${isSuccess ? 'delivered' : 'failed'}">
        <div class="card-top">
          <div>
            <div class="order-code">#${esc(order.orderCode || order.orderId)}</div>
            <div style="font-size:12.5px;color:var(--slate-500);margin-top:2px;">Khách: <b>${esc(receiverName)}</b></div>
          </div>
          <div>
            ${isSuccess 
              ? `<span class="badge" style="background:#ecfdf5;color:#047857;font-weight:700;font-size:12px;padding:3px 8px;border-radius:6px;">✅ Giao thành công</span>` 
              : `<span class="badge" style="background:#fef2f2;color:#dc2626;font-weight:700;font-size:12px;padding:3px 8px;border-radius:6px;">❌ Giao thất bại</span>`}
          </div>
        </div>
        <div style="font-size:12.5px;color:var(--slate-600);margin-bottom:8px;">
          📍 ${esc(shipping.address || '—')}
        </div>
        ${!isSuccess && shipping.failReason ? `
          <div style="font-size:12px;color:var(--danger);background:#fef2f2;padding:6px 10px;border-radius:6px;border:1px solid #fecaca;margin-bottom:8px;">
            Lý do: <b>${esc(shipping.failReason)}</b> (Thử: ${shipping.attemptCount || 1} lần)
          </div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--slate-500);border-top:1px dashed var(--slate-200);padding-top:8px;">
          <span>Thời gian: ${fmtDateTime(shipping.deliveredAt || shipping.failedAt)}</span>
          <span style="font-weight:700;color:var(--slate-800);">${money(order.finalAmount || order.totalAmount)}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function renderWallet(container) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-400);">Đang tổng hợp ví COD...</div>';

  try {
    const codList = await api(`Shipper/cod-reconciliation?shipperId=${currentShipperId}`);
    const items = Array.isArray(codList) ? codList : [];

    const holdingAmount = items.filter(x => x.codStatus === 1).reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
    const submittedAmount = items.filter(x => x.codStatus === 2).reduce((sum, x) => sum + (Number(x.amount) || 0), 0);

    container.innerHTML = `
      <div class="wallet-card">
        <div class="wallet-title">💵 Tiền mặt COD đang giữ trong túi</div>
        <div class="wallet-amount">${money(holdingAmount)}</div>
        <div class="wallet-meta">
          <div>Đã nộp về shop: <b>${money(submittedAmount)}</b></div>
          <div>Tổng số đơn đã thu: <b>${items.length}</b></div>
        </div>
      </div>

      <h4 style="font-size:14px;font-weight:700;color:var(--slate-700);margin:16px 0 10px;">Chi tiết các đơn thu tiền COD:</h4>
      ${!items.length ? `
        <div style="background:white;border-radius:12px;padding:30px;text-align:center;border:1px solid var(--slate-200);color:var(--slate-400);">Chưa có đơn COD nào.</div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${items.map(item => `
            <div style="background:white;border-radius:12px;border:1px solid var(--slate-200);padding:14px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <strong style="font-size:14px;color:var(--slate-900);">#${esc(item.orderCode)}</strong>
                  <div style="font-size:12.5px;color:var(--slate-600);margin-top:2px;">Khách: ${esc(item.receiverName)} (${esc(item.receiverPhone)})</div>
                  <div style="font-size:11.5px;color:var(--slate-400);margin-top:2px;">Thu: ${fmtDateTime(item.codCollectedAt)}</div>
                </div>
                <div style="text-align:right;">
                  <strong style="font-size:15px;color:#b45309;">${money(item.amount)}</strong>
                  <div style="margin-top:4px;">
                    ${item.codStatus === 2 
                      ? `<span class="badge" style="background:#ecfdf5;color:#047857;font-weight:700;font-size:11px;padding:2px 6px;border-radius:4px;">Đã nộp shop</span>` 
                      : `<span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;font-size:11px;padding:2px 6px;border-radius:4px;">Đang giữ tiền</span>`}
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  } catch (err) {
    container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--danger);">Không thể nạp ví COD: ${esc(err.message)}</div>`;
  }
}

// ── 3. DELIVERY ACTIONS ─────────────────────────────────────
async function startDelivery(orderId) {
  try {
    await api(`Shipper/orders/${orderId}/start-delivery?shipperId=${currentShipperId}`, { method: 'POST' });
    toast('Đã bắt đầu hành trình giao đơn hàng!', 'success');
    loadOrders();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

async function completeDelivery(orderId, codAmount) {
  const promptText = codAmount > 0 
    ? `Xác nhận đã giao hàng thành công và ĐÃ THU ${money(codAmount)} tiền mặt COD từ khách hàng?` 
    : 'Xác nhận kiện hàng đã được giao thành công tới khách hàng?';

  if (!confirm(promptText)) return;

  try {
    await api(`Shipper/orders/${orderId}/complete-delivery?shipperId=${currentShipperId}`, { method: 'POST' });
    toast('Chúc mừng bạn đã hoàn thành giao đơn hàng!', 'success');
    loadOrders();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

let activeFailOrderId = null;
function openFailModal(orderId) {
  activeFailOrderId = orderId;
  const modal = document.createElement('div');
  modal.id = 'failModalOverlay';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:800;color:var(--slate-900);">Báo cáo Giao hàng thất bại</h3>
        <button type="button" onclick="document.getElementById('failModalOverlay').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--slate-400);">✕</button>
      </div>
      <p style="font-size:13px;color:var(--slate-500);margin-bottom:12px;">Vui lòng chọn lý do chính xác để bộ phận điều phối hỗ trợ xử lý:</p>

      <div id="failReasonsList">
        <button class="reason-btn selected" onclick="selectFailReason(this, 'Không liên lạc được (Thuê bao / Không nghe máy)')">
          <span>📵</span> <span>Không liên lạc được khách</span>
        </button>
        <button class="reason-btn" onclick="selectFailReason(this, 'Khách hẹn giao lại vào thời gian khác')">
          <span>📅</span> <span>Khách hẹn giao vào ngày khác</span>
        </button>
        <button class="reason-btn" onclick="selectFailReason(this, 'Khách từ chối nhận hàng (Bom hàng / Đổi ý)')">
          <span>🚫</span> <span>Khách từ chối nhận hàng</span>
        </button>
        <button class="reason-btn" onclick="selectFailReason(this, 'Sai địa chỉ / Không tìm thấy số nhà')">
          <span>📍</span> <span>Sai địa chỉ giao hàng</span>
        </button>
        <button class="reason-btn" onclick="selectFailReason(this, 'Khác')">
          <span>✍️</span> <span>Lý do khác...</span>
        </button>
      </div>

      <div style="margin:12px 0;">
        <label style="display:block;font-size:12.5px;font-weight:700;color:var(--slate-700);margin-bottom:4px;">Ghi chú chi tiết (nếu có):</label>
        <input type="text" id="failNoteInput" placeholder="Ví dụ: Đã gọi 3 cuộc lúc 10h15 không nghe máy..." style="width:100%;padding:10px 12px;border:1px solid var(--slate-300);border-radius:8px;font-size:13px;">
      </div>

      <div style="display:flex;gap:10px;margin-top:16px;">
        <button type="button" onclick="document.getElementById('failModalOverlay').remove()" style="flex:1;padding:12px;background:var(--slate-100);color:var(--slate-700);border:none;border-radius:10px;font-weight:700;cursor:pointer;">Hủy</button>
        <button type="button" onclick="submitFailDelivery()" style="flex:2;padding:12px;background:var(--danger);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;">Xác nhận báo thất bại</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

let selectedReasonText = 'Không liên lạc được (Thuê bao / Không nghe máy)';
function selectFailReason(btn, text) {
  document.querySelectorAll('.reason-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedReasonText = text;
}

async function submitFailDelivery() {
  if (!activeFailOrderId) return;
  const note = document.getElementById('failNoteInput')?.value || '';
  try {
    await api(`Shipper/orders/${activeFailOrderId}/fail-delivery?shipperId=${currentShipperId}`, {
      method: 'POST',
      body: JSON.stringify({
        failReason: selectedReasonText,
        note
      })
    });
    toast('Đã ghi nhận báo cáo giao hàng thất bại.', 'info');
    document.getElementById('failModalOverlay')?.remove();
    loadOrders();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// ── 4. REALTIME SIGNALR CONNECTION ──────────────────────────
async function initSignalR() {
  if (typeof signalR === 'undefined' || trackingHubConnection) return;
  try {
    const token = localStorage.getItem('toyStoreToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
    trackingHubConnection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/order-tracking' + (token ? `?access_token=${encodeURIComponent(token)}` : ''))
      .withAutomaticReconnect()
      .build();

    trackingHubConnection.on('ReceiveNewOrderAssignment', data => {
      console.log('[SignalR Shipper] ReceiveNewOrderAssignment:', data);
      addShipperNotification({
        id: `assignment-${data.orderId || data.deliveryBatchCode || Date.now()}`,
        title: 'Đơn hàng đã được phân công',
        message: data.message || 'Bạn vừa được gán đơn giao hàng!',
        type: 'assignment'
      });
      loadOrders();
    });

    trackingHubConnection.on('ReceiveNewOrderCreated', data => {
      console.log('[SignalR Shipper] ReceiveNewOrderCreated:', data);
      const orderCode = data.orderCode || data.orderId || '';
      addShipperNotification({
        id: `new-order-${data.orderId || orderCode || Date.now()}`,
        title: 'Có đơn hàng mới chờ điều phối',
        message: data.message || `Đơn #${orderCode} vừa phát sinh.`,
        type: 'new',
        createdAt: data.createdAt
      });
    });

    trackingHubConnection.onreconnected(async () => {
      try {
        await trackingHubConnection.invoke('JoinShipper', currentShipperId);
        await trackingHubConnection.invoke('JoinNewOrderNotifications');
        loadOrders();
        toast('Đã kết nối lại kênh thông báo đơn hàng.', 'success');
      } catch (e) {
        console.warn('[SignalR Shipper] Không thể tham gia lại nhóm thông báo:', e.message);
      }
    });

    await trackingHubConnection.start();
    await trackingHubConnection.invoke('JoinShipper', currentShipperId);
    await trackingHubConnection.invoke('JoinNewOrderNotifications');
    console.log('[SignalR Shipper] Đã kết nối kênh phân chuyến thành công.');
  } catch (e) {
    console.warn('[SignalR Shipper] Lỗi kết nối SignalR:', e.message);
  }
}

document.getElementById('shipperLogoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('toyStoreToken');
  localStorage.removeItem('toyStoreUser');
  localStorage.removeItem('toyStoreShipperId');
  location.replace('/customer.html');
});

document.getElementById('shipperNotificationBtn')?.addEventListener('click', () => {
  toggleShipperNotificationPanel();
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
});

document.getElementById('clearShipperNotificationsBtn')?.addEventListener('click', clearShipperNotifications);

document.addEventListener('click', event => {
  if (!event.target.closest('.shipper-notification-menu')) closeShipperNotificationPanel();
});

window.onload = loadShipperProfiles;
