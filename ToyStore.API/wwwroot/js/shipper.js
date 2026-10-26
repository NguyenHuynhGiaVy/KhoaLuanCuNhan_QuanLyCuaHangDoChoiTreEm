// ============================================================
// TOYSTORE SHIPPER PORTAL CLIENT JAVASCRIPT
// Chuẩn hóa quy trình 5 bước thực tế & Siết chặt RBAC 2026
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

const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = v => v == null ? '0 đ' : Number(v).toLocaleString('vi-VN') + ' đ';
const fmtDateTime = s => s ? new Date(s).toLocaleString('vi-VN') : '—';
const shipperNotificationStorageKey = () => `toyStoreShipperNotifications:${currentShipperId || 'me'}`;
const canSelectShipper = ['admin', 'manager', 'staff'].includes(userRole);
const selectedShipperQuery = () => currentShipperId ? `?shipperId=${encodeURIComponent(currentShipperId)}` : '';

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
    // Nếu chưa liên kết shipper
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
  if (activeTab === 'wallet') renderWallet(document.getElementById('tabContent'));
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
  if (subEl) subEl.textContent = `SĐT: ${shipper.phoneNumber} · Biển số xe: ${shipper.vehicleNumber || '—'} · Tuyến: ${shipper.assignedArea || 'Linh hoạt'}`;
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
    // API tự động giới hạn chỉ trả về đơn của chính shipper này theo Token
    allOrders = await api(`Shipper/my-orders${selectedShipperQuery()}`);
    renderCurrentTab();
  } catch (err) {
    if (container) {
      container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--danger);">Lỗi tải đơn hàng: ${esc(err.message)}</div>`;
    }
  }
}

function renderCurrentTab() {
  // Đơn đang cần shipper xử lý; đơn đã giao thành công nằm trong lịch sử và ví COD.
  const activeOrders = allOrders.filter(o => {
    const st = Number(o.shipping?.status ?? 0);
    return st === 0 || st === 1 || st === 2 || st === 3;
  });

  // Trạng thái lịch sử: hoàn tất giao hoặc giao thất bại/hoàn hàng.
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

function renderWorkflowStepper(shippingStatus, isCod, codStatus) {
  // 5 bước chuẩn hóa:
  // 1. Nhận đơn (status >= 1)
  // 2. Đến cửa hàng nhận hàng (status >= 2)
  // 3. Giao hàng cho KH (status >= 3)
  // 4. Nhận tiền / Giao thành công (status == 4 hoặc order status == 4)
  // 5. Shipper đã báo nộp (2) hoặc admin xác nhận tiền vào quỹ (3).
  const s = Number(shippingStatus || 0);
  const step1Done = s >= 1;
  const step2Done = s >= 2;
  const step3Done = s >= 3;
  const step4Done = s >= 4;
  const step5Done = isCod ? (codStatus >= 2) : step4Done;

  return `
    <div class="workflow-stepper">
      <div class="step-item ${step1Done ? (s === 1 ? 'active' : 'done') : ''}">
        <div class="step-num">${step1Done && s > 1 ? '✓' : '1'}</div>
        <div class="step-text">Nhận đơn</div>
      </div>
      <div class="step-item ${step2Done ? (s === 2 ? 'active' : 'done') : ''}">
        <div class="step-num">${step2Done && s > 2 ? '✓' : '2'}</div>
        <div class="step-text">Lấy hàng tại kho</div>
      </div>
      <div class="step-item ${step3Done ? (s === 3 ? 'active' : 'done') : ''}">
        <div class="step-num">${step3Done && s > 3 ? '✓' : '3'}</div>
        <div class="step-text">Giao cho KH</div>
      </div>
      <div class="step-item ${step4Done ? (s === 4 && !step5Done ? 'active' : 'done') : ''}">
        <div class="step-num">${step4Done ? '✓' : '4'}</div>
        <div class="step-text">${isCod ? 'Thu tiền COD' : 'Giao thành công'}</div>
      </div>
      <div class="step-item ${step5Done ? 'done' : ''}">
        <div class="step-num">${step5Done ? '✓' : '5'}</div>
        <div class="step-text">Nộp tiền về shop</div>
      </div>
    </div>
  `;
}

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
      <section style="margin-bottom:18px;padding:14px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 2px 8px;">
          <strong style="font-size:14px;color:#3730a3;">📦 Lô ${esc(group.batchCode)}</strong>
          <span style="font-size:12px;color:#4338ca;font-weight:700;">${group.orders.length} đơn · ${totalItems} sản phẩm</span>
        </div>
        <div style="font-size:12px;line-height:1.6;color:#3730a3;margin:0 2px 10px;">
          <b>Mặt hàng trong lô:</b> ${productSummary}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">${orderCards}</div>
      </section>
    `;
  }).join('');
}

function renderActiveOrders(orders, container) {
  if (!orders.length) {
    container.innerHTML = `
      <div style="background:white;border-radius:16px;padding:50px 20px;text-align:center;border:1px solid var(--slate-200);">
        <div style="font-size:48px;margin-bottom:12px;">🎉</div>
        <h3 style="font-size:17px;font-weight:700;color:var(--slate-800);">Hiện không có đơn nào đang cần xử lý</h3>
        <p style="font-size:13px;color:var(--slate-500);margin-top:4px;">Khi cửa hàng phân công đơn hoặc lô hàng mới, bạn sẽ nhận được thông báo ngay lập tức.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = renderOrdersGroupedByBatch(orders, renderActiveOrderCard);
}

