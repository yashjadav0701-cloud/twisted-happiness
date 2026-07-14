/**
 * Twisted Happiness - Enterprise Storefront Engine
 * Version: 9.0.0 - Fully Integrated Unified Cart Checkout, Address Book & Mobile-Sticky Sidebar.
 */

const SUPABASE_URL = "https://gvrfucjtnyqfkdynrmqs.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_8jru2BqvTdE9bcwNOLIHAA_dx6aUCM0";
let _supabase;

const DISCOUNT_TIERS = [
    { threshold: 4999, type: 'percent', value: 15, label: '15% OFF VIP' },
    { threshold: 2499, type: 'percent', value: 12, label: '12% OFF VIP' },
    { threshold: 999,  type: 'percent', value: 10, label: '10% OFF VIP' },
    { threshold: 499,  type: 'percent', value: 8,  label: '8% OFF VIP' },
    { threshold: 299,  type: 'flat',    value: 30, label: '₹30 OFF VIP' }
];

const countryCodeMapping = {
    "+91": "🇮🇳 IN (+91)", "+1": "🇺🇸 US (+1)", "+44": "🇬🇧 UK (+44)",
    "+61": "🇦🇺 AU (+61)", "+971": "🇦🇪 AE (+971)", "+966": "🇸🇦 SA (+966)",
    "+65": "🇸🇬 SG (+65)", "+60": "🇲🇾 MY (+60)", "+49": "🇩🇪 DE (+49)",
    "+33": "🇫🇷 FR (+33)", "+39": "🇮🇹 IT (+39)", "+81": "🇯🇵 JP (+81)",
    "+82": "🇰🇷 KR (+82)", "+64": "🇳🇿 NZ (+64)", "+27": "🇿🇦 ZA (+27)"
};

let settings = safeJSONParse('th_settings', { storeName: "Twisted Happiness", instagram: "", whatsapp: "9909310501", instamojoUser: "twistedhappiness", countryCode: "+91" });
let cart = safeJSONParse('th_cart', []); 
let products = [];
let currentMainCategory = 'All'; let activeSubCategories = []; let currentSortMode = 'newest'; let currentSearchQuery = ''; 
let searchTimeout = null;
let modalImages = []; let currentSlideIndex = 0; let isAnimating = false; 
let currentLightboxIndex = 0; let isLightboxAnimating = false;
let currentModalLevel = 0; let statePushed = false;

// Unified Checkout State Flow Variables
let checkoutStep = 1;
let pendingOrderPayload = null; 
let currentOrderReference = null;
let currentDeliveryFee = 0;

// Address Book State
let savedAddresses = safeJSONParse('th_saved_addresses', []);
let oldProfile = safeJSONParse('th_shiprocket_profile', null);
if (savedAddresses.length === 0 && oldProfile && oldProfile.first_name) {
    savedAddresses.push(oldProfile);
    localStorage.setItem('th_saved_addresses', JSON.stringify(savedAddresses));
    localStorage.removeItem('th_shiprocket_profile');
}
let selectedAddressIndex = savedAddresses.length > 0 ? 0 : -1;
let editingAddressIndex = null;

// 🎀 BULLETPROOF LOADING ENGINE 🎀
const dismissPreloader = () => {
    const preloader = document.getElementById('luxury-page-preloader');
    if (preloader && !preloader.classList.contains('hidden')) {
        preloader.classList.add('opacity-0');
        setTimeout(() => preloader.classList.add('hidden'), 700);
    }
};

window.addEventListener('load', () => { setTimeout(dismissPreloader, 300); });
setTimeout(dismissPreloader, 2500);

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(dismissPreloader, 1500); 

    try {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        fetchDatabase(); 
    } catch (e) {
        console.error("Supabase Init Error:", e);
        dismissPreloader(); 
    }
    
    applyDynamicSettings();
    bindDOMEvents();
    injectSkeletons();
    updateCartCount();
    setupSocialLinks();
});

function showInteractionLoader(text = "Please wait...") {
    const loader = document.getElementById('interaction-loader');
    if(!loader) return;
    document.getElementById('interaction-loader-text').textContent = text;
    loader.classList.remove('hidden');
    loader.classList.add('flex');
    requestAnimationFrame(() => loader.classList.remove('opacity-0'));
}

function hideInteractionLoader() {
    const loader = document.getElementById('interaction-loader');
    if(!loader) return;
    loader.classList.add('opacity-0');
    setTimeout(() => {
        loader.classList.add('hidden');
        loader.classList.remove('flex');
    }, 300);
}

function applyDynamicSettings() {
    const name = settings.storeName || "Twisted Happiness";
    document.title = `${name} | Fine Art & Handcrafted Gifts`;
    if(document.getElementById('dynamic-store-name')) document.getElementById('dynamic-store-name').textContent = name;
    if(document.getElementById('footer-dynamic-name')) document.getElementById('footer-dynamic-name').textContent = name;
    if(document.getElementById('preloader-brand')) document.getElementById('preloader-brand').textContent = name;
    if(document.getElementById('current-year')) document.getElementById('current-year').textContent = new Date().getFullYear();
}

function bindDOMEvents() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            window.location.href = '/khushiified';
        }
    });

    document.getElementById('prof-pin')?.addEventListener('input', () => {
        if (document.getElementById('checkout-overlay') && !document.getElementById('checkout-overlay').classList.contains('hidden')) {
            updateCheckoutUI();
        }
    });

    document.getElementById('btn-open-return-policy')?.addEventListener('click', () => openPolicyModal('return-policy-modal', 'return-policy-box'));
    document.getElementById('btn-close-return-policy')?.addEventListener('click', () => closePolicyModal('return-policy-modal', 'return-policy-box'));
    document.getElementById('btn-open-privacy-policy')?.addEventListener('click', () => openPolicyModal('privacy-policy-modal', 'privacy-policy-box'));
    document.getElementById('btn-close-privacy-policy')?.addEventListener('click', () => closePolicyModal('privacy-policy-modal', 'privacy-policy-box'));
    
    document.getElementById('searchInputDesk')?.addEventListener('input', (e) => syncSearch(e.target.value));
    document.getElementById('searchInputMob')?.addEventListener('input', (e) => syncSearch(e.target.value));
    document.getElementById('sortInputMob')?.addEventListener('change', (e) => setSortMode(e.target.value));
    document.getElementById('sortInputDesk')?.addEventListener('change', (e) => setSortMode(e.target.value));
    document.getElementById('sub-category-filters-mob')?.addEventListener('change', (e) => filterSubCategory(e.target.value));
    document.getElementById('btn-close-product')?.addEventListener('click', () => { closeProductPage(); safeBack(); });
    document.getElementById('breadcrumb-back')?.addEventListener('click', () => { closeProductPage(); safeBack(); });
    document.getElementById('btn-close-lightbox')?.addEventListener('click', () => { forceCloseLightbox(); safeBack(); });

    document.getElementById('btn-slide-prev')?.addEventListener('click', (e) => { e.stopPropagation(); moveSlide(-1); });
    document.getElementById('btn-slide-next')?.addEventListener('click', (e) => { e.stopPropagation(); moveSlide(1); });
    document.getElementById('btn-lightbox-prev')?.addEventListener('click', () => moveLightboxSlide(-1));
    document.getElementById('btn-lightbox-next')?.addEventListener('click', () => moveLightboxSlide(1));

    setupTouchCarousel(); setupLightboxTouch();
}

function openPolicyModal(modalId, boxId) {
    currentModalLevel = 2; safePushState(2);
    const modal = document.getElementById(modalId);
    const box = document.getElementById(boxId);
    if(!modal || !box) return;
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        box.classList.remove('scale-95', 'translate-y-2');
        box.classList.add('scale-100', 'translate-y-0');
    });
}

function closePolicyModal(modalId, boxId) {
    const modal = document.getElementById(modalId);
    const box = document.getElementById(boxId);
    if(!modal || !box) return;
    requestAnimationFrame(() => {
        modal.classList.add('opacity-0');
        box.classList.remove('scale-100', 'translate-y-0');
        box.classList.add('scale-95', 'translate-y-2');
        setTimeout(() => {
            modal.classList.add('hidden');
            if(document.getElementById('checkout-overlay')?.classList.contains('hidden')){
                document.body.classList.remove('overflow-hidden');
            }
        }, 200);
    });
}

