/**
 * Twisted Happiness - Enterprise Storefront Engine
 * Pinterest Waterfall Layout, SEO-optimized, Touch-enabled, On-Site UPI Checkout.
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

const countryCodeMapping = { "+91": "🇮🇳 IN (+91)", "+1": "🇺🇸 US (+1)", "+44": "🇬🇧 UK (+44)" }; // Truncated for brevity here

let settings = safeJSONParse('th_settings', { whatsapp: "9909310501", upiId: "khushisj315@oksbi", countryCode: "+91" });
let shiprocketProfile = safeJSONParse('th_shiprocket_profile', { first_name: '', last_name: '', email: '', phone: '', address_1: '', address_2: '', city: '', state: '', pincode: '' });
let cart = safeJSONParse('th_cart', []); 
let products = [];
let currentMainCategory = 'All'; let activeSubCategories = []; let currentSortMode = 'newest'; let currentSearchQuery = ''; 
let searchTimeout = null;
let modalImages = []; let currentSlideIndex = 0; let isAnimating = false; 
let currentLightboxIndex = 0; let isLightboxAnimating = false;
let currentModalLevel = 0; let statePushed = false;
let currentCommissionContext = 'cart'; let singleProductToCommission = null;

// Checkout state
let pendingOrderPayload = null; 
let currentOrderReference = null;

document.addEventListener('DOMContentLoaded', () => {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    bindDOMEvents();
    injectSkeletons(); // Trigger aesthetic girly skeletons
    fetchDatabase();
    updateCartCount();
    setupWhatsAppLink();

    // Re-render masonry grid safely on window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if(products.length > 0) renderProducts(currentSearchQuery);
        }, 250);
    });
});

function bindDOMEvents() {
    document.getElementById('btn-profile-header')?.addEventListener('click', openProfileFromHeader);
    document.getElementById('btn-toggle-cart')?.addEventListener('click', toggleCart);
    document.getElementById('btn-toggle-cart-product')?.addEventListener('click', toggleCart);
    document.getElementById('searchInputDesk')?.addEventListener('input', (e) => syncSearch(e.target.value));
    document.getElementById('searchInputMob')?.addEventListener('input', (e) => syncSearch(e.target.value));
    document.getElementById('sortInputMob')?.addEventListener('change', (e) => setSortMode(e.target.value));
    document.getElementById('sortInputDesk')?.addEventListener('change', (e) => setSortMode(e.target.value));
    document.getElementById('sub-category-filters-mob')?.addEventListener('change', (e) => filterSubCategory(e.target.value));
    
    document.getElementById('btn-close-product')?.addEventListener('click', () => { closeProductPage(); safeBack(); });
    document.getElementById('breadcrumb-back')?.addEventListener('click', () => { closeProductPage(); safeBack(); });
    document.getElementById('btn-close-lightbox')?.addEventListener('click', () => { forceCloseLightbox(); safeBack(); });
    document.getElementById('btn-close-cart')?.addEventListener('click', () => { forceCloseCart(); safeBack(); });
    document.getElementById('cart-overlay')?.addEventListener('click', () => { forceCloseCart(); safeBack(); });
    document.getElementById('btn-close-profile')?.addEventListener('click', () => { forceCloseProfileModal(); safeBack(); });
    document.getElementById('btn-close-commission')?.addEventListener('click', () => { forceCloseCommissionForm(); safeBack(); });
    document.getElementById('btn-close-offers')?.addEventListener('click', () => { forceCloseOffersModal(); safeBack(); });
    document.getElementById('btn-close-payment')?.addEventListener('click', () => { forceClosePaymentModal(); safeBack(); });
    
    document.getElementById('profile-form')?.addEventListener('submit', saveProfileAndContinue);
    document.getElementById('commission-form')?.addEventListener('submit', submitCommission);
    document.getElementById('btn-cart-checkout')?.addEventListener('click', routeCheckoutFromCart);
    document.getElementById('btn-show-offers')?.addEventListener('click', showOffersModal);
    document.getElementById('btn-edit-profile')?.addEventListener('click', editProfile);
    
    document.getElementById('btn-confirm-payment')?.addEventListener('click', confirmPaymentAndOrder);
    document.getElementById('btn-return-gallery')?.addEventListener('click', () => { forceClosePaymentModal(); safeBack(); });

    document.getElementById('btn-slide-prev')?.addEventListener('click', (e) => { e.stopPropagation(); moveSlide(-1); });
    document.getElementById('btn-slide-next')?.addEventListener('click', (e) => { e.stopPropagation(); moveSlide(1); });
    document.getElementById('btn-lightbox-prev')?.addEventListener('click', () => moveLightboxSlide(-1));
    document.getElementById('btn-lightbox-next')?.addEventListener('click', () => moveLightboxSlide(1));

    window.addEventListener('popstate', function(e) {
        const level = e.state ? e.state.level : 0;
        requestAnimationFrame(() => {
            if (level === 0) { closeProductPage(); forceCloseCart(); forceCloseCommissionForm(); forceCloseProfileModal(); forceCloseLightbox(); forceCloseOffersModal(); forceClosePaymentModal(); } 
            else if (level === 1) { forceCloseLightbox(); forceCloseCommissionForm(); forceCloseOffersModal(); forceCloseProfileModal(); forceClosePaymentModal(); }
            currentModalLevel = level;
        });
    });

    setupTouchCarousel(); setupLightboxTouch();
}

function safeJSONParse(key, fallback) { try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : fallback; } catch (e) { localStorage.removeItem(key); return fallback; } }
function safePushState(level) { try { history.pushState({ level: level }, ""); statePushed = true; } catch(e) { statePushed = false; } }
function safeBack() { if (statePushed) { try { history.back(); } catch(e) {} statePushed = false; } }
function isMobileDevice() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); }

function setupWhatsAppLink() {
    const adminPhone = (settings.countryCode || '+91').replace(/\+/g, '') + settings.whatsapp;
    const waLink = document.getElementById('floating-whatsapp');
    if(waLink) waLink.href = `https://wa.me/${adminPhone}?text=Hello!%20I%20am%20exploring%20your%20beautiful%20collection.`;
}

// 🚨 Pinterest Style JS Masonry Skeletons
function getColumnCount() {
    const w = window.innerWidth;
    if(w >= 1280) return 6;
    if(w >= 1024) return 5;
    if(w >= 768) return 4;
    if(w >= 640) return 3;
    return 2;
}

function injectSkeletons() {
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const cols = getColumnCount();
    const randomHeights = ['h-[220px]', 'h-[320px]', 'h-[280px]', 'h-[250px]', 'h-[350px]'];
    
    for(let i=0; i<cols; i++) {
        const col = document.createElement('div');
        col.className = 'flex flex-col gap-4 sm:gap-5 w-full';
        
        for(let j=0; j<4; j++) {
            const delay = ((i*4)+j) * 0.05;
            const rh = randomHeights[Math.floor(Math.random() * randomHeights.length)];
            col.innerHTML += `
                <div class="w-full opacity-0 transform translate-y-4" style="animation: fadeInUp 0.4s ease-out forwards; animation-delay: ${delay}s;">
                    <div class="w-full bg-luxury-blush/40 rounded-3xl ${rh} skeleton-layer mb-3 border border-luxury-rose/20 shadow-[0_8px_30px_rgb(223,168,176,0.15)]"></div>
                    <div class="px-2">
                        <div class="h-3 rounded-full bg-luxury-blush/70 w-3/4 mb-2.5 skeleton-layer"></div>
                        <div class="h-3 rounded-full bg-luxury-blush/70 w-1/2 skeleton-layer"></div>
                    </div>
                </div>`;
        }
        grid.appendChild(col);
    }
}

async function fetchDatabase() { 
    const startTime = Date.now();
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
        
        // Force minimum 800ms delay so user sees the premium skeletons
        const elapsed = Date.now() - startTime;
        if (elapsed < 800) {
            await new Promise(r => setTimeout(r, 800 - elapsed));
        }

        requestAnimationFrame(() => { renderFilters(); renderProducts(); });
    } catch (error) { console.error("Database initialization failed:", error); } 
}

// 🚨 Pinterest JS Masonry Distribution
function renderProducts(searchQuery = '') { 
    const grid = document.getElementById('product-grid'); if(!grid) return; grid.innerHTML = ''; 
    let filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if(currentMainCategory !== 'All') { filtered = filtered.filter(p => p.mainCategory === currentMainCategory); }
    if(activeSubCategories.length > 0) { filtered = filtered.filter(p => activeSubCategories.includes(p.category)); }
    if(currentSortMode === 'low') filtered.sort((a,b) => parseFloat(a.price) - parseFloat(b.price)); 
    if(currentSortMode === 'high') filtered.sort((a,b) => parseFloat(b.price) - parseFloat(a.price)); 
    if(currentSortMode === 'newest') filtered.reverse(); 

    if(filtered.length === 0) { 
        grid.innerHTML = '<div class="col-span-full text-center py-20 text-gray-400 font-medium text-sm w-full inline-block">No creations found.</div>'; 
        return; 
    } 

    const cols = getColumnCount();
    const colWrappers = [];
    for(let i=0; i<cols; i++) {
        const col = document.createElement('div');
        col.className = 'flex flex-col gap-4 sm:gap-5 w-full';
        colWrappers.push(col);
        grid.appendChild(col);
    }

    // Distribute round-robin for perfect visual chronology without CSS Column breaks
    filtered.forEach((p, index) => {
        colWrappers[index % cols].appendChild(generateProductCardHTML(p));
    });
    
    requestAnimationFrame(() => setupScrollReveal());
}

function generateProductCardHTML(p) {
    const cleanPrice = Number(p.price.toString().replace(/[^0-9.,]/g, '')); const discountPercent = getDiscountPercent(p.id.toString()); const originalPrice = Math.round(cleanPrice * (1 + (discountPercent / 100)));
    const mainImg = (p.image1 && typeof p.image1 === 'string' && p.image1.trim() !== '') ? p.image1 : 'https://placehold.co/400x500/F8E9EA/423133';
    
    const card = document.createElement('div'); 
    card.className = `w-full relative cursor-pointer opacity-0 transform translate-y-4 transition-all duration-500 ease-out group scroll-reveal`; 
    card.addEventListener('click', () => openProductPage(p.id));
    card.innerHTML = `
        <div class="w-full relative rounded-[28px] overflow-hidden group shadow-[0_8px_25px_rgba(223,168,176,0.25)] hover:shadow-[0_12px_35px_rgba(223,168,176,0.4)] bg-gradient-to-tr from-luxury-blush/20 to-white border border-luxury-rose/30 transition-all duration-500">
            <span class="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-md text-luxury-rose text-[14px] font-cursive font-bold px-3 py-1 rounded-full border border-luxury-rose/20 shadow-sm transform group-hover:scale-105 transition-transform duration-300">${p.category}</span>
            <img loading="lazy" decoding="async" src="${mainImg}" alt="${p.name}" onerror="this.src='https://placehold.co/400x500/F8E9EA/423133';" class="block w-full h-auto object-cover opacity-0 transition-all duration-700 pointer-events-none group-hover:scale-105 min-h-[150px]" onload="this.classList.remove('opacity-0')">
            
            <div class="absolute bottom-3 right-3 z-10 translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <button class="bg-white/95 text-luxury-rose hover:text-white hover:bg-luxury-rose w-10 h-10 rounded-full shadow-lg border border-luxury-rose/30 flex items-center justify-center transition-colors">
                    <i class="fas fa-shopping-bag text-sm"></i>
                </button>
            </div>
        </div>
        <div class="pt-3 pb-1 px-2 flex flex-col justify-start text-left w-full">
            <h3 class="font-sans font-semibold text-[13px] text-luxury-dark leading-snug w-full transition-colors group-hover:text-luxury-rose mb-1 line-clamp-2">${p.name}</h3>
            <div class="flex items-center gap-2 flex-wrap w-full">
                <span class="font-poppins font-bold text-luxury-dark text-[15px] sm:text-[17px] tracking-tight leading-none">₹${cleanPrice}</span>
                <span class="font-poppins text-luxury-rose/60 text-[10px] font-medium line-through leading-none">₹${originalPrice}</span>
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
    modalImages.forEach(imgSrc => { html += `<div class="w-full h-full flex-shrink-0 flex items-center justify-center relative bg-transparent" onclick="openLightboxFromCarousel()"><img loading="lazy" decoding="async" src="${imgSrc}" class="w-full h-full object-cover"></div>`; }); 
    track.innerHTML = html; currentSlideIndex = 0; track.style.transform = `translateX(0)`;
    
    thumbContainer.innerHTML = ''; 
    if (modalImages.length > 1) { 
        modalImages.forEach((imgSrc, index) => { 
            const thumb = document.createElement('img'); thumb.src = imgSrc; 
            thumb.className = `w-12 h-12 object-cover rounded-md border-2 transition-all cursor-pointer ${index === 0 ? 'border-luxury-rose scale-105 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`; 
            thumb.id = `thumb-${index}`; thumb.onclick = () => { goToSlide(index); }; thumbContainer.appendChild(thumb); 
        }); 
    } 
    
    document.getElementById('modal-title').textContent = p.name; document.getElementById('modal-main-category').textContent = p.mainCategory; 
    document.getElementById('modal-sub-category').textContent = p.category || 'Fine Art Medium'; 
    document.getElementById('breadcrumb-main-cat').textContent = p.mainCategory;
    document.getElementById('breadcrumb-sub-cat').textContent = p.name.substring(0, 20) + (p.name.length > 20 ? '...' : '');
    document.getElementById('modal-price').textContent = cleanPrice; document.getElementById('modal-original-price').textContent = "₹" + originalPrice; 
    document.getElementById('modal-discount-tag').textContent = `${discountPercent}% OFF`; document.getElementById('modal-specs').innerHTML = p.specs || 'No details provided.'; 
    document.getElementById('modal-prep-time').textContent = `${p.prepTime || '3-5'} Days`;
    
    const badgesContainer = document.getElementById('art-badges-container'); const dimBadge = document.getElementById('modal-dimensions-badge'); const custBadge = document.getElementById('modal-custom-badge');
    badgesContainer.classList.add('hidden'); dimBadge.classList.add('hidden'); custBadge.classList.add('hidden');
    if(p.mainCategory === 'Canvas Paintings' || p.mainCategory === 'Clay Art Paintings') {
        badgesContainer.classList.remove('hidden');
        if(p.dimensions) { document.getElementById('modal-dimensions-text').textContent = p.dimensions; dimBadge.classList.remove('hidden'); }
        if(p.isCustomizable) custBadge.classList.remove('hidden');
    }

    const careGuide = document.getElementById('modal-care-guide');
    if (p.mainCategory === 'Canvas Paintings') { careGuide.innerHTML = `<li>Keep away from prolonged direct sunlight.</li><li>Avoid areas with extreme humidity.</li><li>Dust gently with a clean, dry microfiber cloth.</li>`; } 
    else if (p.mainCategory === 'Clay Art Paintings') { careGuide.innerHTML = `<li><strong>Highly fragile.</strong> Handle edges with care.</li><li>Keep strictly away from moisture.</li><li>Dust very lightly using a soft brush.</li>`; } 
    else { careGuide.innerHTML = `<li>Keep away from direct, harsh sunlight.</li><li>Lightly dust with a soft, dry brush.</li><li>Do not expose to moisture.</li>`; }

    renderRelatedProducts(p.id, p.mainCategory); updateProductButtons(p.id);
    document.getElementById('customer-view').classList.add('hidden'); document.getElementById('product-view').classList.remove('hidden');
    window.scrollTo(0, 0); currentModalLevel = 1; safePushState(1); 
}

function closeProductPage() { document.getElementById('product-view').classList.add('hidden'); document.getElementById('customer-view').classList.remove('hidden'); window.scrollTo(0, 0); }

function updateProductButtons(id) {
    const actionContainer = document.getElementById('modal-action-buttons'); if(!actionContainer) return;
    const cartItem = cart.find(item => item.id === id); const qty = cartItem ? parseInt(cartItem.qty || 1) : 0;
    if(qty > 0) {
        actionContainer.innerHTML = `<div class="flex items-center justify-between w-full h-full bg-white border border-luxury-rose rounded-full px-2 sm:px-4 py-3 shadow-sm min-h-[44px]"><button onclick="window.th_updateCartQty('${id}', -1, event)" class="w-8 h-8 rounded-full bg-luxury-bg hover:bg-luxury-blush border border-luxury-blush text-luxury-dark active:scale-90 flex items-center justify-center shrink-0"><i class="fas fa-minus text-xs"></i></button><span class="text-base sm:text-lg font-bold text-luxury-rose font-poppins min-w-[20px] text-center">${qty}</span><button onclick="window.th_updateCartQty('${id}', 1, event)" class="w-8 h-8 rounded-full bg-luxury-bg hover:bg-luxury-blush border border-luxury-blush text-luxury-dark active:scale-90 flex items-center justify-center shrink-0"><i class="fas fa-plus text-xs"></i></button></div><button onclick="window.th_routeCheckoutFromModal('${id}', event)" class="w-full bg-luxury-dark text-white hover:bg-luxury-gold font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider shadow-md active:scale-[0.98] transition-colors min-h-[44px]"><i class="fas fa-bolt text-luxury-gold"></i> Checkout</button>`;
    } else {
        actionContainer.innerHTML = `<button onclick="window.th_updateCartQty('${id}', 1, event)" class="w-full bg-white border border-luxury-dark text-luxury-dark hover:bg-luxury-bg font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider transition-colors shadow-sm active:scale-[0.98] min-h-[44px]"><i class="fas fa-shopping-bag"></i> Add to Bag</button><button onclick="window.th_routeCheckoutFromModal('${id}', event)" class="w-full bg-luxury-dark text-white hover:bg-luxury-gold font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider shadow-md active:scale-[0.98] transition-colors min-h-[44px]"><i class="fas fa-bolt text-luxury-gold"></i> Buy Now</button>`;
    }
}

function renderRelatedProducts(currentId, mainCategory) {
    const grid = document.getElementById('related-products-grid'); if(!grid) return; grid.innerHTML = '';
    let related = products.filter(p => p.id !== currentId); let sameCat = related.filter(p => p.mainCategory === mainCategory); let others = related.filter(p => p.mainCategory !== mainCategory); let finalRelated = [...sameCat, ...others].slice(0, 12); 
    
    const cols = getColumnCount();
    const colWrappers = [];
    for(let i=0; i<cols; i++) {
        const col = document.createElement('div'); col.className = 'flex flex-col gap-4 sm:gap-5 w-full'; colWrappers.push(col); grid.appendChild(col);
    }
    finalRelated.forEach((p, index) => { colWrappers[index % cols].appendChild(generateProductCardHTML(p)); });
    requestAnimationFrame(() => setupScrollReveal());
}

function syncSearch(val) { currentSearchQuery = val; if(document.getElementById('searchInputDesk') && document.getElementById('searchInputDesk').value !== val) document.getElementById('searchInputDesk').value = val; if(document.getElementById('searchInputMob') && document.getElementById('searchInputMob').value !== val) document.getElementById('searchInputMob').value = val; clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { requestAnimationFrame(() => renderProducts(val)); }, 250); }
function setSortMode(val) { currentSortMode = val; if(document.getElementById('sortInputDesk')) document.getElementById('sortInputDesk').value = val; if(document.getElementById('sortInputMob')) document.getElementById('sortInputMob').value = val; renderProducts(currentSearchQuery); }
function filterMainCategory(cat) { currentMainCategory = cat; activeSubCategories = []; renderFilters(); renderProducts(currentSearchQuery); }
function filterSubCategory(cat) { activeSubCategories = cat === 'All' ? [] : [cat]; renderFilters(); renderProducts(currentSearchQuery); }
function toggleSubCategoryCheckbox(cat) { const idx = activeSubCategories.indexOf(cat); if(idx > -1) { activeSubCategories.splice(idx, 1); } else { activeSubCategories.push(cat); } const subContainerMob = document.getElementById('sub-category-filters-mob'); if(subContainerMob) { subContainerMob.value = activeSubCategories.length === 1 ? activeSubCategories[0] : 'All'; } renderFilters(); renderProducts(currentSearchQuery); }
window.th_toggleSubCategory = toggleSubCategoryCheckbox;

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
    if(existing) { existing.qty = parseInt(existing.qty || 1); existing.qty += delta; if(existing.qty <= 0) { cart = cart.filter(x => x.id !== id); showToast("Removed from Bag", "fa-times"); } else { if(delta > 0) showToast("Quantity Increased", "fa-plus"); } } else if(delta > 0) { const p = products.find(x => x.id === id); if(p) { cart.push({ id: p.id, name: p.name, price: p.price, prepTime: p.prepTime, image: p.image1, isCustomizable: p.isCustomizable, mainCategory: p.mainCategory, qty: 1 }); showToast("Added to Bag", "fa-check"); } }
    localStorage.setItem('th_cart', JSON.stringify(cart)); updateCartCount();
    requestAnimationFrame(() => {
        const sidebar = document.getElementById('cart-sidebar'); if(sidebar && !sidebar.classList.contains('translate-x-full')) { renderCart(); }
        const prodView = document.getElementById('product-view'); if(prodView && !prodView.classList.contains('hidden')) { updateProductButtons(id); }
    });
}
window.th_updateCartQty = updateCartQty;

function renderCart() { 
    const container = document.getElementById('cart-items-container'); const banner = document.getElementById('cart-promo-banner'); const totalsContainer = document.getElementById('cart-totals-container');
    if (cart.length === 0) { container.innerHTML = '<div class="text-center text-gray-400 mt-24"><i class="fas fa-shopping-bag text-5xl mb-6 opacity-30"></i><p class="font-logo font-normal text-xl text-luxury-dark/40">Your bag is elegantly empty.</p></div>'; banner.classList.add('hidden'); totalsContainer.classList.add('hidden'); return; } 
    container.innerHTML = ''; let trueSubtotal = 0; let sellingSubtotal = 0;    
    cart.forEach(item => { 
        const cleanPrice = Number(item.price.toString().replace(/[^0-9.,]/g, '')); const qty = parseInt(item.qty || 1); const discountPercent = getDiscountPercent(item.id.toString()); const originalPrice = Math.round(cleanPrice * (1 + (discountPercent / 100))); trueSubtotal += (originalPrice * qty); sellingSubtotal += (cleanPrice * qty); const itemImg = (item.image && typeof item.image === 'string' && item.image.trim() !== '') ? item.image : 'https://placehold.co/150/F8E9EA/423133';
        container.innerHTML += `<div class="flex gap-4 border border-luxury-blush bg-white p-3 rounded-2xl shadow-sm relative group hover:border-luxury-rose transition-colors duration-400"><img loading="lazy" decoding="async" src="${itemImg}" alt="${item.name}" width="150" height="150" class="w-16 h-20 object-cover bg-luxury-bg border border-luxury-blush rounded-xl transition-transform duration-400 group-hover:scale-105"><div class="flex flex-col justify-center flex-grow pr-4"><h4 class="font-bitter text-[12px] font-semibold text-luxury-dark leading-snug mb-1 line-clamp-2 transition-colors duration-400 group-hover:text-luxury-rose">${item.name}</h4><div class="flex items-baseline gap-1.5 mb-2"><span class="font-poppins text-luxury-dark font-bold text-[13px]">₹${cleanPrice}</span><span class="font-poppins text-gray-400 text-[9px] line-through">₹${originalPrice}</span></div><div class="flex items-center gap-2 bg-luxury-bg rounded-full border border-luxury-blush w-fit overflow-hidden h-[36px]"><button onclick="window.th_updateCartQty('${item.id}', -1, event)" class="touch-action-manipulation w-8 h-full flex items-center justify-center hover:bg-luxury-blush text-luxury-dark"><i class="fas fa-minus text-[8px]"></i></button><span class="text-[10px] font-bold text-luxury-rose font-poppins min-w-[16px] text-center">${qty}</span><button onclick="window.th_updateCartQty('${item.id}', 1, event)" class="touch-action-manipulation w-8 h-full flex items-center justify-center hover:bg-luxury-blush text-luxury-dark"><i class="fas fa-plus text-[8px]"></i></button></div></div></div>`; 
    }); 
    const productDiscountTotal = trueSubtotal - sellingSubtotal; const { discount: vipDiscount, currentTier, nextTier, amountNeeded } = calculateCartDiscount(sellingSubtotal); const finalTotal = sellingSubtotal - vipDiscount; const totalSavings = productDiscountTotal + vipDiscount;
    if (nextTier) { banner.innerHTML = `Add <span class="font-bold font-poppins">₹${amountNeeded}</span> more to unlock <span class="font-bold text-white">${nextTier.label}</span>! ✨`; banner.classList.remove('hidden'); } else if (currentTier && sellingSubtotal >= 4999) { banner.innerHTML = `✨ You've unlocked the <span class="font-bold text-white">Maximum VIP Discount</span>! ✨`; banner.classList.remove('hidden'); } else { banner.classList.add('hidden'); }
    document.getElementById('cart-original-subtotal').textContent = `₹${trueSubtotal}`; document.getElementById('cart-product-discount').textContent = `- ₹${productDiscountTotal}`;
    const vipRow = document.getElementById('vip-discount-row'); if(vipDiscount > 0) { document.getElementById('cart-discount-label').textContent = currentTier.label; document.getElementById('cart-discount-amount').textContent = `- ₹${vipDiscount}`; vipRow.classList.remove('hidden'); } else { vipRow.classList.add('hidden'); }
    document.getElementById('cart-total-savings').textContent = totalSavings; document.getElementById('cart-final-total').textContent = `₹${finalTotal}`; totalsContainer.classList.remove('hidden');
}

function toggleCart() { const sidebar = document.getElementById('cart-sidebar'); if (sidebar.classList.contains('translate-x-full')) { currentModalLevel = 1; safePushState(1); forceOpenCart(); } else { safeBack(); forceCloseCart(); } }
function forceOpenCart() { const overlay = document.getElementById('cart-overlay'); const sidebar = document.getElementById('cart-sidebar'); renderCart(); requestAnimationFrame(() => { overlay.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); requestAnimationFrame(() => { overlay.classList.remove('opacity-0'); sidebar.classList.remove('translate-x-full'); }); }); }
function forceCloseCart() { const overlay = document.getElementById('cart-overlay'); const sidebar = document.getElementById('cart-sidebar'); requestAnimationFrame(() => { overlay.classList.add('opacity-0'); sidebar.classList.add('translate-x-full'); setTimeout(() => { overlay.classList.add('hidden'); if(document.getElementById('commission-modal').classList.contains('hidden') && document.getElementById('profile-modal').classList.contains('hidden') && document.getElementById('payment-modal').classList.contains('hidden')){ document.body.classList.remove('overflow-hidden'); } }, 300); }); }

function openLightboxFromCarousel() { currentLightboxIndex = currentSlideIndex; const lb = document.getElementById('lightbox-modal'); const track = document.getElementById('lightbox-track'); track.innerHTML = ''; modalImages.forEach((src) => { track.innerHTML += `<div class="w-full h-full flex-shrink-0 flex items-center justify-center p-2 md:p-8"><img loading="lazy" decoding="async" src="${src}" class="max-w-full max-h-full object-contain"></div>`; }); track.style.transition = 'none'; track.style.transform = `translateX(-${currentLightboxIndex * 100}%)`; updateLightboxCounter(); currentModalLevel = 2; safePushState(2); lb.classList.remove('hidden'); requestAnimationFrame(() => { lb.classList.remove('opacity-0'); }); setupLightboxTouch(); }
function forceCloseLightbox() { const lb = document.getElementById('lightbox-modal'); requestAnimationFrame(() => { lb.classList.add('opacity-0'); setTimeout(() => { lb.classList.add('hidden'); }, 200); }); }
function moveLightboxSlide(direction) { if (isLightboxAnimating) return; isLightboxAnimating = true; currentLightboxIndex += direction; if (currentLightboxIndex < 0) currentLightboxIndex = modalImages.length - 1; if (currentLightboxIndex >= modalImages.length) currentLightboxIndex = 0; const track = document.getElementById('lightbox-track'); requestAnimationFrame(() => { track.style.transition = 'transform 0.4s ease-out'; track.style.transform = `translateX(-${currentLightboxIndex * 100}%)`; }); updateLightboxCounter(); setTimeout(() => { isLightboxAnimating = false; }, 400); }
function updateLightboxCounter() { const counter = document.getElementById('lightbox-counter'); if(counter) counter.textContent = `${currentLightboxIndex + 1} / ${modalImages.length}`; }

function moveSlide(direction) { if (isAnimating) return; isAnimating = true; currentSlideIndex += direction; if (currentSlideIndex < 0) currentSlideIndex = modalImages.length - 1; if (currentSlideIndex >= modalImages.length) currentSlideIndex = 0; const track = document.getElementById('modal-carousel-track'); requestAnimationFrame(() => { track.style.transition = 'transform 0.4s ease-out'; track.style.transform = `translateX(-${currentSlideIndex * 100}%)`; }); updateActiveThumb(currentSlideIndex, modalImages.length); setTimeout(() => { isAnimating = false; }, 400); }
function goToSlide(index) { if (isAnimating || index === currentSlideIndex) return; isAnimating = true; currentSlideIndex = index; const track = document.getElementById('modal-carousel-track'); requestAnimationFrame(() => { track.style.transition = 'transform 0.4s ease-out'; track.style.transform = `translateX(-${currentSlideIndex * 100}%)`; }); updateActiveThumb(currentSlideIndex, modalImages.length); setTimeout(() => { isAnimating = false; }, 400); }
function setupTouchCarousel() { let startX = 0; let endX = 0; const track = document.getElementById('modal-carousel-track'); if(track) { track.replaceWith(track.cloneNode(true)); const newTrack = document.getElementById('modal-carousel-track'); newTrack.addEventListener('touchstart', (e) => { startX = e.changedTouches[0].screenX; }, {passive: true}); newTrack.addEventListener('touchend', (e) => { endX = e.changedTouches[0].screenX; requestAnimationFrame(() => { if (endX < startX - 30) moveSlide(1); else if (endX > startX + 30) moveSlide(-1); }); }, {passive: true}); } }
function setupLightboxTouch() { let lbStartX = 0; let lbEndX = 0; const track = document.getElementById('lightbox-track'); if(track) { track.replaceWith(track.cloneNode(true)); const newTrack = document.getElementById('lightbox-track'); newTrack.addEventListener('touchstart', (e) => { lbStartX = e.changedTouches[0].screenX; }, {passive: true}); newTrack.addEventListener('touchend', (e) => { lbEndX = e.changedTouches[0].screenX; requestAnimationFrame(() => { if (lbEndX < lbStartX - 30) moveLightboxSlide(1); else if (lbEndX > lbStartX + 30) moveLightboxSlide(-1); }); }, {passive: true}); } }
function updateActiveThumb(activeIndex, totalImages) { requestAnimationFrame(() => { for(let i = 0; i < totalImages; i++) { const thumb = document.getElementById(`thumb-${i}`); if(thumb) { if(i === activeIndex) { thumb.classList.add('border-luxury-rose', 'scale-105', 'opacity-100'); thumb.classList.remove('border-transparent', 'opacity-60'); } else { thumb.classList.remove('border-luxury-rose', 'scale-105', 'opacity-100'); thumb.classList.add('border-transparent', 'opacity-60'); } } } }); }

function forceCloseProfileModal() { const modal = document.getElementById('profile-modal'); const box = document.getElementById('profile-box'); requestAnimationFrame(() => { modal.classList.add('opacity-0'); box.classList.remove('modal-open-state'); box.classList.add('modal-closed'); setTimeout(() => { modal.classList.add('hidden'); if(document.getElementById('cart-overlay').classList.contains('hidden') && document.getElementById('commission-modal').classList.contains('hidden') && document.getElementById('payment-modal').classList.contains('hidden')){ document.body.classList.remove('overflow-hidden'); } }, 300); }); }
function forceCloseCommissionForm() { const modal = document.getElementById('commission-modal'); const box = document.getElementById('commission-box'); requestAnimationFrame(() => { modal.classList.add('opacity-0'); box.classList.remove('modal-open-state'); box.classList.add('modal-closed'); setTimeout(() => { modal.classList.add('hidden'); if(document.getElementById('cart-overlay').classList.contains('hidden') && document.getElementById('profile-modal').classList.contains('hidden') && document.getElementById('payment-modal').classList.contains('hidden')){ document.body.classList.remove('overflow-hidden'); } }, 300); }); }
function showOffersModal() { currentModalLevel = 2; safePushState(2); const modal = document.getElementById('offers-modal'); const box = document.getElementById('offers-box'); modal.classList.remove('hidden'); requestAnimationFrame(() => { modal.classList.remove('opacity-0'); box.classList.remove('modal-closed'); box.classList.add('modal-open-state'); }); }
function forceCloseOffersModal() { const modal = document.getElementById('offers-modal'); const box = document.getElementById('offers-box'); requestAnimationFrame(() => { modal.classList.add('opacity-0'); box.classList.remove('modal-open-state'); box.classList.add('modal-closed'); setTimeout(() => { modal.classList.add('hidden'); }, 300); }); }
function forceClosePaymentModal() { const modal = document.getElementById('payment-modal'); const box = document.getElementById('payment-box'); requestAnimationFrame(() => { modal.classList.add('opacity-0'); box.classList.remove('modal-open-state'); box.classList.add('modal-closed'); setTimeout(() => { modal.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); pendingOrderPayload = null; }, 300); }); }

function isProfileComplete() { return shiprocketProfile.first_name && shiprocketProfile.email && shiprocketProfile.phone && shiprocketProfile.address_1 && shiprocketProfile.city && shiprocketProfile.pincode; }
function routeCheckoutFromModal(id, event) { if(event) { event.preventDefault(); event.stopPropagation(); } const p = products.find(x => x.id == id); routeCheckout(p); }
window.th_routeCheckoutFromModal = routeCheckoutFromModal;
function routeCheckoutFromCart(event) { if(event) { event.preventDefault(); event.stopPropagation(); } forceCloseCart(); setTimeout(() => { routeCheckout(null); }, 300); }
function routeCheckout(product = null) { if(product) { currentCommissionContext = 'single'; singleProductToCommission = product; } else { currentCommissionContext = 'cart'; singleProductToCommission = null; if(cart.length === 0) return showToast("Your bag is empty!", "fa-times", "text-red-500"); } currentModalLevel = 2; safePushState(2); if(isProfileComplete()) { showCommissionModal(); } else { showProfileModal(); } }
function openProfileFromHeader() { currentCommissionContext = 'header'; currentModalLevel = 1; safePushState(1); showProfileModal(); }
function editProfile() { forceCloseCommissionForm(); setTimeout(() => { showProfileModal(); }, 300); }

function showProfileModal() { const modal = document.getElementById('profile-modal'); const box = document.getElementById('profile-box'); modal.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); requestAnimationFrame(() => { modal.classList.remove('opacity-0'); box.classList.remove('modal-closed'); box.classList.add('modal-open-state'); }); document.getElementById('prof-fname').value = shiprocketProfile.first_name || ''; document.getElementById('prof-lname').value = shiprocketProfile.last_name || ''; document.getElementById('prof-email').value = shiprocketProfile.email || ''; document.getElementById('prof-phone').value = shiprocketProfile.phone || ''; const activeCode = settings.countryCode || "+91"; document.getElementById('prof-country-code-display').textContent = countryCodeMapping[activeCode] || activeCode; document.getElementById('prof-add1').value = shiprocketProfile.address_1 || ''; document.getElementById('prof-add2').value = shiprocketProfile.address_2 || ''; document.getElementById('prof-city').value = shiprocketProfile.city || ''; document.getElementById('prof-state').value = shiprocketProfile.state || ''; document.getElementById('prof-pin').value = shiprocketProfile.pincode || ''; }
function saveProfileAndContinue() { shiprocketProfile.first_name = document.getElementById('prof-fname').value.trim(); shiprocketProfile.last_name = document.getElementById('prof-lname').value.trim(); shiprocketProfile.email = document.getElementById('prof-email').value.trim(); shiprocketProfile.phone = document.getElementById('prof-phone').value.trim(); shiprocketProfile.address_1 = document.getElementById('prof-add1').value.trim(); shiprocketProfile.address_2 = document.getElementById('prof-add2').value.trim(); shiprocketProfile.city = document.getElementById('prof-city').value.trim(); shiprocketProfile.state = document.getElementById('prof-state').value.trim(); shiprocketProfile.pincode = document.getElementById('prof-pin').value.trim(); if(!shiprocketProfile.first_name || !shiprocketProfile.phone || !shiprocketProfile.address_1 || !shiprocketProfile.city || !shiprocketProfile.pincode) { alert("Please complete all required fields (*)."); return; } localStorage.setItem('th_shiprocket_profile', JSON.stringify(shiprocketProfile)); forceCloseProfileModal(); if (currentCommissionContext === 'header') { showToast("Profile Saved", "fa-check"); } else { setTimeout(() => { showCommissionModal(); }, 300); } }
function showCommissionModal() { const modal = document.getElementById('commission-modal'); const box = document.getElementById('commission-box'); modal.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); requestAnimationFrame(() => { modal.classList.remove('opacity-0'); box.classList.remove('modal-closed'); box.classList.add('modal-open-state'); }); document.getElementById('summary-name').textContent = `${shiprocketProfile.first_name} ${shiprocketProfile.last_name}`.trim(); document.getElementById('comm-type').value = 'Standard Order (No Framing)'; document.getElementById('comm-colors').value = ''; document.getElementById('comm-dimensions').value = ''; let hasCustomizable = false; if (currentCommissionContext === 'single' && singleProductToCommission) { hasCustomizable = singleProductToCommission.isCustomizable; } else { hasCustomizable = cart.some(item => item.isCustomizable); } const dimWrapper = document.getElementById('comm-dimensions-wrapper'); if (hasCustomizable) { dimWrapper.classList.remove('hidden'); } else { dimWrapper.classList.add('hidden'); } }

async function submitCommission() {
    const type = document.getElementById('comm-type').value; const colors = document.getElementById('comm-colors').value.trim() || 'No notes'; const dims = document.getElementById('comm-dimensions').value.trim();
    const btn = document.getElementById('final-checkout-btn'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing Secure Gateway...'; btn.disabled = true;

    let trueSubtotal = 0; let sellingSubtotal = 0; let totalPrepTime = ""; let itemsToSave = [];

    if(currentCommissionContext === 'single' && singleProductToCommission) {
        const cleanPrice = Number(singleProductToCommission.price.toString().replace(/[^0-9.,]/g, '')); const discountPercent = getDiscountPercent(singleProductToCommission.id.toString()); const originalPrice = Math.round(cleanPrice * (1 + (discountPercent / 100)));
        trueSubtotal = originalPrice; sellingSubtotal = cleanPrice; totalPrepTime = calculateTotalPrepTime([{...singleProductToCommission, qty: 1}]); itemsToSave = [{ id: singleProductToCommission.id, name: singleProductToCommission.name, price: cleanPrice, qty: 1, image: singleProductToCommission.image1 }];
    } else {
        cart.forEach((item) => { 
            const cleanPrice = Number(item.price.toString().replace(/[^0-9.,]/g, '')); const qty = parseInt(item.qty || 1); const discountPercent = getDiscountPercent(item.id.toString()); const originalPrice = Math.round(cleanPrice * (1 + (discountPercent / 100)));
            trueSubtotal += (originalPrice * qty); sellingSubtotal += (cleanPrice * qty); itemsToSave.push({ id: item.id, name: item.name, price: cleanPrice, qty: qty, image: item.image });
        });
        totalPrepTime = calculateTotalPrepTime(cart);
    }
    
    const { discount: vipDiscount } = calculateCartDiscount(sellingSubtotal); const finalTotal = sellingSubtotal - vipDiscount; 
    const safeCountryCode = (settings.countryCode || '+91'); const fullContactPhone = safeCountryCode + " " + shiprocketProfile.phone;

    let fullAddress = `${shiprocketProfile.address_1}, ${shiprocketProfile.address_2 ? shiprocketProfile.address_2 + ', ' : ''}${shiprocketProfile.city}, ${shiprocketProfile.state} - ${shiprocketProfile.pincode}`;
    let artDetails = `Phone: ${fullContactPhone} | Patron: ${shiprocketProfile.first_name} ${shiprocketProfile.last_name} | Email: ${shiprocketProfile.email} | Address: ${fullAddress} | Purpose: ${type} | Notes: ${colors}`;
    if(dims && !document.getElementById('comm-dimensions-wrapper').classList.contains('hidden')) { artDetails += ` | Size: ${dims}`; } artDetails += ` | Est. Prep: ${totalPrepTime}`; 

    pendingOrderPayload = { order_details: JSON.stringify(itemsToSave), subtotal: sellingSubtotal, discount: vipDiscount, total: finalTotal, customer_reqs: artDetails, status: 'pending' };
    
    const formattedTotal = Number(finalTotal).toFixed(2); const cleanUpiId = (settings.upiId || "khushisj315@oksbi").trim();
    const cleanNameForNote = shiprocketProfile.first_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10); currentOrderReference = `TH_${cleanNameForNote}_${String(Date.now()).slice(-4)}`; 
    const upiLink = `upi://pay?pa=${cleanUpiId}&pn=Twisted_Happiness&am=${formattedTotal}&cu=INR&tn=${currentOrderReference}`;
    
    btn.innerHTML = 'Place Order & Pay <i class="fas fa-lock text-xs"></i>'; btn.disabled = false; forceCloseCommissionForm();
    
    setTimeout(() => {
        document.getElementById('payment-amount').textContent = `₹${formattedTotal}`;
        document.getElementById('payment-step-1').classList.remove('hidden'); document.getElementById('payment-step-1').classList.add('flex');
        document.getElementById('payment-step-2').classList.add('hidden'); document.getElementById('payment-step-2').classList.remove('flex');
        
        const verifyBtn = document.getElementById('btn-confirm-payment'); verifyBtn.innerHTML = 'I Have Completed Payment <i class="fas fa-check-circle"></i>'; verifyBtn.disabled = false;

        if (isMobileDevice()) {
            document.getElementById('payment-mobile-btn').href = upiLink; document.getElementById('payment-mobile-container').classList.remove('hidden'); document.getElementById('payment-mobile-container').classList.add('flex'); document.getElementById('payment-qr-container').classList.add('hidden'); document.getElementById('payment-qr-container').classList.remove('flex');
        } else {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}&margin=10`; document.getElementById('payment-qr-img').src = qrUrl; document.getElementById('payment-qr-container').classList.remove('hidden'); document.getElementById('payment-qr-container').classList.add('flex'); document.getElementById('payment-mobile-container').classList.add('hidden'); document.getElementById('payment-mobile-container').classList.remove('flex');
        }

        const pModal = document.getElementById('payment-modal'); const pBox = document.getElementById('payment-box'); pModal.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); requestAnimationFrame(() => { pModal.classList.remove('opacity-0'); pBox.classList.remove('modal-closed'); pBox.classList.add('modal-open-state'); });
    }, 300);
}

async function confirmPaymentAndOrder() {
    if(!pendingOrderPayload) return;
    const btn = document.getElementById('btn-confirm-payment'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Securing Order...'; btn.disabled = true;
    const { error } = await _supabase.from('orders').insert([pendingOrderPayload]);
    if (error) { showToast("Network error. Please try again.", "fa-times", "text-red-500"); btn.innerHTML = 'I Have Completed Payment <i class="fas fa-check-circle"></i>'; btn.disabled = false; return; }

    document.getElementById('payment-step-1').classList.add('hidden'); document.getElementById('payment-step-1').classList.remove('flex');
    document.getElementById('success-ref-note').textContent = currentOrderReference;
    document.getElementById('payment-step-2').classList.remove('hidden'); document.getElementById('payment-step-2').classList.add('flex');

    if(currentCommissionContext === 'cart') { cart = []; localStorage.setItem('th_cart', JSON.stringify(cart)); updateCartCount(); }
}

function showToast(msg, icon = 'fa-check', color = 'text-luxury-rose') { const t = document.getElementById('toast'); document.getElementById('toast-msg').textContent = msg; document.getElementById('toast-icon').className = `fas ${icon} ${color} text-sm drop-shadow-sm`; requestAnimationFrame(() => { t.classList.remove('opacity-0', 'translate-y-10'); setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000); }); }
function setupScrollReveal() { const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if(entry.isIntersecting) { requestAnimationFrame(() => { entry.target.classList.remove('opacity-0', 'translate-y-4'); observer.unobserve(entry.target); }); } }); }, { threshold: 0.05, rootMargin: '50px' }); document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el)); }