function renderActiveOrderCard(order) {
    const shipping = order.shipping || {};
    const payment = order.payment || {};
    const isCod = payment.paymentMethod === 0;
    const st = Number(shipping.status || 0);

    const address = shipping.address || 'Chưa có địa chỉ';
    const receiverName = shipping.receiverName || order.customerName || 'Khách nhận';
    const receiverPhone = shipping.receiverPhone || order.phoneNumber || '';
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('123 Nguyễn Thị Minh Khai, Quận 1, TP.HCM')}&destination=${encodeURIComponent(address)}`;

    let statusBadge = '';
    if (st === 0) statusBadge = `<span class="badge" style="background:#fef3c7;color:#92400e;font-weight:700;font-size:11.5px;padding:3px 8px;border-radius:6px;">Chờ bạn nhận đơn</span>`;
    else if (st === 1) statusBadge = `<span class="badge" style="background:#fef3c7;color:#92400e;font-weight:700;font-size:11.5px;padding:3px 8px;border-radius:6px;">Đã nhận đơn - chờ lấy hàng</span>`;
    else if (st === 2) statusBadge = `<span class="badge" style="background:#ecfdf5;color:#047857;font-weight:700;font-size:11.5px;padding:3px 8px;border-radius:6px;">Đã lấy hàng - Sẵn sàng giao</span>`;
    else if (st === 3) statusBadge = `<span class="badge" style="background:#e0e7ff;color:#3730a3;font-weight:700;font-size:11.5px;padding:3px 8px;border-radius:6px;">⚡ Đang trên đường giao cho KH</span>`;
    else statusBadge = `<span class="badge" style="background:#f1f5f9;color:#475569;font-weight:700;font-size:11.5px;padding:3px 8px;border-radius:6px;">Đang xử lý</span>`;

    return `
      <div class="order-card in-transit" id="orderCard_${order.orderId}">
        <div class="card-top">
          <div>
            <div class="order-code">#${esc(order.orderCode || order.orderId)}</div>
            ${shipping.deliveryBatchCode ? `<span class="batch-tag">📦 Lô: ${esc(shipping.deliveryBatchCode)}</span>` : ''}
          </div>
          <div>${statusBadge}</div>
        </div>

        ${renderWorkflowStepper(st, isCod, payment.codStatus)}

        <div class="customer-info">
          <div class="customer-name">
            <span>👤 ${esc(receiverName)}</span>
            ${receiverPhone ? `<a href="tel:${esc(receiverPhone)}" class="customer-phone-btn">📞 ${esc(receiverPhone)}</a>` : ''}
          </div>
          <div class="customer-address">
            <span>📍</span>
            <div>${esc(address)}</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:4px;">
            <a href="${mapsUrl}" target="_blank" class="maps-link-btn">
              <span>🗺️ Chỉ đường Google Maps</span>
              <span>↗</span>
            </a>
            <button type="button" class="secondary-btn" style="padding:4px 10px;font-size:11.5px;" onclick="viewOrderTrackingLogs(${order.orderId})">
              📜 Lịch sử hành trình
            </button>
          </div>
        </div>

        <div class="cod-box">
          <span class="cod-label">${isCod ? '💵 CẦN THU TIỀN MẶT (COD)' : '💳 ĐÃ THANH TOÁN ONLINE'}</span>
          <span class="cod-amount">${isCod ? money(order.finalAmount || order.totalAmount) : '0 đ'}</span>
        </div>

        ${shipping.failReason ? `
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:12px;">
            <strong>⚠️ Lần giao trước thất bại:</strong> ${esc(shipping.failReason)} (Đã thử: ${shipping.attemptCount || 1}/3)
          </div>
        ` : ''}

        <!-- Nút hành động tương ứng từng bước trong quy trình -->
        <div class="card-actions">
          ${st === 0 ? `
            <button class="btn-action btn-start" onclick="acceptOrder(${order.orderId})">
              <span>📥 Bước 1: Nhận đơn hàng</span>
            </button>
          ` : st === 1 ? `
            <button class="btn-action btn-start" onclick="pickupOrder(${order.orderId})">
              <span>🏬 Bước 2: Đến cửa hàng nhận hàng</span>
            </button>
          ` : st === 2 ? `
            <button class="btn-action btn-start" onclick="startDelivery(${order.orderId})">
              <span>🚀 Bước 3: Xuất phát giao cho KH</span>
            </button>
          ` : `
            <button class="btn-action btn-fail" onclick="openFailModal(${order.orderId})">
              <span>✕ Giao thất bại</span>
            </button>
            <button class="btn-action btn-success" onclick="openCompleteDeliveryModal(${order.orderId}, ${isCod ? (order.finalAmount || order.totalAmount) : 0})">
              <span>✓ Bước 4: Giao thành công & Thu tiền</span>
            </button>
          `}
        </div>
      </div>
    `;
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

  container.innerHTML = renderOrdersGroupedByBatch(orders, renderHistoryOrderCard);
}

function renderHistoryOrderCard(order) {
    const shipping = order.shipping || {};
    const payment = order.payment || {};
    const isSuccess = Number(order.status) === 4 || shipping.status === 4;
    const receiverName = shipping.receiverName || order.customerName || 'Khách nhận';
    const isCod = payment.paymentMethod === 0;
    const codStatus = Number(payment.codStatus || 0);

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

        ${isSuccess && isCod ? `
          <div style="display:flex;justify-content:space-between;align-items:center;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;">
            <div>
              <span style="font-weight:700;color:#b45309;">COD khách trả: ${money(payment.amount || order.finalAmount || order.totalAmount)}</span>
              <span style="display:block;font-size:11px;color:#92400e;">Phí ship của bạn: ${money(shipping.shippingFee)} · Cần nộp shop: ${money(Math.max(0, Number(payment.amount || order.totalAmount || 0) - Number(shipping.shippingFee || 0)))}</span>
              <span style="display:block;font-size:11px;color:#92400e;">${codStatus === 3 ? '✅ Admin đã xác nhận tiền vào quỹ' : codStatus === 2 ? '🔎 Đã báo nộp, chờ admin kiểm tra' : '⏳ Đang giữ tiền COD'}</span>
            </div>
            ${codStatus === 1 ? `
              <button class="primary-btn" style="padding:4px 10px;font-size:11px;" onclick="submitCod(${order.orderId})">
                Bước 5: Gửi lại tiền shop
              </button>
            ` : ''}
          </div>
        ` : ''}

        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--slate-500);border-top:1px dashed var(--slate-200);padding-top:8px;">
          <button type="button" class="secondary-btn" style="padding:3px 8px;font-size:11px;" onclick="viewOrderTrackingLogs(${order.orderId})">
            📜 Xem lịch sử hành trình
          </button>
          <span style="font-weight:700;color:var(--slate-800);">${money(order.finalAmount || order.totalAmount)}</span>
        </div>
      </div>
    `;
}

