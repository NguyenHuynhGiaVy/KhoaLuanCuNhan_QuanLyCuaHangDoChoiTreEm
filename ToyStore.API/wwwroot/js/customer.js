/**
 * ToyStore Customer - customer.js
 * Logic lọc sản phẩm theo chuẩn MyKingdom (Tickbox)
 */

const grid = document.getElementById('productGrid');
const searchInput = document.getElementById('productSearch');
const sortSelect = document.getElementById('productSort');
const resultCount = document.getElementById('resultCount');
const catalogTitle = document.getElementById('catalogTitle');

let products = [];
let categories = [];
let activeFilter = 'all'; // Category ID từ sidebar trên

// State cho các bộ lọc tickbox
let selectedPrices = [];
let selectedBrands = [];
let selectedGenders = [];
let selectedAges = [];

let currentPage = 1;
const pageSize = 12;
let cartCount = Number(localStorage.getItem('toyStoreCartCount') || 0);

const escapeHtml = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = v => v == null ? 'Liên hệ' : `${Number(v).toLocaleString('vi-VN')}đ`;

function showToast(m) {
    const t = document.getElementById('customerToast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2400);
}

function updateCart() {
    const c = document.getElementById('cartCount');
    if (c) c.textContent = cartCount;
    localStorage.setItem('toyStoreCartCount', cartCount);
}

const API_BASE = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '5225'))
    ? 'http://localhost:5225'
    : '';

function updateApiStatus(online, message = '') {
    const status = document.getElementById('customerApiStatus');
    if (!status) return;
    status.textContent = online ? 'API đang kết nối' : 'API không kết nối';
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

        // Chỉ cập nhật nếu có thay đổi để không mất trạng thái UI
        if (JSON.stringify(products) !== JSON.stringify(newProducts) ||
            JSON.stringify(categories) !== JSON.stringify(newCategories)) {
            products = newProducts;
            categories = newCategories;

            renderCategories();
            renderBrandFilters();
            renderHomeCategories();
            renderProducts();
            renderHomeProducts();
        }
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
            const count = products.filter(p => String(p.categoryId) === String(c.id)).length;
            return `<button class="category-filter ${activeFilter == String(c.id) ? 'active' : ''}" data-filter="${c.id}">${escapeHtml(c.name)} <span>(${count})</span></button>`;
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
    `).join('') : '<div class="filter-loading">Chưa có thương hiệu</div>';
}

function productCard(p) {
    return `
        <article class="product-card">
            <a class="product-link" href="/product-detail.html?id=${p.productId}">
                <div class="product-img">
                    <img src="${escapeHtml(p.imageUrl || 'https://placehold.co/400x400?text=ToyStore')}" alt="${escapeHtml(p.name)}" loading="lazy">
                </div>
                <div class="product-detail">
                    <small>${escapeHtml(p.categoryName || 'Đồ chơi')}</small>
                    <h3>${escapeHtml(p.name)}</h3>
                    <div class="product-price"><b>${money(p.basePrice)}</b></div>
                </div>
            </a>
            <button class="add-cart" data-id="${p.productId}">Thêm vào giỏ</button>
        </article>
    `;
}

function renderProducts() {
    if (!grid) return;

    const query = searchInput?.value.toLowerCase() || '';

    let filtered = products.filter(p => {
        // 1. Tìm kiếm (Tên / Danh mục)
        const matchSearch = (p.name || '').toLowerCase().includes(query) || (p.categoryName || '').toLowerCase().includes(query);

        // 2. Danh mục (Sidebar ID)
        const matchCategory = activeFilter === 'all' || String(p.categoryId) === String(activeFilter);

        // 3. Giá (Tickbox)
        let matchPrice = selectedPrices.length === 0;
        if (!matchPrice) {
            const price = Number(p.basePrice || 0);
            matchPrice = selectedPrices.some(range => {
                const [min, max] = range.split('-').map(Number);
                return price >= min && price <= max;
            });
        }

        // 4. Thương hiệu (Tickbox)
        const matchBrand = selectedBrands.length === 0 || selectedBrands.includes(String(p.brandId));

        // 5. Giới tính (Tickbox)
        let matchGender = selectedGenders.length === 0;
        if (!matchGender) {
            const pg = String(p.gender);
            // MyKingdom: Nếu chọn trai/gái, sp Unisex (3) luôn hiện
            matchGender = selectedGenders.includes(pg) || pg === '3';
        }

        // 6. Độ tuổi (Tickbox)
        let matchAge = selectedAges.length === 0;
        if (!matchAge) {
            const pMin = p.ageFrom == null ? 0 : Number(p.ageFrom);
            const pMax = p.ageTo == null ? 9999 : Number(p.ageTo);
            matchAge = selectedAges.some(range => {
                const [fMin, fMax] = range.split('-').map(Number);
                // Intersection logic: Giao nhau giữa khoảng sp và khoảng lọc
                return pMin <= fMax && pMax >= fMin;
            });
        }

        return matchSearch && matchCategory && matchPrice && matchBrand && matchGender && matchAge;
    });

    // Sắp xếp
    if (sortSelect?.value === 'priceAsc') filtered.sort((a, b) => Number(a.basePrice) - Number(b.basePrice));
    else if (sortSelect?.value === 'priceDesc') filtered.sort((a, b) => Number(b.basePrice) - Number(a.basePrice));
    else if (sortSelect?.value === 'name') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (resultCount) resultCount.textContent = `${filtered.length} Sản phẩm`;

    // Phân trang
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageProducts = filtered.slice(start, start + pageSize);

    grid.innerHTML = pageProducts.map(productCard).join('') || '<div class="empty-state">Không tìm thấy sản phẩm phù hợp.</div>';
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('productPagination');
    if (!pagination) return;
    if (totalPages <= 1) { pagination.innerHTML = ''; return; }

    let buttons = `<button class="page-button" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>←</button>`;
    for (let i = 1; i <= totalPages; i++) {
        buttons += `<button class="page-button ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    buttons += `<button class="page-button" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>→</button>`;
    pagination.innerHTML = buttons;
}