function safeJSONParse(key, fallback) { try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : fallback; } catch (e) { localStorage.removeItem(key); return fallback; } }
function safePushState(level) { try { history.pushState({ level: level }, ""); statePushed = true; } catch(e) { statePushed = false; } }
function safeBack() { if (statePushed) { try { history.back(); } catch(e) {} statePushed = false; } }
function isMobileDevice() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); }

function setupSocialLinks() {
    const phone = (settings.whatsapp || "9909310501").replace(/\D/g, '');
    const code = (settings.countryCode || "91").replace(/\D/g, '');
    const waLink = document.getElementById('footer-whatsapp');
    if(waLink) {
        waLink.href = `https://wa.me/${code}${phone}?text=Hello!%20I%20am%20exploring%20your%20beautiful%20collection.`;
    }
    const igLink = document.getElementById('footer-instagram');
    if(igLink) {
        if (settings.instagram && settings.instagram.trim() !== "") {
            let cleanIg = settings.instagram.trim();
            if (!cleanIg.startsWith('http://') && !cleanIg.startsWith('https://')) {
                cleanIg = 'https://' + cleanIg;
            }
            igLink.href = cleanIg;
            igLink.classList.remove('hidden');
            igLink.classList.add('flex'); 
        } else {
            igLink.classList.add('hidden');
            igLink.classList.remove('flex');
        }
    }
}

function injectSkeletons() {
    const loadingGrid = document.getElementById('product-grid');
    if(!loadingGrid) return;
    let skeletonHTML = '';
    for(let i=0; i<12; i++) {
        const delay = (i % 6) * 0.05;
        skeletonHTML += `
        <div class="w-full relative opacity-100 transform translate-y-0" style="animation: fadeInUp 0.4s ease-out forwards; animation-delay: ${delay}s;">
            <div class="w-full bg-luxury-blush/30 rounded-2xl aspect-[4/5] skeleton-layer mb-3"></div>
            <div class="px-1">
                <div class="h-3 rounded-full bg-luxury-blush/60 w-3/4 mb-2.5 skeleton-layer"></div>
                <div class="h-4 rounded-full bg-luxury-blush/60 w-1/3 skeleton-layer"></div>
            </div>
        </div>`;
    }
    loadingGrid.innerHTML = skeletonHTML;
}

async function fetchDatabase() { 
    try { 
        const { data, error } = await _supabase.from('creations').select('*').order('created_at', { ascending: false }); 
        if (error) throw error;
        products = data.map(row => {
            let parsedImages = []; try { parsedImages = JSON.parse(row.image_url) || []; } catch(e) {}
            return {
                id: row.id, name: row.name, category: row.category, mainCategory: row.main_category || 'Pipe Cleaner Crafts', price: row.price, prepTime: row.prep_time, specs: row.specs, dimensions: row.dimensions || '', isCustomizable: row.is_customizable || false,
                image1: parsedImages[0] ? parsedImages[0].data : '', image2: parsedImages[1] ? parsedImages[1].data : '', image3: parsedImages[2] ? parsedImages[2].data : '', image4: parsedImages[3] ? parsedImages[3].data : '', image5: parsedImages[4] ? parsedImages[4].data : ''
            };
        });
        requestAnimationFrame(() => { 
            renderFilters(); 
            renderProducts(); 
            setTimeout(dismissPreloader, 400); 
        });
    } catch (error) { 
        console.error("Database initialization failed:", error); 
        dismissPreloader(); 
    } 
}

function renderProducts(searchQuery = '') { 
    const grid = document.getElementById('product-grid'); if(!grid) return; grid.innerHTML = ''; 
    let filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if(currentMainCategory !== 'All') { filtered = filtered.filter(p => p.mainCategory === currentMainCategory); }
    if(activeSubCategories.length > 0) { filtered = filtered.filter(p => activeSubCategories.includes(p.category)); }
    if(currentSortMode === 'low') filtered.sort((a,b) => parseFloat(a.price) - parseFloat(b.price)); 
    if(currentSortMode === 'high') filtered.sort((a,b) => parseFloat(b.price) - parseFloat(a.price)); 
    if(currentSortMode === 'newest') filtered.reverse(); 

    if(filtered.length === 0) { grid.innerHTML = '<div class="col-span-full text-center py-20 text-gray-400 font-medium text-sm w-full inline-block">No creations found.</div>'; return; } 

    const fragment = document.createDocumentFragment();
    filtered.forEach((p) => { fragment.appendChild(generateProductCardHTML(p)); }); 
    grid.appendChild(fragment);
    requestAnimationFrame(() => { setupScrollReveal(); });
}

function generateProductCardHTML(p) {
    const cleanPrice = Number(p.price.toString().replace(/[^0-9.,]/g, '')); const discountPercent = getDiscountPercent(p.id.toString()); const originalPrice = Math.round(cleanPrice * (1 + (discountPercent / 100)));
    const mainImg = (p.image1 && typeof p.image1 === 'string' && p.image1.trim() !== '') ? p.image1 : 'https://placehold.co/400x500/F8E9EA/423133';
    const card = document.createElement('div'); card.className = `w-full relative cursor-pointer opacity-0 transform translate-y-4 transition-all duration-400 ease-out group scroll-reveal`; 
    card.addEventListener('click', () => openProductPage(p.id));
    card.innerHTML = `
        <div class="w-full relative rounded-2xl overflow-hidden group shadow-sm bg-gradient-to-tr from-luxury-bg to-white border border-luxury-blush aspect-[4/5] mb-2">
            <span class="absolute top-2.5 left-2.5 z-10 bg-white/95 text-luxury-dark text-[7px] sm:text-[8px] font-bold px-2.5 py-1 rounded-md uppercase tracking-[0.15em] border border-luxury-blush truncate max-w-[80%] shadow-sm">${p.category}</span>
            <img loading="lazy" decoding="async" src="${mainImg}" alt="${p.name}" width="400" height="500" onerror="this.src='https://placehold.co/400x500/F8E9EA/423133';" class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-500 pointer-events-none" onload="this.classList.remove('opacity-0')">
        </div>
        <div class="px-1 flex flex-col justify-start text-left w-full">
            <h3 class="font-bitter font-semibold text-[11px] sm:text-[12px] text-luxury-dark leading-snug w-full transition-colors group-hover:text-luxury-rose mb-0.5 line-clamp-2">${p.name}</h3>
            <div class="flex items-center md:items-baseline gap-1.5 flex-wrap w-full">
                <span class="font-poppins font-extrabold text-luxury-dark text-[14px] sm:text-[15px] tracking-tight leading-none">₹${cleanPrice}</span>
                <span class="font-poppins text-gray-400 text-[9px] font-medium line-through leading-none">₹${originalPrice}</span>
            </div>
        </div>`;
    return card;
}

function injectProductSchema(p, cleanPrice) {
    let schemaScript = document.getElementById('product-schema');
    if (!schemaScript) { schemaScript = document.createElement('script'); schemaScript.type = 'application/ld+json'; schemaScript.id = 'product-schema'; document.head.appendChild(schemaScript); }
    const schema = { "@context": "https://schema.org/", "@type": "Product", "name": p.name, "image": [p.image1], "description": p.specs || "Handcrafted fine art by Twisted Happiness.", "sku": p.id, "offers": { "@type": "Offer", "url": window.location.href, "priceCurrency": "INR", "price": cleanPrice, "availability": "https://schema.org/InStock", "seller": { "@type": "Organization", "name": "Twisted Happiness" } } };
    schemaScript.textContent = JSON.stringify(schema);
}

