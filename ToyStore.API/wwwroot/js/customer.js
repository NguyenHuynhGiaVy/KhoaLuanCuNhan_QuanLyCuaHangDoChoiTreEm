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
let appliedVoucher = null;
let customerAddresses = [];
let selectedCustomerAddressId = null;
let checkoutEstimateTimer = null;
let checkoutEstimateVersion = 0;

// Filter state
let selectedPrices = [];
let selectedBrands = [];
let selectedGenders = [];
let selectedAges = [];

let currentPage = 1;
const pageSize = 12;

const escapeHtml = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = v => v == null ? 'Liên hệ' : `${Number(v).toLocaleString('vi-VN')}đ`;
const parseUtcDate = value => {
    if (!value) return null;
    const text = String(value);
    const normalized = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(text)
        ? text
        : (/^\d{4}-\d{2}-\d{2}T/.test(text) ? `${text}Z` : text);
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
};
const fmtVietnamDateTime = value => {
    const date = parseUtcDate(value);
    return date ? date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
};
const fmtVietnamDate = value => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    const date = parseUtcDate(value);
    return date ? date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';
};

function formatDeliveryWindow(fromDate, toDate) {
    if (!fromDate) return 'Đang xác nhận';
    const formatDateOnly = value => {
        const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[3]}/${match[2]}/${match[1]}`;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    };
    const from = formatDateOnly(fromDate);
    const to = formatDateOnly(toDate);
    return from && to && from !== to ? `${from} – ${to}` : from || 'Đang xác nhận';
}

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

// Dữ liệu đơn vị hành chính hai cấp, áp dụng từ 01/07/2025.
// API v2 trả về 34 tỉnh/thành và các phường, xã, đặc khu trực thuộc.
const VIETNAM_ADDRESS_API = 'https://provinces.open-api.vn/api/v2';
let vietnamProvincesPromise = null;
let vietnamAddressInitializationPromise = null;

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
        products = (newProducts || []).filter(product =>
            Number(product.status) !== 0 && Number(product.status) !== 3);
        categories = newCategories || [];
        refreshCartPricesFromProducts();

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

async function loadCustomerNotifications() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions || document.getElementById('customerNotificationButton')) return;

    const notificationMenu = document.createElement('div');
    notificationMenu.className = 'customer-notification-menu';
    notificationMenu.innerHTML = `
        <button class="header-icon customer-notification-button" id="customerNotificationButton"
                type="button" aria-label="Thông báo voucher" aria-expanded="false" title="Thông báo voucher">
            🔔<span class="customer-notification-badge" id="customerNotificationBadge">0</span>
        </button>
        <section class="customer-notification-panel" id="customerNotificationPanel" aria-label="Thông báo voucher">
            <div class="customer-notification-head">
                <strong>Thông báo voucher</strong>
                <button type="button" id="customerNotificationClose" aria-label="Đóng">×</button>
            </div>
            <div id="customerNotificationList" class="customer-notification-list">
                <p class="customer-notification-empty">Đang tải thông báo...</p>
            </div>
        </section>`;
    headerActions.insertBefore(notificationMenu, headerActions.querySelector('.cart-button'));

    const button = notificationMenu.querySelector('#customerNotificationButton');
    const panel = notificationMenu.querySelector('#customerNotificationPanel');
    const list = notificationMenu.querySelector('#customerNotificationList');
    const badge = notificationMenu.querySelector('#customerNotificationBadge');

    button.addEventListener('click', () => {
        const isOpen = panel.classList.toggle('open');
        button.setAttribute('aria-expanded', String(isOpen));
    });
    notificationMenu.querySelector('#customerNotificationClose').addEventListener('click', () => {
        panel.classList.remove('open');
        button.setAttribute('aria-expanded', 'false');
    });

    try {
        const response = await fetch(`${API_BASE}/api/Notification/customer-vouchers`, {
            cache: 'no-store'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const vouchers = data.vouchers || [];
        badge.textContent = vouchers.length > 99 ? '99+' : String(vouchers.length);
        badge.classList.toggle('show', vouchers.length > 0);
        if (!vouchers.length) {
            list.innerHTML = '<p class="customer-notification-empty">Hiện chưa có voucher khả dụng.</p>';
            return;
        }

        list.innerHTML = vouchers.map(voucher => `
            <article class="customer-notification-item">
                <strong>${escapeHtml(voucher.name || 'Voucher mới')}</strong>
                <p>Mã voucher: <b>${escapeHtml(voucher.code)}</b></p>
            </article>`).join('');
    } catch (error) {
        console.warn('Không thể tải thông báo voucher:', error.message);
        list.innerHTML = '<p class="customer-notification-empty">Không thể tải thông báo.</p>';
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
    const price = Number(variant?.salePrice ?? variant?.price);
    return Number.isFinite(price) && price > 0 ? price : null;
}

function originalPriceOf(variant) {
    const price = Number(variant?.originalPrice ?? variant?.price);
    return Number.isFinite(price) && price > 0 ? price : null;
}

function promotionOf(variant) {
    const originalPrice = originalPriceOf(variant);
    const salePrice = sellingPriceOf(variant);
    return originalPrice !== null && salePrice !== null && salePrice < originalPrice
        ? { originalPrice, salePrice, discount: originalPrice - salePrice }
        : null;
}

function preferredVariantOf(product) {
    const variants = product?.variants || product?.productVariants || [];
    return variants.find(variant => (availableQuantityOf(variant) || 0) > 0 && sellingPriceOf(variant) !== null)
        || variants.find(variant => (availableQuantityOf(variant) || 0) > 0)
        || variants[0]
        || null;
}

function refreshCartPricesFromProducts() {
    const cart = getCart();
    let changed = false;

    cart.forEach(item => {
        const product = products.find(candidate =>
            Number(candidate.productId) === Number(item.productId));
        const variant = (product?.productVariants || product?.variants || [])
            .find(candidate => Number(candidate.variantId) === Number(item.variantId));
        const salePrice = sellingPriceOf(variant);
        const originalPrice = originalPriceOf(variant);
        if (salePrice === null || originalPrice === null) return;

        if (variant) {
            if (variant.sku && variant.sku !== item.sku) {
                item.sku = variant.sku;
                changed = true;
            }
            if (variant.attributes && (!item.attributes || !item.attributes.length)) {
                item.attributes = variant.attributes;
                changed = true;
            }
            const attrText = formatVariantAttributes(variant);
            if (attrText && attrText !== item.variantAttributesText) {
                item.variantAttributesText = attrText;
                changed = true;
            }
        }

        if (Number(item.price) !== salePrice
            || Number(item.originalPrice ?? item.price) !== originalPrice
            || String(item.promotionName || '') !== String(variant?.promotionName || '')) {
            item.price = salePrice;
            item.originalPrice = originalPrice;
            item.promotionName = variant?.promotionName || '';
            item.stockQuantity = availableQuantityOf(variant);
            changed = true;
        }
    });

    if (changed) localStorage.setItem('toyStoreCart', JSON.stringify(cart));
}

function productCard(p) {
    const variant = preferredVariantOf(p);
    const availableQuantity = availableQuantityOf(variant);
    const price = sellingPriceOf(variant);
    const promotion = promotionOf(variant);
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
                        ${price === null ? '<b>Chưa cập nhật giá</b>' : promotion
                            ? `<del class="original-price">${money(promotion.originalPrice)}</del><b>${money(price)}</b>`
                            : `<b>${money(price)}</b>`}
                        ${price === null ? '' : `<small style="color:var(--secondary);font-weight:700;font-size:11.5px;">+${estPoints} điểm</small>`}
                    </div>
                </div>
            </a>
            <div class="product-card-actions">
                <button class="add-cart" data-id="${p.productId}" ${unavailable ? 'disabled aria-disabled="true" style="opacity:.58;cursor:not-allowed;"' : ''}><span>🛍</span> ${unavailable ? unavailableLabel : 'Thêm vào giỏ'}</button>
                <button class="buy-now-card" data-id="${p.productId}" ${unavailable ? 'disabled aria-disabled="true"' : ''}><span>⚡</span> ${unavailable ? unavailableLabel : 'Mua ngay'}</button>
            </div>
        </article>
    `;
}

function makeCardOrderItem(product) {
    const variant = preferredVariantOf(product);
    const stockQuantity = availableQuantityOf(variant);
    const price = sellingPriceOf(variant);

    if (stockQuantity === null || stockQuantity <= 0) {
        throw new Error(stockQuantity === null
            ? 'Sản phẩm này chưa có hàng trong kho.'
            : 'Sản phẩm này hiện đã hết hàng.');
    }
    if (price === null) {
        throw new Error('Sản phẩm này chưa được cập nhật giá bán.');
    }

    return {
        productId: product.productId,
        variantId: variant?.variantId || product.productId,
        categoryId: product.categoryId ?? null,
        name: product.name,
        price,
        originalPrice: originalPriceOf(variant) ?? price,
        promotionName: variant?.promotionName || '',
        imageUrl: product.imageUrl || variant?.imageUrl,
        quantity: 1,
        sku: variant?.sku || '',
        attributes: variant?.attributes || [],
        variantAttributesText: formatVariantAttributes(variant),
        stockQuantity
    };
}

function fullAddressOf(address) {
    return address?.fullAddress
        || [address?.addressDetail, address?.wardName, address?.provinceName]
            .filter(Boolean)
            .join(', ');
}

