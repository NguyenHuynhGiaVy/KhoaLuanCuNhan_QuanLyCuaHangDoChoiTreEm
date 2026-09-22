/**
 * ToyStore Customer - customer.js
 * Modern Side Drawers (No Dialogs), Loyalty Rewards System & Shopping Engine 2026
 */

'use strict';

const grid = document.getElementById('productGrid');
const searchInput = document.getElementById('productSearch');
const sortSelect = document.getElementById('productSort');
const resultCount = document.getElementById('resultCount');
const catalogTitle = document.getElementById('catalogTitle');

let products = [];
let categories = [];
let activeFilter = 'all';

// Filter state
let selectedPrices = [];
let selectedBrands = [];
let selectedGenders = [];
let selectedAges = [];

let currentPage = 1;
const pageSize = 12;

const escapeHtml = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = v => v == null ? 'Liên hệ' : `${Number(v).toLocaleString('vi-VN')}đ`;

function showToast(m, type = 'success') {
    const t = document.getElementById('customerToast');
    if (!t) return;
    t.textContent = m;
    t.className = `customer-toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3200);
}

const API_BASE = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '5225'))
    ? 'http://localhost:5225'
    : '';

function updateApiStatus(online) {
    const status = document.getElementById('customerApiStatus');
    if (!status) return;
    status.textContent = online ? 'API Online' : 'API Offline';
    status.className = `customer-api-status ${online ? 'online' : 'offline'}`;
}

async function checkApi() {
    try {
        const response = await fetch(`${API_BASE}/api/Health`, { cache: 'no-store' });
        updateApiStatus(response.ok);
        return response.ok;
    } catch {
        updateApiStatus(false);
        return false;
    }
}

async function loadData() {
    try {
        const [resP, resC] = await Promise.all([
            fetch(`${API_BASE}/api/Product`),
            fetch(`${API_BASE}/api/Category`)
        ]);

        if (!resP.ok || !resC.ok) throw new Error(`Lỗi tải dữ liệu`);

        const newProducts = await resP.json();
        const newCategories = await resC.json();

        products = newProducts || [];
        categories = newCategories || [];

        renderCategories();
        renderBrandFilters();
        renderHomeCategories();
        renderProducts();
        renderHomeProducts();
        updateApiStatus(true);
    } catch (e) {
        updateApiStatus(false);
        console.error(e);
    }
}

/* =========================================================
   RENDER UI
   ========================================================= */

function renderCategories() {
    const list = document.getElementById('categoryList');
    if (!list) return;

    list.innerHTML = `<button class="category-filter ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">Tất cả sản phẩm <span>(${products.length})</span></button>` +
        categories.map(c => {
            const count = products.filter(p => String(p.categoryId) === String(c.id || c.categoryId)).length;
            return `<button class="category-filter ${activeFilter == String(c.id || c.categoryId) ? 'active' : ''}" data-filter="${c.id || c.categoryId}">${escapeHtml(c.name)} <span>(${count})</span></button>`;
        }).join('');
}

function renderBrandFilters() {
    const list = document.getElementById('brandFilterList');
    if (!list) return;

    const brandMap = new Map();
    products.forEach(p => {
        if (p.brandId && p.brandName) brandMap.set(String(p.brandId), p.brandName);
    });

    const brands = Array.from(brandMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

    list.innerHTML = brands.length ? brands.map(([id, name]) => `
        <label class="filter-checkbox">
            <input type="checkbox" class="brand-filter" value="${id}" ${selectedBrands.includes(id) ? 'checked' : ''}>
            <span>${escapeHtml(name)}</span>
        </label>
    `).join('') : '<div style="font-size:12px;color:var(--text-muted);">Đang cập nhật...</div>';
}

function productCard(p) {
    const img = p.imageUrl || (p.variants && p.variants[0]?.imageUrl) || 'https://placehold.co/400x400?text=ToyStore';
    const price = p.basePrice || (p.variants && p.variants[0]?.price) || 0;
    const estPoints = Math.floor(price / 10000);

    return `
        <article class="product-card">
            <a class="product-link" href="/product-detail.html?id=${p.productId}">
                <div class="product-img">
                    <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy">
                </div>
                <div class="product-detail">
                    <div class="cat-tag">${escapeHtml(p.categoryName || 'Đồ chơi cao cấp')}</div>
                    <h3>${escapeHtml(p.name)}</h3>
                    <div class="product-price">
                        <b>${money(price)}</b>
                        <small style="color:var(--secondary);font-weight:700;font-size:11.5px;">+${estPoints} điểm</small>
                    </div>
                </div>
            </a>
            <div style="padding:0 20px 20px;">
                <button class="add-cart" data-id="${p.productId}"><span>🛍</span> Thêm vào giỏ</button>
            </div>
        </article>
    `;
}

function renderProducts() {
    if (!grid) return;

    let filtered = [...products];

    // Filter theo danh mục
    if (activeFilter !== 'all') {
        filtered = filtered.filter(p => String(p.categoryId) === String(activeFilter));
    }

    // Filter theo tìm kiếm
    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (searchVal) {
        filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(searchVal) || (p.description || '').toLowerCase().includes(searchVal));
    }

    // Filter theo giá
    if (selectedPrices.length > 0) {
        filtered = filtered.filter(p => {
            const price = p.basePrice || (p.variants && p.variants[0]?.price) || 0;
            return selectedPrices.some(range => {
                const [min, max] = range.split('-').map(Number);
                return price >= min && price <= max;
            });
        });
    }

    // Filter theo thương hiệu
    if (selectedBrands.length > 0) {
        filtered = filtered.filter(p => selectedBrands.includes(String(p.brandId)));
    }

    // Filter theo giới tính
    if (selectedGenders.length > 0) {
        filtered = filtered.filter(p => selectedGenders.includes(String(p.gender)) || p.gender === 3);
    }

    // Filter theo độ tuổi
    if (selectedAges.length > 0) {
        filtered = filtered.filter(p => {
            const from = p.ageFrom || 0;
            const to = p.ageTo || 240;
            return selectedAges.some(range => {
                const [minA, maxA] = range.split('-').map(Number);
                return from <= maxA && to >= minA;
            });
        });
    }

    // Sort
    const sortVal = sortSelect ? sortSelect.value : '';
    if (sortVal === 'priceAsc') filtered.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
    else if (sortVal === 'priceDesc') filtered.sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0));
    else if (sortVal === 'name') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (resultCount) resultCount.textContent = `${filtered.length} Sản phẩm tìm thấy`;

    if (!filtered.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)">Không tìm thấy sản phẩm phù hợp với bộ lọc.</div>`;
        renderPagination(0);
        return;
    }

    // Pagination
    const totalPages = Math.ceil(filtered.length / pageSize);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const startIdx = (currentPage - 1) * pageSize;
    const paged = filtered.slice(startIdx, startIdx + pageSize);

    grid.innerHTML = paged.map(productCard).join('');
    renderPagination(totalPages);
}