function openProductPage(id) { 
    const p = products.find(x => x.id == id); 
    const cleanPrice = Number(p.price.toString().replace(/[^0-9.,]/g, '')); const discountPercent = getDiscountPercent(p.id.toString()); const originalPrice = Math.round(cleanPrice * (1 + (discountPercent / 100)));
    injectProductSchema(p, cleanPrice);
    modalImages = [p.image1, p.image2, p.image3, p.image4, p.image5].filter(img => typeof img === 'string' && img.trim() !== '');
    if (modalImages.length === 0) modalImages.push('https://placehold.co/400x500/F8E9EA/423133');
    
    const track = document.getElementById('modal-carousel-track'); const thumbContainer = document.getElementById('modal-thumbnails'); 
    track.style.transition = 'none'; let html = '';
    modalImages.forEach(imgSrc => { html += `<div class="w-full h-full flex-shrink-0 flex items-center justify-center relative bg-transparent" onclick="window.openLightboxFromCarousel()"><img loading="lazy" decoding="async" src="${imgSrc}" class="w-full h-full object-contain"></div>`; }); 
    track.innerHTML = html; currentSlideIndex = 0; track.style.transform = `translateX(0)`;
    
    thumbContainer.innerHTML = ''; 
    if (modalImages.length > 1) { 
        modalImages.forEach((imgSrc, index) => { 
            const thumb = document.createElement('img'); thumb.src = imgSrc; 
            thumb.className = `w-12 h-12 object-cover rounded-md border-2 transition-all cursor-pointer ${index === 0 ? 'border-luxury-rose scale-105 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`; 
            thumb.id = `thumb-${index}`; thumb.onclick = () => { window.goToSlide(index); }; thumbContainer.appendChild(thumb); 
        }); 
    } 
    
    if(document.getElementById('modal-title')) document.getElementById('modal-title').textContent = p.name; 
    if(document.getElementById('modal-main-category')) document.getElementById('modal-main-category').textContent = p.mainCategory; 
    if(document.getElementById('modal-sub-category')) document.getElementById('modal-sub-category').textContent = p.category || 'Fine Art Medium'; 
    if(document.getElementById('breadcrumb-main-cat')) document.getElementById('breadcrumb-main-cat').textContent = p.mainCategory;
    if(document.getElementById('breadcrumb-sub-cat')) document.getElementById('breadcrumb-sub-cat').textContent = p.name.substring(0, 20) + (p.name.length > 20 ? '...' : '');
    if(document.getElementById('modal-price')) document.getElementById('modal-price').textContent = cleanPrice; 
    if(document.getElementById('modal-original-price')) document.getElementById('modal-original-price').textContent = "₹" + originalPrice; 
    if(document.getElementById('modal-discount-tag')) document.getElementById('modal-discount-tag').textContent = `${discountPercent}% OFF`; 
    if(document.getElementById('modal-specs')) document.getElementById('modal-specs').innerHTML = p.specs || 'No details provided.'; 
    if(document.getElementById('modal-prep-time')) document.getElementById('modal-prep-time').textContent = `${p.prepTime || '3-5'} Days`;
    
    const badgesContainer = document.getElementById('art-badges-container'); const dimBadge = document.getElementById('modal-dimensions-badge'); const custBadge = document.getElementById('modal-custom-badge');
    if(badgesContainer) badgesContainer.classList.add('hidden'); if(dimBadge) dimBadge.classList.add('hidden'); if(custBadge) custBadge.classList.add('hidden');
    if(p.mainCategory === 'Canvas Paintings' || p.mainCategory === 'Clay Art Paintings') {
        badgesContainer?.classList.remove('hidden');
        if(p.dimensions && dimBadge) { document.getElementById('modal-dimensions-text').textContent = p.dimensions; dimBadge.classList.remove('hidden'); }
        if(p.isCustomizable) custBadge?.classList.remove('hidden');
    }

    const careGuide = document.getElementById('modal-care-guide');
    if (careGuide) {
        if (p.mainCategory === 'Canvas Paintings') { careGuide.innerHTML = `<li>Keep away from prolonged direct sunlight.</li><li>Avoid areas with extreme humidity.</li><li>Dust gently with a clean, dry microfiber cloth.</li>`; } 
        else if (p.mainCategory === 'Clay Art Paintings') { careGuide.innerHTML = `<li><strong>Highly fragile.</strong> Handle edges with care.</li><li>Keep strictly away from moisture.</li><li>Dust very lightly using a soft brush.</li>`; } 
        else { careGuide.innerHTML = `<li>Keep away from direct, harsh sunlight.</li><li>Lightly dust with a soft, dry brush.</li><li>Do not expose to moisture.</li>`; }
    }

    renderRelatedProducts(p.id, p.mainCategory, p.category); 
    updateProductButtons(p.id);
    document.getElementById('customer-view')?.classList.add('hidden'); 
    document.getElementById('product-view')?.classList.remove('hidden');
    window.scrollTo(0, 0); currentModalLevel = 1; safePushState(1); 
}

function closeProductPage() { document.getElementById('product-view')?.classList.add('hidden'); document.getElementById('customer-view')?.classList.remove('hidden'); window.scrollTo(0, 0); }

function updateProductButtons(id) {
    const actionContainer = document.getElementById('modal-action-buttons'); if(!actionContainer) return;
    const cartItem = cart.find(item => item.id === id); const qty = cartItem ? parseInt(cartItem.qty || 1) : 0;
    if(qty > 0) {
        actionContainer.innerHTML = `<div class="flex items-center justify-between w-full h-full bg-white border border-luxury-rose rounded-full px-2 sm:px-4 py-3 shadow-sm min-h-[44px]"><button type="button" onclick="window.th_updateCartQty('${id}', -1, event)" class="w-8 h-8 rounded-full bg-luxury-bg hover:bg-luxury-blush border border-luxury-blush text-luxury-dark active:scale-90 flex items-center justify-center shrink-0"><i class="fas fa-minus text-xs"></i></button><span class="text-base sm:text-lg font-bold text-luxury-rose font-poppins min-w-[20px] text-center">${qty}</span><button type="button" onclick="window.th_updateCartQty('${id}', 1, event)" class="w-8 h-8 rounded-full bg-luxury-bg hover:bg-luxury-blush border border-luxury-blush text-luxury-dark active:scale-90 flex items-center justify-center shrink-0"><i class="fas fa-plus text-xs"></i></button></div><button type="button" onclick="window.routeCheckoutFromModal('${id}', event)" class="w-full bg-luxury-dark text-white hover:bg-[#D9778A] font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider shadow-md active:scale-[0.98] transition-colors min-h-[44px]"><i class="fas fa-bolt text-luxury-gold"></i> Checkout</button>`;
    } else {
        actionContainer.innerHTML = `<button type="button" onclick="window.th_updateCartQty('${id}', 1, event)" class="w-full bg-white border border-luxury-dark text-luxury-dark hover:bg-luxury-bg font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider transition-colors shadow-sm active:scale-[0.98] min-h-[44px]"><i class="fas fa-shopping-bag"></i> Add to Bag</button><button type="button" onclick="window.routeCheckoutFromModal('${id}', event)" class="w-full bg-luxury-dark text-white hover:bg-[#D9778A] font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider shadow-md active:scale-[0.98] transition-colors min-h-[44px]"><i class="fas fa-bolt text-luxury-gold"></i> Buy Now</button>`;
    }
}

// 🚨 SMART "CURATED FOR YOU" LOGIC 
function renderRelatedProducts(currentId, mainCategory, subCategory) {
    const grid = document.getElementById('related-products-grid'); 
    const section = document.getElementById('related-products-section');
    if(!grid || !section) return; 
    
    grid.innerHTML = '';
    let related = products.filter(p => p.id !== currentId); 
    
    let sameSubCat = related.filter(p => p.category === subCategory); 
    let sameMainCat = related.filter(p => p.mainCategory === mainCategory && p.category !== subCategory);
    
    let finalRelated = [...sameSubCat, ...sameMainCat].slice(0, 14); 
    
    if (finalRelated.length === 0) {
        section.classList.add('hidden');
        return;
    } else {
        section.classList.remove('hidden');
    }

    const fragment = document.createDocumentFragment(); 
    finalRelated.forEach(p => { fragment.appendChild(generateProductCardHTML(p)); });
    grid.appendChild(fragment);
    
    requestAnimationFrame(() => { setupScrollReveal(); });
}

