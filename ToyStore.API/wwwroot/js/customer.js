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
let currentCustomerProfile = null;

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

        // Không hiển thị hàng đã tạm ngưng; trạng thái 2 là hàng thanh lý
        // vẫn được phép bán đến khi hết tồn.
        products = (newProducts || []).filter(product => Number(product.status) !== 0);
        categories = newCategories || [];

        renderCategories();
        renderBrandFilters();
        renderHomeCategories();
        renderProducts();
        renderHomeProducts();
        renderPersonalizedRecommendations();
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

function availableQuantityOf(variant) {
    const value = variant?.availableQuantity;
    if (value === null || value === undefined || value === '') return null;
    const quantity = Number(value);
    return Number.isFinite(quantity) ? Math.max(0, quantity) : null;
}

function sellingPriceOf(variant) {
    const price = Number(variant?.price);
    return Number.isFinite(price) && price > 0 ? price : null;
}

function preferredVariantOf(product) {
    const variants = product?.variants || product?.productVariants || [];
    return variants.find(variant => (availableQuantityOf(variant) || 0) > 0 && sellingPriceOf(variant) !== null)
        || variants.find(variant => (availableQuantityOf(variant) || 0) > 0)
        || variants[0]
        || null;
}

function productCard(p) {
    const variant = preferredVariantOf(p);
    const availableQuantity = availableQuantityOf(variant);
    const price = sellingPriceOf(variant);
    const unavailable = availableQuantity === null || availableQuantity <= 0 || price === null;
    const unavailableLabel = availableQuantity === null
        ? 'Hàng chưa về'
        : (availableQuantity <= 0 ? 'Tạm hết hàng' : 'Chưa cập nhật giá');
    const img = p.imageUrl || variant?.imageUrl || 'https://placehold.co/400x400?text=ToyStore';
    const estPoints = price === null ? 0 : Math.floor(price / 10000);

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
                        <b>${price === null ? 'Chưa cập nhật giá' : money(price)}</b>
                        ${price === null ? '' : `<small style="color:var(--secondary);font-weight:700;font-size:11.5px;">+${estPoints} điểm</small>`}
                    </div>
                </div>
            </a>
            <div style="padding:0 20px 20px;">
                <button class="add-cart" data-id="${p.productId}" ${unavailable ? 'disabled aria-disabled="true" style="opacity:.58;cursor:not-allowed;"' : ''}><span>🛍</span> ${unavailable ? unavailableLabel : 'Thêm vào giỏ'}</button>
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
   PERSONALIZED HOME RECOMMENDATIONS
   Lưu cục bộ theo từng tài khoản: không chia sẻ hành vi giữa người dùng.
   ========================================================= */

function getBehaviorStorageKey() {
    const user = getAuthUser();
    return user?.userId ? `toyStoreProductBehavior:${user.userId}` : null;
}

function getProductBehavior() {
    const key = getBehaviorStorageKey();
    if (!key) return { views: {}, purchases: {} };
    try {
        const behavior = JSON.parse(localStorage.getItem(key) || '{}');
        return {
            views: behavior.views && typeof behavior.views === 'object' ? behavior.views : {},
            purchases: behavior.purchases && typeof behavior.purchases === 'object' ? behavior.purchases : {}
        };
    } catch {
        return { views: {}, purchases: {} };
    }
}

function saveProductBehavior(behavior) {
    const key = getBehaviorStorageKey();
    if (key) localStorage.setItem(key, JSON.stringify(behavior));
}

function recordProductView(product) {
    const productId = product?.productId;
    const key = getBehaviorStorageKey();
    if (!key || !productId) return;

    const behavior = getProductBehavior();
    const old = behavior.views[productId] || {};
    behavior.views[productId] = {
        productId: Number(productId),
        categoryId: product.categoryId ?? old.categoryId ?? null,
        count: Math.min(Number(old.count || 0) + 1, 30),
        lastSeenAt: new Date().toISOString()
    };
    saveProductBehavior(behavior);
    renderPersonalizedRecommendations();
}

function getPersonalizedProducts() {
    const behavior = getProductBehavior();
    const views = Object.values(behavior.views);
    const purchases = Object.values(behavior.purchases);
    const hasBehavior = views.length > 0 || purchases.length > 0;
    if (!hasBehavior) return { products: products.slice(0, 8), hasBehavior: false };

    const directScore = new Map();
    const categoryScore = new Map();
    const addScore = (map, key, score) => {
        if (key !== null && key !== undefined) map.set(String(key), (map.get(String(key)) || 0) + score);
    };

    views.forEach(item => {
        const score = Math.min(Number(item.count || 1), 8) * 3;
        addScore(directScore, item.productId, score);
        addScore(categoryScore, item.categoryId, score * .6);
    });
    purchases.forEach(item => {
        const score = Math.min(Number(item.quantity || 1), 8) * 8;
        addScore(directScore, item.productId, score);
        addScore(categoryScore, item.categoryId, score * .75);
    });

    const ranked = [...products]
        .map(product => ({
            product,
            score: (directScore.get(String(product.productId)) || 0)
                + (categoryScore.get(String(product.categoryId)) || 0)
                + (product.isNew ? .1 : 0)
        }))
        .sort((left, right) => right.score - left.score || String(left.product.name).localeCompare(String(right.product.name)))
        .map(item => item.product);

    return { products: ranked.slice(0, 8), hasBehavior: true };
}

function renderPersonalizedRecommendations() {
    const recommendationGrid = document.getElementById('personalizedRecommendationGrid');
    const subtitle = document.getElementById('recommendationsSubtitle');
    if (!recommendationGrid || !products.length) return;

    const user = getAuthUser();
    const recommendation = getPersonalizedProducts();
    recommendationGrid.innerHTML = recommendation.products.map(productCard).join('');

    if (!subtitle) return;
    if (recommendation.hasBehavior) {
        subtitle.textContent = `Gợi ý theo các sản phẩm ${user?.fullName || 'bạn'} đã xem và mua gần đây.`;
    } else if (user) {
        subtitle.textContent = 'Hãy xem hoặc mua vài sản phẩm để nhận gợi ý phù hợp hơn với sở thích của bạn.';
    } else {
        subtitle.textContent = 'Đăng nhập để nhận gợi ý dựa trên các sản phẩm bạn đã xem và mua.';
    }
}

let homeCarouselIndex = 0;
let homeCarouselTimer = null;

function showHomeSlide(index) {
    const slides = [...document.querySelectorAll('.hero-slide')];
    const dots = [...document.querySelectorAll('.hero-carousel-dot')];
    if (!slides.length) return;

    homeCarouselIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === homeCarouselIndex));
    dots.forEach((dot, dotIndex) => {
        const active = dotIndex === homeCarouselIndex;
        dot.classList.toggle('active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
    });
}

