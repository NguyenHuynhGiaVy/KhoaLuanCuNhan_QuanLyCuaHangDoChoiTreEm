/* ============================================================
   TOYSTORE ADMIN - admin.js
   Full In-Page CRUD Engine (No Dialogs) & Modern UI 2026
   ============================================================ */

'use strict';

// ── STATE ───────────────────────────────────────────────────
const app = document.getElementById('app');
let token = localStorage.getItem('toyStoreToken');
let currentUser = JSON.parse(localStorage.getItem('toyStoreUser') || 'null');
let currentView = 'dashboard';
let cache = {};
let ref = { categories: [], brands: [], suppliers: [], variants: [] };
let revenueChart = null;
let dashboardRefreshTimer = null;
let revenueChartPeriod = 'day30';
let revenueChartCustom = {
  groupBy: 'day',
  from: revenueDateInputValue(new Date(Date.now() - (29 * 86400000))),
  to: revenueDateInputValue(new Date())
};
let productVariantRowIndex = 0;
let supportChatConnection = null;
let selectedSupportConversationId = null;
let supportChatRefreshTimer = null;
const handledSupportMessageIds = new Set();

// ── MODULE DEFINITIONS ──────────────────────────────────────
const MODULES = {
  dashboard: { title: 'Tổng quan hệ thống', kicker: 'TỔNG QUAN' },
  products: {
    title: 'Sản phẩm', kicker: 'HÀNG HÓA & KHO',
    endpoint: 'Product',
    columns: ['Ảnh', 'Tên sản phẩm', 'Danh mục', 'Thương hiệu', 'Giá bán', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  liquidation: {
    title: 'Thanh lý hàng', kicker: 'HÀNG HÓA & KHO'
  },
  categories: {
    title: 'Danh mục', kicker: 'HÀNG HÓA & KHO',
    endpoint: 'Category',
    columns: ['Tên danh mục', 'Mô tả', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  brands: {
    title: 'Thương hiệu', kicker: 'HÀNG HÓA & KHO',
    endpoint: 'Brand',
    columns: ['Thương hiệu', 'Mô tả', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  inventory: {
    title: 'Tồn kho', kicker: 'HÀNG HÓA & KHO',
    endpoint: 'Inventory',
    columns: ['SKU', 'Sản phẩm', 'Tồn kho', 'Đã giữ', 'Có thể bán', 'Cập nhật'],
    canAdd: false, canEdit: true, canDelete: false
  },
  orders: {
    title: 'Đơn hàng', kicker: 'VẬN HÀNH & GIAO NHẬN',
    endpoint: 'Order',
    columns: ['Mã đơn', 'Khách hàng', 'SĐT', 'Ngày đặt', 'Lô giao', 'Shipper', 'Dự kiến giao', 'Giá trị', 'Thanh toán', 'Trạng thái'],
    canAdd: false, canEdit: true, canDelete: false
  },
  shippers: {
    title: 'Nhân viên giao hàng', kicker: 'VẬN HÀNH & GIAO NHẬN',
    endpoint: 'Shipper',
    columns: ['Họ và tên', 'Số điện thoại', 'Biển số xe', 'Tuyến phụ trách', 'Đang giao', 'Đã giao', 'Tiền COD đang giữ', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  cod: {
    title: 'Đối soát công nợ COD', kicker: 'VẬN HÀNH & GIAO NHẬN',
    endpoint: 'Shipper/cod-reconciliation',
    columns: ['Mã đơn', 'Người nhận', 'Số tiền COD', 'Shipper phụ trách', 'Mã lô', 'Thời điểm thu', 'Trạng thái COD'],
    canAdd: false, canEdit: false, canDelete: false
  },
  suppliers: {
    title: 'Nhà cung cấp', kicker: 'VẬN HÀNH & NHẬP HÀNG',
    endpoint: 'Supplier',
    columns: ['Nhà cung cấp', 'Số điện thoại', 'Email', 'Mã số thuế', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  imports: {
    title: 'Phiếu đặt hàng NCC', kicker: 'VẬN HÀNH & NHẬP HÀNG',
    endpoint: 'ImportReceipt',
    columns: ['Mã phiếu', 'Nhà cung cấp', 'Người đặt', 'Ngày đặt', 'Tổng tiền', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  promotions: {
    title: 'Khuyến mãi', kicker: 'MARKETING',
    endpoint: 'Promotion',
    columns: ['Tên chương trình', 'Sản phẩm áp dụng', 'Loại giảm giá', 'Giá trị', 'Thời gian áp dụng', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  vouchers: {
    title: 'Voucher', kicker: 'MARKETING',
    endpoint: 'Voucher',
    columns: ['Mã voucher', 'Tên voucher', 'Giá trị giảm', 'Đã dùng / giới hạn', 'Đơn tối thiểu', 'Hiệu lực', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  customers: {
    title: 'Khách hàng', kicker: 'KHÁCH HÀNG',
    endpoint: 'Customer',
    columns: ['Họ và tên', 'Email', 'Số điện thoại', 'Hạng TV', 'Tổng chi tiêu', 'Đơn hàng'],
    canAdd: false, canEdit: true, canDelete: false
  },
  customerCare: {
    title: 'Chăm sóc khách hàng', kicker: 'KHÁCH HÀNG'
  },
  users: {
    title: 'Phân quyền người dùng', kicker: 'HỆ THỐNG',
    endpoint: 'Auth/users',
    columns: ['Họ và tên', 'Email', 'Số điện thoại', 'Vai trò (Role)', 'Trạng thái'],
    canAdd: false, canEdit: true, canDelete: false
  }
};

const ORDER_STATUS_LABELS = ['Chờ xác nhận', 'Đã xác nhận', 'Đang xử lý', 'Đang giao', 'Hoàn tất', 'Đã hủy'];
const IMPORT_STATUS_MAP = {
  1: { label: 'Chờ duyệt', pill: 'warning' },
  2: { label: 'Đang nhập một phần', pill: 'info' },
  3: { label: 'Đã duyệt & Nhập kho', pill: 'success' },
  4: { label: 'Đã hủy', pill: 'danger' }
};

// ── UTILITIES ───────────────────────────────────────────────
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = v => v == null ? '—' : Number(v).toLocaleString('vi-VN') + ' đ';
const fmtDate = s => s ? new Date(s).toLocaleDateString('vi-VN') : '—';
const fmtDateTime = s => s ? new Date(s).toLocaleString('vi-VN') : '—';
const fmtDeliveryWindow = (from, to) => {
  if (!from) return 'Đang xác nhận';
  const formatDateOnly = value => {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : fmtDate(value);
  };
  const fromText = formatDateOnly(from);
  const toText = to ? formatDateOnly(to) : '';
  return toText && toText !== fromText ? `${fromText} – ${toText}` : fromText;
};
const productVariantsOf = product => product?.productVariants || product?.variants || [];
const hasAvailableStock = product => productVariantsOf(product)
  .some(variant => Number(variant.availableQuantity || 0) > 0);

function pill(text, type = 'neutral') {
  return `<span class="pill ${type}">${esc(text)}</span>`;
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.className = `toast ${type} show`;
  const icon = document.getElementById('toastIcon');
  if (icon) icon.textContent = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
  document.getElementById('toastMsg').textContent = msg;
  setTimeout(() => el.classList.remove('show'), 3500);
}

async function api(path, opt = {}) {
  const res = await fetch(`/api/${path}`, {
    ...opt,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opt.headers || {})
    }
  });
  if (res.status === 401) {
    localStorage.removeItem('toyStoreToken');
    localStorage.removeItem('toyStoreUser');
    location.replace('/customer.html');
    return null;
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Lỗi yêu cầu (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

async function checkApiStatus(notify = false) {
  const dot = document.getElementById('apiDot');
  const label = document.getElementById('apiLabel');
  try {
    const res = await fetch('/api/Health', { cache: 'no-store' });
    if (res.ok) {
      if (dot) dot.className = 'api-dot';
      if (label) label.textContent = 'API Online';
      if (notify) toast('Backend API hoạt động tốt!', 'success');
    } else {
      throw new Error();
    }
  } catch {
    if (dot) dot.className = 'api-dot offline';
    if (label) label.textContent = 'API Offline';
    if (notify) toast('Không thể kết nối đến Backend API', 'error');
  }
}

async function loadRef() {
  try {
    const [c, b, s, p] = await Promise.all([
      api('Category').catch(() => []),
      api('Brand').catch(() => []),
      api('Supplier').catch(() => []),
      api('Product').catch(() => [])
    ]);
    ref.categories = c || [];
    ref.brands = b || [];
    ref.suppliers = s || [];
    ref.products = p || [];
  } catch (err) {
    console.error('Failed to load reference data:', err);
  }
}

// ── NAVIGATION & ROUTING ────────────────────────────────────
function navigate() {
  const hash = location.hash.slice(1) || 'dashboard';
  currentView = hash;
  if (hash !== 'dashboard') stopDashboardRealtime();
  
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.view === hash);
  });
  
  const currentTitle = MODULES[hash]?.title || hash.toUpperCase();
  document.getElementById('breadcrumbCurrent').textContent = currentTitle;

  if (hash === 'dashboard') {
    renderDashboard();
  } else if (hash === 'liquidation') {
    renderLiquidation();
  } else if (hash === 'customer-care') {
    renderCustomerCare();
  } else {
    renderList(hash);
  }
}

window.addEventListener('hashchange', navigate);

// ── 1. DASHBOARD VIEW & FINANCIAL REPORTS (MỤC 5) ─────────────
let dashboardPeriod = '30days'; // 'today' | '7days' | '30days' | 'month' | 'year' | 'custom'
let dashboardDateRange = {
  from: revenueDateInputValue(new Date(Date.now() - (29 * 86400000))),
  to: revenueDateInputValue(new Date()),
  groupBy: 'day'
};

function revenueDateInputValue(date) {
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return localDate.toISOString().slice(0, 10);
}

function getDashboardDates() {
  const today = new Date();
  if (dashboardPeriod === 'today') {
    const t = revenueDateInputValue(today);
    return { from: t, to: t, groupBy: 'day', label: 'Hôm nay' };
  }
  if (dashboardPeriod === '7days') {
    const f = revenueDateInputValue(new Date(today.getTime() - (6 * 86400000)));
    const t = revenueDateInputValue(today);
    return { from: f, to: t, groupBy: 'day', label: '7 ngày qua' };
  }
  if (dashboardPeriod === '30days') {
    const f = revenueDateInputValue(new Date(today.getTime() - (29 * 86400000)));
    const t = revenueDateInputValue(today);
    return { from: f, to: t, groupBy: 'day', label: '30 ngày qua' };
  }
  if (dashboardPeriod === 'month') {
    const f = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const t = revenueDateInputValue(today);
    return { from: f, to: t, groupBy: 'day', label: `Tháng ${today.getMonth() + 1}/${today.getFullYear()}` };
  }
  if (dashboardPeriod === 'year') {
    const f = `${today.getFullYear()}-01-01`;
    const t = revenueDateInputValue(today);
    return { from: f, to: t, groupBy: 'month', label: `Năm ${today.getFullYear()}` };
  }
  // custom
  return {
    from: dashboardDateRange.from,
    to: dashboardDateRange.to,
    groupBy: dashboardDateRange.groupBy || 'day',
    label: `Từ ${dashboardDateRange.from} đến ${dashboardDateRange.to}`
  };
}

function revenueYAxisScale(values) {
  const highestValue = values.reduce((highest, value) => Math.max(highest, Number(value) || 0), 0);
  if (highestValue <= 0) return { max: 100000, stepSize: 10000 };

  const roughStep = highestValue / 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  const multiplier = [1, 1.25, 1.5, 2, 2.5, 5, 10].find(value => normalized <= value) || 10;
  const stepSize = multiplier * magnitude;

  return {
    max: Math.ceil(highestValue / stepSize) * stepSize,
    stepSize
  };
}

async function renderDashboard(refreshOnly = false) {
  if (!refreshOnly && revenueChart) {
    revenueChart.destroy();
    revenueChart = null;
  }

  const dateFilter = getDashboardDates();

  if (!refreshOnly) {
    app.innerHTML = `
      <!-- 1. DATE FILTER TOOLBAR -->
      <div class="dashboard-filter-bar">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-size:13px;font-weight:700;color:var(--slate-700);display:flex;align-items:center;gap:6px;">
            <span>📅</span> Kỳ báo cáo:
          </span>
          <div class="dashboard-filter-pills">
            <button type="button" class="dashboard-filter-btn ${dashboardPeriod === 'today' ? 'active' : ''}" onclick="setDashboardPeriod('today')">Hôm nay</button>
            <button type="button" class="dashboard-filter-btn ${dashboardPeriod === '7days' ? 'active' : ''}" onclick="setDashboardPeriod('7days')">7 ngày qua</button>
            <button type="button" class="dashboard-filter-btn ${dashboardPeriod === '30days' ? 'active' : ''}" onclick="setDashboardPeriod('30days')">30 ngày qua</button>
            <button type="button" class="dashboard-filter-btn ${dashboardPeriod === 'month' ? 'active' : ''}" onclick="setDashboardPeriod('month')">Tháng này</button>
            <button type="button" class="dashboard-filter-btn ${dashboardPeriod === 'year' ? 'active' : ''}" onclick="setDashboardPeriod('year')">Năm nay</button>
            <button type="button" class="dashboard-filter-btn ${dashboardPeriod === 'custom' ? 'active' : ''}" onclick="setDashboardPeriod('custom')">Tùy chọn...</button>
          </div>
        </div>

        ${dashboardPeriod === 'custom' ? `
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
            <select id="dashGroupBy" class="input-control" style="width:115px;padding:6px 10px;" onchange="updateDashDateRange('groupBy', this.value)">
              <option value="day" ${dashboardDateRange.groupBy === 'day' ? 'selected' : ''}>Theo ngày</option>
              <option value="month" ${dashboardDateRange.groupBy === 'month' ? 'selected' : ''}>Theo tháng</option>
              <option value="year" ${dashboardDateRange.groupBy === 'year' ? 'selected' : ''}>Theo năm</option>
            </select>
            <input type="date" id="dashFromDate" class="input-control" style="width:136px;padding:6px 10px;" value="${esc(dashboardDateRange.from)}" onchange="updateDashDateRange('from', this.value)">
            <span style="color:var(--slate-400);">→</span>
            <input type="date" id="dashToDate" class="input-control" style="width:136px;padding:6px 10px;" value="${esc(dashboardDateRange.to)}" onchange="updateDashDateRange('to', this.value)">
            <button type="button" class="primary-btn" style="padding:6px 14px;font-size:12.5px;" onclick="applyCustomDashboardRange()">Lọc</button>
          </div>
        ` : `
          <div style="font-size:12.5px;color:var(--slate-500);font-weight:600;">
            Đang lọc: <strong style="color:var(--primary);">${esc(dateFilter.label)}</strong>
          </div>
        `}
      </div>

      <!-- 2. 5 CORE KPI CARDS (MỤC 5) -->
      <div class="stats-grid-5">
        <!-- 1. Sản phẩm đã bán -->
        <div class="stat-card sold">
          <div class="stat-icon-wrap sold">🧸</div>
          <div class="stat-label">Sản phẩm đã bán</div>
          <div class="stat-value" id="kpiSoldQuantity">...</div>
          <div class="stat-sub" id="kpiInventorySub">Tồn kho hiện tại: ...</div>
        </div>

        <!-- 2. Thực thu (Đã thanh toán) -->
        <div class="stat-card paid">
          <div class="stat-icon-wrap paid">💵</div>
          <div class="stat-label">Thực thu (Tiền về quỹ)</div>
          <div class="stat-value" id="kpiPaidAmount" style="color:#059669;">...</div>
          <div class="stat-sub" id="kpiPaidSub">Online: ... · COD: ...</div>
        </div>

        <!-- 3. Chưa thanh toán (Công nợ & Chờ thu) -->
        <div class="stat-card unpaid">
          <div class="stat-icon-wrap unpaid">⏳</div>
          <div class="stat-label">Chưa thu / Công nợ</div>
          <div class="stat-value" id="kpiUnpaidAmount" style="color:#d97706;">...</div>
          <div class="stat-sub" id="kpiUnpaidSub">Shipper giữ: ... · Đang giao: ...</div>
        </div>

        <!-- 4. Doanh thu dự kiến -->
        <div class="stat-card expected">
          <div class="stat-icon-wrap expected">📈</div>
          <div class="stat-label">Doanh thu dự kiến</div>
          <div class="stat-value" id="kpiExpectedRevenue" style="color:#4f46e5;">...</div>
          <div class="stat-sub" id="kpiOrdersSub">... đơn hợp lệ trong kỳ</div>
        </div>

        <!-- 5. Vận hành & Logistics -->
        <div class="stat-card logistics">
          <div class="stat-icon-wrap logistics">🚚</div>
          <div class="stat-label">Giao hàng thành công</div>
          <div class="stat-value" id="kpiLogisticsRate" style="color:#db2777;">...</div>
          <div class="stat-sub" id="kpiLogisticsSub">Đang giao: ... · Hoàn: ...</div>
        </div>
      </div>

      <!-- 3. CHARTS & QUICK ACTIONS -->
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-bottom:28px;">
        <!-- Left: Revenue & Cashflow Chart -->
        <div class="panel" style="margin-bottom:0;">
          <div class="panel-header">
            <div class="panel-title-area">
              <h2 id="revenueChartTitle">Biểu đồ Doanh số bán & Thực thu theo kỳ</h2>
              <p>So sánh độ lệch giữa giá trị đơn hoàn tất và dòng tiền thực tế về quỹ <span id="dashboardLastUpdated"></span></p>
            </div>
            <div style="display:flex;align-items:center;gap:14px;">
              <span style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#6366f1;"></span> Doanh số bán</span>
              <span style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#10b981;"></span> Thực thu quỹ</span>
            </div>
          </div>
          <div style="padding:22px;">
            <canvas id="revenueChartCanvas" height="155"></canvas>
          </div>
        </div>

        <!-- Right: Quick actions -->
        <div class="panel" style="margin-bottom:0;">
          <div class="panel-header">
            <div class="panel-title-area">
              <h2>Nghiệp vụ vận hành</h2>
              <p>Phím tắt thao tác nhanh</p>
            </div>
          </div>
          <div style="padding:18px;display:flex;flex-direction:column;gap:10px;">
            <button class="primary-btn" onclick="showForm('products')"><span>+</span> Thêm sản phẩm & biến thể</button>
            <button class="success-btn" onclick="showForm('imports')"><span>📦</span> Tạo phiếu đặt hàng NCC</button>
            <button class="secondary-btn" onclick="location.hash='#orders'"><span>↗</span> Quản lý & Gán Shipper đơn hàng</button>
            <button class="secondary-btn" onclick="location.hash='#cod'"><span>💰</span> Đối soát công nợ COD Shipper</button>
            <button class="secondary-btn" onclick="location.hash='#inventory'"><span>▤</span> Quản lý tồn kho & Cảnh báo</button>
            <button class="secondary-btn" onclick="window.open('/shipper.html','_blank')"><span>🛵</span> Mở cổng Shipper App ↗</button>
          </div>
        </div>
      </div>

      <!-- 4. CASHFLOW BREAKDOWN & CATEGORY REVENUE -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;">
        <!-- Left: Cashflow Breakdown -->
        <div class="panel" style="margin-bottom:0;">
          <div class="panel-header">
            <div class="panel-title-area">
              <h2>💳 Phân bổ cơ cấu Dòng tiền trong kỳ</h2>
              <p>Minh bạch trạng thái thanh toán và công nợ</p>
            </div>
          </div>
          <div style="padding:20px;" id="cashflowBreakdownContainer">
            <p style="text-align:center;color:var(--slate-400);padding:20px 0;">Đang tính toán dòng tiền...</p>
          </div>
        </div>

        <!-- Right: Category Revenue Share -->
        <div class="panel" style="margin-bottom:0;">
          <div class="panel-header">
            <div class="panel-title-area">
              <h2>🧸 Doanh thu theo Danh mục sản phẩm</h2>
              <p>Top danh mục đồ chơi đóng góp doanh số cao nhất</p>
            </div>
          </div>
          <div style="padding:20px;" id="categoryRevenueContainer">
            <p style="text-align:center;color:var(--slate-400);padding:20px 0;">Đang tải doanh thu danh mục...</p>
          </div>
        </div>
      </div>

      <!-- 5. SHIPPER LOGISTICS PERFORMANCE TABLE -->
      <div class="panel" style="margin-bottom:28px;">
        <div class="panel-header">
          <div class="panel-title-area">
            <h2>🚚 Hiệu suất giao hàng của đội ngũ Shipper</h2>
            <p>Theo dõi năng suất giao nhận và tiền mặt COD tài xế đang giữ</p>
          </div>
          <button class="secondary-btn" onclick="location.hash='#cod'">Đi đến Đối soát COD →</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Họ và tên Shipper</th>
                <th>Số điện thoại</th>
                <th>Biển số xe</th>
                <th style="text-align:center;">Đơn được gán</th>
                <th style="text-align:center;">Giao thành công</th>
                <th style="text-align:center;">Giao thất bại</th>
                <th style="text-align:center;">Tỷ lệ thành công</th>
                <th style="text-align:right;">COD đang giữ</th>
                <th style="text-align:right;">COD đã nộp</th>
                <th style="text-align:center;">Thao tác</th>
              </tr>
            </thead>
            <tbody id="dashShipperBody">
              <tr><td colspan="10" style="text-align:center;padding:26px;color:var(--slate-400);">Đang tải hiệu suất tài xế...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 6. TOP BEST-SELLING PRODUCTS & RECENT ORDERS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;">
        <!-- Left: Best Selling Products -->
        <div class="panel" style="margin-bottom:0;">
          <div class="panel-header">
            <div class="panel-title-area">
              <h2>🏆 Top 5 Sản phẩm bán chạy nhất</h2>
              <p>Xếp theo số lượng đã bán trong kỳ</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Danh mục</th>
                  <th style="text-align:center;">Đã bán</th>
                  <th style="text-align:right;">Doanh thu</th>
                </tr>
              </thead>
              <tbody id="dashBestSellingBody">
                <tr><td colspan="4" style="text-align:center;padding:24px;color:var(--slate-400);">Đang tải...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right: Recent Orders -->
        <div class="panel" style="margin-bottom:0;">
          <div class="panel-header">
            <div class="panel-title-area">
              <h2>📦 Đơn hàng phát sinh gần đây</h2>
              <p>Các đơn hàng mới nhất cần xử lý</p>
            </div>
            <button class="secondary-btn" onclick="location.hash='#orders'">Xem tất cả →</button>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="dashOrdersBody">
                <tr><td colspan="5" style="text-align:center;padding:24px;color:var(--slate-400);">Đang tải...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  try {
    const { from, to, groupBy } = getDashboardDates();
    const queryParams = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

    const [summary, report, bestSelling, orders] = await Promise.all([
      api(`Dashboard/summary?${queryParams}`).catch(() => null),
      api(`Dashboard/financial-report?${queryParams}&groupBy=${groupBy}`).catch(() => null),
      api(`Dashboard/best-selling?top=5&${queryParams}`).catch(() => []),
      api('Order').catch(() => [])
    ]);

    if (currentView !== 'dashboard') return;

    // 1. Update 5 KPI Cards
    if (summary) {
      const soldEl = document.getElementById('kpiSoldQuantity');
      if (soldEl) soldEl.textContent = `${(summary.totalSoldQuantity || 0).toLocaleString('vi-VN')} cái`;
      const invSub = document.getElementById('kpiInventorySub');
      if (invSub) invSub.textContent = `Tồn kho: ${(summary.currentInventoryQuantity || 0).toLocaleString('vi-VN')} sp (${summary.lowStockCount || 0} mã sắp hết)`;

      const paidEl = document.getElementById('kpiPaidAmount');
      if (paidEl) paidEl.textContent = money(summary.paidAmount);
      const paidSub = document.getElementById('kpiPaidSub');
      if (paidSub) paidSub.textContent = `Online: ${money(summary.onlinePaidAmount)} · COD: ${money(summary.codSubmittedAmount)}`;

      const unpaidEl = document.getElementById('kpiUnpaidAmount');
      if (unpaidEl) unpaidEl.textContent = money(summary.unpaidAmount);
      const unpaidSub = document.getElementById('kpiUnpaidSub');
      if (unpaidSub) unpaidSub.textContent = `Shipper giữ: ${money(summary.codHoldingAmount)} · Đang giao: ${money(summary.pendingCollectionAmount)}`;

      const expEl = document.getElementById('kpiExpectedRevenue');
      if (expEl) expEl.textContent = money(summary.expectedRevenue);
      const ordSub = document.getElementById('kpiOrdersSub');
      if (ordSub) ordSub.textContent = `${summary.totalOrders || 0} đơn hợp lệ (Hoàn tất: ${summary.completedOrders || 0} · Hủy: ${summary.cancelledOrders || 0})`;

      const rateEl = document.getElementById('kpiLogisticsRate');
      if (rateEl) rateEl.textContent = `${summary.deliverySuccessRate || 100}%`;
      const logSub = document.getElementById('kpiLogisticsSub');
      if (logSub) logSub.textContent = `Đang giao: ${summary.shippingOrders || 0} · Tỷ lệ hoàn: ${summary.returnRate || 0}%`;
    }

    // 2. Render Chart (Doanh số vs Thực thu)
    const ctx = document.getElementById('revenueChartCanvas')?.getContext('2d');
    if (ctx && report && report.items && report.items.length > 0) {
      if (revenueChart) revenueChart.destroy();
      const labels = report.items.map(it => it.periodLabel);
      const grossData = report.items.map(it => it.grossRevenue);
      const paidData = report.items.map(it => it.paidAmount);
      const yAxisScale = revenueYAxisScale(grossData.concat(paidData));

      revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Doanh số bán (VNĐ)',
              data: grossData,
              backgroundColor: '#6366f1',
              hoverBackgroundColor: '#4f46e5',
              borderRadius: 6,
              maxBarThickness: labels.length > 15 ? 18 : 36
            },
            {
              label: 'Thực thu về quỹ (VNĐ)',
              data: paidData,
              backgroundColor: '#10b981',
              hoverBackgroundColor: '#059669',
              borderRadius: 6,
              maxBarThickness: labels.length > 15 ? 18 : 36
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.dataset.label}: ${Number(context.parsed.y || 0).toLocaleString('vi-VN')} đ`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: yAxisScale.max,
              ticks: {
                stepSize: yAxisScale.stepSize,
                maxTicksLimit: 10,
                callback: v => Number(v).toLocaleString('vi-VN') + ' đ'
              },
              grid: { color: '#f1f5f9' }
            },
            x: {
              grid: { display: false },
              ticks: { autoSkip: true, maxTicksLimit: labels.length > 15 ? 10 : 12 }
            }
          }
        }
      });
    }

    // 3. Render Cashflow Breakdown
    const cashflowEl = document.getElementById('cashflowBreakdownContainer');
    if (cashflowEl && summary) {
      const gross = Math.max(1, (summary.paidAmount + summary.unpaidAmount) || summary.expectedRevenue || summary.totalRevenue || 1);
      const pctOnline = Math.min(100, Math.round(((summary.onlinePaidAmount || 0) / gross) * 100));
      const pctCodSub = Math.min(100, Math.round(((summary.codSubmittedAmount || 0) / gross) * 100));
      const pctCodHold = Math.min(100, Math.round(((summary.codHoldingAmount || 0) / gross) * 100));
      const pctPending = Math.min(100, Math.round(((summary.pendingCollectionAmount || 0) / gross) * 100));

      cashflowEl.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">
              <span>🌐 Thực thu Online (ZaloPay / Chuyển khoản):</span>
              <span style="color:#2563eb;">${money(summary.onlinePaidAmount)} (${pctOnline}%)</span>
            </div>
            <div class="cashflow-progress-bar">
              <div class="cashflow-progress-fill" style="width:${pctOnline}%;background:#2563eb;"></div>
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">
              <span>🏢 Thực thu COD đã nộp về quỹ shop:</span>
              <span style="color:#059669;">${money(summary.codSubmittedAmount)} (${pctCodSub}%)</span>
            </div>
            <div class="cashflow-progress-bar">
              <div class="cashflow-progress-fill" style="width:${pctCodSub}%;background:#059669;"></div>
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">
              <span>🛵 Tiền COD Shipper đang giữ (Công nợ):</span>
              <span style="color:#d97706;">${money(summary.codHoldingAmount)} (${pctCodHold}%)</span>
            </div>
            <div class="cashflow-progress-bar">
              <div class="cashflow-progress-fill" style="width:${pctCodHold}%;background:#d97706;"></div>
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">
              <span>⏳ Tiền chờ thu (Đơn đang đóng gói / đang giao):</span>
              <span style="color:#64748b;">${money(summary.pendingCollectionAmount)} (${pctPending}%)</span>
            </div>
            <div class="cashflow-progress-bar">
              <div class="cashflow-progress-fill" style="width:${pctPending}%;background:#94a3b8;"></div>
            </div>
          </div>
        </div>
      `;
    }

    // 4. Render Category Revenue
    const catEl = document.getElementById('categoryRevenueContainer');
    if (catEl && report && report.categoryRevenues) {
      if (report.categoryRevenues.length === 0) {
        catEl.innerHTML = `<p style="text-align:center;padding:20px;color:var(--slate-400);">Chưa có dữ liệu danh mục trong kỳ này.</p>`;
      } else {
        catEl.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:14px;">
            ${report.categoryRevenues.map(cat => `
              <div>
                <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:2px;">
                  <span>${esc(cat.categoryName)} <small style="color:var(--slate-400);font-weight:400;">(${cat.soldQuantity} đã bán)</small></span>
                  <span style="color:var(--primary);">${money(cat.revenue)} (${cat.percentage}%)</span>
                </div>
                <div class="cashflow-progress-bar">
                  <div class="cashflow-progress-fill" style="width:${cat.percentage}%;background:linear-gradient(90deg, #6366f1, #a855f7);"></div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }

    // 5. Render Shipper Performance Table
    const shipBody = document.getElementById('dashShipperBody');
    if (shipBody && report && report.shipperPerformances) {
      if (report.shipperPerformances.length === 0) {
        shipBody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:26px;color:var(--slate-400);">Chưa có đơn hàng nào phân công cho Shipper trong kỳ này.</td></tr>`;
      } else {
        shipBody.innerHTML = report.shipperPerformances.map(s => `
          <tr>
            <td><strong>${esc(s.fullName)}</strong></td>
            <td><a href="tel:${esc(s.phoneNumber)}" style="color:var(--primary);text-decoration:none;">📞 ${esc(s.phoneNumber)}</a></td>
            <td><span class="pill" style="background:#f1f5f9;color:#334155;">${esc(s.vehicleNumber || 'Chưa có')}</span></td>
            <td style="text-align:center;"><strong>${s.totalAssigned}</strong></td>
            <td style="text-align:center;"><span style="color:#059669;font-weight:700;">${s.completedDeliveries}</span></td>
            <td style="text-align:center;"><span style="color:#dc2626;font-weight:700;">${s.failedDeliveries}</span></td>
            <td style="text-align:center;"><span class="pill ${s.successRate >= 90 ? 'success' : (s.successRate >= 70 ? 'info' : 'danger')}">${s.successRate}%</span></td>
            <td style="text-align:right;"><strong style="color:#d97706;">${money(s.codHoldingAmount)}</strong></td>
            <td style="text-align:right;"><strong style="color:#059669;">${money(s.codSubmittedAmount)}</strong></td>
            <td style="text-align:center;">
              <button class="secondary-btn" style="padding:4px 10px;font-size:11.5px;" onclick="location.hash='#cod'">Đối soát</button>
            </td>
          </tr>
        `).join('');
      }
    }

    // 6. Render Top Best-Selling Products
    const bestBody = document.getElementById('dashBestSellingBody');
    if (bestBody) {
      if (!bestSelling || bestSelling.length === 0) {
        bestBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--slate-400);">Chưa có sản phẩm bán ra trong kỳ.</td></tr>`;
      } else {
        bestBody.innerHTML = bestSelling.map((p, idx) => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-weight:800;color:var(--slate-400);width:16px;">#${idx + 1}</span>
                <img src="${esc(p.productImageUrl || 'https://placehold.co/60x60?text=Toy')}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:1px solid #e2e8f0;">
                <div>
                  <strong style="font-size:13px;display:block;">${esc(p.productName)}</strong>
                  <small style="color:var(--slate-400);">SKU: ${esc(p.sku)}</small>
                </div>
              </div>
            </td>
            <td><span class="pill info" style="font-size:11px;">${esc(p.categoryName || 'Đồ chơi')}</span></td>
            <td style="text-align:center;"><strong>${(p.totalQuantitySold || 0).toLocaleString('vi-VN')}</strong></td>
            <td style="text-align:right;"><strong style="color:var(--primary);">${money(p.totalRevenue)}</strong></td>
          </tr>
        `).join('');
      }
    }

    // 7. Render Recent Orders
    const dashBody = document.getElementById('dashOrdersBody');
    if (dashBody) {
      const recent = (orders || []).slice(0, 5);
      if (recent.length === 0) {
        dashBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--slate-400);">Chưa có đơn hàng nào.</td></tr>`;
      } else {
        dashBody.innerHTML = recent.map(o => `
          <tr>
            <td><strong>#${esc(o.orderCode || o.orderId)}</strong></td>
            <td>${esc(o.customerName || o.shipping?.receiverName || 'Khách vãng lai')}</td>
            <td><strong style="color:var(--primary);">${money(o.finalAmount || o.totalAmount)}</strong></td>
            <td>${pill(ORDER_STATUS_LABELS[o.status] || 'Đang xử lý', o.status === 4 ? 'success' : (o.status === 5 ? 'danger' : 'warning'))}</td>
            <td style="text-align:right;">
              <button class="icon-action-btn view" title="Xem chi tiết" onclick="showOrderDetail(${o.orderId})">👁</button>
            </td>
          </tr>
        `).join('');
      }
    }

    const stamp = document.getElementById('dashboardLastUpdated');
    if (stamp) stamp.textContent = `· Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}`;
    startDashboardRealtime();
  } catch (err) {
    console.error('[Dashboard Error]:', err);
  }
}

function stopDashboardRealtime() {
  if (dashboardRefreshTimer) {
    clearInterval(dashboardRefreshTimer);
    dashboardRefreshTimer = null;
  }
}

function startDashboardRealtime() {
  if (dashboardRefreshTimer) return;
  dashboardRefreshTimer = setInterval(() => {
    if (currentView === 'dashboard' && document.visibilityState === 'visible') {
      renderDashboard(true);
    }
  }, 10000);
}

window.setDashboardPeriod = function(period) {
  dashboardPeriod = period;
  if (revenueChart) {
    revenueChart.destroy();
    revenueChart = null;
  }
  renderDashboard();
};

window.updateDashDateRange = function(field, val) {
  if (field in dashboardDateRange) dashboardDateRange[field] = val;
};

window.applyCustomDashboardRange = function() {
  if (!dashboardDateRange.from || !dashboardDateRange.to) {
    toast('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc.', 'error');
    return;
  }
  if (dashboardDateRange.from > dashboardDateRange.to) {
    toast('Ngày kết thúc phải lớn hơn ngày bắt đầu.', 'error');
    return;
  }
  if (revenueChart) {
    revenueChart.destroy();
    revenueChart = null;
  }
  renderDashboard();
};

// ── 1B. LIQUIDATION MANAGEMENT ──────────────────────────────
const LIQUIDATION_STALE_DAYS = 90;

function dayAge(dateValue) {
  const value = new Date(dateValue);
  if (Number.isNaN(value.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86400000));
}

function dateInputValue(dateValue) {
  const date = new Date(dateValue);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

async function renderLiquidation() {
  app.innerHTML = `<div class="panel"><div style="padding:42px;text-align:center;color:var(--slate-500);">Đang phân tích hàng cần thanh lý...</div></div>`;

  try {
    const [products, inventories, promotions, liquidationReceipts] = await Promise.all([
      api('Product'),
      api('Inventory'),
      api('Promotion').catch(() => []),
      api('Liquidation')
    ]);
    if (currentView !== 'liquidation') return;

    const now = new Date();
    const promotedVariantIds = new Set((promotions || [])
      .filter(promotion => Number(promotion.status) === 1
        && new Date(promotion.startDate) <= now
        && new Date(promotion.endDate) >= now)
      .flatMap(promotion => (promotion.promotionProducts || [])
        .map(item => String(item.variantId))));

    const candidates = (inventories || []).map(inventory => {
      const product = (products || []).find(item => productVariantsOf(item)
        .some(variant => Number(variant.variantId || variant.id) === Number(inventory.variantId)));
      const variant = product ? productVariantsOf(product)
        .find(item => Number(item.variantId || item.id) === Number(inventory.variantId)) : null;
      if (!product || !variant) return null;

      const availableQuantity = Math.max(0, Number(inventory.availableQuantity ??
        (Number(inventory.quantity || 0) - Number(inventory.reservedQuantity || 0))));
      const stockAge = dayAge(inventory.updatedAt);
      const isLiquidationStatus = Number(product.status) === 2;
      const isLongStock = stockAge >= LIQUIDATION_STALE_DAYS;
      if (availableQuantity <= 0 || (!isLiquidationStatus && !isLongStock)) return null;

      return {
        productId: product.productId,
        variantId: Number(variant.variantId || variant.id),
        productName: product.name,
        sku: variant.sku || inventory.sku || '—',
        availableQuantity,
        stockAge,
        lastMovementAt: inventory.updatedAt,
        price: Number(variant.price || 0),
        isLiquidationStatus,
        isLongStock,
        activeDeal: promotedVariantIds.has(String(variant.variantId || variant.id)),
        suggestedDiscount: isLiquidationStatus || stockAge >= 180 ? 40 : 25
      };
    }).filter(Boolean).sort((left, right) =>
      Number(right.isLiquidationStatus) - Number(left.isLiquidationStatus)
      || right.stockAge - left.stockAge);

    cache.liquidation = candidates;
    const totalUnits = candidates.reduce((sum, item) => sum + item.availableQuantity, 0);
    const totalValue = candidates.reduce((sum, item) => sum + item.availableQuantity * item.price, 0);

    app.innerHTML = `
      <div class="stats-grid" style="margin-bottom:24px;">
        <div class="stat-card"><div class="stat-icon-wrap prd">♻</div><div class="stat-label">Mặt hàng cần thanh lý</div><div class="stat-value">${candidates.length}</div><div class="stat-sub">Ngừng nhập mới hoặc tồn kho từ ${LIQUIDATION_STALE_DAYS} ngày</div></div>
        <div class="stat-card"><div class="stat-icon-wrap ord">📦</div><div class="stat-label">Số lượng cần xử lý</div><div class="stat-value">${totalUnits.toLocaleString('vi-VN')}</div><div class="stat-sub">Sản phẩm còn có thể bán</div></div>
        <div class="stat-card"><div class="stat-icon-wrap rev">💰</div><div class="stat-label">Giá trị theo giá bán</div><div class="stat-value" style="font-size:20px;">${money(totalValue)}</div><div class="stat-sub">Trước khi áp dụng ưu đãi thanh lý</div></div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title-area">
            <h2>Đề xuất thanh lý hàng</h2>
            <p>Hệ thống gợi ý từ hàng ngừng nhập mới hoặc không có biến động kho trong ít nhất ${LIQUIDATION_STALE_DAYS} ngày.</p>
          </div>
          <button class="secondary-btn" onclick="location.hash='#promotions'">Quản lý tất cả khuyến mãi →</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Sản phẩm / SKU</th><th>Lý do</th><th>Tồn có thể bán</th><th>Lần biến động gần nhất</th><th>Giá bán</th><th>Đề xuất</th><th></th></tr></thead>
            <tbody>
              ${candidates.length ? candidates.map(item => `
                <tr>
                  <td><strong>${esc(item.productName)}</strong><br><small style="color:var(--slate-500);">SKU: ${esc(item.sku)}</small></td>
                  <td>${item.isLiquidationStatus ? pill('Ngừng nhập mới', 'danger') : pill(`Tồn kho lâu ${item.stockAge} ngày`, 'warning')}</td>
                  <td><strong style="color:var(--danger);">${item.availableQuantity}</strong></td>
                  <td>${fmtDate(item.lastMovementAt)}<br><small style="color:var(--slate-500);">${item.stockAge} ngày trước</small></td>
                  <td>${item.price > 0 ? money(item.price) : '<span style="color:var(--danger);">Chưa có giá bán</span>'}</td>
                  <td>Giảm ${item.suggestedDiscount}%</td>
                  <td style="text-align:right;white-space:nowrap;"><button class="secondary-btn" style="padding:8px 11px;margin-right:5px;" onclick="showLiquidationReceipt(${item.variantId})">Lập phiếu</button>${item.activeDeal
                    ? '<button class="secondary-btn" style="padding:8px 11px;" onclick="location.hash=\'#promotions\'">Ưu đãi đang chạy</button>'
                    : `<button class="primary-btn" style="padding:8px 11px;" onclick="showLiquidationCampaign(${item.variantId})">Tạo ưu đãi</button>`}</td>
                </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--slate-500);">Chưa có hàng cần thanh lý. Sản phẩm được gợi ý khi ở trạng thái “Thanh lý / ngừng nhập mới” hoặc tồn kho không biến động từ ${LIQUIDATION_STALE_DAYS} ngày.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel" style="margin-top:24px;">
        <div class="panel-header"><div class="panel-title-area"><h2>Lịch sử phiếu thanh lý</h2><p>Phiếu chỉ làm giảm tồn kho khi được xác nhận hoàn tất.</p></div></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Mã phiếu</th><th>Chi tiết sản phẩm</th><th>Ngày tạo</th><th>Trạng thái</th><th></th></tr></thead><tbody>
          ${(liquidationReceipts || []).length ? liquidationReceipts.map(receipt => `<tr>
            <td><strong>${esc(receipt.receiptCode)}</strong></td>
            <td>${(receipt.details || []).map(detail => `${esc(detail.productName)} · ${esc(detail.sku)} × ${detail.quantity}`).join('<br>')}</td>
            <td>${fmtDateTime(receipt.createdAt)}</td>
            <td>${pill(Number(receipt.status) === 1 ? 'Đã hoàn tất' : (Number(receipt.status) === 2 ? 'Đã hủy' : 'Chờ xác nhận'), Number(receipt.status) === 1 ? 'success' : (Number(receipt.status) === 2 ? 'neutral' : 'warning'))}</td>
            <td style="text-align:right;">${Number(receipt.status) === 0 ? `<button class="primary-btn" style="padding:8px 11px;" onclick="completeLiquidationReceipt(${receipt.liquidationReceiptId})">Xác nhận xuất kho</button> <button class="ghost-btn" onclick="cancelLiquidationReceipt(${receipt.liquidationReceiptId})">Hủy</button>` : ''}</td>
          </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--slate-500);">Chưa có phiếu thanh lý.</td></tr>'}
        </tbody></table></div>
      </div>`;
  } catch (err) {
    app.innerHTML = `<div class="panel"><div style="padding:42px;text-align:center;color:var(--danger);">Không thể tải danh sách thanh lý: ${esc(err.message)}</div></div>`;
  }

  window.showLiquidationReceipt = function(variantId) {
    const candidates = cache.liquidation || [];
    const selectedId = Number(variantId);
    app.innerHTML = `
      <div class="form-view-panel">
        <div class="form-view-header"><div class="form-header-title"><button class="back-link-btn" onclick="renderLiquidation()">← Quay lại thanh lý hàng</button><div><h2>Tạo phiếu thanh lý</h2><p>Chọn sản phẩm và số lượng sẽ xuất khỏi kho.</p></div></div></div>
        <form class="form-view-panel" onsubmit="submitLiquidationReceipt(event)">
          <div class="form-body">
            <div class="form-group full"><label>Ghi chú</label><textarea id="liquidationReceiptNote" class="input-control" maxlength="2000" rows="3" placeholder="Lý do thanh lý, biên bản kiểm kê..."></textarea></div>
            <div class="table-wrap"><table class="data-table"><thead><tr><th>Chọn</th><th>Sản phẩm / SKU</th><th>Tồn khả dụng</th><th>Số lượng thanh lý</th></tr></thead><tbody>
              ${candidates.map(item => `<tr><td><input type="checkbox" data-liquidation-select="${item.variantId}" ${item.variantId === selectedId ? 'checked' : ''}></td>
                <td><strong>${esc(item.productName)}</strong><br><small>SKU: ${esc(item.sku)}</small></td><td>${item.availableQuantity}</td>
                <td><input class="input-control" style="max-width:130px;" id="liquidation-quantity-${item.variantId}" type="number" min="1" max="${item.availableQuantity}" value="${item.variantId === selectedId ? 1 : ''}" placeholder="Số lượng"></td></tr>`).join('')}
            </tbody></table></div>
          </div>
          <div class="form-footer-actions"><button type="button" class="ghost-btn" onclick="renderLiquidation()">Hủy bỏ</button><button type="submit" class="primary-btn">Tạo phiếu chờ xác nhận</button></div>
        </form>
      </div>`;
  };

  window.submitLiquidationReceipt = async function(event) {
    event.preventDefault();
    const details = Array.from(document.querySelectorAll('[data-liquidation-select]:checked'))
      .map(checkbox => ({
        variantId: Number(checkbox.dataset.liquidationSelect),
        quantity: Number(document.getElementById(`liquidation-quantity-${checkbox.dataset.liquidationSelect}`)?.value)
      }));
    if (!details.length || details.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      toast('Chọn ít nhất một SKU và nhập số lượng thanh lý hợp lệ.', 'error');
      return;
    }
    try {
      await api('Liquidation', {
        method: 'POST',
        body: JSON.stringify({ note: document.getElementById('liquidationReceiptNote')?.value.trim(), details })
      });
      toast('Đã tạo phiếu thanh lý ở trạng thái chờ xác nhận.', 'success');
      await renderLiquidation();
    } catch (err) {
      toast(`Không thể tạo phiếu thanh lý: ${err.message}`, 'error');
    }
  };

  window.completeLiquidationReceipt = async function(id) {
    if (!confirm('Xác nhận phiếu này và trừ số lượng khỏi tồn kho?')) return;
    try {
      await api(`Liquidation/${id}/complete`, { method: 'POST' });
      toast('Đã hoàn tất thanh lý và cập nhật tồn kho.', 'success');
      await renderLiquidation();
    } catch (err) {
      toast(`Không thể hoàn tất phiếu: ${err.message}`, 'error');
    }
  };

  window.cancelLiquidationReceipt = async function(id) {
    try {
      await api(`Liquidation/${id}/cancel`, { method: 'POST' });
      toast('Đã hủy phiếu thanh lý.', 'success');
      await renderLiquidation();
    } catch (err) {
      toast(`Không thể hủy phiếu: ${err.message}`, 'error');
    }
  };
}

window.showLiquidationCampaign = function(variantId) {
  const item = (cache.liquidation || []).find(candidate => candidate.variantId === Number(variantId));
  if (!item) return;
  if (item.price <= 0) {
    toast('Vui lòng cập nhật giá bán cho biến thể trước khi tạo ưu đãi thanh lý.', 'error');
    return;
  }
  const suggestedEndDate = dateInputValue(Date.now() + 30 * 86400000);
  app.innerHTML = `
    <div class="form-view-panel">
      <div class="form-view-header"><div class="form-header-title"><button class="back-link-btn" onclick="renderLiquidation()">← Quay lại danh sách thanh lý</button><div><h2>Tạo ưu đãi thanh lý</h2><p>${esc(item.productName)} · SKU ${esc(item.sku)} · Còn ${item.availableQuantity} sản phẩm</p></div></div></div>
      <form id="liquidationCampaignForm" autocomplete="off" onsubmit="submitLiquidationCampaign(event, ${item.variantId})">
        <div class="form-body"><div class="form-grid-2">
          <div class="form-group full"><label>Tên ưu đãi</label><input id="liquidationCampaignName" class="input-control" required value="Thanh lý ${esc(item.productName)} - ${esc(item.sku)}"></div>
          <div class="form-group"><label>Mức giảm (%) *</label><input id="liquidationDiscount" type="number" class="input-control" required min="1" max="90" value="${item.suggestedDiscount}"></div>
          <div class="form-group"><label>Kết thúc vào *</label><input id="liquidationEndDate" type="date" class="input-control" required min="${dateInputValue(Date.now() + 86400000)}" value="${suggestedEndDate}"></div>
          <div class="form-group full"><label>Ghi chú</label><textarea id="liquidationNote" class="input-control" rows="3">Ưu đãi thanh lý cho hàng ${item.isLiquidationStatus ? 'ngừng nhập mới' : `tồn kho lâu ${item.stockAge} ngày`}.</textarea></div>
        </div></div>
        <div class="form-footer-actions"><button type="button" class="ghost-btn" onclick="renderLiquidation()">Hủy bỏ</button><button type="submit" class="primary-btn">Tạo ưu đãi thanh lý</button></div>
      </form>
    </div>`;
};

window.submitLiquidationCampaign = async function(event, variantId) {
  event.preventDefault();
  const item = (cache.liquidation || []).find(candidate => candidate.variantId === Number(variantId));
  const name = document.getElementById('liquidationCampaignName')?.value.trim();
  const discountValue = Number(document.getElementById('liquidationDiscount')?.value);
  const endDateValue = document.getElementById('liquidationEndDate')?.value;
  const description = document.getElementById('liquidationNote')?.value.trim() || '';
  if (!item || !name || discountValue <= 0 || discountValue > 90 || !endDateValue) {
    toast('Vui lòng nhập đầy đủ thông tin ưu đãi hợp lệ.', 'error');
    return;
  }

  try {
    const promotion = await api('Promotion', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        promotionType: 0,
        discountValue,
        maximumDiscount: null,
        startDate: new Date().toISOString(),
        endDate: new Date(`${endDateValue}T23:59:59`).toISOString(),
        priority: 100,
        canCombine: false,
        variantIds: [item.variantId],
        status: 1
      })
    });
    toast('Đã tạo ưu đãi thanh lý và gắn đúng biến thể sản phẩm.', 'success');
    renderLiquidation();
  } catch (err) {
    toast(`Không thể tạo ưu đãi thanh lý: ${err.message}`, 'error');
  }
};

// ── 1C. CUSTOMER CARE ──────────────────────────────────────
const CUSTOMER_CARE_STATUSES = {
  0: { label: 'Mới tiếp nhận', pill: 'warning' },
  1: { label: 'Đang xử lý', pill: 'info' },
  2: { label: 'Đã phản hồi', pill: 'success' },
  3: { label: 'Đã đóng', pill: 'neutral' }
};
const CUSTOMER_CARE_TYPES = ['Tư vấn chung', 'Khiếu nại', 'Đổi trả / bảo hành', 'Khác'];

function customerCareStatus(status) {
  return CUSTOMER_CARE_STATUSES[Number(status)] || { label: 'Chưa xác định', pill: 'neutral' };
}

async function renderCustomerCare() {
  app.innerHTML = `<div class="panel"><div style="padding:42px;text-align:center;color:var(--slate-500);">Đang tải yêu cầu chăm sóc khách hàng...</div></div>`;
  try {
    const [feedbacks, returnRequests] = await Promise.all([
      api('CustomerFeedback'),
      api('ReturnRequest')
    ]);
    if (currentView !== 'customer-care') return;
    cache.customerCareReturns = returnRequests || [];
    const list = (feedbacks || []).sort((left, right) =>
      Number(left.status >= 2) - Number(right.status >= 2)
      || new Date(right.createdAt) - new Date(left.createdAt));
    const returnList = returnRequests || [];
    cache.customerCare = list;
    const newCount = list.filter(item => Number(item.status) === 0).length
      + returnList.filter(item => Number(item.status) === 0).length;
    const processingCount = list.filter(item => Number(item.status) === 1).length
      + returnList.filter(item => Number(item.status) === 1).length;
    const resolvedCount = list.filter(item => Number(item.status) >= 2).length
      + returnList.filter(item => [2, 3, 4].includes(Number(item.status))).length;

    app.innerHTML = `
      <div class="stats-grid" style="margin-bottom:24px;">
        <div class="stat-card"><div class="stat-icon-wrap cst">💬</div><div class="stat-label">Yêu cầu mới</div><div class="stat-value">${newCount}</div><div class="stat-sub">Bao gồm yêu cầu trả hàng mới</div></div>
        <div class="stat-card"><div class="stat-icon-wrap ord">⌛</div><div class="stat-label">Đang xử lý</div><div class="stat-value">${processingCount}</div><div class="stat-sub">Phản hồi và trả hàng chờ xử lý</div></div>
        <div class="stat-card"><div class="stat-icon-wrap rev">✓</div><div class="stat-label">Đã hoàn tất</div><div class="stat-value">${resolvedCount}</div><div class="stat-sub">Đã xử lý xong hoặc đã đóng</div></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title-area"><h2>Hộp thư chăm sóc khách hàng</h2><p>Tiếp nhận, trả lời và theo dõi yêu cầu của khách hàng.</p></div></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Khách hàng</th><th>Nội dung yêu cầu</th><th>Loại</th><th>Đơn liên quan</th><th>Gửi lúc</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${list.length ? list.map(item => {
            const state = customerCareStatus(item.status);
            return `<tr><td><strong>${esc(item.customerName || 'Khách hàng')}</strong></td><td><strong>${esc(item.subject)}</strong><br><small style="color:var(--slate-500);">${esc(item.content)}</small></td><td>${esc(CUSTOMER_CARE_TYPES[Number(item.feedbackType)] || CUSTOMER_CARE_TYPES[3])}</td><td>${item.orderCode ? `<strong>#${esc(item.orderCode)}</strong>` : '—'}</td><td>${fmtDateTime(item.createdAt)}</td><td>${pill(state.label, state.pill)}</td><td style="text-align:right;"><button class="icon-action-btn view" title="Xử lý yêu cầu" onclick="showCustomerCareReply(${item.customerFeedbackId})">💬</button></td></tr>`;
          }).join('') : '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--slate-500);">Chưa có yêu cầu chăm sóc khách hàng.</td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="panel" style="margin-top:24px;">
        <div class="panel-header"><div class="panel-title-area"><h2>Đổi trả và nhận hàng hoàn</h2><p>Chỉ thao tác nhận hàng sau khi kho đã thực sự tiếp nhận sản phẩm.</p></div></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Mã yêu cầu</th><th>Khách hàng / Đơn hàng</th><th>Sản phẩm</th><th>Yêu cầu lúc</th><th>Hoàn tiền</th><th>Trạng thái</th><th></th></tr></thead><tbody>
          ${(returnRequests || []).length ? returnRequests.map(item => {
            const returnStates = {
              0: { label: 'Mới yêu cầu', type: 'warning' },
              1: { label: 'Đã duyệt · Chờ nhận hàng', type: 'info' },
              2: { label: 'Từ chối', type: 'danger' },
              3: { label: 'Đã nhận hàng', type: 'success' },
              4: { label: 'Đã hủy', type: 'neutral' }
            };
            const state = returnStates[Number(item.status)] || { label: 'Không xác định', type: 'neutral' };
            return `<tr><td><strong>${esc(item.returnCode)}</strong><br><small>${esc(item.description || '')}</small></td>
              <td>${esc(item.customerName || 'Khách hàng')}<br><small>${esc(item.orderCode || '')}</small></td>
              <td>${(item.details || []).map(detail => `${esc(detail.productName)} · ${esc(detail.sku)} × ${detail.quantity}`).join('<br>')}</td>
              <td>${fmtDateTime(item.requestedAt)}</td><td>${money(item.refundAmount)}</td><td>${pill(state.label, state.type)}</td>
              <td style="text-align:right;white-space:nowrap;">${Number(item.status) === 0
                ? `<button class="primary-btn" style="padding:8px 10px;" onclick="processReturnRequest(${item.returnRequestId}, 1)">Duyệt</button> <button class="ghost-btn" onclick="processReturnRequest(${item.returnRequestId}, 2)">Từ chối</button>`
                : Number(item.status) === 1
                  ? `<button class="primary-btn" style="padding:8px 10px;" onclick="receiveReturnRequest(${item.returnRequestId})">Xác nhận đã nhận hàng</button>`
                  : ''}</td></tr>`;
          }).join('') : '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--slate-500);">Chưa có yêu cầu đổi trả.</td></tr>'}
        </tbody></table></div>
      </div>`;
    app.insertAdjacentHTML('beforeend', `
      <div class="panel admin-support-chat">
        <div class="panel-header"><div class="panel-title-area"><h2>Chat trực tuyến</h2><p>Tin nhắn realtime giữa khách hàng và quản lý.</p></div></div>
        <div class="admin-support-chat-grid">
          <div class="admin-support-chat-list" id="supportChatConversationList"><p>Đang tải hội thoại...</p></div>
          <div class="admin-support-chat-detail" id="supportChatConversationDetail"><p class="admin-support-chat-empty">Chọn một hội thoại để xem tin nhắn.</p></div>
        </div>
      </div>`);
    await renderSupportChatInbox();
  } catch (err) {
    app.innerHTML = `<div class="panel"><div style="padding:42px;text-align:center;color:var(--danger);">Không thể tải yêu cầu chăm sóc khách hàng: ${esc(err.message)}</div></div>`;
  }

  window.processReturnRequest = async function(id, status) {
    const item = (cache.customerCareReturns || []).find(request => Number(request.returnRequestId) === Number(id));
    try {
      await api(`ReturnRequest/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          refundAmount: Number(item?.refundAmount || 0),
          staffNote: status === 1 ? 'Đã duyệt yêu cầu trả hàng.' : 'Yêu cầu trả hàng không được chấp nhận.'
        })
      });
      toast(status === 1 ? 'Đã duyệt yêu cầu trả hàng.' : 'Đã từ chối yêu cầu trả hàng.', 'success');
      renderCustomerCare();
    } catch (err) {
      toast(`Không thể cập nhật yêu cầu trả hàng: ${err.message}`, 'error');
    }
  };

  window.receiveReturnRequest = async function(id) {
    if (!confirm('Xác nhận hàng đã được nhận lại tại kho? Tồn kho sẽ được tăng sau thao tác này.')) return;
    try {
      await api(`ReturnRequest/${id}/receive`, { method: 'POST' });
      toast('Đã nhận hàng trả và cập nhật tồn kho.', 'success');
      renderCustomerCare();
    } catch (err) {
      toast(`Không thể nhận hàng trả: ${err.message}`, 'error');
    }
  };
}

window.showCustomerCareReply = function(feedbackId) {
  const item = (cache.customerCare || []).find(feedback => Number(feedback.customerFeedbackId) === Number(feedbackId));
  if (!item) return;
  app.innerHTML = `
    <div class="form-view-panel">
      <div class="form-view-header"><div class="form-header-title"><button class="back-link-btn" onclick="renderCustomerCare()">← Quay lại chăm sóc khách hàng</button><div><h2>${esc(item.subject)}</h2><p>${esc(item.customerName || 'Khách hàng')} · ${item.orderCode ? `Đơn #${esc(item.orderCode)}` : 'Không gắn đơn hàng'}</p></div></div></div>
      <form id="customerCareReplyForm" onsubmit="submitCustomerCareReply(event, ${item.customerFeedbackId})">
        <div class="form-body"><div class="form-section-card"><h3>Nội dung khách gửi</h3><p style="white-space:pre-wrap;line-height:1.65;">${esc(item.content)}</p></div><div class="form-grid-2" style="margin-top:20px;"><div class="form-group"><label>Trạng thái</label><select id="customerCareStatus" class="input-control">${Object.entries(CUSTOMER_CARE_STATUSES).map(([value, state]) => `<option value="${value}" ${Number(item.status) === Number(value) ? 'selected' : ''}>${state.label}</option>`).join('')}</select></div><div class="form-group full"><label>Phản hồi đến khách hàng</label><textarea id="customerCareResponse" class="input-control" rows="6" placeholder="Nhập nội dung phản hồi...">${esc(item.response)}</textarea><small style="color:var(--slate-500);">Cần nhập phản hồi khi chuyển sang “Đã phản hồi” hoặc “Đã đóng”.</small></div></div></div>
        <div class="form-footer-actions"><button type="button" class="ghost-btn" onclick="renderCustomerCare()">Quay lại</button><button type="submit" class="primary-btn">Lưu xử lý</button></div>
      </form>
    </div>`;
};

async function ensureSupportChatRealtime() {
  if (!window.signalR || supportChatConnection) return;
  supportChatConnection = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/support-chat', { accessTokenFactory: () => token || '' })
    .withAutomaticReconnect()
    .build();
  supportChatConnection.on('SupportMessageReceived', message => {
    if (handledSupportMessageIds.has(message.supportMessageId)) return;
    handledSupportMessageIds.add(message.supportMessageId);
    if (handledSupportMessageIds.size > 1000)
      handledSupportMessageIds.delete(handledSupportMessageIds.values().next().value);
    renderSupportChatInbox().catch(err => console.warn('Could not refresh support chat inbox:', err));
    if (Number(message.supportConversationId) === Number(selectedSupportConversationId)) {
      openSupportConversation(selectedSupportConversationId).catch(err => console.warn('Could not refresh support chat:', err));
    }
  });
  supportChatConnection.on('SupportConversationUpdated', () => {
    renderSupportChatInbox().catch(err => console.warn('Could not refresh support chat inbox:', err));
    if (selectedSupportConversationId) {
      openSupportConversation(selectedSupportConversationId).catch(err => console.warn('Could not refresh support chat:', err));
    }
  });
  supportChatConnection.on('SupportMessagesRead', () => {
    if (selectedSupportConversationId) {
      openSupportConversation(selectedSupportConversationId).catch(err => console.warn('Could not refresh read state:', err));
    }
  });
  try {
    await supportChatConnection.start();
  } catch (err) {
    supportChatConnection = null;
    console.warn('Realtime chat unavailable; inbox polling remains active:', err);
  }
}

async function renderSupportChatInbox() {
  const listElement = document.getElementById('supportChatConversationList');
  if (!listElement || currentView !== 'customer-care') return;
  const conversations = await api('SupportChat');
  if (currentView !== 'customer-care') return;
  cache.supportChats = conversations || [];
  listElement.innerHTML = cache.supportChats.length ? cache.supportChats.map(item => `
    <button type="button" class="admin-support-chat-item ${Number(selectedSupportConversationId) === Number(item.supportConversationId) ? 'active' : ''}"
      onclick="openSupportConversation(${item.supportConversationId})">
      <span><strong>${esc(item.customerName || 'Khách hàng')}</strong><small>${fmtDateTime(item.lastMessageAt || item.createdAt)}</small></span>
      <span class="admin-support-chat-item-meta">${item.unreadCount ? `<b>${item.unreadCount}</b>` : ''}${pill(Number(item.status) === 0 ? 'Đang mở' : 'Đã đóng', Number(item.status) === 0 ? 'success' : 'neutral')}</span>
    </button>`).join('') : '<p class="admin-support-chat-empty">Chưa có hội thoại chat.</p>';
  await ensureSupportChatRealtime();
  if (supportChatRefreshTimer) clearInterval(supportChatRefreshTimer);
  supportChatRefreshTimer = setInterval(() => {
    if (currentView === 'customer-care') renderSupportChatInbox().catch(err => console.warn('Support chat polling failed:', err));
  }, 15000);
}

window.openSupportConversation = async function(conversationId) {
  selectedSupportConversationId = Number(conversationId);
  const detailElement = document.getElementById('supportChatConversationDetail');
  if (!detailElement) return;
  try {
    const conversation = await api(`SupportChat/${conversationId}`);
    if (!conversation) return;
    if (window.signalR && supportChatConnection?.state === signalR.HubConnectionState.Connected) {
      await supportChatConnection.invoke('JoinConversation', Number(conversationId));
    }
    await api(`SupportChat/${conversationId}/read`, { method: 'POST' });
    const messages = conversation.messages || [];
    detailElement.innerHTML = `
      <div class="admin-support-chat-heading">
        <div><strong>${esc(conversation.customerName || 'Khách hàng')}</strong><small>${Number(conversation.status) === 0 ? 'Hội thoại đang mở' : 'Hội thoại đã đóng'}</small></div>
        <div class="admin-support-chat-actions">
          <button class="secondary-btn" onclick="acceptSupportConversation(${conversationId})">Nhận phụ trách</button>
          <button class="secondary-btn" onclick="setSupportConversationStatus(${conversationId}, ${Number(conversation.status) === 0 ? 1 : 0})">${Number(conversation.status) === 0 ? 'Đóng hội thoại' : 'Mở lại'}</button>
        </div>
      </div>
      <div class="admin-support-chat-messages" id="adminSupportChatMessages">
        ${messages.map(message => `<article class="admin-support-chat-message ${message.senderRole === 'Customer' ? 'customer' : 'manager'}"><p>${esc(message.content)}</p><small>${esc(message.senderRole)} · ${fmtDateTime(message.sentAt)}${message.senderRole !== 'Customer' && message.readAt ? ' · Đã xem' : ''}</small></article>`).join('')}
      </div>
      <form class="admin-support-chat-form" onsubmit="sendSupportChatMessage(event, ${conversationId})">
        <textarea id="adminSupportChatInput" maxlength="4000" rows="2" required ${Number(conversation.status) !== 0 ? 'disabled' : ''} placeholder="Nhập câu trả lời..."></textarea>
        <button class="primary-btn" type="submit" ${Number(conversation.status) !== 0 ? 'disabled' : ''}>Gửi</button>
      </form>`;
    const messageBox = document.getElementById('adminSupportChatMessages');
    if (messageBox) messageBox.scrollTop = messageBox.scrollHeight;
    await renderSupportChatInbox();
  } catch (err) {
    detailElement.innerHTML = `<p class="admin-support-chat-empty">Không thể tải hội thoại: ${esc(err.message)}</p>`;
  }
};

window.sendSupportChatMessage = async function(event, conversationId) {
  event.preventDefault();
  const input = document.getElementById('adminSupportChatInput');
  const content = input?.value.trim();
  if (!content) return;
  try {
    await api(`SupportChat/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
    await openSupportConversation(conversationId);
  } catch (err) {
    toast(`Không thể gửi tin nhắn: ${err.message}`, 'error');
  }
};

window.acceptSupportConversation = async function(conversationId) {
  try {
    await api(`SupportChat/${conversationId}/accept`, { method: 'POST' });
    await openSupportConversation(conversationId);
  } catch (err) {
    toast(`Không thể nhận hội thoại: ${err.message}`, 'error');
  }
};

window.setSupportConversationStatus = async function(conversationId, status) {
  try {
    await api(`SupportChat/${conversationId}`, {
      method: 'PUT',
      body: JSON.stringify({ status, assignedManagerUserId: currentUser?.userId || null })
    });
    await openSupportConversation(conversationId);
  } catch (err) {
    toast(`Không thể cập nhật hội thoại: ${err.message}`, 'error');
  }
};

window.submitCustomerCareReply = async function(event, feedbackId) {
  event.preventDefault();
  const status = Number(document.getElementById('customerCareStatus')?.value);
  const response = document.getElementById('customerCareResponse')?.value.trim() || '';
  if (status >= 2 && !response) {
    toast('Vui lòng nhập phản hồi trước khi hoàn tất yêu cầu.', 'error');
    return;
  }
  try {
    await api(`CustomerFeedback/${feedbackId}`, { method: 'PUT', body: JSON.stringify({ status, response }) });
    toast('Đã cập nhật yêu cầu chăm sóc khách hàng.', 'success');
    renderCustomerCare();
  } catch (err) {
    toast(`Không thể cập nhật yêu cầu: ${err.message}`, 'error');
  }
};

// ── 2. GENERIC LIST VIEW ────────────────────────────────────
async function renderList(key) {
  const m = MODULES[key];
  if (!m) return;

  app.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title-area">
          <h2>Danh sách ${m.title}</h2>
          <p>Quản lý dữ liệu và thông tin ${m.title.toLowerCase()}</p>
        </div>
        <div class="panel-actions">
          <input type="text" id="tableSearchInput" placeholder="Tìm kiếm ${m.title.toLowerCase()}..." class="input-control" style="width:240px;padding:8px 14px;" onkeyup="filterTableData('${key}')">
          ${key === 'orders' ? `
            <button class="secondary-btn" onclick="showShippingBatchModal()" style="display:inline-flex;align-items:center;gap:6px;">
              <span>🚚</span> Gợi ý gộp đơn
            </button>
          ` : ''}
          ${m.canAdd ? `
            <button class="primary-btn" onclick="showForm('${key}')">
              <span>+</span> Thêm ${key === 'imports' ? 'phiếu đặt hàng' : m.title.toLowerCase()} mới
            </button>
          ` : ''}
        </div>
      </div>

      ${key === 'orders' ? `
        <div class="order-tabs-container">
          <button type="button" class="order-tab-btn ${orderActiveTab === 'processing' ? 'active' : ''}" onclick="switchOrderTab('processing')">
            <span>⚡ Đang xử lý</span>
            <span class="order-tab-badge" id="orderTabProcessingCount">0</span>
          </button>
          <button type="button" class="order-tab-btn ${orderActiveTab === 'history' ? 'active' : ''}" onclick="switchOrderTab('history')">
            <span>🏁 Lịch sử đơn hàng</span>
            <span class="order-tab-badge" id="orderTabHistoryCount">0</span>
          </button>
          <button type="button" class="order-tab-btn ${orderActiveTab === 'all' ? 'active' : ''}" onclick="switchOrderTab('all')">
            <span>📋 Tất cả đơn</span>
            <span class="order-tab-badge" id="orderTabAllCount">0</span>
          </button>
        </div>

        <div class="order-filter-bar">
          <div class="order-filter-grid">
            <div class="filter-control-wrap">
              <label>Trạng thái chi tiết</label>
              <select id="orderFilterStatusSelect" class="input-control" onchange="applyOrderFilters()">
                <option value="">-- Tất cả trạng thái --</option>
                <option value="0">0. Chờ xử lý</option>
                <option value="1">1. Đã xác nhận</option>
                <option value="2">2. Đang đóng gói / xử lý</option>
                <option value="3">3. Đang giao hàng</option>
                <option value="4">4. Đã hoàn tất</option>
                <option value="5">5. Đã hủy</option>
              </select>
            </div>
            <div class="filter-control-wrap">
              <label>Phương thức thanh toán</label>
              <select id="orderFilterPaymentSelect" class="input-control" onchange="applyOrderFilters()">
                <option value="">-- Tất cả phương thức --</option>
                <option value="0">COD (Thanh toán khi nhận)</option>
                <option value="1">Chuyển khoản (QR / Banking)</option>
                <option value="2">ZaloPay</option>
              </select>
            </div>
            <div class="filter-control-wrap">
              <label>Tình trạng gộp chuyến</label>
              <select id="orderFilterBatchSelect" class="input-control" onchange="applyOrderFilters()">
                <option value="">-- Tất cả tình trạng --</option>
                <option value="unbatched">Chưa phân lô giao</option>
                <option value="batched">Đã gộp vào lô</option>
              </select>
            </div>
            <div class="filter-control-wrap" style="display:flex;gap:8px;">
              <button type="button" class="secondary-btn" style="width:100%;padding:9px;" onclick="resetOrderFilters()">Đặt lại lọc</button>
            </div>
          </div>
          <div id="orderFilterSummary" style="margin-top:10px;font-size:12.5px;color:var(--slate-500);font-weight:600;"></div>
        </div>
      ` : ''}

      ${key === 'products' ? `
        <div class="product-filter-bar" style="margin:16px 24px 0;background:var(--slate-50);border:1px solid var(--slate-200);border-radius:12px;padding:16px;">
          <div class="product-filter-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:12px;align-items:flex-end;">
            <div class="filter-control-wrap">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--slate-600);margin-bottom:4px;text-transform:uppercase;">Danh mục</label>
              <select id="prodFilterCat" class="input-control" onchange="applyProductFilters()">
                <option value="">-- Tất cả danh mục --</option>
                ${(ref.categories || []).map(c => `<option value="${c.id || c.categoryId}">${esc(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="filter-control-wrap">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--slate-600);margin-bottom:4px;text-transform:uppercase;">Thương hiệu</label>
              <select id="prodFilterBrand" class="input-control" onchange="applyProductFilters()">
                <option value="">-- Tất cả thương hiệu --</option>
                ${(ref.brands || []).map(b => `<option value="${b.id || b.brandId}">${esc(b.name)}</option>`).join('')}
              </select>
            </div>
            <div class="filter-control-wrap">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--slate-600);margin-bottom:4px;text-transform:uppercase;">Tồn kho</label>
              <select id="prodFilterStock" class="input-control" onchange="applyProductFilters()">
                <option value="">-- Tất cả tồn kho --</option>
                <option value="in_stock">Còn hàng (> 0)</option>
                <option value="out_of_stock">Hết hàng (= 0)</option>
                <option value="awaiting">Chờ nhập kho NCC</option>
              </select>
            </div>
            <div class="filter-control-wrap">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--slate-600);margin-bottom:4px;text-transform:uppercase;">Trạng thái kinh doanh</label>
              <select id="prodFilterStatus" class="input-control" onchange="applyProductFilters()">
                <option value="">-- Tất cả trạng thái --</option>
                <option value="1">Đang kinh doanh</option>
                <option value="0">Tạm ngưng</option>
                <option value="2">Thanh lý / Ngừng nhập</option>
                <option value="3">Hết hàng</option>
              </select>
            </div>
            <div class="filter-control-wrap">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--slate-600);margin-bottom:4px;text-transform:uppercase;">Khoảng giá (VNĐ)</label>
              <div style="display:flex;gap:6px;">
                <input type="number" id="prodFilterMinPrice" class="input-control" placeholder="Từ" oninput="applyProductFilters()">
                <input type="number" id="prodFilterMaxPrice" class="input-control" placeholder="Đến" oninput="applyProductFilters()">
              </div>
            </div>
            <div class="filter-control-wrap" style="display:flex;gap:6px;">
              <button type="button" class="secondary-btn" style="width:100%;padding:9px;" onclick="resetProductFilters()">Đặt lại lọc</button>
            </div>
          </div>
          <div id="prodFilterSummary" style="margin-top:10px;font-size:12.5px;color:var(--slate-500);font-weight:600;"></div>
        </div>
      ` : ''}

      ${key === 'cod' ? `
        <div class="cod-summary-bar" id="codSummaryCards">
          <div class="cod-kpi-card">
            <div class="cod-kpi-icon" style="background:#fef3c7;color:#b45309;">⏳</div>
            <div>
              <div class="cod-kpi-val" id="codHoldingAmount" style="color:#b45309;">0 đ</div>
              <div class="cod-kpi-label">Tiền COD Shipper đang giữ</div>
            </div>
          </div>
          <div class="cod-kpi-card">
            <div class="cod-kpi-icon" style="background:#ecfdf5;color:#047857;">🏦</div>
            <div>
              <div class="cod-kpi-val" id="codSubmittedAmount" style="color:#047857;">0 đ</div>
              <div class="cod-kpi-label">Tiền COD đã nộp vào quỹ</div>
            </div>
          </div>
          <div class="cod-kpi-card">
            <div class="cod-kpi-icon" style="background:#eff6ff;color:#1d4ed8;">📦</div>
            <div>
              <div class="cod-kpi-val" id="codTotalCount" style="color:#1d4ed8;">0</div>
              <div class="cod-kpi-label">Số đơn COD cần đối soát</div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              ${m.columns.map(c => `<th>${c}</th>`).join('')}
              <th style="text-align:right;min-width:110px;">Thao tác</th>
            </tr>
          </thead>
          <tbody id="listTableBody">
            <tr><td colspan="${m.columns.length + 1}" style="text-align:center;padding:40px;color:var(--slate-400)">Đang tải dữ liệu từ máy chủ...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const data = await api(m.endpoint);
    cache[key] = Array.isArray(data) ? data : (data?.items || []);
    if (key === 'products') {
      applyProductFilters();
    } else if (key === 'orders') {
      applyOrderFilters();
    } else if (key === 'cod') {
      updateCodSummary(cache[key]);
      renderTableRows(key, cache[key]);
    } else {
      renderTableRows(key, cache[key]);
    }
  } catch (err) {
    toast(`Không thể tải dữ liệu: ${err.message}`, 'error');
    document.getElementById('listTableBody').innerHTML = `
      <tr><td colspan="${m.columns.length + 1}" style="text-align:center;padding:40px;color:var(--danger)">Lỗi: ${esc(err.message)}</td></tr>
    `;
  }
}

function updateCodSummary(list) {
  if (!Array.isArray(list)) return;
  const holding = list.filter(x => x.codStatus === 1).reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  const submitted = list.filter(x => x.codStatus === 2).reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  const elHolding = document.getElementById('codHoldingAmount');
  const elSubmitted = document.getElementById('codSubmittedAmount');
  const elCount = document.getElementById('codTotalCount');
  if (elHolding) elHolding.textContent = money(holding);
  if (elSubmitted) elSubmitted.textContent = money(submitted);
  if (elCount) elCount.textContent = list.length;
}

function renderTableRows(key, list) {
  const m = MODULES[key];
  const tbody = document.getElementById('listTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="${m.columns.length + 1}" style="text-align:center;padding:40px;color:var(--slate-400)">Chưa có dữ liệu nào trong danh mục này.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((record, index) => `
    <tr>
      ${getRowCells(key, record).map(cell => `<td>${cell}</td>`).join('')}
      <td style="text-align:right;white-space:nowrap;">
        ${getRowActions(key, record, index)}
      </td>
    </tr>
  `).join('');
}

function filterTableData(key) {
  if (key === 'products') {
    applyProductFilters();
    return;
  }
  if (key === 'orders') {
    applyOrderFilters();
    return;
  }
  const term = (document.getElementById('tableSearchInput')?.value || '').toLowerCase().trim();
  const rawList = cache[key] || [];
  if (!term) {
    renderTableRows(key, rawList);
    return;
  }
  const filtered = rawList.filter(r => JSON.stringify(r).toLowerCase().includes(term));
  renderTableRows(key, filtered);
}

let orderActiveTab = 'processing';

function switchOrderTab(tab) {
  orderActiveTab = tab;
  document.querySelectorAll('.order-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${tab}'`));
  });
  applyOrderFilters();
}

function updateOrderTabCounts() {
  const list = cache['orders'] || [];
  const processingCount = list.filter(o => Number(o.status) >= 0 && Number(o.status) <= 3).length;
  const historyCount = list.filter(o => Number(o.status) === 4 || Number(o.status) === 5).length;
  const allCount = list.length;

  const elProc = document.getElementById('orderTabProcessingCount');
  if (elProc) elProc.textContent = processingCount;
  const elHist = document.getElementById('orderTabHistoryCount');
  if (elHist) elHist.textContent = historyCount;
  const elAll = document.getElementById('orderTabAllCount');
  if (elAll) elAll.textContent = allCount;
}

function applyOrderFilters() {
  const allOrders = cache['orders'] || [];
  updateOrderTabCounts();

  let filtered = [...allOrders];

  // 1. Lọc theo Tab (Ẩn hoàn tất / hủy nếu ở tab processing)
  if (orderActiveTab === 'processing') {
    filtered = filtered.filter(o => Number(o.status) >= 0 && Number(o.status) <= 3);
  } else if (orderActiveTab === 'history') {
    filtered = filtered.filter(o => Number(o.status) === 4 || Number(o.status) === 5);
  }

  // 2. Lọc theo trạng thái chi tiết
  const statusVal = document.getElementById('orderFilterStatusSelect')?.value;
  if (statusVal !== undefined && statusVal !== '') {
    filtered = filtered.filter(o => Number(o.status) === Number(statusVal));
  }

  // 3. Lọc theo phương thức thanh toán
  const paymentVal = document.getElementById('orderFilterPaymentSelect')?.value;
  if (paymentVal !== undefined && paymentVal !== '') {
    filtered = filtered.filter(o => {
      const pm = o.payment?.paymentMethod ?? o.paymentMethod;
      return Number(pm) === Number(paymentVal);
    });
  }

  // 4. Lọc theo tình trạng gộp lô
  const batchVal = document.getElementById('orderFilterBatchSelect')?.value;
  if (batchVal === 'unbatched') {
    filtered = filtered.filter(o => !o.shipping?.deliveryBatchCode);
  } else if (batchVal === 'batched') {
    filtered = filtered.filter(o => !!o.shipping?.deliveryBatchCode);
  }

  // 5. Tìm kiếm từ khóa (input search)
  const searchVal = (document.getElementById('tableSearchInput')?.value || '').trim().toLowerCase();
  if (searchVal) {
    filtered = filtered.filter(o => {
      const code = String(o.orderCode || o.orderId || '').toLowerCase();
      const customer = String(o.customerName || o.shipping?.receiverName || '').toLowerCase();
      const phone = String(o.phoneNumber || o.shipping?.receiverPhone || '').toLowerCase();
      const batch = String(o.shipping?.deliveryBatchCode || '').toLowerCase();
      const addr = String(o.shipping?.address || '').toLowerCase();
      return code.includes(searchVal) || customer.includes(searchVal) || phone.includes(searchVal) || batch.includes(searchVal) || addr.includes(searchVal);
    });
  }

  const summary = document.getElementById('orderFilterSummary');
  if (summary) {
    const tabName = orderActiveTab === 'processing' ? 'Đang xử lý' : (orderActiveTab === 'history' ? 'Lịch sử' : 'Tất cả');
    summary.innerHTML = `Hiển thị <b>${filtered.length}</b> đơn hàng (Tab: ${tabName}).`;
  }

  renderTableRows('orders', filtered);
}

function resetOrderFilters() {
  const selStatus = document.getElementById('orderFilterStatusSelect');
  if (selStatus) selStatus.value = '';
  const selPayment = document.getElementById('orderFilterPaymentSelect');
  if (selPayment) selPayment.value = '';
  const selBatch = document.getElementById('orderFilterBatchSelect');
  if (selBatch) selBatch.value = '';
  const search = document.getElementById('tableSearchInput');
  if (search) search.value = '';
  applyOrderFilters();
}

async function unbatchOrderAction(orderId) {
  if (!confirm('Xác nhận gỡ đơn hàng này ra khỏi mã lô vận chuyển?')) return;
  try {
    const res = await api(`Shipping/unbatch-order/${orderId}`, { method: 'POST' });
    toast(res.message || 'Đã gỡ đơn khỏi mã lô thành công!', 'success');
    if (document.querySelector('.form-view-panel')) {
      showOrderDetail(orderId);
    } else {
      renderList('orders');
    }
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

function applyProductFilters() {
  const catVal = document.getElementById('prodFilterCat')?.value;
  const brandVal = document.getElementById('prodFilterBrand')?.value;
  const stockVal = document.getElementById('prodFilterStock')?.value;
  const statusVal = document.getElementById('prodFilterStatus')?.value;
  const minPrice = parseFloat(document.getElementById('prodFilterMinPrice')?.value);
  const maxPrice = parseFloat(document.getElementById('prodFilterMaxPrice')?.value);
  const search = (document.getElementById('tableSearchInput')?.value || '').toLowerCase().trim();

  let list = cache.products || [];

  if (catVal) {
    list = list.filter(p => String(p.categoryId) === catVal);
  }
  if (brandVal) {
    list = list.filter(p => String(p.brandId) === brandVal);
  }
  if (statusVal) {
    list = list.filter(p => String(p.status) === statusVal);
  }
  if (stockVal === 'in_stock') {
    list = list.filter(p => productVariantsOf(p).some(v => Number(v.availableQuantity || 0) > 0));
  } else if (stockVal === 'out_of_stock') {
    list = list.filter(p => productVariantsOf(p).length > 0 && productVariantsOf(p).every(v => v.availableQuantity !== null && Number(v.availableQuantity) <= 0));
  } else if (stockVal === 'awaiting') {
    list = list.filter(p => productVariantsOf(p).every(v => v.availableQuantity === null || v.availableQuantity === undefined));
  }

  if (!isNaN(minPrice)) {
    list = list.filter(p => {
      const price = p.basePrice ?? productVariantsOf(p)[0]?.price ?? 0;
      return price >= minPrice;
    });
  }
  if (!isNaN(maxPrice)) {
    list = list.filter(p => {
      const price = p.basePrice ?? productVariantsOf(p)[0]?.price ?? 0;
      return price <= maxPrice;
    });
  }

  if (search) {
    list = list.filter(p => {
      const name = (p.name || '').toLowerCase();
      const code = String(p.productId || '');
      const cat = (p.categoryName || '').toLowerCase();
      const brand = (p.brandName || '').toLowerCase();
      const skus = productVariantsOf(p).map(v => (v.sku || '').toLowerCase()).join(' ');
      return name.includes(search) || code.includes(search) || cat.includes(search) || brand.includes(search) || skus.includes(search);
    });
  }

  const summary = document.getElementById('prodFilterSummary');
  if (summary) {
    const total = (cache.products || []).length;
    summary.textContent = `Hiển thị ${list.length} / ${total} sản phẩm phù hợp`;
  }

  renderTableRows('products', list);
}

function resetProductFilters() {
  if (document.getElementById('prodFilterCat')) document.getElementById('prodFilterCat').value = '';
  if (document.getElementById('prodFilterBrand')) document.getElementById('prodFilterBrand').value = '';
  if (document.getElementById('prodFilterStock')) document.getElementById('prodFilterStock').value = '';
  if (document.getElementById('prodFilterStatus')) document.getElementById('prodFilterStatus').value = '';
  if (document.getElementById('prodFilterMinPrice')) document.getElementById('prodFilterMinPrice').value = '';
  if (document.getElementById('prodFilterMaxPrice')) document.getElementById('prodFilterMaxPrice').value = '';
  if (document.getElementById('tableSearchInput')) document.getElementById('tableSearchInput').value = '';
  applyProductFilters();
}

function getRowCells(key, r) {
  switch (key) {
    case 'products':
      const img = r.imageUrl || r.thumbnailUrl || productVariantsOf(r)[0]?.imageUrl || 'https://placehold.co/80x80/e2e8f0/475569?text=Toy';
      return [
        `<img src="${esc(img)}" style="width:42px;height:42px;object-fit:cover;border-radius:8px;border:1px solid var(--slate-200);">`,
        `<strong>${esc(r.name)}</strong><br><small style="color:var(--slate-400);">Mã: ${esc(r.productId)}</small>`,
        esc(r.categoryName || '—'),
        esc(r.brandName || '—'),
        `<strong style="color:var(--primary);">${money(r.basePrice ?? productVariantsOf(r)[0]?.price)}</strong>`,
        pill(
          r.status === 2 ? 'Thanh lý / Ngừng nhập' : (r.status === 3 ? 'Hết hàng' : (r.status === 1 ? 'Đang kinh doanh' : 'Tạm ngưng')),
          r.status === 2 ? 'danger' : (r.status === 3 ? 'warning' : (r.status === 1 ? 'success' : 'neutral'))
        )
      ];

    case 'categories':
    case 'brands':
      return [
        `<strong>${esc(r.name)}</strong>`,
        esc(r.description || '—'),
        pill(r.isActive !== false ? 'Hoạt động' : 'Tạm khóa', r.isActive !== false ? 'success' : 'danger')
      ];

    case 'inventory':
      const available = (r.quantity || 0) - (r.reservedQuantity || 0);
      return [
        `<code style="background:var(--slate-100);padding:3px 6px;border-radius:4px;font-weight:700;">${esc(r.sku || r.productVariant?.sku || 'SKU')}</code>`,
        `<strong>${esc(r.productName || r.productVariant?.product?.name || 'Sản phẩm')}</strong>`,
        `<strong>${r.quantity || 0}</strong>`,
        `<span style="color:var(--slate-500);">${r.reservedQuantity || 0}</span>`,
        `<strong style="color:${available > 0 ? 'var(--success)' : 'var(--danger)'};">${available}</strong>`,
        fmtDateTime(r.updatedAt || r.createdAt)
      ];

    case 'orders':
      return [
        `<strong>#${esc(r.orderCode || r.orderId)}</strong>`,
        esc(r.customerName || r.shipping?.receiverName || 'Khách vãng lai'),
        esc(r.phoneNumber || r.shipping?.receiverPhone || '—'),
        fmtDate(r.orderDate || r.createdAt),
        r.shipping?.deliveryBatchCode 
          ? `<span class="badge" style="background:#e0e7ff;color:#3730a3;font-weight:700;">${esc(r.shipping.deliveryBatchCode)}</span>` 
          : `<span style="color:var(--slate-400);font-size:12px;">Chưa gộp</span>`,
        r.shipping?.shipperName
          ? `<div><strong>${esc(r.shipping.shipperName)}</strong><br><small style="color:var(--slate-500);">${esc(r.shipping.shipperPhone || '')}</small></div>`
          : `<button class="secondary-btn" style="padding:2px 8px;font-size:11px;" onclick="showAssignShipperModal(${r.orderId}, '${esc(r.shipping?.deliveryBatchCode || '')}')">+ Gán</button>`,
        fmtDeliveryWindow(r.shipping?.estimatedDeliveryFromDate || r.shipping?.estimatedDeliveryAt, r.shipping?.estimatedDeliveryToDate),
        `<strong style="color:var(--primary);">${money(r.finalAmount || r.totalAmount)}</strong>`,
        pill(r.paymentStatus === 1 ? 'Đã thanh toán' : 'Chưa thanh toán', r.paymentStatus === 1 ? 'success' : 'neutral'),
        pill(ORDER_STATUS_LABELS[r.status] || 'Đang xử lý', r.status === 4 ? 'success' : (r.status === 5 ? 'danger' : 'warning'))
      ];

    case 'shippers':
      return [
        `<strong>${esc(r.fullName)}</strong>`,
        esc(r.phoneNumber || '—'),
        `<code style="background:var(--slate-100);padding:2px 6px;border-radius:4px;">${esc(r.vehicleNumber || '—')}</code>`,
        esc(r.assignedArea || 'Tất cả các tuyến'),
        `<strong style="color:var(--warning);">${r.activeOrdersCount || 0}</strong>`,
        `<strong style="color:var(--success);">${r.completedOrdersCount || 0}</strong>`,
        `<strong style="color:var(--primary);">${money(r.pendingCodAmount || 0)}</strong>`,
        pill(r.isActive ? 'Đang hoạt động' : 'Tạm dừng', r.isActive ? 'success' : 'neutral')
      ];

    case 'cod':
      return [
        `<strong>#${esc(r.orderCode)}</strong>`,
        `<div><strong>${esc(r.receiverName)}</strong><br><small style="color:var(--slate-500);">${esc(r.receiverPhone)} · ${esc(r.address)}</small></div>`,
        `<strong style="color:var(--primary);font-size:14px;">${money(r.amount)}</strong>`,
        r.shipperName ? `<strong>${esc(r.shipperName)}</strong><br><small style="color:var(--slate-500);">${esc(r.shipperPhone || '')}</small>` : '<span style="color:var(--slate-400);">Chưa gán</span>',
        r.deliveryBatchCode ? `<span class="badge" style="background:#e0e7ff;color:#3730a3;font-weight:700;">${esc(r.deliveryBatchCode)}</span>` : '—',
        fmtDateTime(r.codCollectedAt),
        r.codStatus === 2 
          ? `<span class="badge" style="background:#ecfdf5;color:#047857;font-weight:700;">✅ Đã nộp tiền</span>` 
          : `<span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;">⏳ Shipper giữ tiền</span>`
      ];

    case 'suppliers':
      return [
        `<strong>${esc(r.name)}</strong><br><small style="color:var(--slate-400);">${esc(r.address || '')}</small>`,
        esc(r.phone || '—'),
        esc(r.email || '—'),
        esc(r.taxCode || '—'),
        pill(r.isActive !== false ? 'Hoạt động' : 'Tạm dừng', r.isActive !== false ? 'success' : 'danger')
      ];

    case 'imports':
      const st = IMPORT_STATUS_MAP[r.status] || { label: `Trạng thái ${r.status}`, pill: 'neutral' };
      return [
        `<strong>${esc(r.receiptCode || `PO-#${r.importReceiptId}`)}</strong>`,
        `<strong>${esc(r.supplierName || 'Nhà cung cấp')}</strong>`,
        esc(r.orderedByName || 'Chưa xác định'),
        fmtDate(r.importDate || r.createdAt),
        `<strong style="color:var(--primary);">${money(r.totalAmount)}</strong>`,
        pill(st.label, st.pill)
      ];

    case 'promotions':
      const promotionActive = r.status === undefined ? r.isActive === true : r.status === 1;
      const promotionProducts = r.promotionProducts || [];
      return [
        `<strong>${esc(r.name)}</strong><br><small style="color:var(--slate-400);">${esc(r.description || '')}</small>`,
        promotionProducts.length
          ? `${promotionProducts.slice(0, 2).map(product => `<small>${esc(product.productName || product.sku || `SKU #${product.variantId}`)}</small>`).join('<br>')}${promotionProducts.length > 2 ? `<br><small>+${promotionProducts.length - 2} biến thể</small>` : ''}`
          : '<span style="color:var(--danger)">Chưa chọn sản phẩm</span>',
        r.promotionType === 0 ? 'Phần trăm (%)' : 'Số tiền cố định (đ)',
        `<strong>${r.promotionType === 0 ? `${r.discountValue}%` : money(r.discountValue)}</strong>`,
        `${fmtDate(r.startDate)} - ${fmtDate(r.endDate)}`,
        pill(promotionActive ? 'Đang chạy' : 'Tạm ngưng', promotionActive ? 'success' : 'neutral')
      ];

    case 'vouchers':
      const voucherActive = r.status === undefined ? r.isActive === true : r.status === 1;
      const usageLimit = Number(r.usageLimit ?? r.maxUsage ?? 0);
      const usedCount = Number(r.usedCount || 0);
      return [
        `<code style="background:var(--primary-light);color:var(--primary);padding:4px 8px;border-radius:6px;font-weight:700;">${esc(r.code)}</code>`,
        `<strong>${esc(r.name || r.code)}</strong>${Number(r.requiredPoints || 0) > 0 ? `<br><small style="color:var(--primary);font-weight:700;">Đổi ${Number(r.requiredPoints).toLocaleString('vi-VN')} điểm</small>` : ''}`,
        `<strong>${r.discountType === 0 ? `${r.discountValue}%` : money(r.discountValue)}</strong>`,
        usageLimit > 0
          ? `<strong>${usedCount}/${usageLimit}</strong><br><small>Còn ${Math.max(0, usageLimit - usedCount)} lượt</small>`
          : `<strong>${usedCount}</strong><br><small>Không giới hạn</small>`,
        money(r.minimumOrderValue ?? r.minOrderAmount ?? 0),
        `${fmtDate(r.startDate)} - ${fmtDate(r.endDate || r.expiryDate)}`,
        pill(voucherActive ? 'Khả dụng' : 'Khóa', voucherActive ? 'success' : 'danger')
      ];

    case 'customers':
      return [
        `<strong>${esc(r.fullName || r.name)}</strong>`,
        esc(r.email || '—'),
        esc(r.phoneNumber || r.phone || '—'),
        pill(r.tier || 'Thành viên', 'info'),
        `<strong style="color:var(--primary);">${money(r.totalSpent || 0)}</strong>`,
        `<span>${r.totalOrders || 0} đơn</span>`
      ];

    case 'users':
      return [
        `<strong>${esc(r.fullName || r.userName || 'Người dùng')}</strong>`,
        esc(r.email),
        esc(r.phoneNumber || '—'),
        pill(r.role || 'Staff', r.role === 'Admin' ? 'danger' : (r.role === 'Manager' ? 'warning' : 'info')),
        pill(r.isActive !== false ? 'Kích hoạt' : 'Bị khóa', r.isActive !== false ? 'success' : 'danger')
      ];

    default:
      return [JSON.stringify(r).slice(0, 50)];
  }
}

function getRowActions(key, r, index) {
  const m = MODULES[key];
  let btns = '';

  if (key === 'imports') {
    btns += `<button class="icon-action-btn view" title="Xem chi tiết & Duyệt nhập kho" onclick="showImportDetail(${r.importReceiptId})">👁</button> `;
    if (r.status === 1) {
      btns += `<button class="icon-action-btn" title="Chỉnh sửa phiếu" onclick="showForm('imports', ${index})">✎</button> `;
      btns += `<button class="icon-action-btn del" title="Hủy / Xóa phiếu" onclick="confirmDelete('${key}', ${index})">🗑</button>`;
    }
    return btns;
  }

  if (key === 'orders') {
    let actionBtns = `<button class="icon-action-btn view" title="Xem chi tiết đơn hàng" onclick="showOrderDetail(${r.orderId})">👁</button>`;
    if (r.shipping?.deliveryBatchCode && Number(r.status) < 3) {
      actionBtns += ` <button class="icon-action-btn del" title="Gỡ đơn này khỏi mã lô" onclick="unbatchOrderAction(${r.orderId})">✕</button>`;
    }
    if (Number(r.status) < 4) {
      actionBtns += ` <button class="icon-action-btn" title="Gán / Đổi nhân viên giao hàng" onclick="showAssignShipperModal(${r.orderId}, '${esc(r.shipping?.deliveryBatchCode || '')}')">🚚</button>`;
    }
    return actionBtns;
  }

  if (key === 'cod') {
    if (r.codStatus === 1) {
      return `<button class="primary-btn" style="padding:4px 10px;font-size:12px;white-space:nowrap;" onclick="confirmSingleCodSubmission(${r.paymentId})">✓ Đã thu tiền</button>`;
    }
    return `<span style="color:#059669;font-size:12px;font-weight:700;">✓ Đã đối soát</span>`;
  }

  if (key === 'users') {
    return `
      <button class="icon-action-btn" title="Phân quyền vai trò" onclick="showUserRoleForm(${index})">👥</button>
      <button class="icon-action-btn ${r.isActive !== false ? 'del' : ''}" title="${r.isActive !== false ? 'Khóa tài khoản' : 'Mở khóa'}" onclick="toggleUserStatus('${r.userId || r.id}')">${r.isActive !== false ? '🔒' : '🔓'}</button>
    `;
  }

  if (m.canEdit) {
    btns += `<button class="icon-action-btn" title="Chỉnh sửa" onclick="showForm('${key}', ${index})">✎</button> `;
  }
  if (m.canDelete) {
    btns += `<button class="icon-action-btn del" title="Xóa" onclick="confirmDelete('${key}', ${index})">🗑</button>`;
  }
  return btns;
}

// ── 3. IN-PAGE FORM VIEWS (NO DIALOGS) ───────────────────────
function showForm(key, index = null) {
  if (key === 'products') {
    openProduct2ColForm(index);
    return;
  }
  const m = MODULES[key];
  const isEdit = index !== null;
  const record = isEdit ? cache[key][index] : null;
  if (key === 'products') productVariantRowIndex = 0;

  app.innerHTML = `
    <div class="form-view-panel">
      <div class="form-view-header">
        <div class="form-header-title">
          <button class="back-link-btn" onclick="renderList('${key}')">← Quay lại danh sách</button>
          <div>
            <h2>${isEdit ? 'Chỉnh sửa' : 'Thêm mới'} ${m.title}</h2>
            <p>Vui lòng kiểm tra và nhập đầy đủ các trường thông tin bắt buộc (*).</p>
          </div>
        </div>
      </div>

      <form id="activeInPageForm" autocomplete="off" onsubmit="handleFormSubmit(event, '${key}', ${index})">
        <div class="form-body">
          ${renderFormFields(key, record)}
        </div>
        <div class="form-footer-actions">
          <button type="button" class="ghost-btn" onclick="renderList('${key}')">Hủy bỏ</button>
          <button type="submit" class="primary-btn">Lưu ${m.title}</button>
        </div>
      </form>
    </div>
  `;
}

function renderVariantAttributeRow(attribute = {}) {
  return `
    <div class="variant-attribute-row" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-top:8px;">
      <input type="text" class="input-control variant-attribute-name" value="${esc(attribute.attributeName)}" placeholder="Tên thuộc tính, ví dụ: Màu sắc">
      <input type="text" class="input-control variant-attribute-value" value="${esc(attribute.attributeValue)}" placeholder="Giá trị, ví dụ: Đỏ">
      <button type="button" class="icon-action-btn del" title="Bỏ thuộc tính" onclick="removeVariantAttributeRow(this)">✕</button>
    </div>`;
}

function renderProductVariantEditor(variant = {}) {
  const rowKey = `variant_${productVariantRowIndex++}`;
  const variantId = variant.variantId || variant.id || '';
  const isExisting = Boolean(variantId);
  const canSetPrice = isExisting && Number(variant.availableQuantity || 0) > 0;
  const attributes = Array.isArray(variant.attributes) && variant.attributes.length > 0
    ? variant.attributes
    : [{}];
  const priceHint = canSetPrice
    ? `Tồn kho có thể bán: ${variant.availableQuantity}`
    : 'Chưa có tồn kho. Duyệt phiếu nhập NCC cho biến thể này để nhập giá bán.';

  return `
    <section class="product-variant-editor" data-variant-id="${esc(variantId)}" style="border:1px solid var(--slate-200);border-radius:12px;padding:16px;margin-top:14px;background:var(--slate-50);">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;">
        <div>
          <strong>${isExisting ? `Biến thể SKU: ${esc(variant.sku)}` : 'Biến thể mới'}</strong>
          <div style="font-size:12px;color:var(--slate-500);margin-top:3px;">${isExisting ? 'Cập nhật thông tin biến thể hiện có.' : 'Biến thể mới sẽ nhận giá bán sau khi đã nhập kho.'}</div>
        </div>
        ${isExisting ? '' : `<button type="button" class="ghost-btn" style="padding:7px 10px;color:var(--danger);" onclick="removeProductVariantRow(this)">Bỏ biến thể</button>`}
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>SKU *</label>
          <input type="text" class="input-control variant-sku" value="${esc(variant.sku)}" required placeholder="Ví dụ: LEGO-CITY-RED">
        </div>
        <div class="form-group">
          <label>Giá bán biến thể (VNĐ)</label>
          <input type="number" min="0" step="1000" class="input-control variant-price" value="${variant.price ?? ''}" ${canSetPrice ? '' : 'disabled'} title="${esc(priceHint)}" placeholder="Nhập sau khi có tồn kho">
          <small style="display:block;margin-top:5px;color:${canSetPrice ? 'var(--success)' : 'var(--slate-500)'};">${esc(priceHint)}</small>
        </div>
        <div class="form-group">
          <label>Khối lượng (gram)</label>
          <input type="number" min="0" step="1" class="input-control variant-weight" value="${variant.weight ?? ''}" placeholder="Không bắt buộc">
        </div>
        <div class="form-group">
          <label>URL hình ảnh riêng của biến thể</label>
          <input type="url" class="input-control variant-image-url" value="${esc(variant.imageUrl)}" placeholder="https://example.com/bien-the.jpg">
        </div>
      </div>
      <div style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <label style="font-weight:700;">Thông số & điểm khác biệt của biến thể</label>
          <button type="button" class="secondary-btn" style="padding:7px 10px;" onclick="addVariantAttributeRow('${rowKey}')">+ Thêm thuộc tính</button>
        </div>
        <div id="variantAttributes_${rowKey}" class="variant-attributes">
          ${attributes.map(renderVariantAttributeRow).join('')}
        </div>
      </div>
    </section>`;
}

function renderProductVariantsSection(product) {
  const variants = productVariantsOf(product);
  const initialVariants = variants.length > 0 ? variants : [{}];
  return `
    <div class="form-section-card" style="margin-top:20px;">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
        <div>
          <h3 style="margin:0;">Biến thể sản phẩm *</h3>
          <p style="margin:5px 0 0;color:var(--slate-500);font-size:13px;">Khai báo đúng các tổ hợp có bán, ví dụ Đỏ-S và Đỏ-M; không cần ép mọi màu phải có mọi kích cỡ. Khách sẽ chọn màu và kích cỡ độc lập. Giá vốn được lấy từ phiếu nhập, giá bán chỉ mở sau khi đã có tồn kho.</p>
        </div>
        <button type="button" class="secondary-btn" onclick="addProductVariantRow()">+ Thêm biến thể</button>
      </div>
      <div id="productVariantsEditor">
        ${initialVariants.map(renderProductVariantEditor).join('')}
      </div>
    </div>`;
}

window.addProductVariantRow = function() {
  const editor = document.getElementById('productVariantsEditor');
  if (!editor) return;
  const temp = document.createElement('div');
  temp.innerHTML = renderProductVariantEditor({});
  editor.appendChild(temp.firstElementChild);
};

window.removeProductVariantRow = function(button) {
  const row = button.closest('.product-variant-editor');
  if (row) row.remove();
};

window.addVariantAttributeRow = function(rowKey) {
  const attributes = document.getElementById(`variantAttributes_${rowKey}`);
  if (!attributes) return;
  const temp = document.createElement('div');
  temp.innerHTML = renderVariantAttributeRow({});
  attributes.appendChild(temp.firstElementChild);
};

window.removeVariantAttributeRow = function(button) {
  const row = button.closest('.variant-attribute-row');
  if (row) row.remove();
};

function collectProductVariants() {
  const variants = [];
  const seenSkus = new Set();
  const rows = document.querySelectorAll('.product-variant-editor');
  if (rows.length === 0) throw new Error('Vui lòng giữ lại ít nhất một biến thể sản phẩm.');

  rows.forEach(row => {
    const sku = row.querySelector('.variant-sku')?.value.trim();
    if (!sku) throw new Error('SKU của biến thể không được để trống.');
    const normalizedSku = sku.toUpperCase();
    if (seenSkus.has(normalizedSku)) throw new Error(`SKU '${sku}' đang bị trùng trong sản phẩm này.`);
    seenSkus.add(normalizedSku);

    const attributes = [];
    row.querySelectorAll('.variant-attribute-row').forEach((attributeRow, displayOrder) => {
      const attributeName = attributeRow.querySelector('.variant-attribute-name')?.value.trim() || '';
      const attributeValue = attributeRow.querySelector('.variant-attribute-value')?.value.trim() || '';
      if (attributeName || attributeValue) {
        if (!attributeName || !attributeValue) {
          throw new Error('Mỗi thuộc tính biến thể cần đủ tên và giá trị.');
        }
        attributes.push({ attributeName, attributeValue, displayOrder });
      }
    });

    const priceInput = row.querySelector('.variant-price');
    const weightInput = row.querySelector('.variant-weight');
    const price = !priceInput.disabled && priceInput.value !== '' ? Number(priceInput.value) : null;
    const weight = weightInput.value !== '' ? Number(weightInput.value) : null;
    if ((price !== null && price < 0) || (weight !== null && weight < 0)) {
      throw new Error('Giá bán và khối lượng không được là số âm.');
    }

    variants.push({
      variantId: Number(row.dataset.variantId) || null,
      sku,
      attributes,
      price,
      weight,
      imageUrl: row.querySelector('.variant-image-url')?.value.trim() || null
    });
  });

  if (variants.length > 1) {
    if (variants.some(variant => variant.attributes.length === 0)) {
      throw new Error('Khi có nhiều biến thể, mỗi biến thể cần ít nhất một thông số mô tả điểm khác biệt.');
    }
    const definitions = variants.map(variant => variant.attributes
      .map(attribute => `${attribute.attributeName.trim().toUpperCase()}:${attribute.attributeValue.trim().toUpperCase()}`)
      .sort()
      .join('|'));
    if (new Set(definitions).size !== definitions.length) {
      throw new Error('Các biến thể đang có thông số giống nhau. Hãy mô tả điểm khác biệt của từng biến thể.');
    }
  }
  return variants;
}

// ============================================================
// ── 3A. PRODUCT 2-COLUMN & PRE-SELECTED VARIANT MATRIX (MỤC 1)
// ============================================================

const PRESET_ATTRIBUTE_GROUPS = [
  { name: 'Màu sắc', defaults: ['Đỏ', 'Xanh dương', 'Vàng', 'Trắng', 'Đen'] },
  { name: 'Kích thước', defaults: ['Nhỏ', 'Vừa', 'Lớn', 'Size S', 'Size M', 'Size L'] },
  { name: 'Khối lượng', defaults: ['100g', '250g', '500g', '1kg'] },
  { name: 'Chất liệu', defaults: ['Nhựa ABS cao cấp', 'Gỗ tự nhiên', 'Vải bông mềm', 'Kim loại hợp kim'] },
  { name: 'Phiên bản', defaults: ['Bản tiêu chuẩn', 'Bản đặc biệt', 'Bản nâng cấp'] }
];

let product2ColState = {
  isEdit: false,
  productId: null,
  product: null,
  attributes: [],
  matrixRows: [],
  removedVariantIds: []
};

function openProduct2ColForm(index = null) {
  const isEdit = index !== null && cache.products && cache.products[index];
  const prod = isEdit ? cache.products[index] : null;

  if (isEdit) {
    product2ColState.isEdit = true;
    product2ColState.productId = prod.productId;
    product2ColState.product = prod;
    product2ColState.removedVariantIds = [];

    const variants = productVariantsOf(prod);
    const attrMap = new Map();

    variants.forEach(v => {
      const attrs = v.attributes || [];
      if (attrs.length > 0) {
        attrs.forEach(a => {
          if (a.attributeName && a.attributeValue) {
            const name = a.attributeName.trim();
            if (!attrMap.has(name)) attrMap.set(name, new Set());
            attrMap.get(name).add(a.attributeValue.trim());
          }
        });
      } else {
        if (v.color) {
          if (!attrMap.has('Màu sắc')) attrMap.set('Màu sắc', new Set());
          attrMap.get('Màu sắc').add(v.color.trim());
        }
        if (v.size) {
          if (!attrMap.has('Kích thước')) attrMap.set('Kích thước', new Set());
          attrMap.get('Kích thước').add(v.size.trim());
        }
      }
    });

    if (attrMap.size === 0) {
      product2ColState.attributes = [
        { name: 'Màu sắc', values: [] },
        { name: 'Kích thước', values: [] }
      ];
    } else {
      product2ColState.attributes = Array.from(attrMap.entries()).map(([name, valSet]) => ({
        name,
        values: Array.from(valSet)
      }));
    }

    product2ColState.matrixRows = variants.map(v => {
      const vals = {};
      (v.attributes || []).forEach(a => {
        if (a.attributeName) vals[a.attributeName.trim()] = a.attributeValue?.trim() || '';
      });
      if (!vals['Màu sắc'] && v.color) vals['Màu sắc'] = v.color.trim();
      if (!vals['Kích thước'] && v.size) vals['Kích thước'] = v.size.trim();

      return {
        variantId: v.variantId || v.id || null,
        sku: v.sku || '',
        price: v.price ?? null,
        costPrice: v.costPrice ?? null,
        weight: v.weight ?? null,
        imageUrl: v.imageUrl || '',
        availableQuantity: v.availableQuantity ?? null,
        attributeValues: vals
      };
    });
  } else {
    product2ColState.isEdit = false;
    product2ColState.productId = null;
    product2ColState.product = null;
    product2ColState.removedVariantIds = [];

    product2ColState.attributes = [
      { name: 'Màu sắc', values: ['Đỏ', 'Xanh'] },
      { name: 'Kích thước', values: ['Nhỏ', 'Lớn'] }
    ];

    product2ColState.matrixRows = [
      {
        variantId: null,
        sku: '',
        price: null,
        costPrice: null,
        weight: null,
        imageUrl: '',
        availableQuantity: null,
        attributeValues: { 'Màu sắc': 'Đỏ', 'Kích thước': 'Nhỏ' }
      },
      {
        variantId: null,
        sku: '',
        price: null,
        costPrice: null,
        weight: null,
        imageUrl: '',
        availableQuantity: null,
        attributeValues: { 'Màu sắc': 'Xanh', 'Kích thước': 'Lớn' }
      }
    ];
  }

  renderProduct2ColView();
}

function renderProduct2ColView() {
  const isEdit = product2ColState.isEdit;
  const p = product2ColState.product || {};

  const ageFromVal = productAgeInputValue(p.ageFrom);
  const ageFromUnit = productAgeInputUnit(p.ageFrom);
  const ageToVal = productAgeInputValue(p.ageTo);
  const ageToUnit = productAgeInputUnit(p.ageTo);

  app.innerHTML = `
    <div class="form-view-panel">
      <div class="form-view-header">
        <div class="form-header-title">
          <button class="back-link-btn" onclick="renderList('products')">← Quay lại danh sách sản phẩm</button>
          <div>
            <h2>${isEdit ? `Chỉnh sửa sản phẩm: ${esc(p.name || '')}` : 'Tạo mới sản phẩm đồ chơi'}</h2>
            <p style="color:var(--slate-500);font-size:13px;">Bố cục 2 cột chuẩn E-commerce: Cột trái (Thông tin chung) · Cột phải (Thuộc tính & Ma trận biến thể)</p>
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <button type="button" class="ghost-btn" onclick="renderList('products')">Hủy bỏ</button>
          <button type="button" class="primary-btn" onclick="saveProduct2ColForm()">✓ ${isEdit ? 'Lưu thay đổi sản phẩm' : 'Tạo mới sản phẩm'}</button>
        </div>
      </div>

      <div class="form-body">
        <div class="product-form-2col">
          <!-- CỘT BÊN TRÁI: THÔNG TIN CHUNG SẢN PHẨM -->
          <div class="product-col-left">
            <div class="product-col-card">
              <h3><span class="badge-num">1</span> Thông tin chung sản phẩm</h3>
              
              <div class="form-group" style="margin-bottom:14px;">
                <label>Tên sản phẩm đồ chơi *</label>
                <input id="p2c_name" class="input-control" value="${esc(p.name || '')}" required placeholder="Ví dụ: Bộ Xếp Hình Lego Cảnh Sát">
              </div>

              <div class="form-group" style="margin-bottom:14px;">
                <label>Danh mục *</label>
                <div style="display:flex;gap:8px;">
                  <select id="p2c_cat" class="input-control" required>
                    <option value="">-- Chọn danh mục --</option>
                    ${(ref.categories || []).map(c => `<option value="${c.id || c.categoryId}" ${p.categoryId == (c.id || c.categoryId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                  </select>
                  <button type="button" class="secondary-btn" title="Thêm nhanh danh mục" onclick="quickAddRef('category')">+</button>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:14px;">
                <label>Thương hiệu *</label>
                <div style="display:flex;gap:8px;">
                  <select id="p2c_brand" class="input-control" required>
                    <option value="">-- Chọn thương hiệu --</option>
                    ${(ref.brands || []).map(b => `<option value="${b.id || b.brandId}" ${p.brandId == (b.id || b.brandId) ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
                  </select>
                  <button type="button" class="secondary-btn" title="Thêm nhanh thương hiệu" onclick="quickAddRef('brand')">+</button>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:14px;">
                <label>Nhà cung cấp</label>
                <select id="p2c_supplier" class="input-control">
                  <option value="">-- Chọn nhà cung cấp (nếu có) --</option>
                  ${(ref.suppliers || []).map(s => `<option value="${s.id || s.supplierId}" ${p.supplierId == (s.id || s.supplierId) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
                </select>
              </div>

              <div class="form-group" style="margin-bottom:14px;">
                <label>Độ tuổi phù hợp</label>
                <div style="display:flex;gap:8px;">
                  <input id="p2c_ageFromVal" type="number" min="0" step="1" class="input-control" value="${ageFromVal}" placeholder="Từ">
                  <select id="p2c_ageFromUnit" class="input-control" style="max-width:90px;">
                    <option value="month" ${ageFromUnit === 'month' ? 'selected' : ''}>tháng</option>
                    <option value="year" ${ageFromUnit === 'year' ? 'selected' : ''}>tuổi</option>
                  </select>
                  <input id="p2c_ageToVal" type="number" min="0" step="1" class="input-control" value="${ageToVal}" placeholder="Đến">
                  <select id="p2c_ageToUnit" class="input-control" style="max-width:90px;">
                    <option value="month" ${ageToUnit === 'month' ? 'selected' : ''}>tháng</option>
                    <option value="year" ${ageToUnit === 'year' ? 'selected' : ''}>tuổi</option>
                  </select>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:14px;">
                <label>Giới tính phù hợp</label>
                <select id="p2c_gender" class="input-control">
                  <option value="3" ${p.gender === 3 || p.gender === undefined ? 'selected' : ''}>Cả hai (Bé trai & Bé gái)</option>
                  <option value="1" ${p.gender === 1 ? 'selected' : ''}>Bé trai</option>
                  <option value="2" ${p.gender === 2 ? 'selected' : ''}>Bé gái</option>
                </select>
              </div>

              <div class="form-group" style="margin-bottom:14px;">
                <label>Mô tả chi tiết sản phẩm *</label>
                <textarea id="p2c_desc" class="input-control" rows="4" required placeholder="Nhập mô tả tính năng, chất liệu, xuất xứ...">${esc(p.description || '')}</textarea>
              </div>

              <div class="form-group" style="margin-bottom:14px;">
                <label>URL Hình ảnh đại diện</label>
                <input id="p2c_imageUrl" class="input-control" value="${esc(p.imageUrl || '')}" placeholder="https://example.com/hinh-anh.jpg" oninput="updateImagePreview(this.value)">
                <div id="p2c_imgPreview" style="margin-top:8px;${p.imageUrl ? '' : 'display:none;'}">
                  <img src="${esc(p.imageUrl || '')}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--slate-200);">
                </div>
              </div>

              <div class="form-group" style="margin-bottom:10px;">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" id="p2c_featured" ${p.isFeatured ? 'checked' : ''}>
                  <span>Sản phẩm nổi bật (Hiển thị trang chủ)</span>
                </label>
              </div>

              <div class="form-group" style="margin-bottom:10px;">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" id="p2c_isNew" ${p.isNew !== false ? 'checked' : ''}>
                  <span>Hàng mới về (New Arrival)</span>
                </label>
              </div>

              ${isEdit ? `
                <div class="form-group" style="margin-top:14px;">
                  <label>Trạng thái kinh doanh</label>
                  <select id="p2c_status" class="input-control">
                    <option value="1" ${p.status === 1 ? 'selected' : ''}>Đang kinh doanh</option>
                    <option value="0" ${p.status === 0 ? 'selected' : ''}>Chờ nhập kho / Tạm ngưng</option>
                    <option value="2" ${p.status === 2 ? 'selected' : ''}>Thanh lý / Ngừng nhập mới</option>
                    <option value="3" ${p.status === 3 ? 'selected' : ''}>Hết hàng</option>
                  </select>
                </div>
              ` : `
                <div style="background:var(--slate-100);padding:10px 14px;border-radius:8px;font-size:12.5px;color:var(--slate-600);margin-top:12px;">
                  ℹ Sản phẩm mới sẽ nhận trạng thái <b>Chờ nhập kho (0)</b> và mở giá bán sau khi có phiếu nhập NCC.
                </div>
              `}
            </div>
          </div>

          <!-- CỘT BÊN PHẢI: CẤU HÌNH THUỘC TÍNH & MA TRẬN BIẾN THỂ -->
          <div class="product-col-right" id="productColRight">
            <!-- Will be rendered by renderProduct2ColRight() -->
          </div>
        </div>
      </div>

      <div class="form-footer-actions">
        <button type="button" class="ghost-btn" onclick="renderList('products')">Hủy bỏ</button>
        <button type="button" class="primary-btn" onclick="saveProduct2ColForm()">✓ ${isEdit ? 'Lưu thay đổi sản phẩm' : 'Tạo mới sản phẩm'}</button>
      </div>
    </div>
  `;

  renderProduct2ColRight();
}

function renderProduct2ColRight() {
  const container = document.getElementById('productColRight');
  if (!container) return;

  const activeAttrNames = new Set(product2ColState.attributes.map(a => a.name.toLowerCase()));

  container.innerHTML = `
    <!-- PHẦN 1: CHỌN TRƯỚC NHÓM THUỘC TÍNH -->
    <div class="product-col-card">
      <h3><span class="badge-num">2</span> 1. Chọn trước các nhóm thuộc tính (Pre-selected Attributes)</h3>
      <p style="font-size:13px;color:var(--slate-500);margin-bottom:14px;">
        Tích chọn các nhóm thuộc tính áp dụng cho sản phẩm này. Bảng ma trận biến thể bên dưới sẽ <b>chỉ hiển thị đúng các cột thuộc tính bạn chọn</b>, ẩn toàn bộ các trường không cần thiết.
      </p>

      <div class="attr-picker-list">
        ${PRESET_ATTRIBUTE_GROUPS.map(grp => {
          const isActive = activeAttrNames.has(grp.name.toLowerCase());
          return `
            <div class="attr-chip ${isActive ? 'active' : ''}" onclick="toggleAttributeGroup('${esc(grp.name)}')">
              <span class="attr-chip-icon">${isActive ? '✓' : '+'}</span>
              <span>${esc(grp.name)}</span>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Thêm thuộc tính tùy biến -->
      <div style="display:flex;gap:8px;max-width:400px;margin-bottom:16px;">
        <input type="text" id="newCustomAttrName" class="input-control" placeholder="Tên nhóm thuộc tính khác (VD: Đóng gói, Chất liệu)..." style="padding:7px 12px;font-size:13px;" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomAttributeGroup();}">
        <button type="button" class="secondary-btn" style="padding:7px 14px;white-space:nowrap;font-size:13px;" onclick="addCustomAttributeGroup()">+ Thêm nhóm</button>
      </div>

      <!-- DANH SÁCH GIÁ TRỊ CỦA CÁC THUỘC TÍNH ĐANG CHỌN -->
      <div id="activeAttributesValuesWrap">
        ${renderAttributeValuesBoxes()}
      </div>
    </div>

    <!-- PHẦN 2: MA TRẬN BIẾN THỂ -->
    <div class="product-col-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
        <div>
          <h3 style="margin-bottom:4px;"><span class="badge-num">3</span> 2. Cấu hình giá trị biến thể (Variant Matrix)</h3>
          <p style="font-size:13px;color:var(--slate-500);margin:0;">
            Mỗi biến thể (SKU) là một <b>sự kết hợp duy nhất</b> của các giá trị thuộc tính. Một biến thể không thể chứa 2 kích thước cùng lúc.
          </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="secondary-btn" style="padding:8px 14px;font-size:12.5px;" onclick="generateVariantMatrix()">
            ⚡ Tạo tổ hợp tự động
          </button>
          <button type="button" class="secondary-btn" style="padding:8px 14px;font-size:12.5px;" onclick="addManualVariantRow()">
            + Thêm dòng biến thể
          </button>
          <button type="button" class="ghost-btn" style="padding:8px 14px;font-size:12.5px;" onclick="autoGenerateAllSkus()">
            Gợi ý toàn bộ SKU
          </button>
        </div>
      </div>

      <!-- CẢNH BÁO LỖI REALTIME NẾU TRÙNG LẶP -->
      <div id="matrixValidationAlert" style="display:none;background:var(--danger-bg);color:#991b1b;border:1px solid var(--danger-border);border-radius:8px;padding:12px 16px;font-size:13px;margin-bottom:14px;"></div>

      <!-- BẢNG MA TRẬN BIẾN THỂ -->
      <div id="matrixTableContainer">
        ${renderMatrixTableHtml()}
      </div>
    </div>
  `;

  validateMatrixCombinations();
}

function renderAttributeValuesBoxes() {
  if (product2ColState.attributes.length === 0) {
    return `<div style="text-align:center;padding:18px;color:var(--slate-400);font-size:13px;background:var(--slate-50);border-radius:8px;border:1px dashed var(--slate-300);">Chưa chọn nhóm thuộc tính nào. Hãy bấm vào các chip phía trên để chọn thuộc tính.</div>`;
  }

  return product2ColState.attributes.map(attr => {
    return `
      <div class="attr-values-box">
        <div class="attr-values-header">
          <strong>Nhóm: ${esc(attr.name)}</strong>
          <button type="button" class="ghost-btn" style="padding:2px 8px;font-size:12px;color:var(--danger);" onclick="toggleAttributeGroup('${esc(attr.name)}')">Bỏ nhóm này</button>
        </div>
        <div class="attr-tags-wrap" id="tags_${esc(attr.name)}">
          ${attr.values.map(val => `
            <span class="attr-val-tag">
              <span>${esc(val)}</span>
              <span class="tag-remove" onclick="removeValueFromAttribute('${esc(attr.name)}', '${esc(val)}')">✕</span>
            </span>
          `).join('')}
          ${attr.values.length === 0 ? '<span style="font-size:12px;color:var(--slate-400);font-style:italic;">Chưa có giá trị nào (nhập bên dưới để thêm)</span>' : ''}
        </div>
        <div class="attr-val-input-group">
          <input type="text" id="valInput_${esc(attr.name)}" class="input-control" placeholder="Thêm giá trị cho ${esc(attr.name)} (VD: Đỏ, Xanh...)" style="padding:6px 12px;font-size:12.5px;" onkeydown="if(event.key==='Enter'){event.preventDefault();addValueToAttribute('${esc(attr.name)}');}">
          <button type="button" class="secondary-btn" style="padding:6px 14px;font-size:12.5px;" onclick="addValueToAttribute('${esc(attr.name)}')">+ Thêm</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderMatrixTableHtml() {
  const rows = product2ColState.matrixRows;
  const attrs = product2ColState.attributes;

  if (rows.length === 0) {
    return `
      <div style="text-align:center;padding:30px;color:var(--slate-400);background:var(--slate-50);border-radius:8px;border:1px dashed var(--slate-300);">
        Chưa có biến thể nào. Hãy bấm <b>"⚡ Tạo tổ hợp tự động"</b> hoặc <b>"+ Thêm dòng biến thể"</b> để bắt đầu cấu hình.
      </div>
    `;
  }

  return `
    <div class="matrix-table-wrap">
      <table class="matrix-table">
        <thead>
          <tr>
            <th style="width:36px;text-align:center;">#</th>
            ${attrs.map(a => `<th>${esc(a.name)}</th>`).join('')}
            <th style="min-width:140px;">Mã SKU *</th>
            <th style="width:90px;">Khối lượng (g)</th>
            <th style="width:130px;">Giá bán (đ)</th>
            <th style="width:140px;">Ảnh riêng (URL)</th>
            <th style="width:40px;text-align:center;">Xóa</th>
          </tr>
        </thead>
        <tbody id="matrixTableBody">
          ${rows.map((row, idx) => {
            const isExisting = Boolean(row.variantId);
            const canSetPrice = isExisting && Number(row.availableQuantity || 0) > 0;
            const priceTitle = canSetPrice ? `Tồn kho khả dụng: ${row.availableQuantity}` : (isExisting ? 'Chưa có tồn kho để mở giá' : 'Mở giá sau khi duyệt nhập kho NCC');

            return `
              <tr id="matrixRow_${idx}">
                <td style="text-align:center;font-weight:700;color:var(--slate-500);">${idx + 1}</td>
                ${attrs.map(a => {
                  const currentVal = row.attributeValues[a.name] || '';
                  const options = a.values || [];
                  return `
                    <td>
                      <select class="matrix-input matrix-attr-select" data-row="${idx}" data-attr="${esc(a.name)}" onchange="onMatrixAttrSelectChange(${idx}, '${esc(a.name)}', this.value)">
                        <option value="">-- Chọn ${esc(a.name)} --</option>
                        ${options.map(opt => `<option value="${esc(opt)}" ${currentVal === opt ? 'selected' : ''}>${esc(opt)}</option>`).join('')}
                        ${currentVal && !options.includes(currentVal) ? `<option value="${esc(currentVal)}" selected>${esc(currentVal)} (hiện tại)</option>` : ''}
                      </select>
                    </td>
                  `;
                }).join('')}
                <td>
                  <input class="matrix-input matrix-sku" id="sku_${idx}" value="${esc(row.sku || '')}" placeholder="Mã SKU" required oninput="onMatrixSkuInput(${idx}, this.value)">
                </td>
                <td>
                  <input type="number" min="0" step="1" class="matrix-input matrix-weight" id="weight_${idx}" value="${row.weight ?? ''}" placeholder="g" oninput="onMatrixWeightInput(${idx}, this.value)">
                </td>
                <td>
                  <input type="number" min="0" step="1000" class="matrix-input matrix-price" id="price_${idx}" value="${row.price ?? ''}" ${canSetPrice ? '' : 'disabled'} title="${esc(priceTitle)}" placeholder="${canSetPrice ? 'VNĐ' : 'Chờ kho'}" oninput="onMatrixPriceInput(${idx}, this.value)">
                </td>
                <td>
                  <input type="url" class="matrix-input matrix-image" id="img_${idx}" value="${esc(row.imageUrl || '')}" placeholder="https://..." oninput="onMatrixImageInput(${idx}, this.value)">
                </td>
                <td style="text-align:center;">
                  <button type="button" class="icon-action-btn del" title="Xóa dòng biến thể" onclick="removeMatrixRow(${idx})">✕</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function toggleAttributeGroup(attrName) {
  const existingIdx = product2ColState.attributes.findIndex(a => a.name.toLowerCase() === attrName.toLowerCase());
  if (existingIdx >= 0) {
    product2ColState.attributes.splice(existingIdx, 1);
    product2ColState.matrixRows.forEach(row => {
      delete row.attributeValues[attrName];
    });
  } else {
    const preset = PRESET_ATTRIBUTE_GROUPS.find(p => p.name.toLowerCase() === attrName.toLowerCase());
    product2ColState.attributes.push({
      name: attrName,
      values: preset ? [...preset.defaults.slice(0, 3)] : []
    });
  }
  renderProduct2ColRight();
}

function addCustomAttributeGroup() {
  const input = document.getElementById('newCustomAttrName');
  const name = (input?.value || '').trim();
  if (!name) {
    toast('Vui lòng nhập tên nhóm thuộc tính.', 'error');
    return;
  }
  if (product2ColState.attributes.some(a => a.name.toLowerCase() === name.toLowerCase())) {
    toast(`Nhóm thuộc tính '${name}' đã tồn tại trong danh sách chọn.`, 'error');
    return;
  }
  product2ColState.attributes.push({ name, values: [] });
  renderProduct2ColRight();
}

function addValueToAttribute(attrName) {
  const input = document.getElementById(`valInput_${attrName}`);
  const val = (input?.value || '').trim();
  if (!val) return;

  const attr = product2ColState.attributes.find(a => a.name.toLowerCase() === attrName.toLowerCase());
  if (!attr) return;

  if (attr.values.some(v => v.toLowerCase() === val.toLowerCase())) {
    toast(`Giá trị '${val}' đã có trong nhóm '${attrName}'.`, 'error');
    return;
  }

  attr.values.push(val);
  renderProduct2ColRight();
}

function removeValueFromAttribute(attrName, valToRemove) {
  const attr = product2ColState.attributes.find(a => a.name.toLowerCase() === attrName.toLowerCase());
  if (!attr) return;

  attr.values = attr.values.filter(v => v !== valToRemove);
  renderProduct2ColRight();
}

function generateVariantMatrix() {
  const attrs = product2ColState.attributes.filter(a => a.values.length > 0);
  if (attrs.length === 0) {
    toast('Vui lòng thêm ít nhất một giá trị cho nhóm thuộc tính trước khi tạo tổ hợp.', 'error');
    return;
  }

  const cartesian = (arrays) => arrays.reduce((acc, curr) => acc.flatMap(c => curr.map(n => [...c, n])), [[]]);
  const combos = cartesian(attrs.map(a => a.values.map(val => ({ name: a.name, value: val }))));

  if (combos.length > 50) {
    if (!confirm(`Tổ hợp này sẽ tạo ra ${combos.length} biến thể. Bạn có chắc muốn tiếp tục không?`)) {
      return;
    }
  }

  const existingMap = new Map();
  product2ColState.matrixRows.forEach(row => {
    const key = attrs.map(a => `${a.name}:${row.attributeValues[a.name] || ''}`).sort().join('|');
    existingMap.set(key, row);
  });

  const prodName = document.getElementById('p2c_name')?.value.trim() || 'PRODUCT';
  const skuPrefix = generateSkuPrefix(prodName);

  const newRows = combos.map((combo) => {
    const attrVals = {};
    combo.forEach(c => attrVals[c.name] = c.value);

    const key = attrs.map(a => `${a.name}:${attrVals[a.name] || ''}`).sort().join('|');
    const existing = existingMap.get(key);

    if (existing) {
      return existing;
    }

    const slug = combo.map(c => toAsciiSlug(c.value)).join('-');
    const suggestedSku = `${skuPrefix}-${slug}`.toUpperCase();

    return {
      variantId: null,
      sku: suggestedSku,
      price: null,
      costPrice: null,
      weight: null,
      imageUrl: '',
      availableQuantity: null,
      attributeValues: attrVals
    };
  });

  product2ColState.matrixRows = newRows;
  const tableContainer = document.getElementById('matrixTableContainer');
  if (tableContainer) tableContainer.innerHTML = renderMatrixTableHtml();
  validateMatrixCombinations();
  toast(`Đã tạo tự động ${newRows.length} biến thể từ các tổ hợp thuộc tính!`, 'success');
}

function addManualVariantRow() {
  const attrVals = {};
  product2ColState.attributes.forEach(a => {
    attrVals[a.name] = a.values[0] || '';
  });

  const prodName = document.getElementById('p2c_name')?.value.trim() || 'PRODUCT';
  const skuPrefix = generateSkuPrefix(prodName);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);

  product2ColState.matrixRows.push({
    variantId: null,
    sku: `${skuPrefix}-VAR-${randomSuffix}`,
    price: null,
    costPrice: null,
    weight: null,
    imageUrl: '',
    availableQuantity: null,
    attributeValues: attrVals
  });

  const tableContainer = document.getElementById('matrixTableContainer');
  if (tableContainer) tableContainer.innerHTML = renderMatrixTableHtml();
  validateMatrixCombinations();
}

function removeMatrixRow(index) {
  if (product2ColState.matrixRows.length <= 1) {
    toast('Sản phẩm cần có ít nhất một biến thể.', 'error');
    return;
  }
  const removed = product2ColState.matrixRows.splice(index, 1)[0];
  if (removed && removed.variantId) {
    product2ColState.removedVariantIds.push(removed.variantId);
  }
  const tableContainer = document.getElementById('matrixTableContainer');
  if (tableContainer) tableContainer.innerHTML = renderMatrixTableHtml();
  validateMatrixCombinations();
}

function onMatrixAttrSelectChange(rowIdx, attrName, val) {
  if (product2ColState.matrixRows[rowIdx]) {
    product2ColState.matrixRows[rowIdx].attributeValues[attrName] = val;
    validateMatrixCombinations();
  }
}

function onMatrixSkuInput(rowIdx, val) {
  if (product2ColState.matrixRows[rowIdx]) {
    product2ColState.matrixRows[rowIdx].sku = val.trim();
    validateMatrixCombinations();
  }
}

function onMatrixWeightInput(rowIdx, val) {
  if (product2ColState.matrixRows[rowIdx]) {
    product2ColState.matrixRows[rowIdx].weight = val !== '' ? Number(val) : null;
  }
}

function onMatrixPriceInput(rowIdx, val) {
  if (product2ColState.matrixRows[rowIdx]) {
    product2ColState.matrixRows[rowIdx].price = val !== '' ? Number(val) : null;
  }
}

function onMatrixImageInput(rowIdx, val) {
  if (product2ColState.matrixRows[rowIdx]) {
    product2ColState.matrixRows[rowIdx].imageUrl = val.trim();
  }
}

function autoGenerateAllSkus() {
  const prodName = document.getElementById('p2c_name')?.value.trim() || 'PRODUCT';
  const prefix = generateSkuPrefix(prodName);
  const attrs = product2ColState.attributes;

  product2ColState.matrixRows.forEach((row, idx) => {
    const slugParts = attrs
      .map(a => row.attributeValues[a.name])
      .filter(Boolean)
      .map(toAsciiSlug);

    const suffix = slugParts.length > 0 ? slugParts.join('-') : `V${idx + 1}`;
    row.sku = `${prefix}-${suffix}`.toUpperCase();
    const input = document.getElementById(`sku_${idx}`);
    if (input) input.value = row.sku;
  });

  validateMatrixCombinations();
  toast('Đã cập nhật mã SKU gợi ý cho toàn bộ ma trận!', 'success');
}

function syncMatrixInputsFromDom() {
  product2ColState.matrixRows.forEach((row, idx) => {
    const skuInput = document.getElementById(`sku_${idx}`);
    if (skuInput) row.sku = skuInput.value.trim();

    const weightInput = document.getElementById(`weight_${idx}`);
    if (weightInput) row.weight = weightInput.value !== '' ? Number(weightInput.value) : null;

    const priceInput = document.getElementById(`price_${idx}`);
    if (priceInput && !priceInput.disabled) row.price = priceInput.value !== '' ? Number(priceInput.value) : null;

    const imgInput = document.getElementById(`img_${idx}`);
    if (imgInput) row.imageUrl = imgInput.value.trim();
  });
}

function validateMatrixCombinations() {
  const alertEl = document.getElementById('matrixValidationAlert');
  const rows = product2ColState.matrixRows;
  const attrs = product2ColState.attributes;

  syncMatrixInputsFromDom();

  const seenCombos = new Map();
  const seenSkus = new Map();
  let hasComboError = false;
  let hasSkuError = false;
  let duplicateInfo = '';

  rows.forEach((row, idx) => {
    const tableRow = document.getElementById(`matrixRow_${idx}`);
    if (tableRow) tableRow.classList.remove('matrix-row-error');

    const comboKey = attrs.map(a => `${a.name.trim()}:${(row.attributeValues[a.name] || '').trim()}`).sort().join('|');

    if (attrs.length > 0 && comboKey) {
      if (seenCombos.has(comboKey)) {
        hasComboError = true;
        const prevIdx = seenCombos.get(comboKey);
        duplicateInfo = `Dòng #${prevIdx + 1} và Dòng #${idx + 1} đang trùng tổ hợp thuộc tính (${comboKey.replace(/\|/g, ', ')}).`;
        if (tableRow) tableRow.classList.add('matrix-row-error');
        const prevRow = document.getElementById(`matrixRow_${prevIdx}`);
        if (prevRow) prevRow.classList.add('matrix-row-error');
      } else {
        seenCombos.set(comboKey, idx);
      }
    }

    const sku = (row.sku || '').trim().toUpperCase();
    if (sku) {
      if (seenSkus.has(sku)) {
        hasSkuError = true;
        const prevIdx = seenSkus.get(sku);
        duplicateInfo = `Mã SKU '${sku}' đang bị trùng giữa Dòng #${prevIdx + 1} và Dòng #${idx + 1}.`;
        if (tableRow) tableRow.classList.add('matrix-row-error');
      } else {
        seenSkus.set(sku, idx);
      }
    }
  });

  if (alertEl) {
    if (hasComboError || hasSkuError) {
      alertEl.style.display = 'block';
      alertEl.innerHTML = `⚠️ <strong>Phát hiện trùng lặp:</strong> ${esc(duplicateInfo)} Mỗi biến thể phải là một sự kết hợp duy nhất.`;
      return false;
    } else {
      alertEl.style.display = 'none';
      return true;
    }
  }
  return !hasComboError && !hasSkuError;
}

async function saveProduct2ColForm() {
  syncMatrixInputsFromDom();

  const name = document.getElementById('p2c_name')?.value.trim();
  const catId = document.getElementById('p2c_cat')?.value;
  const brandId = document.getElementById('p2c_brand')?.value;
  const supplierId = document.getElementById('p2c_supplier')?.value;
  const desc = document.getElementById('p2c_desc')?.value.trim();
  const gender = Number(document.getElementById('p2c_gender')?.value || 3);
  const imageUrl = document.getElementById('p2c_imageUrl')?.value.trim() || null;
  const isFeatured = document.getElementById('p2c_featured')?.checked || false;
  const isNew = document.getElementById('p2c_isNew')?.checked || false;
  const status = document.getElementById('p2c_status') ? Number(document.getElementById('p2c_status').value) : 1;

  if (!name) { toast('Tên sản phẩm không được để trống.', 'error'); return; }
  if (!catId) { toast('Vui lòng chọn danh mục.', 'error'); return; }
  if (!brandId) { toast('Vui lòng chọn thương hiệu.', 'error'); return; }
  if (!desc) { toast('Mô tả sản phẩm không được để trống.', 'error'); return; }

  const fromVal = document.getElementById('p2c_ageFromVal')?.value;
  const fromUnit = document.getElementById('p2c_ageFromUnit')?.value;
  const toVal = document.getElementById('p2c_ageToVal')?.value;
  const toUnit = document.getElementById('p2c_ageToUnit')?.value;

  let ageFrom = null;
  let ageTo = null;
  try {
    ageFrom = ageToMonths(fromVal, fromUnit);
    ageTo = ageToMonths(toVal, toUnit);
    if (ageFrom !== null && ageTo !== null && ageFrom > ageTo) {
      throw new Error('Độ tuổi bắt đầu không được lớn hơn độ tuổi kết thúc.');
    }
  } catch (err) {
    toast(err.message, 'error');
    return;
  }

  if (!product2ColState.matrixRows || product2ColState.matrixRows.length === 0) {
    toast('Sản phẩm cần có ít nhất một biến thể.', 'error');
    return;
  }

  for (let i = 0; i < product2ColState.matrixRows.length; i++) {
    const row = product2ColState.matrixRows[i];
    if (!row.sku || !row.sku.trim()) {
      toast(`Dòng #${i + 1}: SKU không được để trống.`, 'error');
      return;
    }
  }

  const isValidMatrix = validateMatrixCombinations();
  if (!isValidMatrix) {
    toast('Vui lòng sửa các biến thể bị trùng lặp trước khi lưu.', 'error');
    return;
  }

  const formattedVariants = product2ColState.matrixRows.map(row => {
    const attrsList = [];
    let order = 0;
    product2ColState.attributes.forEach(attr => {
      const val = row.attributeValues[attr.name];
      if (val) {
        attrsList.push({
          attributeName: attr.name,
          attributeValue: val,
          displayOrder: order++
        });
      }
    });

    return {
      variantId: row.variantId,
      sku: row.sku.trim(),
      price: row.price !== null && row.price !== '' ? Number(row.price) : null,
      costPrice: row.costPrice !== null && row.costPrice !== '' ? Number(row.costPrice) : null,
      weight: row.weight !== null && row.weight !== '' ? Number(row.weight) : null,
      imageUrl: row.imageUrl ? row.imageUrl.trim() : null,
      status: 1,
      attributes: attrsList
    };
  });

  try {
    if (product2ColState.isEdit) {
      const updatePayload = {
        categoryId: Number(catId),
        brandId: Number(brandId),
        supplierId: supplierId ? Number(supplierId) : null,
        name,
        description: desc,
        ageFrom,
        ageTo,
        gender,
        status,
        isFeatured,
        isNew,
        imageUrl
      };

      await api(`Product/${product2ColState.productId}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload)
      });

      for (const v of formattedVariants) {
        if (v.variantId) {
          await api(`Product/variants/${v.variantId}`, {
            method: 'PUT',
            body: JSON.stringify({
              sku: v.sku,
              attributes: v.attributes,
              price: v.price,
              costPrice: v.costPrice,
              weight: v.weight,
              imageUrl: v.imageUrl,
              status: v.status
            })
          });
        } else {
          await api(`Product/${product2ColState.productId}/variants`, {
            method: 'POST',
            body: JSON.stringify({
              sku: v.sku,
              attributes: v.attributes,
              price: v.price,
              costPrice: v.costPrice,
              weight: v.weight,
              imageUrl: v.imageUrl,
              status: v.status
            })
          });
        }
      }

      for (const vid of product2ColState.removedVariantIds) {
        try {
          await api(`Product/variants/${vid}`, { method: 'DELETE' });
        } catch (e) {
          console.warn('Không thể xóa biến thể cũ:', e);
        }
      }

      toast('Cập nhật sản phẩm và ma trận biến thể thành công!', 'success');
    } else {
      const createPayload = {
        categoryId: Number(catId),
        brandId: Number(brandId),
        supplierId: supplierId ? Number(supplierId) : null,
        name,
        description: desc,
        ageFrom,
        ageTo,
        gender,
        status: 0,
        isFeatured,
        isNew,
        imageUrl,
        variants: formattedVariants.map(v => ({
          sku: v.sku,
          attributes: v.attributes,
          price: null,
          costPrice: null,
          weight: v.weight,
          imageUrl: v.imageUrl,
          status: 1
        }))
      };

      await api('Product', {
        method: 'POST',
        body: JSON.stringify(createPayload)
      });

      toast('Tạo mới sản phẩm và cấu hình biến thể thành công!', 'success');
    }

    await loadRef();
    renderList('products');
  } catch (err) {
    toast(`Lỗi lưu sản phẩm: ${err.message}`, 'error');
  }
}

function generateSkuPrefix(name) {
  if (!name) return 'TOY';
  const clean = toAsciiSlug(name).split('-').filter(Boolean);
  if (clean.length === 1) return clean[0].slice(0, 6).toUpperCase();
  return clean.map(w => w[0]).join('').slice(0, 6).toUpperCase() || 'TOY';
}

function toAsciiSlug(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function updateImagePreview(url) {
  const previewDiv = document.getElementById('p2c_imgPreview');
  if (!previewDiv) return;
  if (url && url.startsWith('http')) {
    previewDiv.style.display = 'block';
    previewDiv.innerHTML = `<img src="${esc(url)}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--slate-200);" onerror="this.parentElement.style.display='none'">`;
  } else {
    previewDiv.style.display = 'none';
  }
}

// ── SHIPPING BATCH DISPATCHING MODAL ─────────────────────────
async function showShippingBatchModal() {
  const modalId = 'shippingBatchModalOverlay';
  let existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = modalId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;width:100%;max-width:850px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
      <div style="padding:20px 24px;border-bottom:1px solid var(--slate-200);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="margin:0;font-size:18px;">🚚 Đề Xuất Gộp Đơn Giao Hàng</h3>
          <p style="margin:4px 0 0;font-size:13px;color:var(--slate-500);">Tự động phát hiện các đơn hàng cùng khách nhận hoặc cùng tuyến đường lân cận (≤ 3km) để gom chuyến tối ưu chi phí vận chuyển.</p>
        </div>
        <button type="button" class="icon-action-btn del" onclick="document.getElementById('${modalId}').remove()" style="font-size:18px;">✕</button>
      </div>
      <div id="shippingBatchModalBody" style="padding:24px;overflow-y:auto;flex:1;">
        <div style="text-align:center;padding:30px;color:var(--slate-400);">Đang tải các đề xuất gộp đơn từ máy chủ...</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  try {
    const suggestions = await api('Shipping/batch-suggestions?maxDistanceKm=3.0');
    const container = document.getElementById('shippingBatchModalBody');
    if (!suggestions || suggestions.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:40px;margin-bottom:12px;">📦</div>
          <h4>Hiện chưa có đơn hàng nào cần gộp</h4>
          <p style="color:var(--slate-500);font-size:13px;">Tất cả các đơn chờ giao hiện tại đều có lộ trình riêng biệt hoặc đã được phân bổ mã lô.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = suggestions.map((group, idx) => {
      const deliveryStops = Array.isArray(group.deliveryStops) ? group.deliveryStops : [];
      const deliveryStopsHtml = deliveryStops.length
        ? deliveryStops.map(stop => `
            <div style="display:grid;grid-template-columns:auto 1fr;gap:7px 10px;align-items:start;padding:8px 0;border-bottom:1px dashed var(--slate-200);">
              <code style="background:var(--slate-100);padding:2px 7px;border-radius:4px;font-size:12px;font-weight:600;white-space:nowrap;">#${esc(stop.orderCode || stop.orderId)}</code>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--slate-700);">${esc(stop.address || 'Chưa có địa chỉ giao')}</div>
                <small style="color:var(--slate-500);">${esc(stop.receiverName || '')}${stop.receiverPhone ? ` · ${esc(stop.receiverPhone)}` : ''}</small>
              </div>
            </div>`).join('')
        : `<div style="font-size:13px;color:var(--slate-500);">${esc(group.commonAddressArea || 'Lân cận')}</div>`;

      const isCustomerGroup = (group.reason || '').toLowerCase().includes('cùng người nhận') || (group.reason || '').toLowerCase().includes('cùng khách');
      const badgeHtml = isCustomerGroup
        ? `<span class="batch-badge-customer">👤 Gộp đơn cùng khách</span>`
        : `<span class="batch-badge-route">🗺️ Gom chuyến theo tuyến đường</span>`;

      return `
      <div style="border:1px solid var(--slate-200);border-radius:12px;padding:18px;margin-bottom:16px;background:var(--slate-50);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="badge" style="background:#e0e7ff;color:#3730a3;font-weight:700;">Nhóm #${idx + 1}</span>
              ${badgeHtml}
              <strong>${esc(group.reason)}</strong>
            </div>
            <div style="font-size:13px;color:var(--slate-600);margin-top:5px;">
              ${group.receiverPhone ? `SĐT: <b>${esc(group.receiverPhone)}</b> · ` : ''}
              Lộ trình: <b>${esc(group.commonAddressArea || 'Lân cận')}</b>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button class="secondary-btn" style="padding:8px 12px;font-size:13px;" onclick="executeMergeBatch(${JSON.stringify(group.orderIds).replace(/"/g, '&quot;')}, '${esc(group.targetBatchCode)}')">
              Gộp ${group.totalOrders} đơn
            </button>
            <button class="primary-btn" style="padding:8px 14px;font-size:13px;" onclick="executeMergeAndDispatchBatch(${JSON.stringify(group.orderIds).replace(/"/g, '&quot;')}, '${esc(group.targetBatchCode)}')">
              Gộp & Xuất giao ngay 🚚
            </button>
          </div>
        </div>
        <div style="background:white;border-radius:8px;padding:10px 14px;border:1px solid var(--slate-200);">
          <small style="color:var(--slate-500);display:block;margin-bottom:4px;">Điểm giao theo từng đơn (${group.totalOrders} đơn):</small>
          <div>${deliveryStopsHtml}</div>
        </div>
      </div>
    `;
    }).join('');
  } catch (err) {
    const container = document.getElementById('shippingBatchModalBody');
    if (container) {
      container.innerHTML = `<div style="color:var(--danger);text-align:center;padding:30px;">Không thể tải đề xuất: ${esc(err.message)}</div>`;
    }
  }
}

async function executeMergeBatch(orderIds, batchCode) {
  try {
    await api('Shipping/merge-batch', {
      method: 'POST',
      body: JSON.stringify({ orderIds, batchCode })
    });
    toast(`Đã gộp ${orderIds.length} đơn hàng vào mã lô ${batchCode} thành công!`, 'success');
    document.getElementById('shippingBatchModalOverlay')?.remove();
    renderList('orders');
  } catch (err) {
    toast(`Lỗi gộp đơn: ${err.message}`, 'error');
  }
}

async function executeMergeAndDispatchBatch(orderIds, batchCode) {
  try {
    await api('Shipping/merge-batch', {
      method: 'POST',
      body: JSON.stringify({ orderIds, batchCode })
    });
    await api(`Shipping/dispatch-batch/${encodeURIComponent(batchCode)}`, {
      method: 'POST'
    });
    toast(`Đã gộp và xuất kho ${orderIds.length} đơn sang trạng thái "Đang giao" (Lô ${batchCode})!`, 'success');
    document.getElementById('shippingBatchModalOverlay')?.remove();
    renderList('orders');
  } catch (err) {
    toast(`Lỗi xuất giao lô: ${err.message}`, 'error');
  }
}

async function dispatchShippingBatch(batchCode, currentOrderId) {
  if (!confirm(`Xác nhận xuất kho và chuyển toàn bộ đơn hàng thuộc lô ${batchCode} sang trạng thái "Đang giao"?`)) return;
  try {
    await api(`Shipping/dispatch-batch/${encodeURIComponent(batchCode)}`, {
      method: 'POST'
    });
    toast(`Đã xuất kho lô ${batchCode} thành công!`, 'success');
    if (currentOrderId) {
      showOrderDetail(currentOrderId);
    } else {
      renderList('orders');
    }
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// ── 8. SHIPPER ASSIGNMENT & REALTIME TRACKING (MỤC 4) ────────
async function showAssignShipperModal(orderId, batchCode) {
  const modalId = 'assignShipperModalOverlay';
  let existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = modalId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;width:100%;max-width:580px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;">
      <div style="padding:18px 24px;border-bottom:1px solid var(--slate-200);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="margin:0;font-size:17px;font-weight:700;">🚚 Phân công Shipper giao hàng</h3>
          <p style="margin:4px 0 0;font-size:13px;color:var(--slate-500);">${orderId ? `Đơn hàng #${orderId}` : ''} ${batchCode ? `· Mã lô: <b>${batchCode}</b>` : ''}</p>
        </div>
        <button type="button" class="icon-action-btn del" onclick="document.getElementById('${modalId}').remove()" style="font-size:18px;">✕</button>
      </div>
      <div id="assignShipperModalBody" style="padding:20px 24px;max-height:70vh;overflow-y:auto;">
        <div style="text-align:center;padding:30px;color:var(--slate-400);">Đang tải danh sách shipper...</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  try {
    const shippers = await api('Shipper');
    const container = document.getElementById('assignShipperModalBody');
    if (!shippers || shippers.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--slate-500);">Chưa có nhân viên giao hàng nào trong hệ thống. Hãy thêm mới trong mục <b>Shipper giao hàng</b>.</div>`;
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom:14px;font-size:13px;color:var(--slate-600);font-weight:600;">Chọn nhân viên giao hàng nhận chuyến:</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${shippers.filter(s => s.isActive).map((s, idx) => `
          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:1.5px solid var(--slate-200);border-radius:10px;cursor:pointer;transition:all 0.2s ease;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--slate-200)'">
            <div style="display:flex;align-items:center;gap:12px;">
              <input type="radio" name="selectedShipperId" value="${s.shipperId}" ${idx === 0 ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
              <div>
                <strong style="font-size:14px;color:var(--slate-800);">${esc(s.fullName)}</strong>
                <div style="font-size:12.5px;color:var(--slate-500);margin-top:2px;">
                  📞 ${esc(s.phoneNumber)} · Xe: <b>${esc(s.vehicleNumber || '—')}</b>
                </div>
                <div style="font-size:12px;color:var(--slate-400);margin-top:2px;">Tuyến phụ trách: <b>${esc(s.assignedArea || 'Linh hoạt')}</b></div>
              </div>
            </div>
            <div style="text-align:right;">
              <span class="badge" style="background:#eff6ff;color:#1d4ed8;font-weight:700;">Đang giao: ${s.activeOrdersCount || 0}</span>
              ${s.pendingCodAmount > 0 ? `<div style="font-size:11.5px;color:#b45309;font-weight:700;margin-top:4px;">COD giữ: ${money(s.pendingCodAmount)}</div>` : ''}
            </div>
          </label>
        `).join('')}
      </div>
      <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" class="ghost-btn" onclick="document.getElementById('${modalId}').remove()">Hủy</button>
        <button type="button" class="primary-btn" onclick="executeAssignShipper(${orderId || 'null'}, ${batchCode ? `'${batchCode}'` : 'null'})">Xác nhận phân công 🚚</button>
      </div>
    `;
  } catch (err) {
    const container = document.getElementById('assignShipperModalBody');
    if (container) container.innerHTML = `<div style="color:var(--danger);text-align:center;padding:20px;">Lỗi: ${esc(err.message)}</div>`;
  }
}

async function executeAssignShipper(orderId, batchCode) {
  const selected = document.querySelector('input[name="selectedShipperId"]:checked');
  if (!selected) {
    toast('Vui lòng chọn một nhân viên giao hàng.', 'warning');
    return;
  }
  const shipperId = Number(selected.value);
  try {
    const res = await api('Shipper/assign-order', {
      method: 'POST',
      body: JSON.stringify({
        shipperId,
        orderId: orderId || null,
        deliveryBatchCode: batchCode || null
      })
    });
    toast(res.message || 'Gán shipper thành công!', 'success');
    document.getElementById('assignShipperModalOverlay')?.remove();
    if (document.querySelector('.form-view-panel') && orderId) {
      showOrderDetail(orderId);
    } else {
      renderList('orders');
    }
  } catch (err) {
    toast(`Lỗi gán shipper: ${err.message}`, 'error');
  }
}

async function confirmSingleCodSubmission(paymentId, orderId) {
  if (!confirm('Xác nhận đã nhận đủ tiền COD từ shipper và đối soát vào quỹ cửa hàng?')) return;
  try {
    const res = await api('Shipper/confirm-cod-submission', {
      method: 'POST',
      body: JSON.stringify({
        paymentIds: [paymentId]
      })
    });
    toast(res.message || 'Đối soát tiền COD thành công!', 'success');
    if (orderId && document.querySelector('.form-view-panel')) {
      showOrderDetail(orderId);
    } else {
      renderList('cod');
    }
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

async function retryDeliveryAction(orderId) {
  if (!confirm('Xác nhận xuất giao lại cho đơn hàng này?')) return;
  try {
    await api(`Shipper/orders/${orderId}/retry-delivery`, { method: 'POST' });
    toast('Đã chuyển đơn sang trạng thái Đang giao lại!', 'success');
    showOrderDetail(orderId);
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// ── SIGNALR ORDER TRACKING CLIENT (ADMIN) ────────────────────
let orderTrackingConnection = null;
async function initOrderTrackingSignalR() {
  if (typeof signalR === 'undefined' || orderTrackingConnection) return;
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    orderTrackingConnection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/order-tracking' + (token ? `?access_token=${encodeURIComponent(token)}` : ''))
      .withAutomaticReconnect()
      .build();

    orderTrackingConnection.on('ReceiveOrderStateChanged', data => {
      console.log('[SignalR Admin] ReceiveOrderStateChanged:', data);
      toast(`⚡ Cập nhật vận chuyển: ${data.message || 'Đơn hàng vừa thay đổi trạng thái'}`, 'info');
      // Nếu đang mở trang Đơn hàng hoặc Đối soát COD -> Tự động nạp lại dữ liệu
      const hash = window.location.hash.slice(1);
      if (hash === 'orders' || hash === 'cod' || hash === 'shippers') {
        renderList(hash);
      }
    });

    await orderTrackingConnection.start();
    await orderTrackingConnection.invoke('JoinAdmin');
    console.log('[SignalR Admin] Đã kết nối OrderTrackingHub thành công.');
  } catch (e) {
    console.warn('[SignalR Admin] Không thể kết nối realtime:', e.message);
  }
}

window.openProduct2ColForm = openProduct2ColForm;
window.saveProduct2ColForm = saveProduct2ColForm;
window.toggleAttributeGroup = toggleAttributeGroup;
window.addCustomAttributeGroup = addCustomAttributeGroup;
window.addValueToAttribute = addValueToAttribute;
window.removeValueFromAttribute = removeValueFromAttribute;
window.generateVariantMatrix = generateVariantMatrix;
window.addManualVariantRow = addManualVariantRow;
window.removeMatrixRow = removeMatrixRow;
window.autoGenerateAllSkus = autoGenerateAllSkus;
window.onMatrixAttrSelectChange = onMatrixAttrSelectChange;
window.onMatrixSkuInput = onMatrixSkuInput;
window.onMatrixWeightInput = onMatrixWeightInput;
window.onMatrixPriceInput = onMatrixPriceInput;
window.onMatrixImageInput = onMatrixImageInput;
window.updateImagePreview = updateImagePreview;
window.applyProductFilters = applyProductFilters;
window.resetProductFilters = resetProductFilters;
window.showShippingBatchModal = showShippingBatchModal;
window.executeMergeBatch = executeMergeBatch;
window.executeMergeAndDispatchBatch = executeMergeAndDispatchBatch;
window.dispatchShippingBatch = dispatchShippingBatch;
window.switchOrderTab = switchOrderTab;
window.updateOrderTabCounts = updateOrderTabCounts;
window.applyOrderFilters = applyOrderFilters;
window.resetOrderFilters = resetOrderFilters;
window.unbatchOrderAction = unbatchOrderAction;
window.showOrderDetail = showOrderDetail;
window.showAssignShipperModal = showAssignShipperModal;
window.executeAssignShipper = executeAssignShipper;
window.confirmSingleCodSubmission = confirmSingleCodSubmission;
window.retryDeliveryAction = retryDeliveryAction;
window.initOrderTrackingSignalR = initOrderTrackingSignalR;
window.unbatchOrderAction = unbatchOrderAction;
window.showOrderDetail = showOrderDetail;
function productAgeInputValue(months) {
  if (months === null || months === undefined || months === '') return '';
  const value = Number(months);
  if (!Number.isFinite(value) || value < 0) return '';
  return value > 0 && value % 12 === 0 ? value / 12 : value;
}

function productAgeInputUnit(months) {
  const value = Number(months);
  return value > 0 && value % 12 === 0 ? 'year' : 'month';
}

function ageToMonths(value, unit) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error('Độ tuổi phải là số nguyên không âm.');
  }
  return unit === 'year' ? number * 12 : number;
}

function renderPromotionVariantChoices(promotion = {}) {
  const selectedVariantIds = new Set((promotion.promotionProducts || [])
    .map(item => Number(item.variantId)));
  const variants = (ref.products || []).flatMap(product => productVariantsOf(product)
    .map(variant => ({
      id: Number(variant.variantId || variant.id),
      productName: product.name || 'Sản phẩm',
      sku: variant.sku || `SKU #${variant.variantId || variant.id}`,
      price: variant.price
    })))
    .filter(variant => variant.id > 0);

  if (!variants.length) {
    return '<p style="margin:0;color:var(--danger);">Chưa có biến thể sản phẩm. Hãy tạo sản phẩm, sau đó thêm khuyến mãi.</p>';
  }

  return `<div style="max-height:220px;overflow:auto;border:1px solid var(--slate-200);border-radius:9px;padding:8px;background:white;">
    ${variants.map(variant => `<label style="display:flex;gap:9px;align-items:flex-start;padding:8px;border-bottom:1px solid var(--slate-100);cursor:pointer;">
      <input type="checkbox" name="promotionVariantIds" value="${variant.id}" ${selectedVariantIds.has(variant.id) ? 'checked' : ''}>
      <span><strong>${esc(variant.productName)}</strong><br><small>SKU: ${esc(variant.sku)} · Giá gốc: ${money(variant.price)}</small></span>
    </label>`).join('')}
  </div>`;
}

function renderFormFields(key, r) {
  const v = r || {};
  switch (key) {
    case 'products': {
      const ageFromValue = productAgeInputValue(v.ageFrom);
      const ageToValue = productAgeInputValue(v.ageTo);
      const ageFromUnit = productAgeInputUnit(v.ageFrom);
      const ageToUnit = productAgeInputUnit(v.ageTo);
      return `
        <div class="form-section-card" style="margin:0 0 18px;background:var(--primary-light);border-color:#c7d2fe;">
          <strong>Trình tự tạo sản phẩm</strong>
          <p style="margin:6px 0 0;color:var(--slate-600);font-size:13px;">1. Tạo sản phẩm và nêu các biến thể → 2. Lập, duyệt phiếu nhập nhà cung cấp → 3. Khi tồn kho có sẵn, cập nhật giá bán ở đúng biến thể. Trạng thái kinh doanh được hệ thống tự xác định theo tồn kho.</p>
        </div>
        <div class="form-grid-2">
          <div class="form-group full">
            <label>Tên sản phẩm đồ chơi *</label>
            <input name="name" class="input-control" value="${esc(v.name)}" required placeholder="Ví dụ: Bộ xếp hình Lego City Cảnh Sát">
          </div>
          <div class="form-group">
            <label>Danh mục *</label>
            <div style="display:flex;gap:8px;">
              <select name="categoryId" class="input-control" required id="prodCatSelect">
                <option value="">-- Chọn danh mục --</option>
                ${ref.categories.map(c => `<option value="${c.id || c.categoryId}" ${v.categoryId == (c.id || c.categoryId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
              </select>
              <button type="button" class="secondary-btn" title="Thêm danh mục mới" onclick="quickAddRef('category')">+</button>
            </div>
          </div>
          <div class="form-group">
            <label>Thương hiệu *</label>
            <div style="display:flex;gap:8px;">
              <select name="brandId" class="input-control" required id="prodBrandSelect">
                <option value="">-- Chọn thương hiệu --</option>
                ${ref.brands.map(b => `<option value="${b.id || b.brandId}" ${v.brandId == (b.id || b.brandId) ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
              </select>
              <button type="button" class="secondary-btn" title="Thêm thương hiệu mới" onclick="quickAddRef('brand')">+</button>
            </div>
          </div>
          <div class="form-group">
            <label>Độ tuổi phù hợp</label>
            <div style="display:flex;gap:10px;">
              <input name="ageFromValue" type="number" min="0" step="1" class="input-control" value="${ageFromValue}" placeholder="Từ">
              <select name="ageFromUnit" class="input-control" style="max-width:100px;"><option value="month" ${ageFromUnit === 'month' ? 'selected' : ''}>tháng</option><option value="year" ${ageFromUnit === 'year' ? 'selected' : ''}>năm</option></select>
              <input name="ageToValue" type="number" min="0" step="1" class="input-control" value="${ageToValue}" placeholder="Đến">
              <select name="ageToUnit" class="input-control" style="max-width:100px;"><option value="month" ${ageToUnit === 'month' ? 'selected' : ''}>tháng</option><option value="year" ${ageToUnit === 'year' ? 'selected' : ''}>năm</option></select>
            </div>
            <small style="display:block;margin-top:5px;color:var(--slate-500);">Hệ thống lưu theo tháng và tự quy đổi khi bạn chọn năm.</small>
          </div>
          <div class="form-group">
            <label>Giới tính phù hợp</label>
            <select name="gender" class="input-control">
              <option value="3" ${v.gender === 3 ? 'selected' : ''}>Cả hai (Bé trai & Bé gái)</option>
              <option value="1" ${v.gender === 1 ? 'selected' : ''}>Bé trai</option>
              <option value="2" ${v.gender === 2 ? 'selected' : ''}>Bé gái</option>
            </select>
          </div>
          <div class="form-group full">
            <label>Mô tả chi tiết sản phẩm *</label>
            <textarea name="description" class="input-control" rows="4" required placeholder="Nhập mô tả sản phẩm, chất liệu, tính năng...">${esc(v.description)}</textarea>
          </div>
          <div class="form-group full">
            <label>URL hình ảnh sản phẩm</label>
            <input name="imageUrl" type="url" class="input-control" value="${esc(v.imageUrl)}" placeholder="https://example.com/hinh-san-pham.jpg">
          </div>
        </div>
        ${renderProductVariantsSection(v)}
      `;
    }

    case 'categories':
    case 'brands':
      return `
        <div class="form-grid-2">
          <div class="form-group full">
            <label>Tên gọi *</label>
            <input name="name" class="input-control" value="${esc(v.name)}" required placeholder="Nhập tên...">
          </div>
          <div class="form-group full">
            <label>Mô tả</label>
            <textarea name="description" class="input-control" rows="3" placeholder="Nhập mô tả tóm tắt...">${esc(v.description)}</textarea>
          </div>
          <div class="form-group">
            <label>Trạng thái</label>
            <select name="isActive" class="input-control">
              <option value="true" ${v.isActive !== false ? 'selected' : ''}>Hoạt động</option>
              <option value="false" ${v.isActive === false ? 'selected' : ''}>Tạm khóa</option>
            </select>
          </div>
        </div>
      `;

    case 'suppliers':
      return `
        <div class="form-grid-2">
          <div class="form-group">
            <label>Tên nhà cung cấp *</label>
            <input name="name" class="input-control" value="${esc(v.name)}" required placeholder="Ví dụ: Công ty Cổ phần Đồ Chơi Việt Nam">
          </div>
          <div class="form-group">
            <label>Số điện thoại *</label>
            <input name="phone" class="input-control" value="${esc(v.phone)}" required placeholder="0901234567">
          </div>
          <div class="form-group">
            <label>Email liên hệ</label>
            <input name="email" type="email" class="input-control" value="${esc(v.email)}" placeholder="ncc@domain.com">
          </div>
          <div class="form-group">
            <label>Mã số thuế</label>
            <input name="taxCode" class="input-control" value="${esc(v.taxCode)}" placeholder="0312345678">
          </div>
          <div class="form-group full">
            <label>Địa chỉ trụ sở / Kho xuất hàng</label>
            <input name="address" class="input-control" value="${esc(v.address)}" placeholder="Số 123 Đường XYZ, Quận 1, TP.HCM">
          </div>
          <div class="form-group">
            <label>Trạng thái hợp tác</label>
            <select name="isActive" class="input-control">
              <option value="true" ${v.isActive !== false ? 'selected' : ''}>Đang hoạt động</option>
              <option value="false" ${v.isActive === false ? 'selected' : ''}>Tạm ngưng</option>
            </select>
          </div>
        </div>
      `;

    case 'imports':
      return renderPurchaseOrderForm(v);

    case 'promotions':
      return `
        <div class="form-grid-2">
          <div class="form-group full">
            <label>Tên chương trình khuyến mãi *</label>
            <input name="name" class="input-control" value="${esc(v.name)}" required placeholder="Ví dụ: Siêu Sale Trung Thu 2026">
          </div>
          <div class="form-group">
            <label>Loại giảm giá *</label>
            <select name="promotionType" class="input-control">
              <option value="0" ${v.promotionType === 0 ? 'selected' : ''}>Phần trăm (%)</option>
              <option value="1" ${v.promotionType === 1 ? 'selected' : ''}>Số tiền cố định (đ)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Giá trị giảm *</label>
            <input name="discountValue" type="number" min="0" step="any" class="input-control" value="${v.discountValue || ''}" required placeholder="10 (nếu là %) hoặc 50000 (nếu là VNĐ)">
          </div>
          <div class="form-group">
            <label>Mức giảm tối đa (đ)</label>
            <input name="maximumDiscount" type="number" min="0" step="1000" class="input-control" value="${v.maximumDiscount ?? ''}" placeholder="Chỉ dùng khi giảm theo %">
          </div>
          <div class="form-group">
            <label>Ngày bắt đầu *</label>
            <input name="startDate" type="date" class="input-control" value="${v.startDate ? v.startDate.split('T')[0] : new Date().toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label>Ngày kết thúc *</label>
            <input name="endDate" type="date" class="input-control" value="${v.endDate ? v.endDate.split('T')[0] : new Date(Date.now() + 7*86400000).toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label>Trạng thái</label>
            <select name="status" class="input-control">
              <option value="1" ${v.status === undefined || v.status === 1 ? 'selected' : ''}>Đang kích hoạt</option>
              <option value="0" ${v.status === 0 ? 'selected' : ''}>Tạm ngưng</option>
            </select>
          </div>
          <div class="form-group full">
            <label>Sản phẩm áp dụng *</label>
            <small style="display:block;margin:-3px 0 8px;color:var(--slate-500);">Chương trình tự động giảm giá cho toàn bộ biến thể được chọn; khách hàng không cần nhập mã.</small>
            ${renderPromotionVariantChoices(v)}
          </div>
          <div class="form-group full">
            <label>Mô tả chương trình</label>
            <textarea name="description" class="input-control" rows="3">${esc(v.description)}</textarea>
          </div>
        </div>
      `;

    case 'vouchers':
      return `
        <div class="form-grid-2">
          <div class="form-group full" style="padding:11px 12px;border-radius:8px;background:var(--primary-light);color:var(--slate-700);font-size:13px;">
            Nhập <b>0 điểm</b> cho voucher thông thường. Nhập số điểm lớn hơn 0 để khách đổi điểm lấy mã; mã đó chỉ dùng được bởi đúng khách đã đổi, một lần.
          </div>
          <div class="form-group">
            <label>Mã Voucher (Code) *</label>
            <input name="code" class="input-control" value="${esc(v.code)}" required placeholder="SALE50K" ${v.voucherId ? 'readonly' : ''} style="text-transform:uppercase;font-weight:700;">
            ${v.voucherId ? '<small style="color:var(--slate-500);">Mã đã phát hành nên không thể đổi.</small>' : ''}
          </div>
          <div class="form-group">
            <label>Tên Voucher *</label>
            <input name="name" class="input-control" value="${esc(v.name || v.code)}" required placeholder="Giảm 50K cho đơn từ 300K">
          </div>
          <div class="form-group">
            <label>Loại giảm giá</label>
            <select name="discountType" class="input-control">
              <option value="1" ${v.discountType === 1 ? 'selected' : ''}>Số tiền cố định (đ)</option>
              <option value="0" ${v.discountType === 0 ? 'selected' : ''}>Phần trăm (%)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Giá trị giảm *</label>
            <input name="discountValue" type="number" min="0" class="input-control" value="${v.discountValue || ''}" required placeholder="50000">
          </div>
          <div class="form-group">
            <label>Đơn hàng tối thiểu (đ)</label>
            <input name="minOrderAmount" type="number" min="0" class="input-control" value="${v.minimumOrderValue ?? v.minOrderAmount ?? 0}">
          </div>
          <div class="form-group">
            <label>Mức giảm tối đa (đ)</label>
            <input name="maximumDiscount" type="number" min="0" step="1000" class="input-control" value="${v.maximumDiscount ?? ''}" placeholder="Chỉ dùng khi giảm theo %">
          </div>
          <div class="form-group">
            <label>Tổng số lượt dùng</label>
            <input name="maxUsage" type="number" min="0" class="input-control" value="${v.usageLimit ?? v.maxUsage ?? 0}" placeholder="0 = không giới hạn">
          </div>
          <div class="form-group">
            <label>Giới hạn mỗi khách</label>
            <input name="usageLimitPerCustomer" type="number" min="1" class="input-control" value="${v.usageLimitPerCustomer ?? ''}" placeholder="Để trống = không giới hạn">
          </div>
          <div class="form-group">
            <label>Điểm cần để đổi</label>
            <input name="requiredPoints" type="number" min="0" step="1" class="input-control" value="${Number(v.requiredPoints || 0)}" placeholder="0 = voucher thông thường">
            <small style="color:var(--slate-500);">Voucher đổi điểm sẽ được giữ 1 lượt ngay khi khách đổi.</small>
          </div>
          <div class="form-group">
            <label>Bắt đầu hiệu lực *</label>
            <input name="startDate" type="date" class="input-control" value="${v.startDate ? v.startDate.split('T')[0] : new Date().toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label>Kết thúc hiệu lực *</label>
            <input name="endDate" type="date" class="input-control" value="${(v.endDate || v.expiryDate) ? (v.endDate || v.expiryDate).split('T')[0] : new Date(Date.now() + 30*86400000).toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label>Trạng thái</label>
            <select name="isActive" class="input-control">
              <option value="true" ${v.status === undefined ? v.isActive !== false ? 'selected' : '' : v.status === 1 ? 'selected' : ''}>Khả dụng</option>
              <option value="false" ${v.status === undefined ? v.isActive === false ? 'selected' : '' : v.status !== 1 ? 'selected' : ''}>Khóa</option>
            </select>
          </div>
        </div>
      `;

    case 'shippers':
      return `
        <div class="form-grid-2">
          <div class="form-group">
            <label>Họ và tên nhân viên giao hàng *</label>
            <input name="fullName" class="input-control" value="${esc(v.fullName || '')}" required placeholder="VD: Nguyễn Văn Giao">
          </div>
          <div class="form-group">
            <label>Số điện thoại liên lạc *</label>
            <input name="phoneNumber" class="input-control" value="${esc(v.phoneNumber || '')}" required placeholder="VD: 0909123456">
          </div>
          <div class="form-group">
            <label>Biển số xe vận chuyển</label>
            <input name="vehicleNumber" class="input-control" value="${esc(v.vehicleNumber || '')}" placeholder="VD: 59-X1 123.45">
          </div>
          <div class="form-group">
            <label>Tuyến đường / Khu vực giao hàng phụ trách</label>
            <input name="assignedArea" class="input-control" value="${esc(v.assignedArea || '')}" placeholder="VD: Quận 1, Quận 3, Bình Thạnh">
          </div>
          ${!v.shipperId ? `
            <div class="form-group">
              <label>Email tài khoản đăng nhập (tùy chọn)</label>
              <input class="input-control" type="email" name="email" placeholder="shipper@toystore.vn">
            </div>
            <div class="form-group">
              <label>Mật khẩu khởi tạo</label>
              <input class="input-control" type="password" name="password" placeholder="Shipper@123">
            </div>
          ` : ''}
          <div class="form-group full">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;margin-top:6px;">
              <input type="checkbox" name="isActive" ${v.isActive !== false ? 'checked' : ''} style="width:18px;height:18px;">
              <span>Đang hoạt động (sẵn sàng nhận chuyến giao hàng)</span>
            </label>
          </div>
        </div>
      `;

    case 'customers':
      return renderCustomerForm(v);

    default:
      return `<p>Biểu mẫu chưa được định nghĩa.</p>`;
  }
}

// ── 3B. CUSTOMER FORM & ORDERS HISTORY ───────────────────────
function renderCustomerForm(v = {}) {
  const customerId = v.customerId || v.id;
  const dob = v.dateOfBirth ? v.dateOfBirth.split('T')[0] : '';
  const points = v.loyaltyPoint ?? v.loyaltyPoints ?? 0;

  if (customerId) {
    setTimeout(() => loadCustomerOrdersForAdmin(customerId), 60);
  }

  return `
    <div class="form-grid-2">
      <div class="form-group">
        <label>Họ và tên khách hàng *</label>
        <input name="fullName" class="input-control" value="${esc(v.fullName || v.name)}" required placeholder="Nguyễn Văn A">
      </div>
      <div class="form-group">
        <label>Số điện thoại *</label>
        <input name="phone" class="input-control" value="${esc(v.phone || v.phoneNumber)}" required placeholder="0901234567">
      </div>
      <div class="form-group">
        <label>Email liên hệ *</label>
        <input name="email" type="email" class="input-control" value="${esc(v.email)}" required placeholder="email@domain.com">
      </div>
      <div class="form-group">
        <label>Ngày sinh</label>
        <input name="dateOfBirth" type="date" class="input-control" value="${dob}">
      </div>
      <div class="form-group">
        <label>Giới tính</label>
        <select name="gender" class="input-control">
          <option value="" ${v.gender === null || v.gender === undefined ? 'selected' : ''}>Chưa chọn</option>
          <option value="0" ${v.gender === 0 ? 'selected' : ''}>Nam</option>
          <option value="1" ${v.gender === 1 ? 'selected' : ''}>Nữ</option>
          <option value="2" ${v.gender === 2 ? 'selected' : ''}>Khác</option>
        </select>
      </div>
      <div class="form-group">
        <label>Điểm thưởng tích lũy</label>
        <input class="input-control" value="${Number(points).toLocaleString('vi-VN')} điểm" readonly style="background:var(--slate-100);font-weight:700;color:var(--secondary);">
      </div>
      <div class="form-group full">
        <label>Địa chỉ nhận hàng</label>
        <input name="address" class="input-control" value="${esc(v.address || '')}" placeholder="Số nhà, đường, quận/huyện, tỉnh/thành...">
      </div>
      <div class="form-group">
        <label>Trạng thái tài khoản</label>
        <select name="status" class="input-control">
          <option value="1" ${v.status === 1 || v.status === undefined ? 'selected' : ''}>Đang hoạt động</option>
          <option value="0" ${v.status === 0 ? 'selected' : ''}>Khóa tài khoản</option>
        </select>
      </div>
    </div>

    <!-- DANH SÁCH ĐƠN HÀNG CỦA KHÁCH HÀNG -->
    <div class="form-section-card" style="margin-top:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;display:flex;align-items:center;gap:8px;">📦 Lịch sử đơn hàng của khách hàng</h3>
        <span id="adminCustomerOrdersSummary" style="font-size:13px;font-weight:700;color:var(--slate-500);">${customerId ? 'Đang tải...' : 'Chưa có đơn hàng'}</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã đơn hàng</th>
              <th>Ngày đặt</th>
              <th>Số lượng món</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th style="text-align:right;">Thao tác</th>
            </tr>
          </thead>
          <tbody id="adminCustomerOrdersTbody">
            ${customerId ? '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--slate-400);">Đang tải danh sách đơn hàng...</td></tr>' : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--slate-400);">Khách hàng mới chưa có đơn hàng.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function loadCustomerOrdersForAdmin(customerId) {
  const tbody = document.getElementById('adminCustomerOrdersTbody');
  const summary = document.getElementById('adminCustomerOrdersSummary');
  if (!tbody || !customerId) return;

  try {
    const orders = await api(`Order/customer/${customerId}`);
    if (!orders || !orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--slate-400);">Khách hàng này chưa có đơn hàng nào.</td></tr>`;
      if (summary) summary.textContent = '0 đơn hàng';
      return;
    }

    orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const totalSpent = orders.filter(o => o.status !== 5).reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    if (summary) summary.textContent = `${orders.length} đơn hàng · Tổng chi tiêu: ${money(totalSpent)}`;

    tbody.innerHTML = orders.map(o => {
      const itemsCount = (o.orderDetails || o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
      const stLabel = ORDER_STATUS_LABELS[o.status] || 'Đang xử lý';
      const stPill = o.status === 4 ? 'success' : (o.status === 5 ? 'danger' : 'warning');

      return `
        <tr>
          <td><strong>#${esc(o.orderCode || o.orderId)}</strong></td>
          <td>${fmtDate(o.orderDate || o.createdAt)}</td>
          <td>${itemsCount} món</td>
          <td><strong style="color:var(--primary);">${money(o.totalAmount)}</strong></td>
          <td>${pill(stLabel, stPill)}</td>
          <td style="text-align:right;">
            <button type="button" class="icon-action-btn view" title="Xem chi tiết đơn hàng" onclick="showOrderDetail(${o.orderId})">👁</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger);padding:16px;">Lỗi tải đơn hàng: ${err.message}</td></tr>`;
  }
}

// ── 4. PURCHASE ORDER (PHIẾU ĐẶT HÀNG NCC) BUILDER ───────────
function renderPurchaseOrderForm(v) {
  const today = new Date().toISOString().split('T')[0];
  const randomCode = 'PO-' + new Date().getFullYear() + String(new Date().getMonth()+1).padStart(2,'0') + String(new Date().getDate()).padStart(2,'0') + '-' + Math.floor(1000 + Math.random() * 9000);
  const code = v.receiptCode || randomCode;
  const existingDetails = v.importReceiptDetails || [];
  const orderedByName = v.orderedByName || currentUser?.fullName || currentUser?.userName || 'Tài khoản đang đăng nhập';

  return `
    <div class="form-grid-2" style="margin-bottom:24px;">
      <div class="form-group">
        <label>Nhà cung cấp *</label>
        <select name="supplierId" class="input-control" required id="poSupplierSelect">
          <option value="">-- Chọn nhà cung cấp --</option>
          ${ref.suppliers.map(s => `<option value="${s.id || s.supplierId}" ${v.supplierId == (s.id || s.supplierId) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Mã phiếu đặt hàng *</label>
        <input name="receiptCode" class="input-control" value="${esc(code)}" required placeholder="PO-2026-001">
      </div>
      <div class="form-group">
        <label>Ngày đặt hàng *</label>
        <input name="importDate" type="date" class="input-control" value="${v.importDate ? v.importDate.split('T')[0] : today}" required>
      </div>
      <div class="form-group">
        <label>Người đặt</label>
        <input class="input-control" value="${esc(orderedByName)}" readonly aria-label="Người đặt hàng">
      </div>
      <div class="form-group">
        <label>Ghi chú đặt hàng</label>
        <input name="note" class="input-control" value="${esc(v.note || '')}" placeholder="Ghi chú điều khoản, thời gian dự kiến giao hàng...">
      </div>
    </div>

    <div class="form-section-card">
      <h4>
        <span>Danh sách sản phẩm đặt hàng từ nhà cung cấp</span>
        <button type="button" class="primary-btn" style="padding:6px 14px;font-size:12px;" onclick="addPurchaseOrderItemRow()">+ Thêm mặt hàng</button>
      </h4>
      <div class="order-items-builder">
        <table class="order-items-table">
          <thead>
            <tr>
              <th>Sản phẩm & Biến thể SKU *</th>
              <th style="width:140px;">Số lượng đặt *</th>
              <th style="width:180px;">Đơn giá nhập (đ) *</th>
              <th style="width:180px;">Thành tiền (đ)</th>
              <th style="width:50px;"></th>
            </tr>
          </thead>
          <tbody id="poItemsBody">
            ${existingDetails.length > 0 ? existingDetails.map((item, idx) => renderPurchaseOrderItemRow(item, idx)).join('') : ''}
          </tbody>
          <tfoot>
            <tr style="background:var(--slate-50);font-weight:700;">
              <td colspan="3" style="text-align:right;padding:12px 14px;">Tổng giá trị đơn đặt hàng:</td>
              <td style="padding:12px 14px;color:var(--primary);font-size:16px;" id="poTotalAmountDisplay">0 đ</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

let poRowIndex = 0;
function renderPurchaseOrderItemRow(item = {}, idx = null) {
  const rIdx = idx !== null ? idx : poRowIndex++;
  const variantOptions = (ref.products || []).map(p => {
    return `<optgroup label="${esc(p.name)}">
      ${productVariantsOf(p).map(vr => {
        const vId = vr.variantId || vr.id;
        const isSel = item.variantId == vId;
        return `<option value="${vId}" ${isSel ? 'selected' : ''}>${esc(p.name)} - SKU: ${esc(vr.sku || 'N/A')}</option>`;
      }).join('')}
    </optgroup>`;
  }).join('');

  const qty = item.quantity || 10;
  const cost = item.unitCost || 0;
  const total = qty * cost;

  return `
    <tr class="po-item-row" id="poRow_${rIdx}">
      <td>
        <select class="input-control po-variant-select" required onchange="calculatePOTotals()">
          <option value="">-- Chọn sản phẩm & SKU --</option>
          ${variantOptions}
        </select>
      </td>
      <td>
        <input type="number" min="1" class="input-control po-qty-input" value="${qty}" required oninput="calculatePOTotals()">
      </td>
      <td>
        <input type="number" min="0" step="1000" class="input-control po-cost-input" value="${cost}" required oninput="calculatePOTotals()">
      </td>
      <td>
        <span class="po-row-subtotal" style="font-weight:700;color:var(--slate-800);">${money(total)}</span>
      </td>
      <td style="text-align:center;">
        <button type="button" class="icon-action-btn del" title="Xóa dòng" onclick="removePurchaseOrderItemRow('poRow_${rIdx}')">✕</button>
      </td>
    </tr>
  `;
}

window.addPurchaseOrderItemRow = function() {
  const tbody = document.getElementById('poItemsBody');
  if (!tbody) return;
  const temp = document.createElement('tbody');
  temp.innerHTML = renderPurchaseOrderItemRow({}, poRowIndex++);
  tbody.appendChild(temp.firstElementChild);
  calculatePOTotals();
};

window.removePurchaseOrderItemRow = function(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
    calculatePOTotals();
  }
};

window.calculatePOTotals = function() {
  let grandTotal = 0;
  document.querySelectorAll('.po-item-row').forEach(row => {
    const qty = Number(row.querySelector('.po-qty-input')?.value || 0);
    const cost = Number(row.querySelector('.po-cost-input')?.value || 0);
    const sub = qty * cost;
    const subEl = row.querySelector('.po-row-subtotal');
    if (subEl) subEl.textContent = money(sub);
    grandTotal += sub;
  });
  const display = document.getElementById('poTotalAmountDisplay');
  if (display) display.textContent = money(grandTotal);
};

// ── 5. FORM SUBMISSION HANDLER ──────────────────────────────
async function handleFormSubmit(e, key, index) {
  e.preventDefault();
  const m = MODULES[key];
  const isEdit = index !== null;
  const record = isEdit ? cache[key][index] : null;
  const form = e.target;
  const fd = new FormData(form);
  let payload = Object.fromEntries(fd.entries());

  if (key === 'imports') {
    const supplierId = Number(payload.supplierId);
    if (!supplierId) {
      toast('Vui lòng chọn nhà cung cấp.', 'error');
      return;
    }

    const details = [];
    const rows = document.querySelectorAll('.po-item-row');
    if (rows.length === 0) {
      toast('Phiếu đặt hàng phải có ít nhất một mặt hàng.', 'error');
      return;
    }

    for (const r of rows) {
      const vSelect = r.querySelector('.po-variant-select');
      const variantId = Number(vSelect?.value);
      const quantity = Number(r.querySelector('.po-qty-input')?.value);
      const unitCost = Number(r.querySelector('.po-cost-input')?.value);

      if (!variantId) {
        toast('Vui lòng chọn sản phẩm cho từng dòng.', 'error');
        return;
      }
      if (quantity <= 0) {
        toast('Số lượng đặt hàng phải lớn hơn 0.', 'error');
        return;
      }

      details.push({ variantId, quantity, unitCost });
    }

    payload = {
      supplierId: supplierId,
      receiptCode: payload.receiptCode,
      importDate: new Date(payload.importDate).toISOString(),
      note: payload.note || '',
      status: 1, // Chờ duyệt
      details: details
    };
  } else if (key === 'products') {
    try {
      payload.categoryId = Number(payload.categoryId);
      payload.brandId = Number(payload.brandId);
      payload.gender = Number(payload.gender);
      payload.ageFrom = ageToMonths(payload.ageFromValue, payload.ageFromUnit);
      payload.ageTo = ageToMonths(payload.ageToValue, payload.ageToUnit);
      if (payload.ageFrom !== null && payload.ageTo !== null && payload.ageFrom > payload.ageTo) {
        throw new Error('Độ tuổi bắt đầu không được lớn hơn độ tuổi kết thúc.');
      }
      delete payload.ageFromValue;
      delete payload.ageFromUnit;
      delete payload.ageToValue;
      delete payload.ageToUnit;
      payload.isNew = record?.isNew ?? true;
      payload.variants = collectProductVariants();
    } catch (err) {
      toast(err.message, 'error');
      return;
    }
  } else if (key === 'categories' || key === 'brands' || key === 'suppliers') {
    payload.isActive = payload.isActive === 'true';
  } else if (key === 'promotions') {
    payload.promotionType = Number(payload.promotionType);
    payload.discountValue = Number(payload.discountValue);
    payload.maximumDiscount = payload.maximumDiscount === '' ? null : Number(payload.maximumDiscount);
    payload.status = Number(payload.status);
    payload.startDate = new Date(`${payload.startDate}T00:00:00`).toISOString();
    payload.endDate = new Date(`${payload.endDate}T23:59:59.999`).toISOString();
    payload.variantIds = Array.from(form.querySelectorAll('[name="promotionVariantIds"]:checked'))
      .map(input => Number(input.value));
    if (!payload.variantIds.length) {
      toast('Vui lòng chọn ít nhất một biến thể sản phẩm cho chương trình khuyến mãi.', 'error');
      return;
    }
    delete payload.promotionVariantIds;
  } else if (key === 'vouchers') {
    payload.discountType = Number(payload.discountType);
    payload.discountValue = Number(payload.discountValue);
    payload.minimumOrderValue = Number(payload.minOrderAmount || 0);
    payload.maximumDiscount = payload.maximumDiscount === '' ? null : Number(payload.maximumDiscount);
    payload.requiredPoints = Number(payload.requiredPoints || 0);
    payload.usageLimit = Number(payload.maxUsage || 0);
    payload.usageLimitPerCustomer = payload.usageLimitPerCustomer === ''
      ? null
      : Number(payload.usageLimitPerCustomer);
    payload.status = payload.isActive === 'true' ? 1 : 0;
    payload.code = payload.code.trim().toUpperCase();
    payload.startDate = new Date(`${payload.startDate}T00:00:00`).toISOString();
    payload.endDate = new Date(`${payload.endDate}T23:59:59.999`).toISOString();
    delete payload.maxUsage;
  } else if (key === 'customers') {
    payload.dateOfBirth = payload.dateOfBirth ? new Date(payload.dateOfBirth).toISOString() : null;
    payload.gender = payload.gender === '' || payload.gender === null || payload.gender === undefined ? null : Number(payload.gender);
    payload.status = Number(payload.status ?? 1);
  } else if (key === 'shippers') {
    payload.isActive = form.querySelector('[name="isActive"]')?.checked ?? true;
  }

  try {
    const id = record ? (record.customerId || record.productId || record.id || record.categoryId || record.brandId || record.supplierId || record.importReceiptId || record.promotionId || record.voucherId || record.shipperId) : '';
    const url = isEdit ? `${m.endpoint}/${id}` : m.endpoint;
    const method = isEdit ? 'PUT' : 'POST';

    if (key === 'products' && isEdit) {
      const variants = payload.variants;
      delete payload.variants;
      await api(url, { method, body: JSON.stringify(payload) });

      for (const variant of variants) {
        const variantId = variant.variantId;
        delete variant.variantId;
        await api(
          variantId ? `Product/variants/${variantId}` : `Product/${id}/variants`,
          { method: variantId ? 'PUT' : 'POST', body: JSON.stringify(variant) }
        );
      }
    } else {
      await api(url, {
        method,
        body: JSON.stringify(payload)
      });
    }

    toast(isEdit ? 'Cập nhật thành công!' : 'Tạo mới thành công!', 'success');
    await loadRef();
    renderList(key);
  } catch (err) {
    toast(`Lỗi lưu dữ liệu: ${err.message}`, 'error');
  }
}

// ── 6. PURCHASE ORDER DETAIL & APPROVAL (DUYỆT NHẬP KHO) ─────
async function showImportDetail(id) {
  try {
    const receipt = await api(`ImportReceipt/${id}`);
    if (!receipt) {
      toast('Không tìm thấy phiếu đặt hàng.', 'error');
      return;
    }

    const st = IMPORT_STATUS_MAP[receipt.status] || { label: 'Chờ duyệt', pill: 'warning' };
    const canApprove = receipt.status === 1 || receipt.status === 2;
    const canCancel = receipt.status === 1;

    app.innerHTML = `
      <div class="form-view-panel">
        <div class="form-view-header">
          <div class="form-header-title">
            <button class="back-link-btn" onclick="renderList('imports')">← Quay lại danh sách phiếu</button>
            <div>
              <h2>Chi tiết Phiếu Đặt Hàng #${esc(receipt.receiptCode || receipt.importReceiptId)}</h2>
              <p>Người đặt: ${esc(receipt.orderedByName || 'Chưa xác định')} &bull; Ngày tạo: ${fmtDate(receipt.importDate || receipt.createdAt)} &bull; Trạng thái: ${pill(st.label, st.pill)}</p>
            </div>
          </div>
          <div class="form-actions" style="margin:0;padding:0;border:none;">
            ${canApprove ? `
              <button class="success-btn" onclick="approvePurchaseOrder(${receipt.importReceiptId})">
                <span>✓</span> Duyệt phiếu & Nhập kho
              </button>
            ` : ''}
            ${canCancel ? `
              <button class="danger-btn" onclick="cancelPurchaseOrder(${receipt.importReceiptId})">
                <span>✕</span> Hủy phiếu đặt
              </button>
            ` : ''}
          </div>
        </div>

        <div class="form-body">
          <div id="inlineApprovalNotice"></div>

          <div class="form-grid-3" style="margin-bottom:24px;">
            <div class="stat-card" style="margin:0;">
              <div class="stat-label">Nhà cung cấp</div>
              <div class="stat-value" style="font-size:18px;margin:8px 0 0;">${esc(receipt.supplierName || 'Nhà cung cấp')}</div>
            </div>
            <div class="stat-card" style="margin:0;">
              <div class="stat-label">Tổng giá trị đơn đặt</div>
              <div class="stat-value" style="font-size:22px;color:var(--primary);margin:8px 0 0;">${money(receipt.totalAmount)}</div>
            </div>
            <div class="stat-card" style="margin:0;">
              <div class="stat-label">Ghi chú</div>
              <p style="font-size:13.5px;color:var(--slate-700);margin-top:8px;">${esc(receipt.note || 'Không có ghi chú.')}</p>
            </div>
          </div>

          <div class="form-section-card">
            <h4>Danh sách mặt hàng trong phiếu đặt</h4>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm / Biến thể</th>
                    <th>Mã SKU</th>
                    <th>Số lượng đặt</th>
                    <th>Đã nhận vào kho</th>
                    <th>Đơn giá nhập</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${(receipt.importReceiptDetails || []).map(d => `
                    <tr>
                      <td><strong>${esc(d.productName || 'Sản phẩm')}</strong></td>
                      <td><code>${esc(d.sku || 'SKU')}</code></td>
                      <td><strong>${d.quantity}</strong></td>
                      <td><span style="color:${d.receivedQuantity >= d.quantity ? 'var(--success)' : 'var(--warning)'};font-weight:700;">${d.receivedQuantity || 0}</span> / ${d.quantity}</td>
                      <td>${money(d.unitCost)}</td>
                      <td><strong style="color:var(--primary);">${money(d.totalAmount)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

window.approvePurchaseOrder = async function(id) {
  const notice = document.getElementById('inlineApprovalNotice');
  if (!notice) return;

  notice.innerHTML = `
    <div class="inline-confirm-box success">
      <div class="confirm-text">
        <b>Xác nhận duyệt phiếu & nhập hàng vào kho?</b>
        <p>Hệ thống sẽ cập nhật số lượng tồn kho thực tế của các sản phẩm trong phiếu và ghi nhận lịch sử giao dịch kho.</p>
      </div>
      <div class="confirm-actions">
        <button class="ghost-btn" onclick="document.getElementById('inlineApprovalNotice').innerHTML=''">Hủy</button>
        <button class="success-btn" onclick="executeApprovePurchaseOrder(${id})">Xác nhận Duyệt</button>
      </div>
    </div>
  `;
};

window.executeApprovePurchaseOrder = async function(id) {
  try {
    await api(`ImportReceipt/${id}/approve`, { method: 'POST' });
    toast('Duyệt phiếu & Nhập tồn kho thành công!', 'success');
    await loadRef();
    showImportDetail(id);
  } catch (err) {
    toast(`Lỗi duyệt phiếu: ${err.message}`, 'error');
  }
};

window.cancelPurchaseOrder = async function(id) {
  const notice = document.getElementById('inlineApprovalNotice');
  if (!notice) return;

  notice.innerHTML = `
    <div class="inline-confirm-box warning">
      <div class="confirm-text">
        <b>Bạn có chắc muốn hủy phiếu đặt hàng này?</b>
        <p>Phiếu sau khi hủy sẽ không thể nhập kho được nữa.</p>
      </div>
      <div class="confirm-actions">
        <button class="ghost-btn" onclick="document.getElementById('inlineApprovalNotice').innerHTML=''">Đóng</button>
        <button class="danger-btn" onclick="executeCancelPurchaseOrder(${id})">Hủy phiếu ngay</button>
      </div>
    </div>
  `;
};

window.executeCancelPurchaseOrder = async function(id) {
  try {
    await api(`ImportReceipt/${id}/cancel`, { method: 'POST' });
    toast('Đã hủy phiếu đặt hàng.', 'success');
    showImportDetail(id);
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
};

// ── 7. ORDER DETAIL VIEW & STATUS UPDATE ─────────────────────
async function showOrderDetail(id) {
  try {
    const order = await api(`Order/${id}`);
    if (!order) {
      toast('Không tìm thấy đơn hàng.', 'error');
      return;
    }

    const currentStatus = Number(order.status);
    const canAdvanceOrder = currentStatus >= 0 && currentStatus < 4;
    const isTerminalOrder = currentStatus === 4 || currentStatus === 5;
    const nextStatus = canAdvanceOrder ? currentStatus + 1 : null;

    app.innerHTML = `
      <div class="form-view-panel">
        <div class="form-view-header">
          <div class="form-header-title">
            <button class="back-link-btn" onclick="renderList('orders')">← Quay lại danh sách đơn hàng</button>
            <div>
              <h2>Chi tiết Đơn hàng #${esc(order.orderCode || order.orderId)}</h2>
              <p>Ngày đặt: ${fmtDateTime(order.orderDate || order.createdAt)}</p>
            </div>
          </div>
          <div>
            ${pill(ORDER_STATUS_LABELS[order.status] || 'Đang xử lý', order.status === 4 ? 'success' : (order.status === 5 ? 'danger' : 'warning'))}
          </div>
        </div>

        <div class="form-body">
          <div class="form-grid-3" style="margin-bottom:24px;">
            <div class="form-section-card" style="margin:0;">
              <h4>Thông tin khách hàng</h4>
              <p><strong>Họ tên:</strong> ${esc(order.customerName || order.shipping?.receiverName || 'Khách vãng lai')}</p>
              <p><strong>SĐT:</strong> ${esc(order.phoneNumber || order.shipping?.receiverPhone || '—')}</p>
              <p><strong>Email:</strong> ${esc(order.customerEmail || '—')}</p>
            </div>
            <div class="form-section-card" style="margin:0;">
              <h4>Địa chỉ giao hàng</h4>
              <p><strong>Người nhận:</strong> ${esc(order.shipping?.receiverName || order.customerName || '—')}</p>
              <p><strong>SĐT nhận hàng:</strong> ${esc(order.shipping?.receiverPhone || order.phoneNumber || '—')}</p>
              <p>${esc(order.shipping?.address || 'Chưa có địa chỉ giao hàng')}</p>
              <p>
                <strong>Lô giao:</strong> 
                <span style="font-weight:700;color:var(--primary);">${esc(order.shipping?.deliveryBatchCode || 'Chưa phân lô')}</span>
                ${order.shipping?.deliveryBatchCode && currentStatus < 3 ? `
                  <button class="secondary-btn" style="padding:2px 8px;font-size:11px;margin-left:8px;" onclick="dispatchShippingBatch('${esc(order.shipping.deliveryBatchCode)}', ${order.orderId})" title="Chuyển toàn bộ các đơn cùng mã lô này sang Đang giao">
                    🚚 Xuất giao cả lô
                  </button>
                  <button class="icon-action-btn del" style="padding:2px 8px;font-size:11px;margin-left:4px;border:1px solid #fecaca;color:#dc2626;background:#fff;" onclick="unbatchOrderAction(${order.orderId})" title="Tách đơn này ra khỏi lô giao hiện tại">
                    ✕ Gỡ khỏi lô
                  </button>
                ` : ''}
              </p>
              <p>
                <strong>Shipper phụ trách:</strong> 
                ${order.shipping?.shipperName ? `
                  <strong style="color:var(--slate-800);">${esc(order.shipping.shipperName)}</strong>
                  <span style="color:var(--slate-500);font-size:12px;">(${esc(order.shipping.shipperPhone || '—')})</span>
                  ${currentStatus < 4 ? `
                    <button class="secondary-btn" style="padding:2px 8px;font-size:11px;margin-left:6px;" onclick="showAssignShipperModal(${order.orderId}, '${esc(order.shipping.deliveryBatchCode || '')}')">Đổi</button>
                  ` : ''}
                ` : `
                  <span style="color:var(--slate-400);">Chưa phân công</span>
                  ${currentStatus < 4 ? `
                    <button class="primary-btn" style="padding:2px 8px;font-size:11px;margin-left:6px;" onclick="showAssignShipperModal(${order.orderId}, '${esc(order.shipping?.deliveryBatchCode || '')}')">🚚 Gán Shipper</button>
                  ` : ''}
                `}
              </p>
              ${order.shipping?.status === 3 ? `
                <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:8px 12px;border-radius:8px;font-size:12.5px;margin:8px 0;">
                  <strong>⚠️ Giao thất bại lần ${order.shipping.attemptCount || 1}:</strong> ${esc(order.shipping.failReason || 'Khách hẹn lại')}
                  <br><button class="primary-btn" style="padding:3px 8px;font-size:11.5px;margin-top:6px;" onclick="retryDeliveryAction(${order.orderId})">🔄 Xuất giao lại</button>
                </div>
              ` : ''}
              ${order.shipping?.status === 5 ? `
                <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:8px 12px;border-radius:8px;font-size:12.5px;margin:8px 0;">
                  <strong>❌ Đã hoàn hàng về kho</strong> (Đã thử giao ${order.shipping.attemptCount || 3} lần)
                </div>
              ` : ''}
              ${order.payment?.codStatus === 1 ? `
                <div style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;padding:8px 12px;border-radius:8px;font-size:12.5px;margin:8px 0;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <div>
                    <strong>💵 Shipper đang giữ tiền COD:</strong> ${money(order.payment.amount)}
                    <div style="font-size:11.5px;color:#b45309;">Thu lúc: ${fmtDateTime(order.payment.codCollectedAt)}</div>
                  </div>
                  <button class="primary-btn" style="padding:4px 10px;font-size:11.5px;white-space:nowrap;" onclick="confirmSingleCodSubmission(${order.payment.paymentId}, ${order.orderId})">✓ Đã nộp tiền</button>
                </div>
              ` : ''}
              ${order.payment?.codStatus === 2 ? `
                <div style="background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;padding:8px 12px;border-radius:8px;font-size:12.5px;margin:8px 0;">
                  <strong>✅ Đã đối soát & nộp tiền COD vào quỹ</strong> (${fmtDateTime(order.payment.codSubmittedAt)})
                </div>
              ` : ''}
              <p><strong>Giao dự kiến:</strong> ${fmtDeliveryWindow(order.shipping?.estimatedDeliveryFromDate || order.shipping?.estimatedDeliveryAt, order.shipping?.estimatedDeliveryToDate)}</p>
              <p><strong>Ghi chú đơn hàng:</strong> ${esc(order.note || 'Không có ghi chú.')}</p>
              ${order.shipping?.address ? `
                <div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--slate-200);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong style="font-size:12px;color:var(--slate-700);">🗺️ Lộ trình Google Maps:</strong>
                    <a href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh')}&destination=${encodeURIComponent(order.shipping.address)}" target="_blank" style="font-size:11.5px;color:var(--primary);text-decoration:none;font-weight:700;">Mở Maps ↗</a>
                  </div>
                  <div style="border-radius:8px;overflow:hidden;border:1px solid var(--slate-200);height:140px;background:#f1f5f9;">
                    <iframe width="100%" height="100%" frameborder="0" style="border:0;" src="https://maps.google.com/maps?saddr=${encodeURIComponent('123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh')}&daddr=${encodeURIComponent(order.shipping.address)}&output=embed" loading="lazy"></iframe>
                  </div>
                  <div id="adminOrderEtaInfo" style="margin-top:6px;font-size:12px;background:#f8fafc;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0;">
                    Đang tính cự ly & thời gian di chuyển...
                  </div>
                </div>
              ` : ''}
            </div>
            <div class="form-section-card" style="margin:0;">
              <h4>Cập nhật trạng thái đơn</h4>
              <p style="margin:0;color:var(--slate-500);font-size:13px;">${isTerminalOrder ? 'Đơn hàng đã ở trạng thái cuối.' : 'Chỉ có thể chuyển sang giai đoạn kế tiếp; không thể bỏ qua bước.'}</p>
              <div style="display:flex;gap:8px;margin-top:10px;">
                <select class="input-control" id="orderNewStatusSelect" ${isTerminalOrder ? 'disabled' : ''}>
                  <option value="${currentStatus}" disabled>Hiện tại: ${esc(ORDER_STATUS_LABELS[currentStatus] || 'Đang xử lý')}</option>
                  ${nextStatus !== null ? `<option value="${nextStatus}" selected>Chuyển sang: ${esc(ORDER_STATUS_LABELS[nextStatus])}</option>` : ''}
                  ${canAdvanceOrder ? '<option value="5">Hủy đơn hàng</option>' : ''}
                </select>
                <button class="primary-btn" style="white-space:nowrap;" ${isTerminalOrder ? 'disabled' : ''} onclick="updateOrderStatusAction(${order.orderId})">Cập nhật</button>
              </div>
            </div>
          </div>

          <div class="form-section-card">
            <h4>Sản phẩm trong đơn hàng</h4>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Đơn giá</th>
                    <th>Số lượng</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${(order.orderDetails || order.items || []).map(it => {
                    const variantText = it.variantAttributes || it.variantName || (it.sku ? `SKU: ${it.sku}` : '');
                    return `
                    <tr>
                      <td>
                        <strong>${esc(it.productName || 'Sản phẩm')}</strong>
                        ${variantText ? `<div style="font-size:12px;color:var(--slate-500);margin-top:3px;"><span style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;font-weight:600;display:inline-block;">🏷️ ${esc(variantText)}</span></div>` : ''}
                      </td>
                      <td>${money(it.unitPrice)}</td>
                      <td><strong>${it.quantity}</strong></td>
                      <td><strong style="color:var(--primary);">${money(it.totalAmount || it.totalPrice || (it.unitPrice * it.quantity))}</strong></td>
                    </tr>
                  `;}).join('')}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="text-align:right;font-weight:700;">Tổng tiền thanh toán:</td>
                    <td style="font-size:16px;font-weight:800;color:var(--primary);">${money(order.finalAmount || order.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    if (order.shipping?.address) {
      api('Shipping/calculate-delivery-estimate', {
        method: 'POST',
        body: JSON.stringify({ customerAddress: order.shipping.address })
      }).then(est => {
        const infoEl = document.getElementById('adminOrderEtaInfo');
        if (infoEl && est) {
          infoEl.innerHTML = `
            🛣️ Quãng đường: <b>${esc(est.distanceText || `${est.distanceInKm} km`)}</b> · 
            ⏱️ Di chuyển: <b>${esc(est.durationText || `${est.durationInMinutes} phút`)}</b>
            ${order.status === 3 ? '<br><span style="color:#059669;font-weight:700;">⚡ Shipper đang trên lộ trình giao hàng</span>' : ''}
          `;
        }
      }).catch(e => {
        const infoEl = document.getElementById('adminOrderEtaInfo');
        if (infoEl) infoEl.textContent = 'Không tính được cự ly tự động.';
      });
    }
  } catch (err) {
    toast(`Lỗi tải đơn hàng: ${err.message}`, 'error');
  }
}

window.updateOrderStatusAction = async function(id) {
  const newSt = Number(document.getElementById('orderNewStatusSelect')?.value);
  try {
    await api(`Order/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newSt })
    });
    toast('Cập nhật trạng thái đơn hàng thành công!', 'success');
    showOrderDetail(id);
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
};

// ── 8. INLINE USER ROLE MANAGEMENT & PASSWORD ───────────────
function showUserRoleForm(index) {
  const user = cache.users[index];
  if (!user) return;

  app.innerHTML = `
    <div class="form-view-panel">
      <div class="form-view-header">
        <div class="form-header-title">
          <button class="back-link-btn" onclick="renderList('users')">← Quay lại danh sách người dùng</button>
          <div>
            <h2>Phân quyền tài khoản: ${esc(user.fullName || user.email)}</h2>
            <p>Email: ${esc(user.email)}</p>
          </div>
        </div>
      </div>

      <div class="form-body">
        <div class="form-grid-2">
          <div class="form-group">
            <label>Chọn vai trò mới (Role) *</label>
            <select class="input-control" id="inPageRoleSelect">
              <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin (Quản trị toàn quyền)</option>
              <option value="Manager" ${user.role === 'Manager' ? 'selected' : ''}>Manager (Quản lý cửa hàng)</option>
              <option value="Staff" ${user.role === 'Staff' ? 'selected' : ''}>Staff (Nhân viên vận hành)</option>
              <option value="Customer" ${user.role === 'Customer' ? 'selected' : ''}>Customer (Khách hàng)</option>
            </select>
          </div>
        </div>
        <div class="form-footer-actions" style="padding:0;background:transparent;border:none;">
          <button class="ghost-btn" onclick="renderList('users')">Hủy</button>
          <button class="primary-btn" onclick="saveUserRoleAction('${user.userId || user.id}')">Lưu phân quyền</button>
        </div>
      </div>
    </div>
  `;
}

window.saveUserRoleAction = async function(userId) {
  const role = document.getElementById('inPageRoleSelect')?.value;
  try {
    await api('Auth/assign-role', {
      method: 'POST',
      body: JSON.stringify({ userId, role })
    });
    toast('Cập nhật vai trò người dùng thành công!', 'success');
    renderList('users');
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
};

window.toggleUserStatus = async function(userId) {
  try {
    await api(`Auth/users/${userId}/toggle-status`, { method: 'POST' });
    toast('Cập nhật trạng thái tài khoản thành công!', 'success');
    renderList('users');
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
};

// Admin Change Password In-Page
document.getElementById('adminChangePassBtn')?.addEventListener('click', () => {
  app.innerHTML = `
    <div class="form-view-panel">
      <div class="form-view-header">
        <div class="form-header-title">
          <button class="back-link-btn" onclick="navigate()">← Quay lại</button>
          <div>
            <h2>Đổi mật khẩu tài khoản Quản trị</h2>
            <p>Vui lòng nhập mật khẩu hiện tại và thiết lập mật khẩu mới.</p>
          </div>
        </div>
      </div>

      <form id="adminChangePassForm" onsubmit="handleAdminChangePass(event)">
        <div class="form-body">
          <div class="form-grid-2">
            <div class="form-group full">
              <label>Mật khẩu hiện tại *</label>
              <input name="currentPassword" type="password" class="input-control" required placeholder="Nhập mật khẩu cũ">
            </div>
            <div class="form-group">
              <label>Mật khẩu mới *</label>
              <input name="newPassword" type="password" minlength="6" class="input-control" required placeholder="Tối thiểu 6 ký tự">
            </div>
            <div class="form-group">
              <label>Xác nhận mật khẩu mới *</label>
              <input name="confirmPassword" type="password" minlength="6" class="input-control" required placeholder="Nhập lại mật khẩu mới">
            </div>
          </div>
        </div>
        <div class="form-footer-actions">
          <button type="button" class="ghost-btn" onclick="navigate()">Hủy bỏ</button>
          <button type="submit" class="primary-btn">Cập nhật mật khẩu mới</button>
        </div>
      </form>
    </div>
  `;
});

async function handleAdminChangePass(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  if (data.newPassword !== data.confirmPassword) {
    toast('Mật khẩu xác nhận không khớp.', 'error');
    return;
  }
  try {
    await api('Auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    toast('Đổi mật khẩu thành công!', 'success');
    navigate();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// ── 9. INLINE DELETE CONFIRMATION ───────────────────────────
function confirmDelete(key, index) {
  const m = MODULES[key];
  const record = cache[key][index];
  const tbody = document.getElementById('listTableBody');
  const rows = tbody.querySelectorAll('tr');
  const targetRow = rows[index];
  if (!targetRow) return;

  const id = record.productId || record.id || record.categoryId || record.brandId || record.supplierId || record.importReceiptId || record.promotionId || record.voucherId;

  targetRow.innerHTML = `
    <td colspan="${m.columns.length + 1}" style="padding:16px 20px;background:var(--danger-bg);">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="color:var(--danger);font-weight:700;">
          ⚠ Bạn có chắc chắn muốn xóa mục này? Hành động này không thể hoàn tác.
        </span>
        <div style="display:flex;gap:8px;">
          <button class="ghost-btn" style="padding:6px 14px;font-size:12px;" onclick="renderList('${key}')">Hủy</button>
          <button class="danger-btn" style="padding:6px 14px;font-size:12px;" onclick="executeDelete('${key}', '${id}')">Xóa vĩnh viễn</button>
        </div>
      </div>
    </td>
  `;
}

async function executeDelete(key, id) {
  const m = MODULES[key];
  try {
    await api(`${m.endpoint}/${id}`, { method: 'DELETE' });
    toast('Đã xóa thành công!', 'success');
    renderList(key);
  } catch (err) {
    toast(`Lỗi xóa: ${err.message}`, 'error');
  }
}

// Quick Add Reference on the fly
window.quickAddRef = async function(type) {
  const name = prompt(type === 'category' ? 'Nhập tên danh mục mới:' : 'Nhập tên thương hiệu mới:');
  if (!name || !name.trim()) return;
  try {
    const ep = type === 'category' ? 'Category' : 'Brand';
    const res = await api(ep, {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), description: '', isActive: true })
    });
    await loadRef();
    const selectId = type === 'category' ? 'prodCatSelect' : 'prodBrandSelect';
    const sel = document.getElementById(selectId);
    if (sel && res?.id) {
      sel.innerHTML = `<option value="">-- Chọn --</option>` + (type === 'category' ? ref.categories : ref.brands).map(item => `
        <option value="${item.id || item.categoryId || item.brandId}" ${item.id == res.id ? 'selected' : ''}>${esc(item.name)}</option>
      `).join('');
      sel.value = res.id;
    }
    toast(`Thêm ${type === 'category' ? 'danh mục' : 'thương hiệu'} thành công!`, 'success');
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
};

// ── 10. AUTH & INIT ─────────────────────────────────────────
document.getElementById('logoutButton')?.addEventListener('click', () => {
  localStorage.removeItem('toyStoreToken');
  localStorage.removeItem('toyStoreUser');
  location.replace('/customer.html');
});

document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

// Chỉ tài khoản thuộc khu vực quản trị mới được mở trang Admin.
const adminPortalRoles = ['admin', 'manager', 'staff'];
const canAccessAdminPortal = user => adminPortalRoles.includes(String(user?.role || '').trim().toLowerCase());

// Không đăng nhập hoặc không có quyền quản trị thì trở về trang khách hàng.
if (!token || !canAccessAdminPortal(currentUser)) {
  location.replace('/customer.html');
} else {
  document.querySelector('.app-shell')?.classList.add('show');
  if (currentUser) {
    const uName = document.getElementById('currentUserName');
    const uRole = document.getElementById('userRole');
    const uAvatar = document.getElementById('userAvatar');
    if (uName) uName.textContent = currentUser.fullName || currentUser.userName || 'Admin';
    if (uRole) uRole.textContent = currentUser.role || 'Quản trị viên';
    if (uAvatar) uAvatar.textContent = (currentUser.fullName || currentUser.userName || 'AD').slice(0, 2).toUpperCase();
  }
  checkApiStatus();
  loadRef().then(navigate);
  setTimeout(initOrderTrackingSignalR, 1000);
}