function syncSearch(val) { currentSearchQuery = val; if(document.getElementById('searchInputDesk') && document.getElementById('searchInputDesk').value !== val) document.getElementById('searchInputDesk').value = val; if(document.getElementById('searchInputMob') && document.getElementById('searchInputMob').value !== val) document.getElementById('searchInputMob').value = val; clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { requestAnimationFrame(() => renderProducts(val)); }, 250); }
function setSortMode(val) { currentSortMode = val; if(document.getElementById('sortInputDesk')) document.getElementById('sortInputDesk').value = val; if(document.getElementById('sortInputMob')) document.getElementById('sortInputMob').value = val; renderProducts(currentSearchQuery); }
function filterMainCategory(cat) { currentMainCategory = cat; activeSubCategories = []; renderFilters(); renderProducts(currentSearchQuery); }
function filterSubCategory(cat) { activeSubCategories = cat === 'All' ? [] : [cat]; renderFilters(); renderProducts(currentSearchQuery); }
function toggleSubCategoryCheckbox(cat) { const idx = activeSubCategories.indexOf(cat); if(idx > -1) { activeSubCategories.splice(idx, 1); } else { activeSubCategories.push(cat); } const subContainerMob = document.getElementById('sub-category-filters-mob'); if(subContainerMob) { subContainerMob.value = activeSubCategories.length === 1 ? activeSubCategories[0] : 'All'; } renderFilters(); renderProducts(currentSearchQuery); }

function renderFilters() {
    const mainContainer = document.getElementById('main-category-filters'); const mainCats = ['All', 'Pipe Cleaner Crafts', 'Canvas Paintings', 'Clay Art Paintings'];
    if(mainContainer) { mainContainer.innerHTML = ''; mainCats.forEach(cat => { const btn = document.createElement('button'); btn.className = `text-[9px] sm:text-[10px] font-bold uppercase tracking-widest whitespace-nowrap px-4 py-2.5 border-b-[2px] transition-colors ${currentMainCategory === cat ? 'text-luxury-rose border-luxury-rose' : 'text-gray-400 border-transparent hover:text-luxury-dark'}`; btn.textContent = cat; btn.onclick = () => filterMainCategory(cat); mainContainer.appendChild(btn); }); }
    let subs = []; if(currentMainCategory === 'All') { subs = [...new Set(products.map(p => p.category).filter(c => c))]; } else { subs = [...new Set(products.filter(p => p.mainCategory === currentMainCategory).map(p => p.category).filter(c => c))]; }
    activeSubCategories = activeSubCategories.filter(cat => subs.includes(cat));
    const subContainerMob = document.getElementById('sub-category-filters-mob');
    if(subContainerMob) { let htmlMob = `<option value="All">All Sub-Categories</option>`; subs.forEach(cat => { const isSelected = activeSubCategories.length === 1 && activeSubCategories[0] === cat; htmlMob += `<option value="${cat}" ${isSelected ? 'selected' : ''}>${cat}</option>`; }); subContainerMob.innerHTML = htmlMob; }
    const subContainerDesk = document.getElementById('desktop-checkbox-filters');
    if(subContainerDesk) {
        let htmlDesk = ''; subs.forEach(cat => { const isChecked = activeSubCategories.includes(cat); htmlDesk += `<label class="flex items-center gap-3 cursor-pointer group w-full p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-luxury-blush"><div class="relative flex items-center justify-center w-[14px] h-[14px] rounded border border-luxury-rose/50 bg-white group-hover:border-luxury-rose transition-colors shrink-0 overflow-hidden shadow-sm"><input type="checkbox" value="${cat}" class="peer sr-only" onchange="window.th_toggleSubCategory('${cat}')" ${isChecked ? 'checked' : ''}><div class="absolute inset-0 bg-luxury-rose scale-0 peer-checked:scale-100 transition-transform duration-300 origin-center"></div><i class="fas fa-check text-[7px] text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 absolute z-10"></i></div><span class="text-[10px] font-bold text-luxury-dark tracking-[0.1em] transition-colors truncate uppercase ${isChecked ? 'text-luxury-rose' : ''}">${cat}</span></label>`; });
        subContainerDesk.innerHTML = htmlDesk || `<p class="text-[9px] text-gray-400 italic px-2 pt-2">No sub-categories</p>`;
    }
}

function getDiscountPercent(idStr) { let hash = 0; for (let i = 0; i < idStr.length; i++) { hash = idStr.charCodeAt(i) + ((hash << 5) - hash); } return (Math.abs(hash) % 31) + 10; }
function calculateCartDiscount(subtotal) { let discount = 0; let currentTier = null; let nextTier = null; for (let i = 0; i < DISCOUNT_TIERS.length; i++) { if (subtotal >= DISCOUNT_TIERS[i].threshold) { currentTier = DISCOUNT_TIERS[i]; nextTier = i > 0 ? DISCOUNT_TIERS[i - 1] : null; break; } } if (!currentTier && subtotal > 0) { nextTier = DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1]; } if (currentTier) { if (currentTier.type === 'percent') { discount = Math.round(subtotal * (currentTier.value / 100)); } else { discount = currentTier.value; } } let amountNeeded = nextTier ? nextTier.threshold - subtotal : 0; return { discount, currentTier, nextTier, amountNeeded }; }
function calculateTotalPrepTime(items) { let absoluteMinDays = 999; items.forEach(item => { const pt = item.prepTime || '3'; const matches = pt.match(/\d+/g); if(matches && matches.length >= 1) { let minForProduct = parseInt(matches[0]); if (minForProduct < absoluteMinDays) absoluteMinDays = minForProduct; } else { if (3 < absoluteMinDays) absoluteMinDays = 3; } }); if (absoluteMinDays === 999) absoluteMinDays = 3; const totalQuantity = items.reduce((sum, item) => sum + parseInt(item.qty || 1), 0); return `${absoluteMinDays * totalQuantity} Days`; }

function updateCartCount() { requestAnimationFrame(() => { const count = cart.reduce((sum, item) => sum + parseInt(item.qty || 1), 0); document.querySelectorAll('#cart-count, #product-page-cart-count').forEach(el => { if(el) el.textContent = count; }); }); }

function updateCartQty(id, delta, event) {
    if(event) { event.preventDefault(); event.stopPropagation(); } 
    let existing = cart.find(x => x.id === id);
    if(existing) { 
        existing.qty = parseInt(existing.qty || 1); existing.qty += delta; 
        if(existing.qty <= 0) { 
            cart = cart.filter(x => x.id !== id); showToast("Removed from Bag", "fa-times"); 
        } else { if(delta > 0) showToast("Quantity Increased", "fa-plus"); } 
    } else if(delta > 0) { 
        const p = products.find(x => x.id === id); 
        if(p) { cart.push({ id: p.id, name: p.name, price: p.price, prepTime: p.prepTime, image: p.image1, isCustomizable: p.isCustomizable, mainCategory: p.mainCategory, qty: 1 }); showToast("Added to Bag", "fa-check"); } 
    }
    localStorage.setItem('th_cart', JSON.stringify(cart)); updateCartCount();
    
    // Auto-update modal if open
    const prodView = document.getElementById('product-view'); if(prodView && !prodView.classList.contains('hidden')) { updateProductButtons(id); }
}

function openLightboxFromCarousel() { currentLightboxIndex = currentSlideIndex; const lb = document.getElementById('lightbox-modal'); const track = document.getElementById('lightbox-track'); if(!lb || !track) return; track.innerHTML = ''; modalImages.forEach((src) => { track.innerHTML += `<div class="w-full h-full flex-shrink-0 flex items-center justify-center p-2 md:p-8"><img loading="lazy" decoding="async" src="${src}" class="max-w-full max-h-full object-contain"></div>`; }); track.style.transition = 'none'; track.style.transform = `translateX(-${currentLightboxIndex * 100}%)`; updateLightboxCounter(); currentModalLevel = 2; safePushState(2); lb.classList.remove('hidden'); requestAnimationFrame(() => { lb.classList.remove('opacity-0'); }); setupLightboxTouch(); }
function forceCloseLightbox() { const lb = document.getElementById('lightbox-modal'); if(!lb) return; requestAnimationFrame(() => { lb.classList.add('opacity-0'); setTimeout(() => { lb.classList.add('hidden'); }, 200); }); }
function moveLightboxSlide(direction) { if (isLightboxAnimating) return; isLightboxAnimating = true; currentLightboxIndex += direction; if (currentLightboxIndex < 0) currentLightboxIndex = modalImages.length - 1; if (currentLightboxIndex >= modalImages.length) currentLightboxIndex = 0; const track = document.getElementById('lightbox-track'); if(!track) return; requestAnimationFrame(() => { track.style.transition = 'transform 0.4s ease-out'; track.style.transform = `translateX(-${currentLightboxIndex * 100}%)`; }); updateLightboxCounter(); setTimeout(() => { isLightboxAnimating = false; }, 400); }
function updateLightboxCounter() { const counter = document.getElementById('lightbox-counter'); if(counter) counter.textContent = `${currentLightboxIndex + 1} / ${modalImages.length}`; }