function startHomeCarousel() {
    if (!document.getElementById('homeCarousel')) return;
    if (homeCarouselTimer) clearInterval(homeCarouselTimer);
    homeCarouselTimer = setInterval(() => showHomeSlide(homeCarouselIndex + 1), 5000);
}

window.recordProductView = recordProductView;

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
    const stockQuantity = availableQuantityOf({ availableQuantity: item.stockQuantity });
    const requestedQuantity = Math.max(1, Number(item.quantity) || 1);

    if (Number(item.price || 0) <= 0) {
        showToast('Sản phẩm này chưa được cập nhật giá bán.', 'error');
        return;
    }

    if (stockQuantity === null || stockQuantity <= 0) {
        showToast(stockQuantity === null ? 'Sản phẩm này chưa có hàng trong kho.' : 'Sản phẩm này hiện đã hết hàng.', 'error');
        return;
    }

    const existing = cart.find(x => x.variantId === item.variantId || (x.productId === item.productId && !item.variantId));
    if (existing) {
        if ((existing.quantity || 1) + requestedQuantity > stockQuantity) {
            showToast(`Bạn chỉ có thể chọn tối đa ${stockQuantity} sản phẩm này.`, 'error');
            return;
        }
        existing.quantity = (existing.quantity || 1) + requestedQuantity;
        existing.stockQuantity = stockQuantity;
    } else {
        if (requestedQuantity > stockQuantity) {
            showToast(`Bạn chỉ có thể chọn tối đa ${stockQuantity} sản phẩm này.`, 'error');
            return;
        }
        cart.push({ ...item, quantity: requestedQuantity, stockQuantity });
    }
    saveCart(cart);
    showToast(`Đã thêm "${item.name}" vào giỏ hàng!`);
    openCartDrawer();
}