function renderPagination(total) {
    const pag = document.getElementById('productPagination');
    if (!pag) return;
    if (total <= 1) { pag.innerHTML = ''; return; }

    let html = '';
    for (let i = 1; i <= total; i++) {
        html += `<button class="page-button ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    pag.innerHTML = html;
}

function renderHomeCategories() {
    const homeCat = document.getElementById('homeCategoryList');
    if (!homeCat || !categories.length) return;

    const icons = ['🧸', '🚀', '🧩', '🎨', '🏰', '🚗', '🤖', '👑'];
    homeCat.innerHTML = categories.slice(0, 8).map((c, idx) => `
        <div onclick="location.href='/products.html'">
            <span class="category-icon">${icons[idx % icons.length]}</span>
            <b>${escapeHtml(c.name)}</b>
            <small>${escapeHtml(c.description || 'Khám phá ngay')}</small>
        </div>
    `).join('');
}

function renderHomeProducts() {
    const homeGrid = document.getElementById('homeProductGrid');
    if (!homeGrid || !products.length) return;
    homeGrid.innerHTML = products.slice(0, 8).map(productCard).join('');
}

/* =========================================================
   SHOPPING CART ENGINE & LOCALSTORAGE
   ========================================================= */

function getCart() {
    return JSON.parse(localStorage.getItem('toyStoreCart') || '[]');
}

function saveCart(cart) {
    localStorage.setItem('toyStoreCart', JSON.stringify(cart));
    updateCartCountBadge();
    renderCartDrawer();
}

function updateCartCountBadge() {
    const cart = getCart();
    const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    document.querySelectorAll('#cartCount').forEach(el => el.textContent = totalQty);
    const dCount = document.getElementById('cartDrawerCount');
    if (dCount) dCount.textContent = totalQty;
}

function addToCart(item) {
    const cart = getCart();
    const existing = cart.find(x => x.variantId === item.variantId || (x.productId === item.productId && !item.variantId));
    if (existing) {
        existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
    } else {
        cart.push({ ...item, quantity: item.quantity || 1 });
    }
    saveCart(cart);
    showToast(`Đã thêm "${item.name}" vào giỏ hàng!`);
    openCartDrawer();
}

function updateCartItemQty(index, delta) {
    const cart = getCart();
    if (!cart[index]) return;
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    saveCart(cart);
}

function removeCartItem(index) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
    showToast('Đã xóa sản phẩm khỏi giỏ hàng.');
}

function renderCartDrawer() {
    const body = document.getElementById('cartDrawerBody');
    if (!body) return;
    const cart = getCart();

    if (!cart.length) {
        body.innerHTML = `
            <div style="text-align:center;padding:50px 20px;color:var(--text-muted);">
                <div style="font-size:44px;margin-bottom:12px;">🛍</div>
                <p>Giỏ hàng của bạn đang trống.</p>
                <a href="/products.html" class="add-cart" style="display:inline-block;width:auto;padding:8px 20px;margin-top:16px;">Khám phá đồ chơi ngay</a>
            </div>
        `;
        document.getElementById('cartSubtotal').textContent = '0đ';
        document.getElementById('cartTotal').textContent = '0đ';
        const est = document.getElementById('cartPointsEstimate');
        if (est) est.innerHTML = `✨ Dự kiến tích lũy: <b>0 điểm thưởng</b>`;
        return;
    }

    let subtotal = 0;
    body.innerHTML = cart.map((item, idx) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        subtotal += itemTotal;
        return `
            <div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--border-light);align-items:center;">
                <img src="${escapeHtml(item.imageUrl || 'https://placehold.co/100x100?text=Toy')}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--border-color);">
                <div style="flex:1;min-width:0;">
                    <h4 style="font-size:13.5px;font-weight:700;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.name)}</h4>
                    <p style="font-size:13px;color:var(--primary);font-weight:800;margin:0 0 6px;">${money(item.price)}</p>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button type="button" class="btn-qty-minus" data-index="${idx}" style="width:24px;height:24px;border:1px solid var(--border-color);background:#fff;border-radius:4px;cursor:pointer;">-</button>
                        <span style="font-size:13px;font-weight:700;min-width:20px;text-align:center;">${item.quantity}</span>
                        <button type="button" class="btn-qty-plus" data-index="${idx}" style="width:24px;height:24px;border:1px solid var(--border-color);background:#fff;border-radius:4px;cursor:pointer;">+</button>
                    </div>
                </div>
                <div style="text-align:right;">
                    <strong style="font-size:13.5px;color:var(--text-main);display:block;margin-bottom:8px;">${money(itemTotal)}</strong>
                    <button type="button" class="cart-item-remove" data-index="${idx}" style="border:none;background:none;color:var(--text-muted);cursor:pointer;font-size:14px;">🗑</button>
                </div>
            </div>
        `;
    }).join('');

    const shipping = subtotal >= 500000 || subtotal === 0 ? 0 : 30000;
    const finalTotal = subtotal + shipping;
    const estPoints = Math.floor(finalTotal / 10000);

    document.getElementById('cartSubtotal').textContent = money(subtotal);
    const shipEl = document.getElementById('cartShippingFee');
    if (shipEl) shipEl.textContent = shipping === 0 ? 'Miễn phí' : money(shipping);
    document.getElementById('cartTotal').textContent = money(finalTotal);

    const est = document.getElementById('cartPointsEstimate');
    if (est) est.innerHTML = `✨ Dự kiến tích lũy: <b style="color:var(--secondary);font-size:13px;">+${estPoints} điểm thưởng</b>`;
}

/* =========================================================
   DRAWER CONTROLLERS (NO DIALOGS)
   ========================================================= */

function openCartDrawer() {
    closeCheckoutDrawer();
    closeAccountDrawer();
    renderCartDrawer();
    document.getElementById('cartDrawerOverlay')?.classList.add('open');
}

function closeCartDrawer() {
    document.getElementById('cartDrawerOverlay')?.classList.remove('open');
}

function openCheckoutDrawer() {
    const cart = getCart();
    if (!cart.length) {
        showToast('Giỏ hàng của bạn đang trống.', 'error');
        return;
    }
    closeCartDrawer();
    closeAccountDrawer();

    const user = getAuthUser();
    if (user) {
        const nameIn = document.getElementById('orderFullName');
        if (nameIn && !nameIn.value) nameIn.value = user.fullName || '';
    }

    let subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    const shipping = subtotal >= 500000 ? 0 : 30000;
    const total = subtotal + shipping;
    const totalEl = document.getElementById('checkoutFinalTotal');
    if (totalEl) totalEl.textContent = money(total);

    document.getElementById('checkoutDrawerOverlay')?.classList.add('open');
}

function closeCheckoutDrawer() {
    document.getElementById('checkoutDrawerOverlay')?.classList.remove('open');
}

function openAccountDrawer() {
    closeCartDrawer();
    closeCheckoutDrawer();
    syncAccountDrawerView();
    document.getElementById('accountDrawerOverlay')?.classList.add('open');
}

function closeAccountDrawer() {
    document.getElementById('accountDrawerOverlay')?.classList.remove('open');
}

/* =========================================================
   CUSTOMER LOYALTY & AUTHENTICATION ENGINE
   ========================================================= */

function getAuthToken() {
    return localStorage.getItem('toyStoreToken');
}

function getAuthUser() {
    return JSON.parse(localStorage.getItem('toyStoreUser') || 'null');
}

async function syncAccountDrawerView() {
    const token = getAuthToken();
    const user = getAuthUser();

    const unauthView = document.getElementById('drawerUnauthenticated');
    const authView = document.getElementById('drawerAuthenticated');
    const drawerTitle = document.getElementById('accountDrawerTitle');

    if (!token || !user) {
        if (unauthView) unauthView.style.display = 'block';
        if (authView) authView.style.display = 'none';
        if (drawerTitle) drawerTitle.textContent = 'Đăng nhập / Đăng ký';
        return;
    }

    if (unauthView) unauthView.style.display = 'none';
    if (authView) authView.style.display = 'block';
    if (drawerTitle) drawerTitle.textContent = 'ToyStore Rewards Club';

    document.getElementById('userProfileName').textContent = user.fullName || user.userName || 'Khách hàng';
    document.getElementById('userProfileEmail').textContent = user.email || '';
    document.getElementById('userProfileRole').textContent = user.role || 'Customer';

    // Fetch customer loyalty points from API
    try {
        let customerData = null;
        if (user.userId) {
            const res = await fetch(`${API_BASE}/api/Customer/user/${user.userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) customerData = await res.json();
        }

        const points = customerData?.loyaltyPoint || 0;
        const ptsEl = document.getElementById('userLoyaltyPoints');
        if (ptsEl) ptsEl.textContent = Number(points).toLocaleString('vi-VN');

        // Membership Tier
        const tierBadge = document.getElementById('userTierBadge');
        if (tierBadge) {
            if (points >= 1000) {
                tierBadge.textContent = '💎 Hạng Kim Cương';
                tierBadge.style.background = 'rgba(56, 189, 248, 0.2)';
                tierBadge.style.color = '#38bdf8';
            } else if (points >= 300) {
                tierBadge.textContent = '🥇 Hạng Vàng';
                tierBadge.style.background = 'rgba(251, 191, 36, 0.2)';
                tierBadge.style.color = '#fbbf24';
            } else if (points >= 100) {
                tierBadge.textContent = '🥈 Hạng Bạc';
                tierBadge.style.background = 'rgba(203, 213, 225, 0.2)';
                tierBadge.style.color = '#cbd5e1';
            } else {
                tierBadge.textContent = '🥉 Hạng Đồng';
                tierBadge.style.background = 'rgba(217, 119, 6, 0.2)';
                tierBadge.style.color = '#d97706';
            }
        }
    } catch (e) {
        console.error('Failed to load customer profile / loyalty:', e);
    }
}