function moveSlide(direction) { if (isAnimating) return; isAnimating = true; currentSlideIndex += direction; if (currentSlideIndex < 0) currentSlideIndex = modalImages.length - 1; if (currentSlideIndex >= modalImages.length) currentSlideIndex = 0; const track = document.getElementById('modal-carousel-track'); if(!track) return; requestAnimationFrame(() => { track.style.transition = 'transform 0.4s ease-out'; track.style.transform = `translateX(-${currentSlideIndex * 100}%)`; }); updateActiveThumb(currentSlideIndex, modalImages.length); setTimeout(() => { isAnimating = false; }, 400); }
function goToSlide(index) { if (isAnimating || index === currentSlideIndex) return; isAnimating = true; currentSlideIndex = index; const track = document.getElementById('modal-carousel-track'); if(!track) return; requestAnimationFrame(() => { track.style.transition = 'transform 0.4s ease-out'; track.style.transform = `translateX(-${currentSlideIndex * 100}%)`; }); updateActiveThumb(currentSlideIndex, modalImages.length); setTimeout(() => { isAnimating = false; }, 400); }
function setupTouchCarousel() { let startX = 0; let endX = 0; const track = document.getElementById('modal-carousel-track'); if(track) { track.replaceWith(track.cloneNode(true)); const newTrack = document.getElementById('modal-carousel-track'); newTrack.addEventListener('touchstart', (e) => { startX = e.changedTouches[0].screenX; }, {passive: true}); newTrack.addEventListener('touchend', (e) => { endX = e.changedTouches[0].screenX; requestAnimationFrame(() => { if (endX < startX - 30) moveSlide(1); else if (endX > startX + 30) moveSlide(-1); }); }, {passive: true}); } }
function setupLightboxTouch() { let lbStartX = 0; let lbEndX = 0; const track = document.getElementById('lightbox-track'); if(track) { track.replaceWith(track.cloneNode(true)); const newTrack = document.getElementById('lightbox-track'); newTrack.addEventListener('touchstart', (e) => { lbStartX = e.changedTouches[0].screenX; }, {passive: true}); newTrack.addEventListener('touchend', (e) => { lbEndX = e.changedTouches[0].screenX; requestAnimationFrame(() => { if (lbEndX < lbStartX - 30) moveLightboxSlide(1); else if (lbEndX > lbStartX + 30) moveLightboxSlide(-1); }); }, {passive: true}); } }
function updateActiveThumb(activeIndex, totalImages) { requestAnimationFrame(() => { for(let i = 0; i < totalImages; i++) { const thumb = document.getElementById(`thumb-${i}`); if(thumb) { if(i === activeIndex) { thumb.classList.add('border-luxury-rose', 'scale-105', 'opacity-100'); thumb.classList.remove('border-transparent', 'opacity-60'); } else { thumb.classList.remove('border-luxury-rose', 'scale-105', 'opacity-100'); thumb.classList.add('border-transparent', 'opacity-60'); } } } }); }

// 🚨 UNIFIED MASTER CHECKOUT ENGINE 🚨
function routeCheckoutFromModal(id, event) { 
    if(event) { event.preventDefault(); event.stopPropagation(); } 
    const p = products.find(x => x.id == id); 
    if(!p) return;
    
    let existing = cart.find(x => x.id === id);
    if(!existing) {
        cart.push({ id: p.id, name: p.name, price: p.price, prepTime: p.prepTime, image: p.image1, isCustomizable: p.isCustomizable, mainCategory: p.mainCategory, qty: 1 });
        localStorage.setItem('th_cart', JSON.stringify(cart));
        updateCartCount();
    }
    openCheckoutBase(); 
}

function openCheckoutBase() {
    if(cart.length === 0) return showToast("Your bag is empty!", "fa-times", "text-red-500");
    currentModalLevel = 1; safePushState(1);
    checkoutStep = 1;
    const overlay = document.getElementById('checkout-overlay');
    if(!overlay) return;

    overlay.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    
    document.getElementById('payment-success-view')?.classList.add('hidden'); document.getElementById('payment-success-view')?.classList.remove('flex');
    document.getElementById('payment-gateway-view')?.classList.remove('hidden'); document.getElementById('payment-gateway-view')?.classList.add('flex');
    
    renderCheckoutItems();
    renderAddressBook();
    updateCheckoutUI();
    
    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
        overlay.scrollTo(0, 0);
    });
}

function closeCheckout() {
    const overlay = document.getElementById('checkout-overlay');
    if(!overlay) return;
    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
        setTimeout(() => {
            overlay.classList.add('hidden');
            if(document.getElementById('return-policy-modal') && document.getElementById('return-policy-modal').classList.contains('hidden') && document.getElementById('privacy-policy-modal') && document.getElementById('privacy-policy-modal').classList.contains('hidden')){
                document.body.classList.remove('overflow-hidden');
            }
            pendingOrderPayload = null;
            renderProducts(currentSearchQuery);
        }, 300);
    });
}

function updateCheckoutQty(id, delta) {
    let existing = cart.find(x => x.id === id);
    if(existing) { 
        existing.qty = parseInt(existing.qty || 1) + delta; 
        if(existing.qty <= 0) { 
            cart = cart.filter(x => x.id !== id); 
        } 
    }
    localStorage.setItem('th_cart', JSON.stringify(cart));
    updateCartCount();
    
    if (cart.length === 0) {
        closeCheckout();
        return showToast("Bag is empty!", "fa-times");
    }
    
    renderCheckoutItems();
    updateCheckoutUI();
}

function renderCheckoutItems() {
    const container = document.getElementById('checkout-items-list');
    if(!container) return;
    let itemsHTML = '';

    cart.forEach(item => {
        const cleanPrice = Number(item.price.toString().replace(/[^0-9.,]/g, ''));
        const discountPercent = getDiscountPercent(item.id.toString());
        const originalPrice = Math.round(cleanPrice * (1 + (discountPercent / 100)));
        const itemImg = (item.image1 || item.image) ? (item.image1 || item.image) : 'https://placehold.co/150/F8E9EA/423133';
        const qty = parseInt(item.qty || 1);

        itemsHTML += `
        <div class="flex flex-col sm:flex-row gap-4 border border-luxury-blush bg-white p-4 rounded-2xl shadow-sm">
            <img src="${itemImg}" class="w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-xl border border-luxury-blush shrink-0 bg-luxury-bg">
            <div class="flex flex-col justify-between w-full">
                <div>
                    <h4 class="font-bitter text-[14px] sm:text-[15px] font-semibold text-luxury-dark mb-1 leading-snug">${item.name}</h4>
                    <p class="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-3">${item.mainCategory || item.category || 'Handcrafted Art'}</p>
                    <div class="flex items-baseline gap-2 mb-4">
                        <span class="font-poppins text-luxury-dark font-bold text-[16px] sm:text-[18px]">₹${cleanPrice}</span>
                        <span class="font-poppins text-gray-400 text-[11px] line-through">₹${originalPrice}</span>
                        <span class="text-green-600 font-bold text-[10px] ml-1">${discountPercent}% Off</span>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="flex items-center bg-white border border-luxury-blush rounded-full h-[36px] overflow-hidden shadow-sm">
                        <button type="button" onclick="window.updateCheckoutQty('${item.id}', -1)" class="w-10 h-full flex items-center justify-center text-luxury-dark hover:bg-luxury-blush transition-colors"><i class="fas fa-minus text-[10px]"></i></button>
                        <div class="w-10 h-full flex items-center justify-center border-l border-r border-luxury-blush text-[12px] font-bold text-luxury-rose bg-luxury-bg">${qty}</div>
                        <button type="button" onclick="window.updateCheckoutQty('${item.id}', 1)" class="w-10 h-full flex items-center justify-center text-luxury-dark hover:bg-luxury-blush transition-colors"><i class="fas fa-plus text-[10px]"></i></button>
                    </div>
                </div>
            </div>
        </div>`;
    });
    
    let hasCustomizable = cart.some(item => item.isCustomizable);
    const dimWrapper = document.getElementById('comm-dimensions-wrapper');
    if (hasCustomizable) dimWrapper?.classList.remove('hidden'); else dimWrapper?.classList.add('hidden');
    
    container.innerHTML = itemsHTML;
}