function renderHomeProducts() {
    const homeGrid = document.getElementById('homeProductGrid');
    if (!homeGrid) return;
    homeGrid.innerHTML = products.length ? products.slice(0, 8).map(productCard).join('') : '<p>Đang cập nhật sản phẩm...</p>';
}

function renderHomeCategories() {
    const list = document.getElementById('homeCategoryList');
    if (!list) return;
    const icons = ['◈', '♢', '✦', '♡', '⊞', '▤'];
    list.innerHTML = categories.length ? categories.slice(0, 6).map((c, i) => `
        <div>
            <span class="category-icon ${i % 2 ? 'coral' : ''}">${icons[i % icons.length]}</span>
            <b>${escapeHtml(c.name)}</b>
            <small>${products.filter(p => String(p.categoryId) === String(c.id)).length} sản phẩm</small>
        </div>
    `).join('') : '<div><b>Chưa có danh mục</b></div>';
}

/* =========================================================
   GIỎ HÀNG (SHOPPING CART & CHECKOUT LOGIC)
   ========================================================= */

function getCartItems() {
    try {
        return JSON.parse(localStorage.getItem('toyStoreCartItems') || '[]');
    } catch {
        return [];
    }
}

function saveCartItems(items) {
    localStorage.setItem('toyStoreCartItems', JSON.stringify(items));
    updateCartCountBadge();
    renderCartDrawer();
}

function updateCartCountBadge() {
    const items = getCartItems();
    const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const badge = document.getElementById('cartCount');
    if (badge) badge.textContent = totalQty;
    const drawerBadge = document.getElementById('cartDrawerCount');
    if (drawerBadge) drawerBadge.textContent = totalQty;
}

function addToCart(itemToAdd) {
    let items = getCartItems();
    const existingIndex = items.findIndex(x => String(x.productId) === String(itemToAdd.productId) && String(x.variantId || '') === String(itemToAdd.variantId || ''));
    
    if (existingIndex >= 0) {
        items[existingIndex].quantity = (Number(items[existingIndex].quantity) || 1) + (Number(itemToAdd.quantity) || 1);
    } else {
        items.push({
            productId: itemToAdd.productId,
            variantId: itemToAdd.variantId || itemToAdd.productId,
            name: itemToAdd.name || 'Sản phẩm',
            price: Number(itemToAdd.price || 0),
            imageUrl: itemToAdd.imageUrl || 'https://placehold.co/400x400?text=ToyStore',
            quantity: Number(itemToAdd.quantity) || 1,
            sku: itemToAdd.sku || ''
        });
    }

    saveCartItems(items);
    showToast("Đã thêm vào giỏ hàng!");
    openCartDrawer();
}

function updateCartItemQty(index, delta) {
    let items = getCartItems();
    if (!items[index]) return;
    items[index].quantity = (Number(items[index].quantity) || 1) + delta;
    if (items[index].quantity <= 0) {
        items.splice(index, 1);
    }
    saveCartItems(items);
}

function removeCartItem(index) {
    let items = getCartItems();
    items.splice(index, 1);
    saveCartItems(items);
}