async function handleCustomerLogin(e) {
    e.preventDefault();
    const email = document.getElementById('custLoginEmail')?.value.trim();
    const password = document.getElementById('custLoginPassword')?.value;
    const errNode = document.getElementById('custLoginError');
    if (errNode) errNode.textContent = '';

    try {
        const response = await fetch(`${API_BASE}/api/Auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Email hoặc mật khẩu không chính xác.');
        }

        const data = await response.json();
        localStorage.setItem('toyStoreToken', data.token);
        localStorage.setItem('toyStoreUser', JSON.stringify({
            userId: data.userId,
            fullName: data.fullName,
            email: data.email,
            role: data.role
        }));

        showToast(`Chào mừng bạn quay lại, ${data.fullName || 'bạn'}!`);
        syncAccountDrawerView();
    } catch (err) {
        if (errNode) errNode.textContent = err.message;
    }
}

async function handleCustomerRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('custRegFullName')?.value.trim();
    const email = document.getElementById('custRegEmail')?.value.trim();
    const phoneNumber = document.getElementById('custRegPhone')?.value.trim();
    const password = document.getElementById('custRegPassword')?.value;
    const errNode = document.getElementById('custRegError');
    if (errNode) errNode.textContent = '';

    try {
        const response = await fetch(`${API_BASE}/api/Auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, phoneNumber, password })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Đăng ký không thành công.');
        }

        const data = await response.json();
        localStorage.setItem('toyStoreToken', data.token);
        localStorage.setItem('toyStoreUser', JSON.stringify({
            userId: data.userId,
            fullName: data.fullName,
            email: data.email,
            role: data.role
        }));

        showToast(`Đăng ký thành công! Chào mừng ${data.fullName} đến với ToyStore Rewards.`);
        syncAccountDrawerView();
    } catch (err) {
        if (errNode) errNode.textContent = err.message;
    }
}