// ── 3. VÍ COD CỦA SHIPPER (ĐỒNG NHẤT GIỮA CÁC MÁY TÍNH) ─────
async function renderWallet(container) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-400);">Đang tổng hợp ví COD của bạn...</div>';

  try {
    // API /api/Shipper/cod-reconciliation với Policy ShipperAccess đã sửa
    const codList = await api(`Shipper/cod-reconciliation${selectedShipperQuery()}`);
    const items = Array.isArray(codList) ? codList : [];

    const holdingAmount = items.filter(x => x.codStatus === 1).reduce((sum, x) => sum + (Number(x.storeAmount) || 0), 0);
    const pendingVerificationAmount = items.filter(x => x.codStatus === 2).reduce((sum, x) => sum + (Number(x.storeAmount) || 0), 0);
    const submittedAmount = items.filter(x => x.codStatus === 3).reduce((sum, x) => sum + (Number(x.storeAmount) || 0), 0);
    const shippingEarnings = items.reduce((sum, x) => sum + (Number(x.shippingFee) || 0), 0);
    const totalCollected = items.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);

    container.innerHTML = `
      <div class="wallet-card">
        <div class="wallet-title">💵 Tiền hàng cần cửa hàng đối soát</div>
        <div class="wallet-amount">${money(holdingAmount + pendingVerificationAmount)}</div>
        <div class="wallet-meta">
          <div>Chờ admin xác nhận: <b>${money(pendingVerificationAmount)}</b></div>
          <div>Đã vào quỹ shop: <b>${money(submittedAmount)}</b></div>
        </div>
        <div class="wallet-meta" style="margin-top:8px;">
          <div>Phí ship thuộc về bạn: <b>${money(shippingEarnings)}</b></div>
          <div>Tổng COD khách trả: <b>${money(totalCollected)}</b></div>
        </div>
        ${holdingAmount + pendingVerificationAmount > 0 ? `
          <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.2);padding-top:12px;font-size:12.5px;color:rgba(255,255,255,0.9);">
            ℹ️ Phí ship là thu nhập của bạn. Chỉ nộp cửa hàng phần tiền hàng; khoản đã báo nộp sẽ được tính vào quỹ sau khi admin xác nhận.
          </div>
        ` : ''}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin:20px 0 10px;">
        <h4 style="font-size:14px;font-weight:700;color:var(--slate-700);">Chi tiết các khoản thu tiền COD của bạn:</h4>
        <button class="secondary-btn" style="padding:4px 10px;font-size:11.5px;" onclick="renderWallet(document.getElementById('tabContent'))">🔄 Làm mới</button>
      </div>

      ${!items.length ? `
        <div style="background:white;border-radius:12px;padding:30px;text-align:center;border:1px solid var(--slate-200);color:var(--slate-400);">
          Bạn chưa có khoản thu COD nào phát sinh.
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${items.map(item => {
            const codStatus = Number(item.codStatus);
            return `
            <div style="background:white;border-radius:12px;border:1px solid var(--slate-200);padding:14px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <strong style="font-size:14px;color:var(--slate-900);">#${esc(item.orderCode)}</strong>
                  <div style="font-size:12px;color:var(--slate-600);margin-top:3px;">${(item.products || []).map(product => `${esc(product.productName)} × ${Number(product.quantity || 0)}`).join(', ') || 'Không có chi tiết sản phẩm'}</div>
                  <div style="font-size:12.5px;color:var(--slate-600);margin-top:2px;">Khách: ${esc(item.receiverName)} (${esc(item.receiverPhone)})</div>
                  <div style="font-size:11.5px;color:var(--slate-400);margin-top:2px;">Thu lúc: ${fmtDateTime(item.codCollectedAt)}</div>
                  <div style="font-size:11.5px;font-weight:700;margin-top:6px;color:${codStatus === 3 ? '#047857' : codStatus === 2 ? '#1d4ed8' : '#b45309'};">
                    ${codStatus === 3 ? '✅ Admin đã xác nhận đã nhận tiền' : codStatus === 2 ? '🔎 Đã báo nộp — chờ admin xác nhận' : codStatus === 1 ? '⏳ Đang giữ tiền — cần nộp về cửa hàng' : 'Chưa ghi nhận đã thu COD'}
                  </div>
                </div>
                <div style="text-align:right;">
                  <strong style="font-size:15px;color:#b45309;">Cần nộp: ${money(item.storeAmount)}</strong>
                  <div style="font-size:11px;color:var(--slate-500);">COD ${money(item.amount)} · Phí ship ${money(item.shippingFee)}</div>
                </div>
              </div>
              ${codStatus === 1 ? `
                <button type="button" class="primary-btn" style="display:block;width:100%;margin-top:12px;padding:10px 14px;font-size:13px;font-weight:700;" onclick="submitCod(${Number(item.orderId)})">
                  💸 Đã nộp tiền về cửa hàng — Báo admin xác nhận
                </button>
              ` : ''}
            </div>
          `}).join('')}
        </div>
      `}
    `;
  } catch (err) {
    container.innerHTML = `
      <div style="background:white;border-radius:12px;padding:30px;text-align:center;border:1px solid var(--slate-200);">
        <div style="font-size:32px;margin-bottom:8px;">⚠️</div>
        <div style="color:var(--danger);font-weight:700;">Không thể tải ví COD: ${esc(err.message)}</div>
        <p style="font-size:12px;color:var(--slate-500);margin-top:6px;">Vui lòng kiểm tra lại phiên đăng nhập hoặc nhấn nút thử lại.</p>
        <button class="primary-btn" style="margin-top:12px;padding:6px 14px;" onclick="renderWallet(document.getElementById('tabContent'))">Thử lại</button>
      </div>
    `;
  }
}