function renderCartDrawer() {
    const body = document.getElementById('cartDrawerBody');
    if (!body) return;

    const items = getCartItems();
    if (!items.length) {
        body.innerHTML = '<div class="empty-cart-msg">Giỏ hàng của bạn đang trống.<br><br><a href="/products.html" class="hero-button" style="padding:8px 14px;font-size:11px;">Mua sắm ngay <span>→</span></a></div>';
        document.getElementById('cartSubtotal').textContent = '0đ';
        document.getElementById('cartTotal').textContent = '0đ';
        return;
    }

    let subtotal = 0;
    body.innerHTML = items.map((item, index) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        subtotal += itemTotal;
        return `
            <div class="cart-item">
                <img class="cart-item-img" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">
                <div class="cart-item-info">
                    <h4 class="cart-item-title">${escapeHtml(item.name)}</h4>
                    ${item.sku ? `<div class="cart-item-variant">SKU: ${escapeHtml(item.sku)}</div>` : ''}
                    <div class="cart-item-price">${money(item.price)}</div>
                    <div class="cart-item-actions">
                        <div class="cart-item-qty">
                            <button type="button" class="btn-qty-minus" data-index="${index}">−</button>
                            <span>${item.quantity}</span>
                            <button type="button" class="btn-qty-plus" data-index="${index}">+</button>
                        </div>
                        <button type="button" class="cart-item-remove" data-index="${index}" title="Xóa">🗑</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const shipping = subtotal >= 500000 || subtotal === 0 ? 0 : 30000;
    const grandTotal = subtotal + shipping;

    document.getElementById('cartSubtotal').textContent = money(subtotal);
    const shipFeeNode = document.getElementById('cartShippingFee');
    if (shipFeeNode) shipFeeNode.textContent = shipping === 0 ? 'Miễn phí' : money(shipping);
    document.getElementById('cartTotal').textContent = money(grandTotal);
}

function openCartDrawer() {
    renderCartDrawer();
    document.getElementById('cartDrawerOverlay')?.classList.add('open');
}

function closeCartDrawer() {
    document.getElementById('cartDrawerOverlay')?.classList.remove('open');
}

let appliedVoucherDiscount = 0;

function openCheckoutModal() {
    const items = getCartItems();
    if (!items.length) {
        showToast("Giỏ hàng của bạn đang trống!");
        return;
    }
    closeCartDrawer();
    
    // Auto fill user details if logged in
    const user = getAuthUser();
    if (user) {
        const nameInput = document.getElementById('orderFullName');
        const phoneInput = document.getElementById('orderPhone');
        if (nameInput && user.fullName) nameInput.value = user.fullName;
    }

    updateCheckoutTotal();
    document.getElementById('checkoutModalBackdrop')?.classList.add('open');
}

function closeCheckoutModal() {
    document.getElementById('checkoutModalBackdrop')?.classList.remove('open');
}

function updateCheckoutTotal() {
    const items = getCartItems();
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= 500000 || subtotal === 0 ? 0 : 30000;
    const finalTotal = Math.max(0, subtotal + shipping - appliedVoucherDiscount);
    const node = document.getElementById('checkoutFinalTotal');
    if (node) node.textContent = money(finalTotal);
}

async function handleCheckoutSubmit(e) {
    e.preventDefault();
    const items = getCartItems();
    if (!items.length) {
        showToast("Giỏ hàng trống!");
        return;
    }

    const fullName = document.getElementById('orderFullName')?.value.trim();
    const phone = document.getElementById('orderPhone')?.value.trim();
    const address = document.getElementById('orderAddress')?.value.trim();
    const note = document.getElementById('orderNote')?.value.trim();
    const paymentMethod = document.getElementById('orderPaymentMethod')?.value;

    const orderDetails = items.map(item => ({
        variantId: Number(item.variantId || item.productId),
        quantity: Number(item.quantity)
    }));

    const payload = {
        note: `Người nhận: ${fullName} - SĐT: ${phone} - Đ/c: ${address} | Ghi chú: ${note || 'Không'} | Thanh toán: ${paymentMethod}`,
        orderDetails: orderDetails
    };

    try {
        const response = await fetch(`${API_BASE}/api/Order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || 'Lỗi đặt hàng');
        }

        const orderResult = await response.json();
        saveCartItems([]); // Clear cart
        closeCheckoutModal();
        showToast(`🎉 Đặt hàng thành công! Mã đơn: ${orderResult.orderCode || 'ORD-NEW'}`);
    } catch (error) {
        alert(`Không thể đặt hàng: ${error.message}`);
    }
}

/* =========================================================
   CUSTOMER AUTH & MODALS
   ========================================================= */

function getAuthToken() {
    return localStorage.getItem('toyStoreToken');
}

function getAuthUser() {
    try {
        return JSON.parse(localStorage.getItem('toyStoreUser') || 'null');
    } catch {
        return null;
    }
}

function openAuthModal() {
    updateAuthUI();
    document.getElementById('customerAuthModalBackdrop')?.classList.add('open');
}

function closeAuthModal() {
    document.getElementById('customerAuthModalBackdrop')?.classList.remove('open');
}