// ADDRESS BOOK LOGIC
function renderAddressBook() {
    const container = document.getElementById('address-book-container');
    const form = document.getElementById('checkout-profile-form');
    const btnAdd = document.getElementById('btn-show-add-address');
    const btnCancel = document.getElementById('btn-cancel-address');

    if (!container || !form) return;

    if (savedAddresses.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        form.classList.remove('hidden');
        btnAdd.classList.add('hidden');
        btnCancel.classList.add('hidden');
        clearAddressForm();
        editingAddressIndex = null;
    } else {
        container.classList.remove('hidden');
        let html = '';
        savedAddresses.forEach((addr, i) => {
            const isSelected = i === selectedAddressIndex;
            html += `
            <div class="border ${isSelected ? 'border-[#D9778A] bg-[#FFF0F2]' : 'border-luxury-blush bg-white'} rounded-xl p-4 flex gap-4 cursor-pointer transition-colors relative shadow-sm" onclick="window.selectAddress(${i})">
                <div class="pt-1 shrink-0">
                    <div class="w-4 h-4 rounded-full border-2 ${isSelected ? 'border-[#D9778A] flex items-center justify-center bg-white' : 'border-gray-300 bg-white'}">
                        ${isSelected ? '<div class="w-2 h-2 rounded-full bg-[#D9778A]"></div>' : ''}
                    </div>
                </div>
                <div class="flex-grow pr-8">
                    <p class="font-bold text-luxury-dark text-[12px] uppercase tracking-wider mb-1">${addr.first_name} ${addr.last_name}</p>
                    <p class="text-gray-500 text-[11px] leading-relaxed mb-2">${addr.address_1}${addr.address_2 ? ', ' + addr.address_2 : ''}<br>${addr.city}, ${addr.state} - <span class="font-bold text-luxury-dark">${addr.pincode}</span></p>
                    <p class="text-luxury-dark font-medium text-[11px]"><i class="fas fa-phone-alt text-luxury-rose/70 mr-1.5 text-[9px]"></i> ${addr.phone}</p>
                </div>
                <button type="button" onclick="window.editAddress(${i}, event)" class="absolute top-4 right-4 text-[9px] text-gray-400 hover:text-luxury-rose uppercase font-bold tracking-widest bg-white w-8 h-8 rounded-full border border-luxury-blush flex items-center justify-center transition-colors"><i class="fas fa-pen"></i></button>
            </div>`;
        });
        container.innerHTML = html;
        form.classList.add('hidden');
        btnAdd.classList.remove('hidden');
    }
    updateCheckoutUI(); 
}

function selectAddress(index) {
    selectedAddressIndex = index;
    document.getElementById('checkout-profile-form').classList.add('hidden');
    document.getElementById('btn-show-add-address').classList.remove('hidden');
    renderAddressBook();
}

function showAddressForm() {
    editingAddressIndex = null;
    clearAddressForm();
    document.getElementById('checkout-profile-form').classList.remove('hidden');
    document.getElementById('btn-show-add-address').classList.add('hidden');
    if(savedAddresses.length > 0) {
        document.getElementById('btn-cancel-address').classList.remove('hidden');
    }
    updateCheckoutUI();
}

function hideAddressForm() {
    document.getElementById('checkout-profile-form').classList.add('hidden');
    document.getElementById('btn-show-add-address').classList.remove('hidden');
    editingAddressIndex = null;
    updateCheckoutUI();
}

function editAddress(index, event) {
    event.stopPropagation(); 
    editingAddressIndex = index;
    const addr = savedAddresses[index];
    document.getElementById('prof-fname').value = addr.first_name || ''; 
    document.getElementById('prof-lname').value = addr.last_name || ''; 
    document.getElementById('prof-email').value = addr.email || ''; 
    document.getElementById('prof-phone').value = addr.phone || ''; 
    document.getElementById('prof-add1').value = addr.address_1 || ''; 
    document.getElementById('prof-add2').value = addr.address_2 || ''; 
    document.getElementById('prof-city').value = addr.city || ''; 
    document.getElementById('prof-state').value = addr.state || ''; 
    document.getElementById('prof-pin').value = addr.pincode || '';

    document.getElementById('checkout-profile-form').classList.remove('hidden');
    document.getElementById('btn-show-add-address').classList.add('hidden');
    document.getElementById('btn-cancel-address').classList.remove('hidden');
    updateCheckoutUI();
}

function saveAddressFromForm() {
    const addr = {
        first_name: document.getElementById('prof-fname').value.trim(),
        last_name: document.getElementById('prof-lname').value.trim(),
        email: document.getElementById('prof-email').value.trim(),
        phone: document.getElementById('prof-phone').value.trim(),
        address_1: document.getElementById('prof-add1').value.trim(),
        address_2: document.getElementById('prof-add2').value.trim(),
        city: document.getElementById('prof-city').value.trim(),
        state: document.getElementById('prof-state').value.trim(),
        pincode: document.getElementById('prof-pin').value.trim()
    };

    if(!addr.first_name || !addr.phone || !addr.address_1 || !addr.city || !addr.pincode) { 
        showToast("Please fill all required delivery fields", "fa-exclamation-circle", "text-red-500");
        return false; 
    }

    if (editingAddressIndex !== null) {
        savedAddresses[editingAddressIndex] = addr;
        selectedAddressIndex = editingAddressIndex;
    } else {
        savedAddresses.push(addr);
        selectedAddressIndex = savedAddresses.length - 1;
    }

    localStorage.setItem('th_saved_addresses', JSON.stringify(savedAddresses));
    editingAddressIndex = null;
    renderAddressBook();
    showToast("Address Saved", "fa-check");
    return true;
}

function clearAddressForm() {
    document.getElementById('prof-fname').value = ''; 
    document.getElementById('prof-lname').value = ''; 
    document.getElementById('prof-email').value = ''; 
    document.getElementById('prof-phone').value = ''; 
    document.getElementById('prof-add1').value = ''; 
    document.getElementById('prof-add2').value = ''; 
    document.getElementById('prof-city').value = ''; 
    document.getElementById('prof-state').value = ''; 
    document.getElementById('prof-pin').value = '';
}