function updateCartItemQty(index, delta) {
    const cart = getCart();
    if (!cart[index]) return;

    const stockQuantity = availableQuantityOf({ availableQuantity: cart[index].stockQuantity });
    if (delta > 0 && stockQuantity !== null && cart[index].quantity >= stockQuantity) {
        showToast(`Bạn chỉ có thể chọn tối đa ${stockQuantity} sản phẩm này.`, 'error');
        return;
    }

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
        const stockQuantity = availableQuantityOf({ availableQuantity: item.stockQuantity });
        const cannotIncrease = stockQuantity !== null && item.quantity >= stockQuantity;
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
                        <button type="button" class="btn-qty-plus" data-index="${idx}" ${cannotIncrease ? 'disabled' : ''} style="width:24px;height:24px;border:1px solid var(--border-color);background:#fff;border-radius:4px;cursor:${cannotIncrease ? 'not-allowed' : 'pointer'};opacity:${cannotIncrease ? '.45' : '1'};">+</button>
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
    if (currentCustomerProfile) {
        populateCheckoutFromProfile(currentCustomerProfile);
    } else if (user && getAuthToken()) {
        loadCustomerProfile()
            .then(profile => populateCheckoutFromProfile(profile))
            .catch(() => null);
    } else if (user) {
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

function isAdminPortalUser(user) {
    return ['admin', 'manager', 'staff'].includes(String(user?.role || '').trim().toLowerCase());
}

function redirectAdminPortalUser(user = getAuthUser()) {
    if (!getAuthToken() || !isAdminPortalUser(user)) return false;
    window.location.replace('/index.html');
    return true;
}

async function loadCustomerProfile() {
    const token = getAuthToken();
    if (!token) return null;

    const response = await fetch(`${API_BASE}/api/Customer/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 404) {
        currentCustomerProfile = null;
        return null;
    }

    if (!response.ok) throw new Error('Không thể tải hồ sơ khách hàng.');

    currentCustomerProfile = await response.json();
    return currentCustomerProfile;
}

function populateCheckoutFromProfile(profile) {
    if (!profile) return;

    const fields = {
        orderFullName: profile.fullName,
        orderPhone: profile.phone,
        orderAddress: profile.address
    };

    Object.entries(fields).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input && !input.value) input.value = value || '';
    });
}

function renderCustomerProfileForm(profile) {
    const host = document.getElementById('drawerAuthenticated');
    if (!host) return;

    let panel = document.getElementById('customerProfilePanel');
    if (!panel) {
        const markup = `
            <section id="customerProfilePanel" style="background:#ffffff;border:1px solid var(--border-color);padding:18px;border-radius:12px;margin:0 0 16px;">
                <h3 id="customerProfileHeading" style="font-size:15px;margin-bottom:4px;">Hồ sơ xác nhận đơn hàng</h3>
                <p id="customerProfileHint" style="font-size:12px;color:var(--text-muted);margin-bottom:14px;"></p>
                <form id="customerProfileForm">
                    <div class="cust-form-group"><label>Họ và tên *</label><input id="profileFullName" required></div>
                    <div class="cust-form-group"><label>Số điện thoại *</label><input id="profilePhone" type="tel" required placeholder="0901234567"></div>
                    <div class="cust-form-group"><label>Địa chỉ nhận hàng *</label><textarea id="profileAddress" rows="2" required placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"></textarea></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div class="cust-form-group"><label>Ngày sinh</label><input id="profileDateOfBirth" type="date"></div>
                        <div class="cust-form-group"><label>Giới tính</label><select id="profileGender"><option value="">Không chọn</option><option value="0">Nam</option><option value="1">Nữ</option><option value="2">Khác</option></select></div>
                    </div>
                    <p id="customerProfileError" style="color:var(--danger);font-size:12px;font-weight:700;margin-bottom:10px;"></p>
                    <button class="cart-checkout-btn" type="submit" style="padding:10px;">Lưu hồ sơ khách hàng</button>
                </form>
            </section>`;
        const logout = document.getElementById('custLogoutBtn');
        if (logout) logout.insertAdjacentHTML('beforebegin', markup);
        else host.insertAdjacentHTML('beforeend', markup);
        panel = document.getElementById('customerProfilePanel');
    }

    const setValue = (id, value) => {
        const input = document.getElementById(id);
        if (input) input.value = value ?? '';
    };

    setValue('profileFullName', profile?.fullName || getAuthUser()?.fullName || '');
    setValue('profilePhone', profile?.phone || '');
    setValue('profileAddress', profile?.address || '');
    setValue('profileDateOfBirth', profile?.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '');
    setValue('profileGender', profile?.gender ?? '');

    const exists = Boolean(profile);
    const heading = document.getElementById('customerProfileHeading');
    const hint = document.getElementById('customerProfileHint');
    if (heading) heading.textContent = exists ? 'Hồ sơ xác nhận đơn hàng' : 'Hoàn thiện hồ sơ khách hàng';
    if (hint) hint.textContent = exists
        ? 'Thông tin này được tự động điền khi bạn xác nhận đơn hàng.'
        : 'Hãy lưu hồ sơ một lần để đặt hàng và nhận điểm thưởng.';
}

async function handleCustomerProfileSubmit(event) {
    event.preventDefault();
    const token = getAuthToken();
    const errorNode = document.getElementById('customerProfileError');
    if (errorNode) errorNode.textContent = '';

    if (!token) {
        if (errorNode) errorNode.textContent = 'Vui lòng đăng nhập lại.';
        return;
    }

    const payload = {
        fullName: document.getElementById('profileFullName')?.value.trim(),
        phone: document.getElementById('profilePhone')?.value.trim(),
        address: document.getElementById('profileAddress')?.value.trim(),
        dateOfBirth: document.getElementById('profileDateOfBirth')?.value || null,
        gender: document.getElementById('profileGender')?.value === ''
            ? null
            : Number(document.getElementById('profileGender')?.value)
    };

    try {
        const response = await fetch(`${API_BASE}/api/Customer/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Không thể lưu hồ sơ khách hàng.');

        currentCustomerProfile = data;
        const user = getAuthUser();
        if (user) {
            user.fullName = data.fullName || user.fullName;
            localStorage.setItem('toyStoreUser', JSON.stringify(user));
        }
        renderCustomerProfileForm(data);
        populateCheckoutFromProfile(data);
        showToast('Đã lưu hồ sơ khách hàng. Bạn có thể xác nhận đơn hàng.', 'success');
    } catch (error) {
        if (errorNode) errorNode.textContent = error.message;
    }
}

async function syncAccountDrawerView() {
    const token = getAuthToken();
    const user = getAuthUser();

    if (redirectAdminPortalUser(user)) return;

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

    const nameNode = document.getElementById('userProfileName');
    const emailNode = document.getElementById('userProfileEmail');
    const roleNode = document.getElementById('userProfileRole');
    if (nameNode) nameNode.textContent = user.fullName || user.userName || 'Khách hàng';
    if (emailNode) emailNode.textContent = user.email || '';
    if (roleNode) roleNode.textContent = user.role || 'Customer';

    // Fetch customer loyalty points from API
    try {
        const customerData = await loadCustomerProfile();
        renderCustomerProfileForm(customerData);

        if (customerData && nameNode) nameNode.textContent = customerData.fullName || nameNode.textContent;

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

        if (redirectAdminPortalUser(data)) return;

        showToast(`Chào mừng bạn quay lại, ${data.fullName || 'bạn'}!`);
        syncAccountDrawerView();
        renderPersonalizedRecommendations();
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

        showToast(`Đăng ký thành công! Hãy hoàn thiện hồ sơ để xác nhận đơn hàng và nhận điểm thưởng.`);
        syncAccountDrawerView();
        renderPersonalizedRecommendations();
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
    currentCustomerProfile = null;
    syncAccountDrawerView();
    renderPersonalizedRecommendations();
    showToast('Đã đăng xuất tài khoản.');
}

/* =========================================================
   CHECKOUT REVIEW
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

    const token = getAuthToken();
    if (!token || !getAuthUser()) {
        closeCheckoutDrawer();
        openAccountDrawer();
        showToast('Vui lòng đăng nhập và tạo hồ sơ khách hàng trước khi đặt hàng.', 'error');
        return;
    }

    let customerProfile;
    try {
        customerProfile = await loadCustomerProfile();
    } catch {
        showToast('Không thể kiểm tra hồ sơ khách hàng. Vui lòng thử lại.', 'error');
        return;
    }

    if (!customerProfile?.customerId || !customerProfile.phone || !customerProfile.address) {
        closeCheckoutDrawer();
        openAccountDrawer();
        showToast('Vui lòng hoàn thiện hồ sơ khách hàng trước khi xác nhận đơn.', 'error');
        return;
    }

    const orderDetails = cart.map(item => ({
        variantId: item.variantId || item.productId,
        quantity: item.quantity || 1
    }));

    const paymentMethod = document.getElementById('orderPaymentMethod')?.value || 'COD';
    const pendingOrder = {
        customerId: customerProfile.customerId,
        customer: { fullName, phone, address },
        note: note || '',
        paymentMethod,
        orderDetails,
        items: cart.map(item => ({
            productId: item.productId,
            categoryId: products.find(product => String(product.productId) === String(item.productId))?.categoryId ?? null,
            name: item.name,
            imageUrl: item.imageUrl,
            price: item.price,
            quantity: item.quantity || 1
        })),
        createdAt: new Date().toISOString()
    };

    // Chỉ lưu thông tin tạm để khách xem chi tiết. Đơn hàng chưa được tạo ở đây.
    localStorage.setItem('toyStorePendingOrder', JSON.stringify(pendingOrder));
    location.href = '/order-review.html';
}

/* =========================================================
   EVENT LISTENERS & BINDINGS
   ========================================================= */

document.addEventListener('click', e => {
    const carouselDot = e.target.closest('[data-home-slide]');
    if (carouselDot) {
        showHomeSlide(Number(carouselDot.dataset.homeSlide));
        startHomeCarousel();
        return;
    }

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
            const variant = preferredVariantOf(targetProd);
            addToCart({
                productId: targetProd.productId,
                variantId: variant?.variantId || targetProd.productId,
                name: targetProd.name,
                price: variant?.price ?? targetProd.basePrice,
                imageUrl: targetProd.imageUrl || variant?.imageUrl,
                quantity: 1,
                sku: variant?.sku || '',
                stockQuantity: availableQuantityOf(variant)
            });
        }
        return;
    }

    // Open/Close Drawers
    if (e.target.closest('#custCartBtn')) { openCartDrawer(); return; }
    if (e.target.closest('#cartDrawerClose') || e.target === document.getElementById('cartDrawerOverlay')) { closeCartDrawer(); return; }

    if (e.target.closest('#openCheckoutDrawerBtn')) { openCheckoutDrawer(); return; }
    if (e.target.closest('#checkoutDrawerClose') || e.target === document.getElementById('checkoutDrawerOverlay')) { closeCheckoutDrawer(); return; }

    if (e.target.closest('#joinLoyaltyBtn')) { location.href = '/rewards.html'; return; }
    if (e.target.closest('#custAccountBtn')) { openAccountDrawer(); return; }
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
document.addEventListener('submit', event => {
    if (event.target.id === 'customerProfileForm') handleCustomerProfileSubmit(event);
});

document.getElementById('mobileMenu')?.addEventListener('click', () => {
    const mobileNav = document.getElementById('mobileNav');
    if (!mobileNav) return;

    const isOpen = mobileNav.classList.toggle('open');
    document.getElementById('mobileMenu')?.setAttribute('aria-expanded', String(isOpen));
});

document.getElementById('mobileNav')?.addEventListener('click', event => {
    if (event.target.closest('a')) {
        document.getElementById('mobileNav')?.classList.remove('open');
        document.getElementById('mobileMenu')?.setAttribute('aria-expanded', 'false');
    }
});

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
if (!redirectAdminPortalUser()) {
    updateCartCountBadge();
    checkApi();
    loadData();
    startHomeCarousel();
    setInterval(loadData, 30000);
}