async function handleCustomerChangePassword(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('changePassCurrent')?.value;
    const newPassword = document.getElementById('changePassNew')?.value;
    const confirmPassword = document.getElementById('changePassConfirm')?.value;
    const errNode = document.getElementById('changePassError');
    if (errNode) errNode.textContent = '';

    if (newPassword !== confirmPassword) {
        if (errNode) errNode.textContent = 'Mật khẩu xác nhận không khớp.';
        return;
    }

    const token = getAuthToken();
    if (!token) {
        if (errNode) errNode.textContent = 'Vui lòng đăng nhập lại.';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/Auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Đổi mật khẩu thất bại.');
        }

        document.getElementById('custChangePassForm').reset();
        document.getElementById('custChangePassForm').style.display = 'none';
        showToast('🔒 Đổi mật khẩu thành công!');
    } catch (err) {
        if (errNode) errNode.textContent = err.message;
    }
}

function handleCustomerLogout() {
    localStorage.removeItem('toyStoreToken');
    localStorage.removeItem('toyStoreUser');
    syncAccountDrawerView();
    showToast('Đã đăng xuất tài khoản.');
}

/* =========================================================
   CHECKOUT SUBMISSION (AUTOMATIC LOYALTY POINTS EARN)
   ========================================================= */

async function handleCheckoutSubmit(e) {
    e.preventDefault();
    const cart = getCart();
    if (!cart.length) {
        showToast('Giỏ hàng trống.', 'error');
        return;
    }

    const fullName = document.getElementById('orderFullName')?.value.trim();
    const phone = document.getElementById('orderPhone')?.value.trim();
    const address = document.getElementById('orderAddress')?.value.trim();
    const note = document.getElementById('orderNote')?.value.trim();

    if (!fullName || !phone || !address) {
        showToast('Vui lòng điền đủ thông tin giao hàng.', 'error');
        return;
    }

    const user = getAuthUser();
    const token = getAuthToken();
    let customerId = null;

    if (user && user.userId && token) {
        try {
            const custRes = await fetch(`${API_BASE}/api/Customer/user/${user.userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (custRes.ok) {
                const cData = await custRes.json();
                customerId = cData.customerId || cData.id;
            }
        } catch (e) {
            console.error('Cannot retrieve customerId for order:', e);
        }
    }

    const orderDetails = cart.map(item => ({
        variantId: item.variantId || item.productId,
        quantity: item.quantity || 1
    }));

    const payload = {
        customerId: customerId,
        note: `[Khách hàng: ${fullName} - SĐT: ${phone} - Địa chỉ: ${address}] ${note || ''}`.trim(),
        orderDetails: orderDetails
    };

    const submitBtn = document.getElementById('confirmOrderBtn');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE}/api/Order`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Không thể tạo đơn hàng');
        }

        const createdOrder = await response.json();
        const estPoints = Math.floor((createdOrder.totalAmount || createdOrder.finalAmount || 0) / 10000);

        // Clear cart
        localStorage.removeItem('toyStoreCart');
        updateCartCountBadge();
        closeCheckoutDrawer();

        showToast(`Đặt hàng thành công! Mã đơn: #${createdOrder.orderCode || createdOrder.orderId}. Bạn nhận được +${estPoints} điểm thưởng!`, 'success');

        setTimeout(() => {
            syncAccountDrawerView();
        }, 1000);
    } catch (err) {
        showToast(`Lỗi đặt hàng: ${err.message}`, 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

/* =========================================================
   EVENT LISTENERS & BINDINGS
   ========================================================= */

document.addEventListener('click', e => {
    // Categories on Products Page
    const catBtn = e.target.closest('.category-filter');
    if (catBtn) {
        document.querySelectorAll('.category-filter').forEach(b => b.classList.remove('active'));
        catBtn.classList.add('active');
        activeFilter = catBtn.dataset.filter;
        if (catalogTitle) catalogTitle.textContent = activeFilter === 'all' ? 'Sản phẩm' : catBtn.textContent.split('(')[0].trim();
        currentPage = 1;
        renderProducts();
        return;
    }

    // Pagination
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn && !pageBtn.disabled) {
        currentPage = Number(pageBtn.dataset.page);
        renderProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    // Add to cart from card
    const addCartBtn = e.target.closest('.add-cart');
    if (addCartBtn && addCartBtn.dataset.id) {
        const pId = addCartBtn.dataset.id;
        const targetProd = products.find(x => String(x.productId) === String(pId));
        if (targetProd) {
            const variant = targetProd.variants?.[0] || targetProd.productVariants?.[0];
            addToCart({
                productId: targetProd.productId,
                variantId: variant?.variantId || targetProd.productId,
                name: targetProd.name,
                price: variant?.price ?? targetProd.basePrice,
                imageUrl: targetProd.imageUrl || variant?.imageUrl,
                quantity: 1,
                sku: variant?.sku || ''
            });
        }
        return;
    }

    // Open/Close Drawers
    if (e.target.closest('#custCartBtn')) { openCartDrawer(); return; }
    if (e.target.closest('#cartDrawerClose') || e.target === document.getElementById('cartDrawerOverlay')) { closeCartDrawer(); return; }

    if (e.target.closest('#openCheckoutDrawerBtn')) { openCheckoutDrawer(); return; }
    if (e.target.closest('#checkoutDrawerClose') || e.target === document.getElementById('checkoutDrawerOverlay')) { closeCheckoutDrawer(); return; }

    if (e.target.closest('#custAccountBtn, #joinLoyaltyBtn')) { openAccountDrawer(); return; }
    if (e.target.closest('#accountDrawerClose') || e.target === document.getElementById('accountDrawerOverlay')) { closeAccountDrawer(); return; }

    // Cart Qty Modifiers
    const qtyMinus = e.target.closest('.btn-qty-minus');
    if (qtyMinus) { updateCartItemQty(Number(qtyMinus.dataset.index), -1); return; }

    const qtyPlus = e.target.closest('.btn-qty-plus');
    if (qtyPlus) { updateCartItemQty(Number(qtyPlus.dataset.index), 1); return; }

    const removeBtn = e.target.closest('.cart-item-remove');
    if (removeBtn) { removeCartItem(Number(removeBtn.dataset.index)); return; }

    // Drawer Auth Tabs
    if (e.target.closest('#tabLoginBtn')) {
        document.getElementById('tabLoginBtn').classList.add('active');
        document.getElementById('tabRegisterBtn').classList.remove('active');
        document.getElementById('custLoginForm').style.display = 'block';
        document.getElementById('custRegisterForm').style.display = 'none';
        return;
    }

    if (e.target.closest('#tabRegisterBtn')) {
        document.getElementById('tabRegisterBtn').classList.add('active');
        document.getElementById('tabLoginBtn').classList.remove('active');
        document.getElementById('custLoginForm').style.display = 'none';
        document.getElementById('custRegisterForm').style.display = 'block';
        return;
    }

    if (e.target.closest('#toggleChangePassBtn')) {
        const form = document.getElementById('custChangePassForm');
        if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
        return;
    }

    if (e.target.closest('#custLogoutBtn')) { handleCustomerLogout(); return; }
});

document.addEventListener('change', e => {
    if (e.target.classList.contains('price-filter')) {
        selectedPrices = [...document.querySelectorAll('.price-filter:checked')].map(x => x.value);
    } else if (e.target.classList.contains('brand-filter')) {
        selectedBrands = [...document.querySelectorAll('.brand-filter:checked')].map(x => x.value);
    } else if (e.target.classList.contains('gender-filter')) {
        selectedGenders = [...document.querySelectorAll('.gender-filter:checked')].map(x => x.value);
    } else if (e.target.classList.contains('age-filter')) {
        selectedAges = [...document.querySelectorAll('.age-filter:checked')].map(x => x.value);
    } else return;

    currentPage = 1;
    renderProducts();
});

document.getElementById('checkoutDrawerForm')?.addEventListener('submit', handleCheckoutSubmit);
document.getElementById('custLoginForm')?.addEventListener('submit', handleCustomerLogin);
document.getElementById('custRegisterForm')?.addEventListener('submit', handleCustomerRegister);
document.getElementById('custChangePassForm')?.addEventListener('submit', handleCustomerChangePassword);

searchInput?.addEventListener('input', () => {
    currentPage = 1;
    renderProducts();
});

sortSelect?.addEventListener('change', () => {
    currentPage = 1;
    renderProducts();
});

document.getElementById('clearFilters')?.addEventListener('click', () => {
    document.querySelectorAll('.catalog-sidebar input[type="checkbox"]').forEach(cb => cb.checked = false);
    selectedPrices = []; selectedBrands = []; selectedGenders = []; selectedAges = [];
    activeFilter = 'all';
    document.querySelectorAll('.category-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
    if (catalogTitle) catalogTitle.textContent = 'Sản phẩm';
    currentPage = 1;
    renderProducts();
    showToast("Đã xóa tất cả bộ lọc");
});

/* =========================================================
   INITIALIZATION
   ========================================================= */
updateCartCountBadge();
checkApi();
loadData();
setInterval(loadData, 30000);