function calculateDynamicDelivery(subtotal, pincode, items) {
    if (subtotal >= 2499 || subtotal === 0) return 0; 
    
    let totalChargeableWeightKg = 0;
    
    items.forEach(item => {
        let itemDeadWeight = 0.2; 
        let itemVolumetricWeight = 0.2;
        const cat = item.mainCategory || item.category || '';
        const qty = parseInt(item.qty || 1);

        if (cat.includes('Canvas')) {
            itemDeadWeight = 1.5; 
            itemVolumetricWeight = (45 * 35 * 5) / 5000; 
        } else if (cat.includes('Clay')) {
            itemDeadWeight = 0.8;
            itemVolumetricWeight = (25 * 25 * 10) / 5000;
        } else {
            itemDeadWeight = 0.15;
            itemVolumetricWeight = (15 * 10 * 5) / 5000;
        }

        const chargeablePerItem = Math.max(itemDeadWeight, itemVolumetricWeight);
        totalChargeableWeightKg += (chargeablePerItem * qty);
    });

    const weightSlabs = Math.ceil(totalChargeableWeightKg / 0.5);

    let zone = 'D'; 
    if (pincode && pincode.toString().length >= 2) {
        const pinPrefix = parseInt(pincode.toString().substring(0, 2));
        const pinPrefixThree = parseInt(pincode.toString().substring(0, 3));
        
        if (pinPrefixThree === 387 || pinPrefixThree === 388) {
            zone = 'A';
        } else if ((pinPrefix >= 36 && pinPrefix <= 42) || pinPrefix === 39) {
            zone = 'B';
        } else if (pinPrefix === 19 || (pinPrefix >= 78 && pinPrefix <= 79)) {
            zone = 'E';
        }
    }

    let baseRate = 0;
    let additionalSlabRate = 0;

    switch(zone) {
        case 'A': baseRate = 35; additionalSlabRate = 35; break;
        case 'B': baseRate = 45; additionalSlabRate = 40; break;
        case 'E': baseRate = 85; additionalSlabRate = 80; break;
        default:  baseRate = 55; additionalSlabRate = 50; break;
    }

    let finalShippingFee = baseRate;
    if (weightSlabs > 1) {
        finalShippingFee += ((weightSlabs - 1) * additionalSlabRate);
    }
    
    return finalShippingFee;
}

function goToCheckoutStep(step) {
    if (step === 1) {
        checkoutStep = 1;
        updateCheckoutUI();
    } else if (step === 2) {
        if (cart.length === 0) return showToast("Your bag is empty!", "fa-times", "text-red-500");
        checkoutStep = 2;
        updateCheckoutUI();
    }
}