function updateAuthUI() {
    const user = getAuthUser();
    const unauthBox = document.getElementById('authModalUnauthenticated');
    const authBox = document.getElementById('authModalAuthenticated');

    if (user && getAuthToken()) {
        if (unauthBox) unauthBox.style.display = 'none';
        if (authBox) authBox.style.display = 'block';

        document.getElementById('userProfileName').textContent = user.fullName || 'Khách hàng';
        document.getElementById('userProfileEmail').textContent = user.email || '';
        const roleNode = document.getElementById('userProfileRole');
        if (roleNode) {
            const role = user.role || 'Customer';
            roleNode.textContent = role === 'Admin' ? 'Quản trị viên' : role === 'Manager' ? 'Quản lý' : role === 'Staff' ? 'Nhân viên' : 'Khách hàng';
            roleNode.className = `role-badge ${role.toLowerCase()}`;
        }
    } else {
        if (unauthBox) unauthBox.style.display = 'block';
        if (authBox) authBox.style.display = 'none';
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
            const err = await response.json();
            throw new Error(err.message || 'Đăng nhập thất bại');
        }

        const data = await response.json();
        localStorage.setItem('toyStoreToken', data.token);
        localStorage.setItem('toyStoreUser', JSON.stringify({
            userId: data.userId,
            fullName: data.fullName,
            email: data.email,
            role: data.role
        }));

        closeAuthModal();
        showToast(`Chào mừng trở lại, ${data.fullName}!`);
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
            const err = await response.json();
            throw new Error(err.message || 'Đăng ký thất bại');
        }

        const data = await response.json();
        localStorage.setItem('toyStoreToken', data.token);
        localStorage.setItem('toyStoreUser', JSON.stringify({
            userId: data.userId,
            fullName: data.fullName,
            email: data.email,
            role: data.role
        }));

        closeAuthModal();
        showToast(`Tạo tài khoản thành công! Chào mừng ${data.fullName}`);
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
        if (errNode) errNode.textContent = 'Bạn cần đăng nhập lại.';
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
            const err = await response.json();
            throw new Error(err.message || 'Đổi mật khẩu thất bại');
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
    closeAuthModal();
    showToast('Đã đăng xuất thành công.');
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

document.addEventListener('click', e => {
    // Category Sidebar (Top)
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

    // Phân trang
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn && !pageBtn.disabled) {
        currentPage = Number(pageBtn.dataset.page);
        renderProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    // Thêm vào giỏ hàng từ sản phẩm
    const addCartBtn = e.target.closest('.add-cart');
    if (addCartBtn && addCartBtn.dataset.id) {
        const pId = addCartBtn.dataset.id;
        const targetProd = products.find(x => String(x.productId) === String(pId));
        if (targetProd) {
            const variant = targetProd.productVariants?.[0];
            addToCart({
                productId: targetProd.productId,
                variantId: variant?.variantId || targetProd.productId,
                name: targetProd.name,
                price: variant?.price ?? targetProd.basePrice,
                imageUrl: targetProd.imageUrl,
                quantity: 1,
                sku: variant?.sku || ''
            });
        }
        return;
    }

    // Controls trong Giỏ hàng Drawer
    if (e.target.closest('#custCartBtn')) { openCartDrawer(); return; }
    if (e.target.closest('#cartDrawerClose, #cartDrawerOverlay')) {
        if (e.target === document.getElementById('cartDrawerOverlay') || e.target.closest('#cartDrawerClose')) {
            closeCartDrawer();
        }
    }

    const qtyMinus = e.target.closest('.btn-qty-minus');
    if (qtyMinus) { updateCartItemQty(Number(qtyMinus.dataset.index), -1); return; }

    const qtyPlus = e.target.closest('.btn-qty-plus');
    if (qtyPlus) { updateCartItemQty(Number(qtyPlus.dataset.index), 1); return; }

    const removeBtn = e.target.closest('.cart-item-remove');
    if (removeBtn) { removeCartItem(Number(removeBtn.dataset.index)); return; }

    if (e.target.closest('#openCheckoutBtn')) { openCheckoutModal(); return; }
    if (e.target.closest('#checkoutModalClose') || e.target === document.getElementById('checkoutModalBackdrop')) { closeCheckoutModal(); return; }

    // Account / Auth Modal Controls
    if (e.target.closest('#custAccountBtn')) { openAuthModal(); return; }
    if (e.target.closest('#customerAuthModalClose') || e.target === document.getElementById('customerAuthModalBackdrop')) { closeAuthModal(); return; }

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
    // Lọc tickboxes
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

document.getElementById('checkoutForm')?.addEventListener('submit', handleCheckoutSubmit);
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
   START
   ========================================================= */
updateCartCountBadge();
checkApi();
loadData();
setInterval(loadData, 30000);

