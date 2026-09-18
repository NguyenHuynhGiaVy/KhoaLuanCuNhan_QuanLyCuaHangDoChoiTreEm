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

function updateApiStatus(online, message = '') {
    const status = document.getElementById('customerApiStatus');
    if (!status) return;
    status.textContent = online ? 'API đang kết nối' : 'API không kết nối';
    status.className = `customer-api-status ${online ? 'online' : 'offline'}`;
}

async function checkApi() {
    try {
        const response = await fetch('/api/Health', { cache: 'no-store' });
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
            fetch('/api/Product'),
            fetch('/api/Category')
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

    // Thêm vào giỏ
    if (e.target.closest('.add-cart')) {
        cartCount++;
        updateCart();
        showToast("Đã thêm vào giỏ hàng!");
    }
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
updateCart();
checkApi();
loadData();
setInterval(loadData, 30000);