function updateCheckoutUI() {
    const btn = document.getElementById('checkout-action-btn');
    const fill = document.getElementById('progress-bar-fill');
    const ind1 = document.getElementById('step-indicator-1');
    const lbl1 = document.getElementById('step-label-1');
    const ind2 = document.getElementById('step-indicator-2');
    const lbl2 = document.getElementById('step-label-2');
    const ind3 = document.getElementById('step-indicator-3');
    const lbl3 = document.getElementById('step-label-3');
    const sidebar = document.getElementById('checkout-price-sidebar');

    if(!btn || !fill) return;

    let trueSubtotal = 0; let sellingSubtotal = 0; let totalItems = 0; 
    
    if (cart.length > 0) {
        cart.forEach((item) => { 
            const cleanPrice = Number(item.price.toString().replace(/[^0-9.,]/g, '')); const qty = parseInt(item.qty || 1); const discountPercent = getDiscountPercent(item.id.toString()); 
            trueSubtotal += (Math.round(cleanPrice * (1 + (discountPercent / 100))) * qty); sellingSubtotal += (cleanPrice * qty); 
            totalItems += qty;
        });
    }

    // Dynamic Delivery Check
    let currentPin = '';
    const form = document.getElementById('checkout-profile-form');
    if (form && !form.classList.contains('hidden')) {
        currentPin = document.getElementById('prof-pin').value.trim();
    } else if (savedAddresses.length > 0 && selectedAddressIndex !== -1) {
        currentPin = savedAddresses[selectedAddressIndex].pincode;
    }

    const deliveryFeeEl = document.getElementById('qo-delivery-fee');
    
    if (sellingSubtotal >= 2499) {
        currentDeliveryFee = 0;
        if(deliveryFeeEl) deliveryFeeEl.innerHTML = '<span class="text-green-600 font-bold uppercase tracking-widest text-[10px]">Free</span>';
    } else if (currentPin.length >= 2) {
        currentDeliveryFee = calculateDynamicDelivery(sellingSubtotal, currentPin, cart);
        if(deliveryFeeEl) deliveryFeeEl.innerHTML = `₹${currentDeliveryFee}`;
    } else {
        currentDeliveryFee = 0; 
        if(deliveryFeeEl) deliveryFeeEl.innerHTML = '<span class="text-gray-400 text-[10px] font-medium">Calculated next step</span>';
    }
    
    const { discount: vipDiscount, currentTier } = calculateCartDiscount(sellingSubtotal); 
    const finalTotal = sellingSubtotal - vipDiscount + currentDeliveryFee; 
    const productDiscountTotal = trueSubtotal - sellingSubtotal;
    const totalSavings = productDiscountTotal + vipDiscount;

    if(document.getElementById('qo-item-count')) document.getElementById('qo-item-count').textContent = totalItems;
    if(document.getElementById('qo-original-value')) document.getElementById('qo-original-value').textContent = `₹${trueSubtotal}`;
    if(document.getElementById('qo-product-discount')) document.getElementById('qo-product-discount').textContent = `- ₹${productDiscountTotal}`;
    
    const vipRow = document.getElementById('qo-vip-row');
    if(vipRow) {
        if(vipDiscount > 0) {
            if(document.getElementById('qo-vip-label')) document.getElementById('qo-vip-label').textContent = currentTier.label;
            if(document.getElementById('qo-vip-discount')) document.getElementById('qo-vip-discount').textContent = `- ₹${vipDiscount}`;
            vipRow.classList.remove('hidden');
        } else { vipRow.classList.add('hidden'); }
    }

    if(document.getElementById('qo-total-savings')) document.getElementById('qo-total-savings').textContent = totalSavings;
    if(document.getElementById('qo-final-total')) document.getElementById('qo-final-total').textContent = `₹${finalTotal}`;

    if(sidebar) {
        if (checkoutStep === 1 || checkoutStep === 2) {
            sidebar.className = "block lg:col-span-4 w-full mt-2 lg:mt-0"; 
        } else {
            sidebar.className = "hidden lg:block lg:col-span-4 w-full mt-2 lg:mt-0"; 
        }
    }

    if (checkoutStep === 1) {
        document.getElementById('checkout-step-1')?.classList.remove('hidden');
        document.getElementById('checkout-step-2')?.classList.add('hidden'); document.getElementById('checkout-step-2')?.classList.remove('flex');
        document.getElementById('checkout-step-3')?.classList.add('hidden'); document.getElementById('checkout-step-3')?.classList.remove('flex');

        fill.style.width = '0%';
        if(ind1) ind1.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-[#D9778A] text-white shadow-md border-2 border-white group-hover:scale-105";
        if(lbl1) lbl1.className = "text-[9px] font-bold uppercase tracking-widest text-luxury-dark";
        
        if(ind2) ind2.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-white text-gray-400 border-2 border-luxury-blush group-hover:scale-105";
        if(lbl2) lbl2.className = "text-[9px] font-bold uppercase tracking-widest text-gray-400";
        
        if(ind3) ind3.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-white text-gray-400 border-2 border-luxury-blush";
        if(lbl3) lbl3.className = "text-[9px] font-bold uppercase tracking-widest text-gray-400";
        
        btn.innerHTML = 'Continue to Delivery <i class="fas fa-arrow-right"></i>';
        btn.classList.remove('hidden');
        if(cart.length === 0) { btn.disabled = true; btn.classList.add('opacity-50', 'cursor-not-allowed'); } else { btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed'); }
        
    } else if (checkoutStep === 2) {
        document.getElementById('checkout-step-1')?.classList.add('hidden');
        document.getElementById('checkout-step-2')?.classList.remove('hidden'); document.getElementById('checkout-step-2')?.classList.add('flex');
        document.getElementById('checkout-step-3')?.classList.add('hidden'); document.getElementById('checkout-step-3')?.classList.remove('flex');

        fill.style.width = '50%';
        if(ind1) ind1.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-[#D9778A] text-white shadow-md border-2 border-white group-hover:scale-105";
        if(lbl1) lbl1.className = "text-[9px] font-bold uppercase tracking-widest text-luxury-dark";
        
        if(ind2) ind2.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-[#D9778A] text-white shadow-md border-2 border-white group-hover:scale-105";
        if(lbl2) lbl2.className = "text-[9px] font-bold uppercase tracking-widest text-luxury-dark";
        
        if(ind3) ind3.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-white text-gray-400 border-2 border-luxury-blush";
        if(lbl3) lbl3.className = "text-[9px] font-bold uppercase tracking-widest text-gray-400";
        
        btn.innerHTML = 'Proceed to Secure Payment <i class="fas fa-lock text-[10px]"></i>';
        btn.classList.remove('hidden');
        btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed');
        
    } else if (checkoutStep === 3) {
        document.getElementById('checkout-step-1')?.classList.add('hidden');
        document.getElementById('checkout-step-2')?.classList.add('hidden'); document.getElementById('checkout-step-2')?.classList.remove('flex');
        document.getElementById('checkout-step-3')?.classList.remove('hidden'); document.getElementById('checkout-step-3')?.classList.add('flex');

        fill.style.width = '100%';
        if(ind3) ind3.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-[#D9778A] text-white shadow-md border-2 border-white";
        if(lbl3) lbl3.className = "text-[9px] font-bold uppercase tracking-widest text-luxury-dark";
        btn.classList.add('hidden'); 
    }
}

function handleCheckoutAction() {
    if (checkoutStep === 1) {
        if (cart.length === 0) return showToast("Your bag is empty!", "fa-times", "text-red-500");
        checkoutStep = 2;
        updateCheckoutUI();
        renderAddressBook();
        document.getElementById('checkout-overlay')?.scrollTo({top: 0, behavior: 'smooth'});
        
    } else if (checkoutStep === 2) {
        const form = document.getElementById('checkout-profile-form');
        if (form && !form.classList.contains('hidden')) {
            const success = saveAddressFromForm();
            if (!success) return; 
        }

        if (savedAddresses.length === 0 || selectedAddressIndex === -1) {
            showToast("Please provide a delivery address.", "fa-exclamation-circle", "text-red-500");
            return;
        }
        
        preparePaymentGateway();
    }
}

function preparePaymentGateway() {
    const type = document.getElementById('comm-type') ? document.getElementById('comm-type').value : 'Standard Order'; 
    const colors = document.getElementById('comm-colors') ? document.getElementById('comm-colors').value.trim() : 'No notes'; 
    const dims = document.getElementById('comm-dimensions') ? document.getElementById('comm-dimensions').value.trim() : '';
    
    showInteractionLoader("Securing Payment Gateway...");

    let sellingSubtotal = 0; let totalPrepTime = ""; let itemsToSave = [];

    cart.forEach((item) => { 
        const cleanPrice = Number(item.price.toString().replace(/[^0-9.,]/g, '')); const qty = parseInt(item.qty || 1); 
        sellingSubtotal += (cleanPrice * qty); 
        itemsToSave.push({ id: item.id, name: item.name, price: cleanPrice, qty: qty, image: item.image });
    });
    totalPrepTime = calculateTotalPrepTime(cart);
    
    const targetAddress = savedAddresses[selectedAddressIndex];
    currentDeliveryFee = calculateDynamicDelivery(sellingSubtotal, targetAddress.pincode, cart);
    
    const { discount: vipDiscount } = calculateCartDiscount(sellingSubtotal); 
    const finalTotal = sellingSubtotal - vipDiscount + currentDeliveryFee; 
    const safeCountryCode = (settings.countryCode || '+91'); 
    const fullContactPhone = safeCountryCode + " " + targetAddress.phone;

    let fullAddress = `${targetAddress.address_1}, ${targetAddress.address_2 ? targetAddress.address_2 + ', ' : ''}${targetAddress.city}, ${targetAddress.state} - ${targetAddress.pincode}`;
    let artDetails = `Phone: ${fullContactPhone} | Patron: ${targetAddress.first_name} ${targetAddress.last_name} | Email: ${targetAddress.email} | Address: ${fullAddress} | Purpose: ${type} | Notes: ${colors} | Delivery Fee: ₹${currentDeliveryFee}`;
    if(dims && document.getElementById('comm-dimensions-wrapper') && !document.getElementById('comm-dimensions-wrapper').classList.contains('hidden')) { artDetails += ` | Size: ${dims}`; } 
    artDetails += ` | Est. Prep: ${totalPrepTime}`; 

    pendingOrderPayload = { 
        order_details: JSON.stringify(itemsToSave), 
        subtotal: sellingSubtotal, 
        discount: vipDiscount, 
        total: finalTotal, 
        customer_reqs: artDetails, 
        status: 'pending' 
    };
    
    const formattedTotal = Number(finalTotal).toFixed(2); 
    const cleanIMUser = (settings.instamojoUser || "twistedhappiness").trim().replace('@', '');
    const cleanNameForNote = targetAddress.first_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10); 
    currentOrderReference = `TH_${cleanNameForNote}_${String(Date.now()).slice(-4)}`; 
    
    const paymentLink = `https://instamojo.com/@${cleanIMUser}?amount=${formattedTotal}&purpose=${currentOrderReference}`;
    
    setTimeout(() => {
        checkoutStep = 3;
        
        if(document.getElementById('checkout-payment-amount')) document.getElementById('checkout-payment-amount').textContent = `₹${formattedTotal}`;
        
        const verifyBtn = document.getElementById('btn-confirm-payment');
        if(verifyBtn) {
            verifyBtn.innerHTML = 'I Have Completed Payment <i class="fas fa-check-circle"></i>';
            verifyBtn.disabled = false;
        }

        if(document.getElementById('payment-instamojo-btn')) {
            document.getElementById('payment-instamojo-btn').href = paymentLink;
        }
        
        updateCheckoutUI();
        document.getElementById('checkout-overlay')?.scrollTo({top: 0, behavior: 'smooth'});
        
        hideInteractionLoader();
        
    }, 1500); 
}

async function confirmPaymentAndOrder() {
    if(!pendingOrderPayload) return;
    
    const btn = document.getElementById('btn-confirm-payment');
    if(btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Securing Order...';
        btn.disabled = true;
    }

    const { error } = await _supabase.from('orders').insert([pendingOrderPayload]);
    
    if (error) {
        console.error("Order insertion error:", error);
        showToast("Network error. Please try again.", "fa-times", "text-red-500");
        if(btn) {
            btn.innerHTML = 'I Have Completed Payment <i class="fas fa-check-circle"></i>';
            btn.disabled = false;
        }
        return;
    }

    document.getElementById('payment-gateway-view')?.classList.add('hidden');
    document.getElementById('payment-gateway-view')?.classList.remove('flex');
    
    if(document.getElementById('success-ref-note')) document.getElementById('success-ref-note').textContent = currentOrderReference;
    document.getElementById('payment-success-view')?.classList.remove('hidden');
    document.getElementById('payment-success-view')?.classList.add('flex');

    cart = []; 
    localStorage.setItem('th_cart', JSON.stringify(cart)); 
    updateCartCount(); 
}

// 🚨 GLOBALLY BIND ALL FUNCTIONS TO PREVENT BUTTON FAILURES
window.openCheckoutBase = openCheckoutBase;
window.closeCheckout = closeCheckout;
window.handleCheckoutAction = handleCheckoutAction;
window.openLightboxFromCarousel = openLightboxFromCarousel;
window.moveLightboxSlide = moveLightboxSlide;
window.goToSlide = goToSlide;
window.th_toggleSubCategory = toggleSubCategoryCheckbox;
window.th_routeCheckoutFromModal = routeCheckoutFromModal;
window.th_updateCartQty = updateCartQty;
window.updateCheckoutQty = updateCheckoutQty;
window.goToCheckoutStep = goToCheckoutStep;
window.confirmPaymentAndOrder = confirmPaymentAndOrder;
window.showAddressForm = showAddressForm;
window.hideAddressForm = hideAddressForm;
window.saveAddressFromForm = saveAddressFromForm;
window.selectAddress = selectAddress;
window.editAddress = editAddress;

function showToast(msg, icon = 'fa-check', color = 'text-luxury-rose') { const t = document.getElementById('toast'); document.getElementById('toast-msg').textContent = msg; document.getElementById('toast-icon').className = `fas ${icon} ${color} text-sm drop-shadow-sm`; requestAnimationFrame(() => { t.classList.remove('opacity-0', 'translate-y-10'); setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000); }); }
function setupScrollReveal() { const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if(entry.isIntersecting) { requestAnimationFrame(() => { entry.target.classList.remove('opacity-0', 'translate-y-4'); observer.unobserve(entry.target); }); } }); }, { threshold: 0.05, rootMargin: '50px' }); document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el)); }