// ── 4. WORKFLOW ACTIONS (BƯỚC 1 ĐẾN BƯỚC 5) ───────────────────
// Bước 1: Nhận đơn
async function acceptOrder(orderId) {
  try {
    await api(`Shipper/orders/${orderId}/accept-order${selectedShipperQuery()}`, { method: 'POST' });
    toast('Đã xác nhận tiếp nhận đơn hàng!', 'success');
    loadOrders();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// Bước 2: Đến cửa hàng nhận hàng
async function pickupOrder(orderId) {
  try {
    await api(`Shipper/orders/${orderId}/pickup${selectedShipperQuery()}`, { method: 'POST' });
    toast('Đã xác nhận lấy hàng tại kho/cửa hàng!', 'success');
    loadOrders();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// Bước 3: Giao hàng cho KH
async function startDelivery(orderId) {
  try {
    await api(`Shipper/orders/${orderId}/start-delivery${selectedShipperQuery()}`, { method: 'POST' });
    toast('Đã bắt đầu lộ trình giao hàng tới khách!', 'success');
    loadOrders();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// Bước 4: Nhận tiền / Giao thành công (Kèm tải ảnh minh chứng giao hàng từ máy tính)
let completeModalState = { orderId: null, codAmount: 0, uploadedProofUrl: null };

function openCompleteDeliveryModal(orderId, codAmount) {
  completeModalState = { orderId, codAmount, uploadedProofUrl: null };

  const modal = document.createElement('div');
  modal.id = 'completeModalOverlay';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:440px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="font-size:16px;font-weight:800;color:var(--slate-900);">Bước 4: Xác nhận Giao Thành Công</h3>
        <button type="button" onclick="document.getElementById('completeModalOverlay').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--slate-400);">✕</button>
      </div>

      <div style="background:${codAmount > 0 ? '#fffbeb' : '#ecfdf5'};border:1px solid ${codAmount > 0 ? '#fde68a' : '#a7f3d0'};border-radius:10px;padding:12px;margin-bottom:14px;">
        ${codAmount > 0 ? `
          <div style="font-size:13px;color:#92400e;font-weight:700;">💵 CẦN THU TIỀN MẶT (COD):</div>
          <div style="font-size:20px;font-weight:800;color:#b45309;margin-top:2px;">${money(codAmount)}</div>
          <div style="font-size:11.5px;color:#92400e;margin-top:2px;">Bạn có chắc chắn đã nhận đủ số tiền mặt này từ khách hàng?</div>
        ` : `
          <div style="font-size:13px;color:#047857;font-weight:700;">💳 Đơn đã thanh toán trực tuyến: 0 đ</div>
          <div style="font-size:11.5px;color:#065f46;margin-top:2px;">Kiện hàng đã giao thành công tới tay người nhận.</div>
        `}
      </div>

      <!-- Tải ảnh minh chứng giao hàng trực tiếp từ máy tính/điện thoại -->
      <label style="display:block;font-size:12px;font-weight:700;color:var(--slate-700);margin-bottom:6px;">Ảnh chụp minh chứng giao hàng (Tùy chọn):</label>
      <div class="photo-upload-box" onclick="document.getElementById('proofFileInput').click()">
        <input type="file" id="proofFileInput" accept="image/*" style="display:none;" onchange="handleProofImageSelected(this)">
        <div style="font-size:24px;">📸</div>
        <div style="font-size:12.5px;font-weight:600;color:var(--primary);margin-top:4px;">Nhấn để chọn ảnh từ máy tính hoặc chụp ảnh</div>
        <div style="font-size:11px;color:var(--slate-400);">Hỗ trợ JPG, PNG, WEBP (Tối đa 10MB)</div>
        <img id="proofPreviewImg" class="photo-preview-img" alt="Xem trước minh chứng">
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--slate-700);margin-bottom:4px;">Ghi chú bàn giao (nếu có):</label>
        <input type="text" id="deliveryNoteInput" class="input-control" style="width:100%;padding:8px 12px;border:1px solid var(--slate-300);border-radius:8px;" placeholder="VD: Gửi bảo vệ / Khách nhận trực tiếp...">
      </div>

      <div style="display:flex;gap:8px;">
        <button type="button" class="secondary-btn" style="flex:1;padding:10px;" onclick="document.getElementById('completeModalOverlay').remove()">Hủy bỏ</button>
        <button type="button" class="btn-action btn-success" style="flex:2;padding:10px;justify-content:center;" onclick="submitCompleteDelivery()">
          ✓ Xác nhận hoàn thành
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

  // Tải lên server qua API UploadController
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
      res = await fetch('/api/Upload/image', {
        method: 'POST',
        body: formData
      });
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

// Bước 5: Gửi lại tiền cho cửa hàng
async function submitCod(orderId) {
  if (!confirm('Xác nhận đã bàn giao cho cửa hàng phần tiền hàng (không bao gồm phí ship thuộc về bạn)? Admin sẽ kiểm tra trước khi cộng tiền vào quỹ.')) return;

  try {
    await api(`Shipper/orders/${orderId}/submit-cod${selectedShipperQuery()}`, {
      method: 'POST',
      body: JSON.stringify({ note: 'Shipper đã nộp lại tiền mặt COD về cửa hàng' })
    });
    toast('Đã báo nộp tiền COD. Khoản tiền sẽ vào quỹ sau khi admin xác nhận.', 'success');
    loadOrders();
    if (activeTab === 'wallet') renderWallet(document.getElementById('tabContent'));
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// Báo cáo giao hàng thất bại
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
      <p style="font-size:13px;color:var(--slate-500);margin-bottom:12px;">Vui lòng chọn lý do chính xác để điều phối hỗ trợ xử lý:</p>

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
        <button class="reason-btn" onclick="selectFailReason(this, 'Sai địa chỉ hoặc khu vực không thể tiếp cận')">
          <span>📍</span> <span>Sai thông tin địa chỉ giao</span>
        </button>
      </div>

      <div style="margin-top:12px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--slate-700);margin-bottom:4px;">Ghi chú chi tiết thêm:</label>
        <input type="text" id="failNoteInput" class="input-control" style="width:100%;padding:8px 12px;border:1px solid var(--slate-300);border-radius:8px;" placeholder="Nhập ghi chú thêm...">
      </div>

      <div style="display:flex;gap:8px;margin-top:16px;">
        <button type="button" class="secondary-btn" style="flex:1;padding:10px;" onclick="document.getElementById('failModalOverlay').remove()">Hủy</button>
        <button type="button" class="btn-action btn-fail" style="flex:2;padding:10px;justify-content:center;" onclick="submitFailReport()">Gửi báo cáo</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

let selectedFailReasonText = 'Không liên lạc được (Thuê bao / Không nghe máy)';
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
    <div class="modal-content" style="max-width:500px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:16px;font-weight:800;color:var(--slate-900);">Lịch sử hành trình đơn #${orderId}</h3>
        <button type="button" onclick="document.getElementById('trackingModalOverlay').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--slate-400);">✕</button>
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
              👤 <b>${esc(log.performedByName || 'Hệ thống')}</b> (${esc(log.performedByRole || 'System')}) · 🕒 ${fmtDateTime(log.createdAt)}
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

// ── 6. REALTIME NOTIFICATIONS (SIGNALR) ──────────────────────
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

  trackingHubConnection.on('ReceiveOrderTrackingUpdate', data => {
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

// ── 7. INITIALIZATION ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('shipperSelector')?.addEventListener('change', event => {
    changeSelectedShipper(event.target.value);
  });

  document.getElementById('shipperLogoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('toyStoreToken');
    localStorage.removeItem('toyStoreUser');
    localStorage.removeItem('toyStoreShipperId');
    location.replace('/customer.html');
  });

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

  loadShipperProfile();
});