async function buyNowFromProductCard(productId) {
    const product = products.find(item => String(item.productId) === String(productId));
    if (!product) return;

    let item;
    try {
        item = makeCardOrderItem(product);
    } catch (error) {
        showToast(error.message || 'Sản phẩm hiện chưa thể đặt hàng.', 'error');
        return;
    }

    const token = getAuthToken();
    const sessionUser = getAuthUser();
    if (!token || !sessionUser?.userId) {
        openAccountDrawer();
        showToast('Vui lòng đăng nhập để mua ngay.', 'error');
        return;
    }

    try {
        const profile = await loadCustomerProfile();
        if (token !== getAuthToken()
            || getAuthUser()?.userId !== sessionUser.userId
            || profile?.userId !== sessionUser.userId
            || !profile?.customerId
            || !profile?.phone) {
            openAccountDrawer();
            showToast('Vui lòng hoàn thiện hồ sơ khách hàng trước khi mua ngay.', 'error');
            return;
        }

        const response = await fetch(`${API_BASE}/api/Customer/profile/addresses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const addresses = await response.json().catch(() => []);
        const address = Array.isArray(addresses)
            ? addresses.find(item => item.isDefault) || addresses[0]
            : null;
        const fullAddress = fullAddressOf(address);
        if (!response.ok || !address?.receiverName || !address?.receiverPhone || !fullAddress) {
            await openCheckoutDrawer();
            showToast('Hãy lưu địa chỉ giao hàng để tiếp tục mua ngay.', 'error');
            return;
        }

        const pricing = getCartPricing([item]);
        const pendingOrder = {
            accountUserId: sessionUser.userId,
            customerId: profile.customerId,
            customer: {
                fullName: address.receiverName,
                phone: address.receiverPhone,
                address: fullAddress
            },
            note: '',
            paymentMethod: 'COD',
            voucherCode: null,
            voucherDiscount: 0,
            promotionDiscount: pricing.promotionDiscount,
            originalSubtotal: pricing.originalSubtotal,
            discountedSubtotal: pricing.saleSubtotal,
            shippingFee: pricing.shippingFee,
            total: pricing.saleSubtotal + pricing.shippingFee,
            orderDetails: [{ variantId: item.variantId, quantity: 1 }],
            items: [{
                ...item,
                variantAttributes: item.variantAttributesText || formatVariantAttributes(item)
            }],
            createdAt: new Date().toISOString()
        };

        // Mua ngay luôn chỉ chứa sản phẩm vừa chọn, không làm thay đổi giỏ hàng hiện có.
        localStorage.setItem('toyStorePendingOrder', JSON.stringify(pendingOrder));
        location.href = '/order-review.html';
    } catch (error) {
        showToast(error.message || 'Không thể chuẩn bị đơn hàng. Vui lòng thử lại.', 'error');
    }
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
            const price = sellingPriceOf(preferredVariantOf(p)) || p.basePrice || 0;
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
    if (sortVal === 'priceAsc') filtered.sort((a, b) => (sellingPriceOf(preferredVariantOf(a)) || a.basePrice || 0) - (sellingPriceOf(preferredVariantOf(b)) || b.basePrice || 0));
    else if (sortVal === 'priceDesc') filtered.sort((a, b) => (sellingPriceOf(preferredVariantOf(b)) || b.basePrice || 0) - (sellingPriceOf(preferredVariantOf(a)) || a.basePrice || 0));
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
    updateCheckoutTotal();
}

function updateCartCountBadge() {
    const cart = getCart();
    const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    document.querySelectorAll('#cartCount').forEach(el => el.textContent = totalQty);
    const dCount = document.getElementById('cartDrawerCount');
    if (dCount) dCount.textContent = totalQty;
}

function formatVariantAttributes(item) {
    if (!item) return '';
    if (item.variantAttributesText && typeof item.variantAttributesText === 'string') {
        return item.variantAttributesText;
    }
    if (Array.isArray(item.attributes) && item.attributes.length > 0) {
        const text = item.attributes
            .filter(a => a && a.attributeName && a.attributeValue)
            .map(a => `${a.attributeName}: ${a.attributeValue}`)
            .join(' · ');
        if (text) return text;
    }
    if (item.variantLabel) return item.variantLabel;
    if (item.variantName) return item.variantName;
    const parts = [];
    if (item.color) parts.push(`Màu: ${item.color}`);
    if (item.size) parts.push(`Size: ${item.size}`);
    if (parts.length > 0) return parts.join(' · ');
    return '';
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

    if (!item.variantAttributesText) {
        item.variantAttributesText = formatVariantAttributes(item);
    }

    // Phân biệt biến thể: trùng nếu cùng variantId (khi có variantId riêng) hoặc cùng productId và cùng thuộc tính
    const existing = cart.find(x => {
        if (item.variantId && x.variantId && Number(item.variantId) !== Number(item.productId)) {
            return Number(x.variantId) === Number(item.variantId);
        }
        return Number(x.productId) === Number(item.productId)
            && String(x.variantAttributesText || '').trim() === String(item.variantAttributesText || '').trim();
    });

    if (existing) {
        if ((existing.quantity || 1) + requestedQuantity > stockQuantity) {
            showToast(`Bạn chỉ có thể chọn tối đa ${stockQuantity} sản phẩm này.`, 'error');
            return;
        }
        existing.quantity = (existing.quantity || 1) + requestedQuantity;
        existing.stockQuantity = stockQuantity;
        if (item.price) existing.price = item.price;
        if (item.originalPrice) existing.originalPrice = item.originalPrice;
        if (item.imageUrl) existing.imageUrl = item.imageUrl;
        if (item.sku) existing.sku = item.sku;
        if (item.attributes) existing.attributes = item.attributes;
        if (item.variantAttributesText) existing.variantAttributesText = item.variantAttributesText;
    } else {
        if (requestedQuantity > stockQuantity) {
            showToast(`Bạn chỉ có thể chọn tối đa ${stockQuantity} sản phẩm này.`, 'error');
            return;
        }
        cart.push({ ...item, quantity: requestedQuantity, stockQuantity });
    }
    saveCart(cart);
    const attrText = item.variantAttributesText ? ` (${item.variantAttributesText})` : '';
    showToast(`Đã thêm "${item.name}${attrText}" vào giỏ hàng!`);
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

function getCartPricing(cart = getCart()) {
    const originalSubtotal = cart.reduce((sum, item) => {
        const originalPrice = Number(item.originalPrice ?? item.price ?? 0);
        return sum + originalPrice * Number(item.quantity || 1);
    }, 0);
    const saleSubtotal = cart.reduce((sum, item) =>
        sum + Number(item.price || 0) * Number(item.quantity || 1), 0);

    return {
        originalSubtotal,
        saleSubtotal,
        promotionDiscount: Math.max(0, originalSubtotal - saleSubtotal),
        shippingFee: saleSubtotal >= 500000 || saleSubtotal === 0 ? 0 : 30000
    };
}

function voucherDiscountFor(voucher, merchandiseTotal) {
    if (!voucher || merchandiseTotal <= 0) return 0;
    const minimumOrderValue = Number(voucher.minimumOrderValue || 0);
    if (minimumOrderValue > 0 && merchandiseTotal < minimumOrderValue) return 0;

    let discount = Number(voucher.discountType) === 0
        ? merchandiseTotal * Number(voucher.discountValue || 0) / 100
        : Number(voucher.discountValue || 0);
    if (voucher.maximumDiscount !== null && voucher.maximumDiscount !== undefined) {
        discount = Math.min(discount, Number(voucher.maximumDiscount));
    }
    return Math.min(merchandiseTotal, Math.max(0, discount));
}

function updateCheckoutTotal() {
    const pricing = getCartPricing();
    const voucherDiscount = voucherDiscountFor(appliedVoucher, pricing.saleSubtotal);
    const total = Math.max(0, pricing.saleSubtotal + pricing.shippingFee - voucherDiscount);
    const totalEl = document.getElementById('checkoutFinalTotal');
    if (totalEl) totalEl.textContent = money(total);
    return { ...pricing, voucherDiscount, total };
}

async function applyVoucher() {
    const codeInput = document.getElementById('orderVoucherCode');
    const message = document.getElementById('voucherMessage');
    const code = codeInput?.value.trim();
    const token = getAuthToken();
    if (message) message.textContent = '';

    if (!code) {
        if (message) { message.textContent = 'Vui lòng nhập mã voucher.'; message.style.color = 'var(--danger)'; }
        return;
    }
    if (!token) {
        closeCheckoutDrawer();
        openAccountDrawer();
        showToast('Vui lòng đăng nhập để sử dụng voucher.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/Voucher/code/${encodeURIComponent(code)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const voucher = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(voucher.message || voucher.title || 'Không tìm thấy voucher.');

        const now = new Date();
        if (Number(voucher.status) !== 1
            || new Date(voucher.startDate) > now
            || new Date(voucher.endDate) < now) {
            throw new Error('Voucher không còn hiệu lực.');
        }

        const pricing = getCartPricing();
        const discount = voucherDiscountFor(voucher, pricing.saleSubtotal);
        if (Number(voucher.minimumOrderValue || 0) > pricing.saleSubtotal) {
            throw new Error(`Voucher áp dụng cho đơn từ ${money(voucher.minimumOrderValue)}.`);
        }
        if (discount <= 0) throw new Error('Voucher không tạo được mức giảm giá hợp lệ.');

        appliedVoucher = voucher;
        if (codeInput) codeInput.value = voucher.code || code.toUpperCase();
        if (message) {
            message.textContent = `Đã áp dụng ${voucher.code}: giảm ${money(discount)}.`;
            message.style.color = 'var(--success)';
        }
        updateCheckoutTotal();
    } catch (error) {
        appliedVoucher = null;
        updateCheckoutTotal();
        if (message) { message.textContent = error.message; message.style.color = 'var(--danger)'; }
    }
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
        const originalPrice = Number(item.originalPrice ?? item.price ?? 0);
        const hasPromotion = originalPrice > Number(item.price || 0);
        const stockQuantity = availableQuantityOf({ availableQuantity: item.stockQuantity });
        const cannotIncrease = stockQuantity !== null && item.quantity >= stockQuantity;
        const variantText = item.variantAttributesText || formatVariantAttributes(item);
        subtotal += itemTotal;
        return `
            <div class="cart-drawer-item" style="display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--border-light);align-items:flex-start;">
                <img src="${escapeHtml(item.imageUrl || 'https://placehold.co/100x100?text=Toy')}" alt="${escapeHtml(item.name)}" style="width:68px;height:68px;object-fit:cover;border-radius:10px;border:1px solid var(--border-color);flex-shrink:0;">
                <div style="flex:1;min-width:0;">
                    <h4 style="font-size:13.5px;font-weight:700;margin:0 0 3px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h4>
                    ${variantText ? `
                        <div class="cart-item-variant-chip" style="display:inline-flex;align-items:center;gap:4px;background:#f1f5f9;border:1px solid #e2e8f0;padding:2px 7px;border-radius:5px;font-size:11.5px;color:#334155;margin-bottom:5px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                            <span>🏷️ ${escapeHtml(variantText)}</span>
                            ${item.sku ? `<small style="color:#64748b;font-weight:400;margin-left:3px;">(SKU: ${escapeHtml(item.sku)})</small>` : ''}
                        </div>
                    ` : (item.sku ? `<div style="font-size:11.5px;color:#64748b;margin-bottom:4px;">SKU: ${escapeHtml(item.sku)}</div>` : '')}
                    <p style="font-size:13px;color:var(--primary);font-weight:800;margin:0 0 6px;">${hasPromotion ? `<del class="original-price">${money(originalPrice)}</del> ` : ''}${money(item.price)}</p>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button type="button" class="btn-qty-minus" data-index="${idx}" aria-label="Giảm số lượng" style="width:24px;height:24px;border:1px solid var(--border-color);background:#fff;border-radius:4px;cursor:pointer;font-weight:700;">-</button>
                        <span style="font-size:13px;font-weight:700;min-width:20px;text-align:center;">${item.quantity}</span>
                        <button type="button" class="btn-qty-plus" data-index="${idx}" ${cannotIncrease ? 'disabled' : ''} aria-label="Tăng số lượng" style="width:24px;height:24px;border:1px solid var(--border-color);background:#fff;border-radius:4px;cursor:${cannotIncrease ? 'not-allowed' : 'pointer'};opacity:${cannotIncrease ? '.45' : '1'};font-weight:700;">+</button>
                    </div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <strong style="font-size:13.5px;color:var(--text-main);display:block;margin-bottom:8px;">${money(itemTotal)}</strong>
                    <button type="button" class="cart-item-remove" data-index="${idx}" title="Xóa sản phẩm" style="border:none;background:none;color:var(--danger,#ef4444);cursor:pointer;font-size:15px;">🗑</button>
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

async function openCheckoutDrawer() {
    const cart = getCart();
    if (!cart.length) {
        showToast('Giỏ hàng của bạn đang trống.', 'error');
        return;
    }
    closeCartDrawer();
    closeAccountDrawer();
    await initializeVietnamDeliveryAddress();

    const user = getAuthUser();
    if (currentCustomerProfile) {
        populateCheckoutFromProfile(currentCustomerProfile);
    } else if (user && getAuthToken()) {
        const profile = await loadCustomerProfile();
        populateCheckoutFromProfile(profile);
    } else if (user) {
        const nameIn = document.getElementById('orderFullName');
        if (nameIn && !nameIn.value) nameIn.value = user.fullName || '';
    }

    await loadCheckoutAddresses();
    try {
        await loadAvailableVouchers();
    } catch (error) {
        showToast(error.message, 'error');
    }

    updateCheckoutTotal();

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

function resetCustomerSessionState() {
    currentCustomerProfile = null;
    customerAddresses = [];
    selectedCustomerAddressId = null;
    appliedVoucher = null;
    localStorage.removeItem('toyStorePendingOrder');
}

function isAdminPortalUser(user) {
    return ['admin', 'manager', 'staff'].includes(String(user?.role || '').trim().toLowerCase());
}

function isShipperUser(user) {
    return String(user?.role || '').trim().toLowerCase() === 'shipper';
}

function redirectInternalPortalUser(user = getAuthUser()) {
    if (!getAuthToken() || !user) return false;
    const role = String(user?.role || '').trim().toLowerCase();
    if (role === 'shipper') {
        window.location.replace('/shipper.html');
        return true;
    }
    if (['admin', 'manager', 'staff'].includes(role)) {
        window.location.replace('/index.html');
        return true;
    }
    return false;
}

function redirectAdminPortalUser(user = getAuthUser()) {
    return redirectInternalPortalUser(user);
}

async function loadCustomerProfile() {
    const token = getAuthToken();
    if (!token) return null;

    try {
        const response = await fetch(`${API_BASE}/api/Customer/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (token === getAuthToken()) currentCustomerProfile = null;
            return null;
        }

        const profile = await response.json();
        if (token !== getAuthToken()) return null;

        currentCustomerProfile = profile;
        return profile;
    } catch {
        if (token === getAuthToken()) currentCustomerProfile = null;
        return null;
    }
}

function populateCheckoutFromProfile(profile) {
    if (!profile) return;

    const fields = {
        orderFullName: profile.fullName,
        orderPhone: profile.phone
    };

    Object.entries(fields).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input && (id !== 'orderPhone' || value)) input.value = value || '';
    });

    const phoneInput = document.getElementById('orderPhone');
    if (phoneInput) {
        phoneInput.readOnly = Boolean(profile.phone);
        phoneInput.title = profile.phone
            ? 'Số điện thoại lấy từ hồ sơ khách hàng'
            : '';
    }
}

async function loadAvailableVouchers() {
    const input = document.getElementById('orderVoucherCode');
    if (!input) return;

    let datalist = document.getElementById('availableVoucherCodes');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'availableVoucherCodes';
        input.parentElement?.appendChild(datalist);
    }
    input.setAttribute('list', datalist.id);

    const response = await fetch(`${API_BASE}/api/Voucher/available`, {
        cache: 'no-store'
    });
    if (!response.ok) {
        throw new Error('Không thể tải danh sách voucher đang khả dụng.');
    }

    const vouchers = await response.json();
    datalist.innerHTML = vouchers.map(voucher =>
        `<option value="${escapeHtml(voucher.code)}" label="${escapeHtml(voucher.name)}"></option>`
    ).join('');

    const noticeId = 'availableVoucherNotice';
    let notice = document.getElementById(noticeId);
    if (!notice) {
        notice = document.createElement('small');
        notice.id = noticeId;
        notice.style.cssText = 'display:block;margin-top:5px;color:var(--primary);font-weight:600;';
        input.parentElement?.appendChild(notice);
    }
    notice.textContent = vouchers.length
        ? `Voucher đang có: ${vouchers.map(voucher => voucher.code).join(', ')}`
        : 'Hiện chưa có voucher khả dụng.';
}

async function getVietnamProvinces() {
    if (!vietnamProvincesPromise) {
        vietnamProvincesPromise = fetch(`${VIETNAM_ADDRESS_API}/p/`, {
            cache: 'force-cache'
        }).then(async response => {
            if (!response.ok) throw new Error('Không thể tải danh sách tỉnh/thành.');
            const provinces = await response.json();
            if (!Array.isArray(provinces) || provinces.length !== 34) {
                throw new Error('Dữ liệu tỉnh/thành chưa đúng phiên bản sau sáp nhập.');
            }
            return provinces.sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'));
        }).catch(error => {
            vietnamProvincesPromise = null;
            throw error;
        });
    }
    return vietnamProvincesPromise;
}

function composeDeliveryAddress() {
    const detail = document.getElementById('orderAddressDetail')?.value.trim() || '';
    const provinceSelect = document.getElementById('orderProvince');
    const wardSelect = document.getElementById('orderWard');
    const province = provinceSelect?.selectedOptions?.[0]?.dataset.name || '';
    const ward = wardSelect?.selectedOptions?.[0]?.dataset.name || '';
    const fullAddress = [detail, ward, province].filter(Boolean).join(', ');
    const storedAddress = document.getElementById('orderAddress');
    if (storedAddress) storedAddress.value = fullAddress;
    return { detail, province, ward, fullAddress };
}

async function loadWardsForSelectedProvince() {
    const provinceSelect = document.getElementById('orderProvince');
    const wardSelect = document.getElementById('orderWard');
    if (!provinceSelect || !wardSelect) return;

    const provinceCode = provinceSelect.value;
    wardSelect.innerHTML = '<option value="">Đang tải phường/xã...</option>';
    wardSelect.disabled = true;
    composeDeliveryAddress();
    if (!provinceCode) {
        wardSelect.innerHTML = '<option value="">Chọn phường/xã/đặc khu</option>';
        return;
    }

    try {
        const response = await fetch(`${VIETNAM_ADDRESS_API}/p/${encodeURIComponent(provinceCode)}?depth=2`, {
            cache: 'force-cache'
        });
        if (!response.ok) throw new Error('Không thể tải phường/xã.');
        const province = await response.json();
        const wards = Array.isArray(province.wards) ? province.wards : [];
        wardSelect.innerHTML = '<option value="">Chọn phường/xã/đặc khu</option>'
            + wards
                .sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'))
                .map(ward => `<option value="${escapeHtml(ward.code)}" data-name="${escapeHtml(ward.name)}">${escapeHtml(ward.name)}</option>`)
                .join('');
        wardSelect.disabled = false;
    } catch (error) {
        wardSelect.innerHTML = '<option value="">Không tải được phường/xã</option>';
        showToast('Không thể tải phường/xã. Vui lòng thử lại.', 'error');
    }
}

function ensureVietnamDeliveryAddressFields() {
    const storedAddress = document.getElementById('orderAddress');
    if (!storedAddress) return null;

    storedAddress.type = 'hidden';
    storedAddress.required = false;

    if (!document.getElementById('deliveryAddressPicker')) {
        // Tương thích với các trang cũ trong thời gian triển khai cập nhật giao diện.
        storedAddress.insertAdjacentHTML('beforebegin', `
            <div id="deliveryAddressPicker" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                <div><label for="orderProvince" style="display:block;font-size:12px;font-weight:700;margin-bottom:5px;">Tỉnh / thành phố *</label><select id="orderProvince" required disabled><option value="">Đang tải tỉnh/thành...</option></select></div>
                <div><label for="orderWard" style="display:block;font-size:12px;font-weight:700;margin-bottom:5px;">Phường / xã / đặc khu *</label><select id="orderWard" required disabled><option value="">Chọn tỉnh/thành trước</option></select></div>
            </div>
            <input type="text" id="orderAddressDetail" required placeholder="Số nhà, tên đường, tòa nhà...">
            <small style="display:block;margin-top:5px;color:var(--text-muted);">Chọn tỉnh/thành và phường/xã trước khi nhập địa chỉ chi tiết.</small>`);
    }

    const picker = document.getElementById('deliveryAddressPicker');
    if (picker && !document.getElementById('checkoutAddressBook')) {
        picker.insertAdjacentHTML('beforebegin', `
            <div id="checkoutAddressBook" class="cust-form-group" style="padding:10px;border:1px solid var(--border-color);border-radius:9px;background:var(--slate-50);">
                <label for="orderSavedAddress">Địa chỉ đã lưu</label>
                <select id="orderSavedAddress"><option value="">Nhập địa chỉ mới</option></select>
                <div id="checkoutDeliveryEstimate" style="font-size:12px;color:var(--text-muted);margin:7px 0;"></div>
                <button type="button" id="saveCheckoutAddressBtn" class="add-cart" style="width:auto;margin:0;padding:7px 11px;">Lưu địa chỉ này</button>
            </div>`);
    }

    return {
        provinceSelect: document.getElementById('orderProvince'),
        wardSelect: document.getElementById('orderWard')
    };
}

function getCheckoutAddressInput() {
    const provinceSelect = document.getElementById('orderProvince');
    const wardSelect = document.getElementById('orderWard');
    return {
        receiverName: document.getElementById('orderFullName')?.value.trim() || '',
        receiverPhone: document.getElementById('orderPhone')?.value.trim() || '',
        addressDetail: document.getElementById('orderAddressDetail')?.value.trim() || '',
        provinceCode: provinceSelect?.value || '',
        provinceName: provinceSelect?.selectedOptions?.[0]?.dataset.name || '',
        wardCode: wardSelect?.value || '',
        wardName: wardSelect?.selectedOptions?.[0]?.dataset.name || ''
    };
}

async function refreshCheckoutDeliveryEstimate(address) {
    const estimate = document.getElementById('checkoutDeliveryEstimate');
    const version = ++checkoutEstimateVersion;
    if (!estimate) return;

    const normalizedAddress = String(address || '').trim();
    if (!normalizedAddress) {
        estimate.textContent = 'Chọn hoặc nhập một địa chỉ giao hàng.';
        return;
    }

    estimate.textContent = 'Đang tính quãng đường và thời gian giao hàng...';
    try {
        const response = await fetch(`${API_BASE}/api/Shipping/calculate-delivery-estimate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerAddress: normalizedAddress })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Không thể tính giao hàng.');
        if (version !== checkoutEstimateVersion) return;

        const distance = result.distanceText || `${Number(result.distanceInKm || 0).toLocaleString('vi-VN')} km`;
        const duration = result.durationText || `${result.durationInMinutes || 0} phút`;
        const deliveryWindow = formatDeliveryWindow(result.estimatedDeliveryFromDate, result.estimatedDeliveryToDate);
        estimate.textContent = `🛣️ ${distance} · ⏱️ ${duration} · Giao dự kiến: ${deliveryWindow}`;
    } catch {
        if (version !== checkoutEstimateVersion) return;
        estimate.textContent = 'Chưa thể tính quãng đường. Vui lòng thử lại sau.';
    }
}

function scheduleCheckoutDeliveryEstimate() {
    if (checkoutEstimateTimer) clearTimeout(checkoutEstimateTimer);
    const { detail, province, ward, fullAddress } = composeDeliveryAddress();
    if (!detail || !province || !ward) {
        checkoutEstimateVersion += 1;
        const estimate = document.getElementById('checkoutDeliveryEstimate');
        if (estimate) estimate.textContent = 'Chọn đủ địa chỉ để xem quãng đường và giao dự kiến.';
        return;
    }

    checkoutEstimateTimer = setTimeout(() => refreshCheckoutDeliveryEstimate(fullAddress), 350);
}

function renderCheckoutAddressBook() {
    const select = document.getElementById('orderSavedAddress');
    const estimate = document.getElementById('checkoutDeliveryEstimate');
    if (!select) return;

    select.innerHTML = '<option value="">Nhập địa chỉ mới</option>'
        + customerAddresses.map(address => {
            const label = `${address.receiverName} — ${address.fullAddress || [address.addressDetail, address.wardName, address.provinceName].filter(Boolean).join(', ')}`;
            return `<option value="${address.customerAddressId}">${escapeHtml(label)}${address.isDefault ? ' (Mặc định)' : ''}</option>`;
        }).join('');
    select.value = selectedCustomerAddressId ? String(selectedCustomerAddressId) : '';

    const selected = customerAddresses.find(address => Number(address.customerAddressId) === Number(selectedCustomerAddressId));
    if (estimate) {
        estimate.textContent = selected
            ? `Giao dự kiến: ${formatDeliveryWindow(selected.estimatedDeliveryFromDate, selected.estimatedDeliveryToDate)}`
            : 'Chọn đủ địa chỉ để xem quãng đường và giao dự kiến.';
    }
}

function clearSavedAddressSelection() {
    if (!selectedCustomerAddressId) return;
    selectedCustomerAddressId = null;
    const select = document.getElementById('orderSavedAddress');
    if (select) select.value = '';
    const estimate = document.getElementById('checkoutDeliveryEstimate');
    if (estimate) estimate.textContent = 'Chọn đủ địa chỉ để xem quãng đường và giao dự kiến.';
}

async function applyCheckoutAddress(address) {
    if (!address) return;
    selectedCustomerAddressId = Number(address.customerAddressId);

    const setValue = (id, value) => {
        const input = document.getElementById(id);
        if (input) input.value = value || '';
    };
    setValue('orderFullName', address.receiverName);
    setValue('orderPhone', address.receiverPhone);
    setValue('orderAddressDetail', address.addressDetail);

    const provinceSelect = document.getElementById('orderProvince');
    if (provinceSelect) {
        provinceSelect.value = String(address.provinceCode || '');
        await loadWardsForSelectedProvince();
    }
    const wardSelect = document.getElementById('orderWard');
    if (wardSelect) wardSelect.value = String(address.wardCode || '');
    const deliveryAddress = composeDeliveryAddress();
    renderCheckoutAddressBook();
    refreshCheckoutDeliveryEstimate(deliveryAddress.fullAddress);
}

async function loadCheckoutAddresses() {
    const token = getAuthToken();
    if (!token) {
        customerAddresses = [];
        selectedCustomerAddressId = null;
        renderCheckoutAddressBook();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/Customer/profile/addresses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Không thể tải sổ địa chỉ.');
        const addresses = await response.json();
        if (token !== getAuthToken()) return;

        customerAddresses = addresses;
        const selected = customerAddresses.find(address => address.isDefault) || customerAddresses[0];
        if (selected) await applyCheckoutAddress(selected);
        else {
            selectedCustomerAddressId = null;
            renderCheckoutAddressBook();
        }
    } catch (error) {
        if (token !== getAuthToken()) return;
        customerAddresses = [];
        selectedCustomerAddressId = null;
        renderCheckoutAddressBook();
    }
}

async function saveCheckoutAddress() {
    const token = getAuthToken();
    if (!token) {
        showToast('Vui lòng đăng nhập và hoàn thiện hồ sơ trước khi lưu địa chỉ.', 'error');
        return;
    }

    const addressInput = getCheckoutAddressInput();
    if (Object.values(addressInput).some(value => !value)) {
        showToast('Vui lòng nhập đủ người nhận và địa chỉ để lưu.', 'error');
        return;
    }

    const existing = customerAddresses.find(address => Number(address.customerAddressId) === Number(selectedCustomerAddressId));
    const payload = {
        ...addressInput,
        isDefault: existing?.isDefault || customerAddresses.length === 0
    };
    const isUpdate = Boolean(existing);

    try {
        const response = await fetch(
            `${API_BASE}/api/Customer/profile/addresses${isUpdate ? `/${existing.customerAddressId}` : ''}`,
            {
                method: isUpdate ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
        const saved = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(saved.message || 'Không thể lưu địa chỉ.');

        if (isUpdate) {
            customerAddresses = customerAddresses.map(address =>
                Number(address.customerAddressId) === Number(saved.customerAddressId) ? saved : address);
        } else {
            customerAddresses = [saved, ...customerAddresses];
        }
        await applyCheckoutAddress(saved);
        showToast(isUpdate ? 'Đã cập nhật địa chỉ giao hàng.' : 'Đã lưu địa chỉ giao hàng.', 'success');
    } catch (error) {
        showToast(error.message || 'Không thể lưu địa chỉ.', 'error');
    }
}

async function initializeVietnamDeliveryAddress() {
    const fields = ensureVietnamDeliveryAddressFields();
    if (!fields?.provinceSelect || !fields.wardSelect) return;

    // Không tải lại nếu danh sách đã hoàn tất; các lần mở drawer đồng thời cùng
    // chờ một Promise để không tạo trạng thái giao diện chập chờn.
    if (fields.provinceSelect.options.length > 1 && !fields.provinceSelect.disabled) return;
    if (vietnamAddressInitializationPromise) return vietnamAddressInitializationPromise;

    vietnamAddressInitializationPromise = (async () => {
        const { provinceSelect } = ensureVietnamDeliveryAddressFields() || {};
        if (!provinceSelect) return;

        try {
            const provinces = await getVietnamProvinces();
            provinceSelect.innerHTML = '<option value="">Chọn tỉnh/thành phố</option>'
                + provinces.map(province => `<option value="${escapeHtml(province.code)}" data-name="${escapeHtml(province.name)}">${escapeHtml(province.name)}</option>`).join('');
            provinceSelect.disabled = false;
        } catch (error) {
            provinceSelect.innerHTML = '<option value="">Không tải được tỉnh/thành</option>';
            provinceSelect.disabled = false;
            showToast('Không thể tải danh sách tỉnh/thành. Vui lòng thử lại.', 'error');
        } finally {
            vietnamAddressInitializationPromise = null;
        }
    })();

    return vietnamAddressInitializationPromise;
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
    setValue('profileDateOfBirth', profile?.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '');
    setValue('profileGender', profile?.gender ?? '');

    const exists = Boolean(profile);
    const heading = document.getElementById('customerProfileHeading');
    const hint = document.getElementById('customerProfileHint');
    if (heading) heading.textContent = exists ? 'Hồ sơ xác nhận đơn hàng' : 'Hoàn thiện hồ sơ khách hàng';
    if (hint) hint.textContent = exists
        ? 'Thông tin liên hệ được tự động điền khi bạn xác nhận đơn hàng. Địa chỉ được quản lý riêng ở bước đặt hàng.'
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

/* =========================================================
   FORGOT & RESET PASSWORD
   ========================================================= */

function showForgotPassView(step = 1) {
    const loginForm = document.getElementById('custLoginForm');
    const regForm = document.getElementById('custRegisterForm');
    const tabs = document.querySelector('.cust-modal-tabs');
    const forgotContainer = document.getElementById('custForgotPassContainer');

    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = 'none';
    if (tabs) tabs.style.display = 'none';
    if (forgotContainer) {
        forgotContainer.style.display = 'block';
        const step1 = document.getElementById('forgotPassStep1');
        const step2 = document.getElementById('forgotPassStep2');
        if (step1) step1.style.display = step === 1 ? 'block' : 'none';
        if (step2) step2.style.display = step === 2 ? 'block' : 'none';
    }
}

function showLoginView() {
    const loginForm = document.getElementById('custLoginForm');
    const regForm = document.getElementById('custRegisterForm');
    const tabs = document.querySelector('.cust-modal-tabs');
    const forgotContainer = document.getElementById('custForgotPassContainer');

    if (tabs) tabs.style.display = 'flex';
    if (loginForm) loginForm.style.display = 'block';
    if (regForm) regForm.style.display = 'none';
    if (forgotContainer) forgotContainer.style.display = 'none';

    document.getElementById('tabLoginBtn')?.classList.add('active');
    document.getElementById('tabRegisterBtn')?.classList.remove('active');
}

async function handleForgotPassRequest(e) {
    e.preventDefault();
    const email = document.getElementById('forgotPassEmail')?.value.trim();
    const errNode = document.getElementById('forgotPassError');
    const btn = document.getElementById('forgotPassSubmitBtn');
    if (errNode) errNode.textContent = '';

    if (!email) {
        if (errNode) errNode.textContent = 'Vui lòng nhập email tài khoản.';
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Đang xử lý...'; }

    try {
        const response = await fetch(`${API_BASE}/api/Auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Không thể tạo mã đặt lại mật khẩu.');

        showToast('Đã tạo mã xác nhận thành công!');
        
        // Populate Step 2
        const resetEmailInput = document.getElementById('resetPassEmail');
        const resetTokenInput = document.getElementById('resetPassToken');
        if (resetEmailInput) resetEmailInput.value = email;
        if (resetTokenInput && data.resetToken) resetTokenInput.value = data.resetToken;

        showForgotPassView(2);
    } catch (err) {
        if (errNode) errNode.textContent = err.message;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Tiếp tục'; }
    }
}

async function handleResetPassSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('resetPassEmail')?.value.trim();
    const token = document.getElementById('resetPassToken')?.value.trim();
    const newPassword = document.getElementById('resetPassNewPassword')?.value;
    const confirmPassword = document.getElementById('resetPassConfirmPassword')?.value;
    const errNode = document.getElementById('resetPassError');
    const btn = document.getElementById('resetPassSubmitBtn');
    if (errNode) errNode.textContent = '';

    if (newPassword !== confirmPassword) {
        if (errNode) errNode.textContent = 'Mật khẩu xác nhận không khớp.';
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Đang đặt lại mật khẩu...'; }

    try {
        const response = await fetch(`${API_BASE}/api/Auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, token, newPassword, confirmPassword })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Đặt lại mật khẩu thất bại.');

        showToast('🎉 Đặt lại mật khẩu thành công! Vui lòng đăng nhập.');
        showLoginView();
        const loginEmail = document.getElementById('custLoginEmail');
        if (loginEmail) loginEmail.value = email;
        const loginPass = document.getElementById('custLoginPassword');
        if (loginPass) loginPass.value = '';
    } catch (err) {
        if (errNode) errNode.textContent = err.message;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Xác nhận đổi mật khẩu'; }
    }
}

/* =========================================================
   GLOBAL ORDER DETAIL MODAL
   ========================================================= */

function ensureOrderDetailModalInDom() {
    if (document.getElementById('orderDetailModalBackdrop')) return;

    const modalHtml = `
    <div class="order-modal-backdrop" id="orderDetailModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="orderModalTitle">
      <div class="order-modal-dialog">
        <div class="order-modal-header">
          <h2 id="orderModalTitle">📦 Chi tiết đơn hàng</h2>
          <button class="order-modal-close" id="closeOrderDetailModalBtn" aria-label="Đóng">✕</button>
        </div>
        <div class="order-modal-body" id="orderDetailModalContent">
          <div style="text-align:center;padding:40px 0;"><div class="spin-loader"></div><p style="margin-top:12px;color:var(--text-muted);">Đang tải dữ liệu đơn hàng...</p></div>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('closeOrderDetailModalBtn')?.addEventListener('click', closeOrderDetailModal);
}

// ── CUSTOMER REALTIME TRACKING SIGNALR (MỤC 4) ────────────────────
let customerTrackingConnection = null;
let currentTrackingOrderId = null;

async function initCustomerTrackingSignalR() {
    if (typeof signalR === 'undefined' || customerTrackingConnection) return;
    try {
        const token = getAuthToken();
        customerTrackingConnection = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/order-tracking' + (token ? `?access_token=${encodeURIComponent(token)}` : ''))
            .withAutomaticReconnect([0, 2000, 5000, 10000])
            .build();

        customerTrackingConnection.on('ReceiveOrderStateChanged', data => {
            console.log('[SignalR Customer] Trạng thái đơn thay đổi:', data);
            if (currentTrackingOrderId && (String(currentTrackingOrderId) === String(data.orderId) || String(currentTrackingOrderId) === String(data.orderCode))) {
                window.showOrderDetailModal(data.orderId);
                showToast(`📦 Đơn hàng #${data.orderCode}: ${data.statusText || 'Trạng thái đã cập nhật'}`);
            }
            if (typeof loadCustomerOrders === 'function') {
                loadCustomerOrders();
            }
        });

        customerTrackingConnection.on('ReceiveDeliveryCompleted', data => {
            console.log('[SignalR Customer] Giao hoàn tất:', data);
            if (currentTrackingOrderId && (String(currentTrackingOrderId) === String(data.orderId) || String(currentTrackingOrderId) === String(data.orderCode))) {
                window.showOrderDetailModal(data.orderId);
                showToast(`🎉 Đơn hàng #${data.orderCode} đã giao thành công!`);
            }
            if (typeof loadCustomerOrders === 'function') {
                loadCustomerOrders();
            }
        });

        customerTrackingConnection.on('ReceiveDeliveryFailed', data => {
            console.log('[SignalR Customer] Giao thất bại:', data);
            if (currentTrackingOrderId && (String(currentTrackingOrderId) === String(data.orderId) || String(currentTrackingOrderId) === String(data.orderCode))) {
                window.showOrderDetailModal(data.orderId);
                showToast(`⚠️ Giao hàng #${data.orderCode} thất bại lần ${data.attemptCount}: ${data.reason}`, 'error');
            }
        });

        await customerTrackingConnection.start();
        console.log('[SignalR Customer] Đã kết nối OrderTrackingHub.');
    } catch (e) {
        console.warn('[SignalR Customer] Không thể kết nối OrderTrackingHub:', e);
    }
}

function closeOrderDetailModal() {
    const backdrop = document.getElementById('orderDetailModalBackdrop');
    if (backdrop) backdrop.classList.remove('show');
    if (customerTrackingConnection && customerTrackingConnection.state === 'Connected' && currentTrackingOrderId) {
        customerTrackingConnection.invoke('LeaveOrder', currentTrackingOrderId).catch(console.warn);
    }
    currentTrackingOrderId = null;
}

function getOrderStatusMeta(status) {
    switch (Number(status)) {
        case 0: return { label: 'Chờ xác nhận', badgeClass: 'pending', step: 1 };
        case 1: return { label: 'Đã xác nhận', badgeClass: 'confirmed', step: 2 };
        case 2: return { label: 'Đang đóng gói', badgeClass: 'processing', step: 2 };
        case 3: return { label: 'Đang giao hàng', badgeClass: 'shipping', step: 3 };
        case 4: return { label: 'Giao thành công', badgeClass: 'completed', step: 4 };
        case 5: return { label: 'Đã hủy', badgeClass: 'cancelled', step: 0 };
        default: return { label: 'Đang xử lý', badgeClass: 'pending', step: 1 };
    }
}

function canCustomerCancelOrder(order) {
    const status = Number(order.status);
    const shipping = order.shipping || {};
    return status >= 0
        && status < 4
        && !shipping.shippedAt
        && Number(shipping.status || 0) < 2;
}

window.cancelCustomerOrder = async function(orderId) {
    if (!confirm('Bạn muốn hủy đơn hàng này trước khi shipper lấy hàng từ kho? Thao tác này là hủy đơn, không phải yêu cầu trả hàng.')) return;

    const token = getAuthToken();
    try {
        const res = await fetch(`${API_BASE}/api/Order/${orderId}/cancel`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.message || 'Không thể hủy đơn hàng.');

        showToast(result.message || 'Đã hủy đơn hàng.');
        await window.showOrderDetailModal(orderId);
        loadCustomerOrders();
    } catch (err) {
        showToast(err.message || 'Không thể hủy đơn hàng.');
    }
};

window.showOrderDetailModal = async function(orderIdOrCode) {
    ensureOrderDetailModalInDom();
    const backdrop = document.getElementById('orderDetailModalBackdrop');
    const content = document.getElementById('orderDetailModalContent');
    if (!backdrop || !content) return;

    backdrop.classList.add('show');
    content.innerHTML = `<div style="text-align:center;padding:40px 0;"><p style="color:var(--text-muted);">Đang tải chi tiết đơn hàng...</p></div>`;

    const token = getAuthToken();
    try {
        const url = typeof orderIdOrCode === 'string' && orderIdOrCode.startsWith('ORD')
            ? `${API_BASE}/api/Order/code/${orderIdOrCode}`
            : `${API_BASE}/api/Order/${orderIdOrCode}`;

        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Không thể tải thông tin đơn hàng.');

        const order = await res.json();
        currentTrackingOrderId = order.orderId;
        if (customerTrackingConnection && customerTrackingConnection.state === 'Connected') {
            customerTrackingConnection.invoke('JoinOrder', order.orderId).catch(console.warn);
        }
        renderOrderDetailContent(order, content);
    } catch (err) {
        content.innerHTML = `
            <div style="text-align:center;padding:30px 16px;">
                <p style="color:var(--danger);font-weight:700;">⚠️ ${err.message}</p>
                <button type="button" class="btn-view-order" onclick="closeOrderDetailModal()" style="margin-top:14px;">Đóng cửa sổ</button>
            </div>`;
    }
};

function renderOrderDetailContent(order, container) {
    const statusMeta = getOrderStatusMeta(order.status);
    const money = val => `${Number(val || 0).toLocaleString('vi-VN')}đ`;
    const orderDate = order.createdAt ? fmtVietnamDateTime(order.createdAt) : 'Mới tạo';
    const isCancelled = Number(order.status) === 5;
    const canCancelOrder = canCustomerCancelOrder(order);
    const earnedPoints = Math.floor(Number(order.totalAmount || 0) / 10000);

    const paymentMethod = order.payment?.paymentMethod ?? order.paymentMethod;
    const paymentText = Number(paymentMethod) === 2 || paymentMethod === 'ZaloPay'
        ? 'Thanh toán online qua ZaloPay'
        : Number(paymentMethod) === 1 || paymentMethod === 'Banking'
            ? 'Chuyển khoản ngân hàng'
            : 'Thanh toán khi nhận hàng (COD)';
    const paymentStatusText = order.payment?.status === 1 || order.status === 4
        ? '<span class="order-badge completed">Đã thanh toán</span>'
        : '<span class="order-badge pending">Chưa thanh toán</span>';

    const shipping = order.shipping || {};
    const trackingCode = shipping.trackingCode || `TRK-${order.orderCode || order.orderId}`;
    const receiverName = shipping.receiverName || order.customer?.fullName || 'Khách hàng';
    const receiverPhone = shipping.receiverPhone || order.customer?.phone || 'Chưa có SĐT';
    const receiverAddress = shipping.address || order.customer?.address || 'Nhận tại cửa hàng';
    const shipperName = shipping.shipper?.fullName || shipping.shipperName;
    const shipperPhone = shipping.shipper?.phoneNumber || shipping.shipperPhone;
    const vehicleNumber = shipping.shipper?.vehicleNumber || 'Chưa cập nhật';
    const failReason = shipping.failReason;
    const attemptCount = shipping.attemptCount || 0;
    const shippingStatus = Number(shipping.status);

    let timelineHtml = '';
    if (!isCancelled) {
        timelineHtml = `
        <div class="order-timeline">
            <div class="timeline-step ${statusMeta.step >= 1 ? 'done' : ''} ${statusMeta.step === 1 ? 'active' : ''}">
                <div class="timeline-dot">1</div>
                <div class="timeline-label">Đặt hàng</div>
            </div>
            <div class="timeline-step ${statusMeta.step >= 2 ? 'done' : ''} ${statusMeta.step === 2 ? 'active' : ''}">
                <div class="timeline-dot">2</div>
                <div class="timeline-label">Xác nhận</div>
            </div>
            <div class="timeline-step ${statusMeta.step >= 3 ? 'done' : ''} ${statusMeta.step === 3 ? 'active' : ''}">
                <div class="timeline-dot">3</div>
                <div class="timeline-label">Đang giao</div>
            </div>
            <div class="timeline-step ${statusMeta.step >= 4 ? 'done' : ''} ${statusMeta.step === 4 ? 'active' : ''}">
                <div class="timeline-dot">✓</div>
                <div class="timeline-label">Hoàn tất</div>
            </div>
        </div>`;
    } else {
        timelineHtml = `
        <div style="background:#fee2e2;border:1px solid #fca5a5;padding:12px 16px;border-radius:10px;color:#dc2626;margin-bottom:20px;font-size:13.5px;font-weight:700;">
            ✕ Đơn hàng này đã được hủy bỏ.
        </div>`;
    }

    const items = order.orderDetails || order.items || [];
    const itemsRowsHtml = items.map(item => {
        const itemName = item.productName || item.name || 'Đồ chơi trẻ em';
        const itemImg = item.productImageUrl || item.imageUrl || 'https://placehold.co/80x80?text=Toy';
        const variantText = item.variantAttributes || item.variantName || (item.sku ? `SKU: ${item.sku}` : '');
        const itemVariant = variantText ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;"><span style="background:#f1f5f9;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;color:#475569;font-weight:600;">🏷️ ${escapeHtml(variantText)}</span></div>` : '';
        const itemPrice = item.unitPrice ?? item.price ?? 0;
        const itemQty = item.quantity || 1;
        const itemTotal = item.totalPrice ?? (itemPrice * itemQty);

        return `
        <tr>
            <td>
                <div style="display:flex;align-items:center;">
                    <img class="order-item-img" src="${itemImg}" alt="${escapeHtml(itemName)}">
                    <div>
                        <strong>${escapeHtml(itemName)}</strong>
                        ${itemVariant}
                    </div>
                </div>
            </td>
            <td style="text-align:center;">${itemQty}</td>
            <td style="text-align:right;">${money(itemPrice)}</td>
            <td style="text-align:right;"><strong>${money(itemTotal)}</strong></td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
            <div>
                <h3 style="font:800 20px 'Space Grotesk',sans-serif;margin-bottom:4px;">#${order.orderCode || order.orderId}</h3>
                <p style="font-size:12.5px;color:var(--text-muted);">Ngày tạo: ${orderDate}</p>
            </div>
            <span class="order-badge ${statusMeta.badgeClass}" style="font-size:13px;padding:6px 14px;">${statusMeta.label}</span>
        </div>

        ${timelineHtml}

        ${canCancelOrder ? `
        <div style="display:flex;justify-content:flex-end;margin:-8px 0 16px;">
            <button type="button" class="btn-view-order" onclick="window.cancelCustomerOrder(${order.orderId})" style="border:1px solid #ef4444;color:#b91c1c;background:#fff;padding:8px 14px;">
                Hủy đơn hàng
            </button>
        </div>` : ''}

        <div id="orderDeliveryTrackingSlot"></div>

        <div class="order-section-box">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <div class="order-section-title" style="margin-bottom:0;">📍 Thông tin giao nhận hàng</div>
                <span class="realtime-live-badge" style="font-size:11px;padding:3px 8px;border-radius:12px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                    <span class="realtime-live-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;"></span>Realtime Live
                </span>
            </div>
            <div class="order-info-grid">
                <div><span style="color:var(--text-muted);display:block;font-size:12px;">Người nhận</span><strong>${escapeHtml(receiverName)}</strong></div>
                <div><span style="color:var(--text-muted);display:block;font-size:12px;">Số điện thoại</span><strong>${escapeHtml(receiverPhone)}</strong></div>
                <div style="grid-column:1/-1;"><span style="color:var(--text-muted);display:block;font-size:12px;">Địa chỉ nhận hàng</span><strong>${escapeHtml(receiverAddress)}</strong></div>
                <div><span style="color:var(--text-muted);display:block;font-size:12px;">Mã vận đơn</span><strong style="color:var(--accent);">${escapeHtml(trackingCode)}</strong></div>
                <div><span style="color:var(--text-muted);display:block;font-size:12px;">Trạng thái vận chuyển</span>
                    <strong style="color:${shippingStatus === 2 ? '#059669' : (shippingStatus === 3 ? '#dc2626' : (shippingStatus === 1 ? '#2563eb' : '#d97706'))};">
                        ${shippingStatus === 1 ? '🚚 Đang giao hàng' : (shippingStatus === 2 ? '✓ Giao thành công' : (shippingStatus === 3 ? '⚠️ Giao thất bại' : (shippingStatus === 4 ? '🔄 Đang giao lại' : (shippingStatus === 5 ? '📦 Hoàn kho' : 'Chờ xuất kho'))))}
                    </strong>
                </div>

                ${shipperName ? `
                <div style="grid-column:1/-1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px;margin-top:6px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:44px;height:44px;border-radius:50%;background:#3b82f6;color:white;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;">🚚</div>
                        <div>
                            <div style="font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;">Shipper phụ trách</div>
                            <div style="font-size:15px;font-weight:800;color:#1e293b;">${escapeHtml(shipperName)}</div>
                            <div style="font-size:12px;color:#64748b;">Biển số xe: <strong>${escapeHtml(vehicleNumber)}</strong></div>
                        </div>
                    </div>
                    ${shipperPhone ? `
                    <div>
                        <a href="tel:${escapeHtml(shipperPhone)}" class="btn-view-order" style="background:#2563eb;color:white;border:none;font-size:12.5px;padding:8px 16px;border-radius:8px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:700;box-shadow:0 2px 6px rgba(37,99,235,0.25);">
                            📞 Gọi cho Shipper (${escapeHtml(shipperPhone)})
                        </a>
                    </div>
                    ` : ''}
                </div>
                ` : `
                <div style="grid-column:1/-1;font-size:12.5px;color:#64748b;margin-top:4px;background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;">
                    ⏳ Cửa hàng đang sắp xếp và phân công Shipper giao đơn này...
                </div>
                `}

                ${shippingStatus === 3 ? `
                <div style="grid-column:1/-1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;color:#991b1b;margin-top:6px;">
                    <div style="font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                        <span>⚠️ Giao hàng không thành công (Lần ${attemptCount}/3)</span>
                    </div>
                    <div style="font-size:12.5px;color:#7f1d1d;">Lý do: <em>"${escapeHtml(failReason || 'Khách hẹn giao lại hoặc không liên lạc được')}"</em></div>
                    <div style="font-size:11.5px;color:#b91c1c;margin-top:4px;">Đơn hàng sẽ được nhân viên giao lại hoặc liên hệ xác nhận thời gian phù hợp.</div>
                </div>
                ` : ''}

                ${shippingStatus === 4 ? `
                <div style="grid-column:1/-1;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;color:#92400e;margin-top:6px;font-size:12.5px;">
                    <strong>🔄 Đang giao lại (Lần ${attemptCount}):</strong> Shipper đang trên đường giao lại kiện hàng đến bạn.
                </div>
                ` : ''}

                ${shippingStatus === 5 ? `
                <div style="grid-column:1/-1;background:#fef2f2;border:1px solid #f87171;border-radius:8px;padding:10px 14px;color:#991b1b;margin-top:6px;font-size:12.5px;">
                    <strong>📦 Kiện hàng đã được hoàn về kho:</strong> Do không thể liên hệ giao hàng sau 3 lần giao. Quý khách vui lòng liên hệ CSKH nếu cần đặt lại.
                </div>
                ` : ''}
            </div>
        </div>

        <div class="order-section-box">
            <div class="order-section-title">💳 Thông tin thanh toán</div>
            <div class="order-info-grid">
                <div><span style="color:var(--text-muted);display:block;font-size:12px;">Hình thức</span><strong>${paymentText}</strong></div>
                <div><span style="color:var(--text-muted);display:block;font-size:12px;">Trạng thái</span>${paymentStatusText}</div>
            </div>
        </div>

        <div class="order-section-box" style="padding:10px 16px;">
            <div class="order-section-title" style="margin-top:6px;">🛍 Danh sách sản phẩm (${items.length})</div>
            <div style="overflow-x:auto;">
                <table class="order-items-table">
                    <thead>
                        <tr>
                            <th>Sản phẩm</th>
                            <th style="text-align:center;">SL</th>
                            <th style="text-align:right;">Đơn giá</th>
                            <th style="text-align:right;">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRowsHtml || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Không có sản phẩm</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="order-section-box">
            <div class="order-calc-row"><span>Tạm tính hàng hóa:</span><span>${money(order.subtotal || order.totalAmount)}</span></div>
            <div class="order-calc-row"><span>Phí vận chuyển:</span><span>${order.shippingFee ? money(order.shippingFee) : 'Miễn phí'}</span></div>
            ${order.discountAmount ? `<div class="order-calc-row" style="color:var(--success);"><span>Giảm giá khuyến mãi:</span><span>-${money(order.discountAmount)}</span></div>` : ''}
            <div class="order-calc-row total">
                <span>Tổng cộng thanh toán:</span>
                <strong>${money(order.totalAmount)}</strong>
            </div>
            <div style="font-size:12px;color:#4338ca;margin-top:8px;background:#eef2ff;padding:8px 12px;border-radius:8px;">
                🎁 Điểm thưởng tích lũy đơn hàng: <strong>+${earnedPoints} điểm</strong> ${order.status === 4 ? '(Đã cộng vào tài khoản)' : '(Cộng khi hoàn tất giao hàng)'}
            </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
            <button type="button" class="btn-view-order" onclick="window.print()" style="background:#f1f5f9;color:#334155;border-color:#cbd5e1;">🖨 In hóa đơn</button>
            <button type="button" class="btn-view-order" onclick="closeOrderDetailModal()" style="padding:8px 18px;">Đóng</button>
        </div>
    `;

    const trackingSlot = document.getElementById('orderDeliveryTrackingSlot');
    if (trackingSlot) {
        loadAndRenderDeliveryTracking(order, trackingSlot);
    }
}

async function loadAndRenderDeliveryTracking(order, targetContainer) {
    if (!order.shipping?.address) return;
    const currentStatus = Number(order.status);
    const isShipping = currentStatus === 3;
    const isCompleted = currentStatus === 4;

    const warehouseAddress = '123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh';
    const receiverAddress = order.shipping.address;

    targetContainer.innerHTML = `
        <div class="order-section-box" style="background:#f8fafc;border:1px solid #cbd5e1;padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                <div style="font-weight:700;font-size:15px;color:#0f172a;display:flex;align-items:center;gap:6px;">
                    <span>${isShipping ? '🚚' : '📍'}</span> Lộ trình giao hàng & Thời gian dự kiến (ETA)
                </div>
                <span id="trackingLiveBadge" class="order-badge ${isShipping ? 'shipping' : (isCompleted ? 'completed' : 'confirmed')}" style="font-size:12px;">
                    ${isShipping ? '⚡ Đang trên đường giao' : (isCompleted ? '✓ Đã giao thành công' : 'Đang chuẩn bị hàng')}
                </span>
            </div>

            <!-- Google Maps Embed Route -->
            <div style="position:relative;width:100%;height:240px;border-radius:10px;overflow:hidden;border:1px solid #cbd5e1;background:#e2e8f0;margin-bottom:12px;">
                <iframe width="100%" height="100%" frameborder="0" style="border:0;" 
                    src="https://maps.google.com/maps?saddr=${encodeURIComponent(warehouseAddress)}&daddr=${encodeURIComponent(receiverAddress)}&output=embed" 
                    allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade">
                </iframe>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div style="background:white;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;">
                    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:2px;">🛣️ Quãng đường từ kho</div>
                    <div id="trackDistanceVal" style="font-size:16px;font-weight:800;color:var(--primary);">Đang tính...</div>
                </div>
                <div style="background:white;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;">
                    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:2px;">⏱️ Thời gian di chuyển</div>
                    <div id="trackDurationVal" style="font-size:16px;font-weight:800;color:#d97706;">Đang tính...</div>
                </div>
            </div>

            <div id="trackEtaBox" style="margin-top:10px;background:#eef2ff;padding:10px 14px;border-radius:8px;font-size:13px;color:#3730a3;font-weight:600;">
                Đang kết nối tính toán thời gian đến nơi...
            </div>

            ${isShipping ? `
                <div id="liveProgressWrapper" style="margin-top:12px;background:white;padding:12px;border-radius:8px;border:1px solid #e2e8f0;">
                    <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;margin-bottom:6px;">
                        <span>Tiến trình giao hàng:</span>
                        <span id="liveProgressPercent" style="color:#059669;">Đang di chuyển...</span>
                    </div>
                    <div style="background:#e2e8f0;border-radius:999px;height:10px;overflow:hidden;margin-bottom:8px;">
                        <div id="liveProgressBar" style="background:linear-gradient(90deg, #3b82f6, #10b981);width:30%;height:100%;transition:width 1s ease;"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                        <small style="color:var(--text-muted);font-size:11.5px;">Tự động cập nhật hoàn tất khi hàng đến nơi.</small>
                        <button type="button" class="btn-view-order" onclick="confirmCustomerReceivedOrder(${order.orderId})" style="padding:6px 14px;font-size:12px;background:#10b981;color:white;border:none;font-weight:700;border-radius:6px;cursor:pointer;">
                            ✓ Tôi đã nhận được hàng
                        </button>
                    </div>
                </div>
            ` : ''}

            <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
                <small style="color:var(--text-muted);">Kho xuất phát: 123 Nguyễn Thị Minh Khai, Q.1, TP.HCM</small>
                <a href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(warehouseAddress)}&destination=${encodeURIComponent(receiverAddress)}" 
                   target="_blank" rel="noopener noreferrer" 
                   style="font-size:12.5px;color:var(--primary);text-decoration:none;font-weight:700;">
                    🗺️ Mở chỉ đường Google Maps ↗
                </a>
            </div>
        </div>
    `;

    try {
        const estRes = await fetch(`${API_BASE}/api/Shipping/calculate-delivery-estimate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerAddress: receiverAddress })
        });
        if (estRes.ok) {
            const est = await estRes.json();
            const distEl = document.getElementById('trackDistanceVal');
            const durEl = document.getElementById('trackDurationVal');
            const etaBox = document.getElementById('trackEtaBox');
            if (distEl) distEl.textContent = est.distanceText || `${est.distanceInKm} km`;
            if (durEl) durEl.textContent = est.durationText || `${est.durationInMinutes} phút`;

            if (isShipping) {
                const durationMins = Number(est.durationInMinutes) || 30;
                const deliveryStartedAt = parseUtcDate(order.shipping?.deliveryStartedAt);
                if (!deliveryStartedAt) {
                    if (etaBox) etaBox.textContent = 'Shipper đang chuẩn bị xuất phát. Thời gian giao dự kiến sẽ cập nhật khi shipper bắt đầu đi giao.';
                    const progressText = document.getElementById('liveProgressPercent');
                    if (progressText) progressText.textContent = 'Đang chờ shipper xuất phát';
                } else {
                    const arrivalTime = new Date(deliveryStartedAt.getTime() + durationMins * 60000);
                    const now = Date.now();
                    const remainingMins = Math.max(0, Math.ceil((arrivalTime.getTime() - now) / 60000));

                    if (etaBox) {
                        etaBox.innerHTML = `
                            🕒 Dự kiến giao đến lúc: <b>${arrivalTime.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</b>
                            (còn khoảng <b>${remainingMins > 0 ? remainingMins + ' phút' : 'đã quá thời gian dự kiến'}</b>).
                        `;
                    }

                    const elapsed = Math.max(0, (now - deliveryStartedAt.getTime()) / 60000);
                    const pct = Math.min(99, Math.max(5, Math.round((elapsed / durationMins) * 100)));
                    const bar = document.getElementById('liveProgressBar');
                    const pctText = document.getElementById('liveProgressPercent');
                    if (bar) bar.style.width = `${pct}%`;
                    if (pctText) pctText.textContent = `Đang giao (ước tính ${pct}%)`;
                }
            } else if (isCompleted) {
                if (etaBox) {
                    etaBox.style.background = '#dcfce7';
                    etaBox.style.color = '#15803d';
                    etaBox.innerHTML = `🎉 Kiện hàng đã được giao thành công tới địa chỉ nhận! Cảm ơn bạn đã mua sắm.`;
                }
            } else {
                if (etaBox) {
                    etaBox.innerHTML = `📦 Đơn hàng đang được chuẩn bị tại kho, dự kiến giao trong khoảng <b>${formatDeliveryWindow(est.estimatedDeliveryFromDate, est.estimatedDeliveryToDate)}</b>.`;
                }
            }
        }
    } catch (e) {
        console.warn('Lỗi tính toán ETA:', e);
    }
}

window.confirmCustomerReceivedOrder = async function(orderId) {
    if (!confirm('Bạn xác nhận đã nhận được kiện hàng từ nhân viên giao hàng?')) return;
    await completeOrderDeliveryApi(orderId);
};

async function completeOrderDeliveryApi(orderId) {
    const token = getAuthToken();
    try {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/api/Order/${orderId}/complete-delivery`, {
            method: 'POST',
            headers
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Không thể cập nhật trạng thái.');
        }
        showToast('🎉 Xác nhận nhận hàng thành công! Đơn hàng đã hoàn tất.');
        window.showOrderDetailModal(orderId);
        loadCustomerOrders();
    } catch (err) {
        console.warn('Complete delivery:', err.message);
    }
}

/* =========================================================
   CUSTOMER ORDERS LIST (IN DRAWER)
   ========================================================= */

async function loadCustomerOrders() {
    const listContainer = document.getElementById('customerOrdersList');
    if (!listContainer) return;

    listContainer.innerHTML = `<div style="text-align:center;padding:24px 0;"><p style="color:var(--text-muted);font-size:13px;">Đang tải danh sách đơn hàng...</p></div>`;

    const token = getAuthToken();
    if (!token) {
        listContainer.innerHTML = `<div class="customer-orders-empty"><p>Vui lòng đăng nhập để xem đơn hàng.</p></div>`;
        return;
    }

    try {
        let profile = currentCustomerProfile;
        if (!profile?.customerId) {
            profile = await loadCustomerProfile();
        }

        if (!profile?.customerId) {
            if (token !== getAuthToken()) return;
            listContainer.innerHTML = `<div class="customer-orders-empty"><p>Chưa có thông tin hồ sơ khách hàng.</p></div>`;
            return;
        }

        const res = await fetch(`${API_BASE}/api/Order/customer/${profile.customerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Không thể tải danh sách đơn hàng.');

        const orders = await res.json();
        if (token !== getAuthToken()) return;
        if (!Array.isArray(orders) || !orders.length) {
            listContainer.innerHTML = `
                <div class="customer-orders-empty">
                    <div style="font-size:36px;margin-bottom:8px;">📦</div>
                    <p style="font-weight:700;margin-bottom:4px;">Bạn chưa có đơn hàng nào</p>
                    <p style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px;">Hãy khám phá các món đồ chơi hấp dẫn tại ToyStore.</p>
                    <button class="cart-checkout-btn" onclick="location.href='/products.html'" style="padding:8px 14px;display:inline-block;width:auto;">Mua sắm ngay</button>
                </div>`;
            return;
        }

        // Sort latest first
        orders.sort((a, b) => (parseUtcDate(b.createdAt)?.getTime() || 0) - (parseUtcDate(a.createdAt)?.getTime() || 0));

        const money = val => `${Number(val || 0).toLocaleString('vi-VN')}đ`;
        listContainer.innerHTML = orders.map(o => {
            const statusMeta = getOrderStatusMeta(o.status);
            const dateStr = o.createdAt ? fmtVietnamDate(o.createdAt) : '';
            const itemsCount = (o.orderDetails || []).reduce((sum, it) => sum + (it.quantity || 1), 0);

            return `
            <div class="customer-order-card">
                <div class="customer-order-head">
                    <div>
                        <span class="customer-order-code">#${o.orderCode || o.orderId}</span>
                        <div class="customer-order-date">${dateStr}</div>
                    </div>
                    <span class="order-badge ${statusMeta.badgeClass}">${statusMeta.label}</span>
                </div>
                <div class="customer-order-body">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span>Số lượng sản phẩm:</span>
                        <span>${itemsCount} món</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span>Tổng thanh toán:</span>
                        <strong>${money(o.totalAmount)}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:4px;gap:10px;">
                        <span>Giao dự kiến:</span>
                        <strong>${formatDeliveryWindow(o.shipping?.estimatedDeliveryFromDate || o.shipping?.estimatedDeliveryAt, o.shipping?.estimatedDeliveryToDate)}</strong>
                    </div>
                </div>
                <div class="customer-order-actions">
                    <button type="button" class="btn-view-order" onclick="window.showOrderDetailModal(${o.orderId})">👁 Xem chi tiết</button>
                    ${canCustomerCancelOrder(o) ? `<button type="button" class="btn-view-order" onclick="window.cancelCustomerOrder(${o.orderId})" style="border:1px solid #ef4444;color:#b91c1c;background:#fff;">Hủy đơn</button>` : ''}
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        if (token !== getAuthToken()) return;
        listContainer.innerHTML = `<div style="color:var(--danger);font-size:13px;padding:12px;">⚠️ ${err.message}</div>`;
    }
}

/* =========================================================
   ACCOUNT DRAWER RENDERING & TABS
   ========================================================= */

function ensureCustomerAccountHtmlStructure() {
    // 1. Forgot password markup inside unauthenticated view
    const unauth = document.getElementById('drawerUnauthenticated');
    if (unauth && !document.getElementById('custForgotPassContainer')) {
        const loginForm = document.getElementById('custLoginForm');
        if (loginForm && !document.getElementById('custForgotPassLink')) {
            const linkHtml = `<div style="text-align:right;margin-bottom:12px;"><a href="javascript:void(0)" class="forgot-pass-link" id="custForgotPassLink">Quên mật khẩu?</a></div>`;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.insertAdjacentHTML('beforebegin', linkHtml);
        }

        const forgotHtml = `
        <div id="custForgotPassContainer" style="display:none;">
            <div style="margin-bottom:16px;">
                <a href="javascript:void(0)" id="backToLoginLink" style="font-size:13px;color:var(--text-muted);display:inline-flex;align-items:center;gap:4px;font-weight:600;">← Quay lại đăng nhập</a>
                <h3 style="font:800 17px 'Space Grotesk',sans-serif;margin-top:10px;">Quên mật khẩu</h3>
                <p style="font-size:12.5px;color:var(--text-muted);">Nhập email đã đăng ký để tạo mã đặt lại mật khẩu mới.</p>
            </div>

            <!-- STEP 1: REQUEST TOKEN -->
            <form id="forgotPassStep1">
                <div class="cust-form-group">
                    <label>Email tài khoản *</label>
                    <input type="email" id="forgotPassEmail" required placeholder="email@toystore.vn">
                </div>
                <p id="forgotPassError" style="color:var(--danger);font-size:12.5px;font-weight:700;margin-bottom:12px;"></p>
                <button class="cart-checkout-btn" type="submit" id="forgotPassSubmitBtn">Gửi mã xác nhận</button>
            </form>

            <!-- STEP 2: RESET PASSWORD -->
            <form id="forgotPassStep2" style="display:none;">
                <div class="cust-form-group">
                    <label>Email *</label>
                    <input type="email" id="resetPassEmail" required readonly style="background:#f1f5f9;">
                </div>
                <div class="cust-form-group">
                    <label>Mã xác nhận / Token *</label>
                    <input type="text" id="resetPassToken" required placeholder="Mã token đã được tạo">
                </div>
                <div class="cust-form-group">
                    <label>Mật khẩu mới *</label>
                    <input type="password" id="resetPassNewPassword" required minlength="6" placeholder="Tối thiểu 6 ký tự">
                </div>
                <div class="cust-form-group">
                    <label>Xác nhận mật khẩu mới *</label>
                    <input type="password" id="resetPassConfirmPassword" required minlength="6" placeholder="Nhập lại mật khẩu">
                </div>
                <p id="resetPassError" style="color:var(--danger);font-size:12.5px;font-weight:700;margin-bottom:12px;"></p>
                <button class="cart-checkout-btn" type="submit" id="resetPassSubmitBtn">Xác nhận đổi mật khẩu</button>
            </form>
        </div>`;

        unauth.insertAdjacentHTML('beforeend', forgotHtml);

        document.getElementById('custForgotPassLink')?.addEventListener('click', () => showForgotPassView(1));
        document.getElementById('backToLoginLink')?.addEventListener('click', showLoginView);
        document.getElementById('forgotPassStep1')?.addEventListener('submit', handleForgotPassRequest);
        document.getElementById('forgotPassStep2')?.addEventListener('submit', handleResetPassSubmit);
    }

    // 2. Account Tabs in authenticated view
    const auth = document.getElementById('drawerAuthenticated');
    if (auth && !document.getElementById('accountNavTabs')) {
        const tabsHtml = `
        <div class="cust-nav-tabs" id="accountNavTabs">
            <button type="button" class="cust-nav-tab active" data-tab="profile">👤 Hồ sơ</button>
            <button type="button" class="cust-nav-tab" data-tab="orders">📦 Đơn hàng</button>
            <button type="button" class="cust-nav-tab" data-tab="security">🔒 Đổi MK</button>
        </div>
        <div id="tabContentOrders" style="display:none;">
            <div id="customerOrdersList"></div>
        </div>`;

        auth.insertAdjacentHTML('afterbegin', tabsHtml);

        // Move password form into security tab
        const changePassForm = document.getElementById('custChangePassForm');
        const togglePassBtn = document.getElementById('toggleChangePassBtn');
        if (togglePassBtn) togglePassBtn.style.display = 'none';

        document.querySelectorAll('.cust-nav-tab').forEach(tabBtn => {
            tabBtn.addEventListener('click', () => {
                document.querySelectorAll('.cust-nav-tab').forEach(t => t.classList.remove('active'));
                tabBtn.classList.add('active');
                const target = tabBtn.dataset.tab;

                const loyaltyBox = auth.querySelector('.loyalty-card-box');
                const infoBox = auth.querySelector('div[style*="background:#ffffff;border:1px solid"]');
                const profilePanel = document.getElementById('customerProfilePanel');
                const ordersBox = document.getElementById('tabContentOrders');
                const passForm = document.getElementById('custChangePassForm');

                if (target === 'profile') {
                    if (loyaltyBox) loyaltyBox.style.display = 'block';
                    if (infoBox) infoBox.style.display = 'block';
                    if (profilePanel) profilePanel.style.display = 'block';
                    if (ordersBox) ordersBox.style.display = 'none';
                    if (passForm) passForm.style.display = 'none';
                } else if (target === 'orders') {
                    if (loyaltyBox) loyaltyBox.style.display = 'none';
                    if (infoBox) infoBox.style.display = 'none';
                    if (profilePanel) profilePanel.style.display = 'none';
                    if (ordersBox) ordersBox.style.display = 'block';
                    if (passForm) passForm.style.display = 'none';
                    loadCustomerOrders();
                } else if (target === 'security') {
                    if (loyaltyBox) loyaltyBox.style.display = 'none';
                    if (infoBox) infoBox.style.display = 'none';
                    if (profilePanel) profilePanel.style.display = 'none';
                    if (ordersBox) ordersBox.style.display = 'none';
                    if (passForm) passForm.style.display = 'block';
                }
            });
        });
    }
}

async function syncAccountDrawerView() {
    const token = getAuthToken();
    const user = getAuthUser();

    if (redirectAdminPortalUser(user)) return;

    ensureCustomerAccountHtmlStructure();
    ensureOrderDetailModalInDom();

    const unauthView = document.getElementById('drawerUnauthenticated');
    const authView = document.getElementById('drawerAuthenticated');
    const drawerTitle = document.getElementById('accountDrawerTitle');

    if (!token || !user) {
        if (unauthView) unauthView.style.display = 'block';
        if (authView) authView.style.display = 'none';
        if (drawerTitle) drawerTitle.textContent = 'Đăng nhập / Đăng ký';
        showLoginView();
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

    // Fetch customer loyalty points & profile from API
    try {
        const customerData = await loadCustomerProfile();
        if (token !== getAuthToken()) return;
        renderCustomerProfileForm(customerData);

        if (customerData && nameNode) nameNode.textContent = customerData.fullName || nameNode.textContent;

        const points = customerData?.loyaltyPoint ?? customerData?.loyaltyPoints ?? 0;
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
        resetCustomerSessionState();
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
        resetCustomerSessionState();
        localStorage.setItem('toyStoreToken', data.token);
        localStorage.setItem('toyStoreUser', JSON.stringify({
            userId: data.userId,
            fullName: data.fullName,
            email: data.email,
            role: data.role
        }));

        showToast(`Đăng ký thành công! Hãy hoàn thiện hồ sơ để nhận nhiều quyền lợi.`);
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
        showToast('🔒 Đổi mật khẩu thành công!');
    } catch (err) {
        if (errNode) errNode.textContent = err.message;
    }
}

function handleCustomerLogout() {
    resetCustomerSessionState();
    localStorage.removeItem('toyStoreToken');
    localStorage.removeItem('toyStoreUser');
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
    const deliveryAddress = composeDeliveryAddress();
    const address = deliveryAddress.fullAddress;
    const note = document.getElementById('orderNote')?.value.trim();

    if (!fullName || !phone || !deliveryAddress.detail || !deliveryAddress.ward || !deliveryAddress.province) {
        showToast('Vui lòng nhập số nhà/đường và chọn đủ phường/xã, tỉnh/thành.', 'error');
        return;
    }

    const token = getAuthToken();
    const sessionUser = getAuthUser();
    if (!token || !sessionUser?.userId) {
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

    if (token !== getAuthToken() || getAuthUser()?.userId !== sessionUser.userId
        || customerProfile?.userId !== sessionUser.userId
        || !customerProfile?.customerId || !customerProfile.phone) {
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
    const pricing = updateCheckoutTotal();
    const pendingOrder = {
        accountUserId: sessionUser.userId,
        customerId: customerProfile.customerId,
        customer: { fullName, phone: customerProfile.phone, address },
        note: note || '',
        paymentMethod,
        voucherCode: appliedVoucher?.code || null,
        voucherDiscount: pricing.voucherDiscount,
        promotionDiscount: pricing.promotionDiscount,
        originalSubtotal: pricing.originalSubtotal,
        discountedSubtotal: pricing.saleSubtotal,
        shippingFee: pricing.shippingFee,
        total: pricing.total,
        orderDetails,
        items: cart.map(item => ({
            productId: item.productId,
            variantId: item.variantId || item.productId,
            categoryId: products.find(product => String(product.productId) === String(item.productId))?.categoryId ?? null,
            name: item.name,
            imageUrl: item.imageUrl,
            price: item.price,
            originalPrice: item.originalPrice ?? item.price,
            promotionName: item.promotionName || '',
            quantity: item.quantity || 1,
            sku: item.sku || '',
            attributes: item.attributes || [],
            variantAttributes: item.variantAttributesText || formatVariantAttributes(item)
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

    if (e.target.closest('#applyVoucherBtn')) {
        applyVoucher();
        return;
    }

    if (e.target.closest('#saveCheckoutAddressBtn')) {
        saveCheckoutAddress();
        return;
    }

    const buyNowBtn = e.target.closest('.buy-now-card');
    if (buyNowBtn?.dataset.id && !buyNowBtn.disabled) {
        buyNowFromProductCard(buyNowBtn.dataset.id);
        return;
    }

    // Add to cart from card
    const addCartBtn = e.target.closest('.add-cart');
    if (addCartBtn && addCartBtn.dataset.id) {
        const pId = addCartBtn.dataset.id;
        const targetProd = products.find(x => String(x.productId) === String(pId));
        if (targetProd) {
            const variant = preferredVariantOf(targetProd);
            const variantAttrs = variant?.attributes || [];
            addToCart({
                productId: targetProd.productId,
                variantId: variant?.variantId || targetProd.productId,
                name: targetProd.name,
                price: sellingPriceOf(variant) ?? targetProd.basePrice,
                originalPrice: originalPriceOf(variant) ?? targetProd.basePrice,
                promotionName: variant?.promotionName || '',
                imageUrl: targetProd.imageUrl || variant?.imageUrl,
                quantity: 1,
                sku: variant?.sku || '',
                attributes: variantAttrs,
                variantAttributesText: formatVariantAttributes(variant || targetProd),
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
    if (e.target.closest('#accountDrawerClose')) { closeAccountDrawer(); return; }

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

document.addEventListener('change', event => {
    if (event.target.id === 'orderSavedAddress') {
        const address = customerAddresses.find(item => Number(item.customerAddressId) === Number(event.target.value));
        if (address) applyCheckoutAddress(address);
        else {
            selectedCustomerAddressId = null;
            renderCheckoutAddressBook();
        }
    } else if (event.target.id === 'orderProvince') {
        clearSavedAddressSelection();
        loadWardsForSelectedProvince();
    } else if (event.target.id === 'orderWard') {
        clearSavedAddressSelection();
        composeDeliveryAddress();
        scheduleCheckoutDeliveryEstimate();
    }
});

document.addEventListener('input', event => {
    if (['orderAddressDetail', 'orderFullName', 'orderPhone'].includes(event.target.id)) {
        clearSavedAddressSelection();
        composeDeliveryAddress();
        if (event.target.id === 'orderAddressDetail') scheduleCheckoutDeliveryEstimate();
    }
});

document.getElementById('checkoutDrawerForm')?.addEventListener('submit', handleCheckoutSubmit);
document.getElementById('orderVoucherCode')?.addEventListener('input', event => {
    if (!appliedVoucher) return;
    if (String(event.target.value || '').trim().toUpperCase() === String(appliedVoucher.code || '').trim().toUpperCase()) return;
    appliedVoucher = null;
    const message = document.getElementById('voucherMessage');
    if (message) message.textContent = '';
    updateCheckoutTotal();
});
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
    initializeVietnamDeliveryAddress();
    loadCustomerNotifications();
    updateCartCountBadge();
    checkApi();
    loadData();
    startHomeCarousel();
    setInterval(loadData, 30000);
    setTimeout(initCustomerTrackingSignalR, 1000);
}
