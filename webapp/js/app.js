/**
 * Twisted Happiness - Premium Storefront Engine
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

const countryCodeMapping = { "+91": "🇮🇳 IN (+91)", "+1": "🇺🇸 US (+1)", "+44": "🇬🇧 UK (+44)" };

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

let pendingOrderPayload = null; 
let currentOrderReference = null;

document.addEventListener('DOMContentLoaded', () => {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    setupHiddenAdminAccess();
    bindDOMEvents();
    injectSkeletons(); 
    fetchDatabase();
    updateCartCount();
    setupWhatsAppLink();

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if(products.length > 0) renderProducts(currentSearchQuery);
        }, 250);
    });
});

function setupHiddenAdminAccess() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
            window.location.href = '/admin.html';
        }
    });
    const path = window.location.pathname + window.location.search + window.location.hash;
    if (path.includes('khushiified')) {
        window.location.href = '/admin.html';
    }
}

function bindDOMEvents() {
    document.getElementById('btn-profile-header')?.addEventListener('click', openProfileFromHeader);
    document.getElementById('btn-toggle-cart')?.addEventListener('click', toggleCart);
    document.getElementById('btn-toggle-cart-product')?.addEventListener('click', toggleCart);
    document.getElementById('searchInputDesk')?.addEventListener('input', (e) => syncSearch(e.target.value));
    document.getElementById('searchInputMob')?.addEventListener('input', (e) => syncSearch(e.target.value));
    
    document.getElementById('btn-close-product')?.addEventListener('click', () => { closeProductPage(); safeBack(); });
    document.getElementById('breadcrumb-back')?.addEventListener('click', () => { closeProductPage(); safeBack(); });
    document.getElementById('btn-close-lightbox')?.addEventListener('click', () => { forceCloseLightbox(); safeBack(); });
    document.getElementById('btn-close-cart')?.addEventListener('click', () => { forceCloseCart(); safeBack(); });
    document.getElementById('cart-overlay')?.addEventListener('click', () => { forceCloseCart(); safeBack(); });
    document.getElementById('btn-close-profile')?.addEventListener('click', () => { forceCloseProfileModal(); safeBack(); });
    document.getElementById('btn-close-commission')?.addEventListener('click', () => { forceCloseCommissionForm(); safeBack(); });
    document.getElementById('btn-close-payment')?.addEventListener('click', () => { forceClosePaymentModal(); safeBack(); });
    
    document.getElementById('profile-form')?.addEventListener('submit', saveProfileAndContinue);
    document.getElementById('commission-form')?.addEventListener('submit', submitCommission);
    document.getElementById('btn-cart-checkout')?.addEventListener('click', routeCheckoutFromCart);
    document.getElementById('btn-edit-profile')?.addEventListener('click', editProfile);
    
    document.getElementById('btn-i-have-paid')?.addEventListener('click', showUtrStep);
    document.getElementById('btn-submit-order')?.addEventListener('click', confirmPaymentAndOrder);
    document.getElementById('btn-return-gallery')?.addEventListener('click', () => { forceClosePaymentModal(); safeBack(); });

    document.getElementById('btn-slide-prev')?.addEventListener('click', (e) => { e.stopPropagation(); moveSlide(-1); });
    document.getElementById('btn-slide-next')?.addEventListener('click', (e) => { e.stopPropagation(); moveSlide(1); });
    document.getElementById('btn-lightbox-prev')?.addEventListener('click', () => moveLightboxSlide(-1));
    document.getElementById('btn-lightbox-next')?.addEventListener('click', () => moveLightboxSlide(1));

    window.addEventListener('popstate', function(e) {
        const level = e.state ? e.state.level : 0;
        requestAnimationFrame(() => {
            if (level === 0) { closeProductPage(); forceCloseCart(); forceCloseCommissionForm(); forceCloseProfileModal(); forceCloseLightbox(); forceClosePaymentModal(); } 
            else if (level === 1) { forceCloseLightbox(); forceCloseCommissionForm(); forceCloseProfileModal(); forceClosePaymentModal(); }
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

function getColumnCount() {
    const w = window.innerWidth;
    if(w >= 1280) return 5;
    if(w >= 1024) return 4;
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
        col.className = 'flex flex-col gap-6 w-full';
        for(let j=0; j<4; j++) {
            const rh = randomHeights[Math.floor(Math.random() * randomHeights.length)];
            col.innerHTML += `
                <div class="w-full">
                    <div class="w-full rounded-[24px] ${rh} skeleton-layer mb-4 shadow-sm"></div>
                    <div class="px-2">
                        <div class="h-4 rounded-full skeleton-layer w-3/4 mb-3"></div>
                        <div class="h-4 rounded-full skeleton-layer w-1/3"></div>
                    </div>
                </div>`;
        }
        grid.appendChild(col);
    }
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
        
        setTimeout(() => {
            const loader = document.getElementById('premium-loader');
            if (loader) loader.classList.add('loader-hidden');
            renderFilters(); 
            renderProducts(); 
        }, 1200);

    } catch (error) { console.error("Database initialization failed:", error); } 
}

function renderProducts(searchQuery = '') { 
    const grid = document.getElementById('product-grid'); if(!grid) return; grid.innerHTML = ''; 
    let filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if(currentMainCategory !== 'All') { filtered = filtered.filter(p => p.mainCategory === currentMainCategory); }
    if(activeSubCategories.length > 0) { filtered = filtered.filter(p => activeSubCategories.includes(p.category)); }
    
    if(filtered.length === 0) { 
        grid.innerHTML = '<div class="col-span-full text-center py-20 text-gray-400 font-medium text-sm w-full inline-block">No creations found.</div>'; 
        return; 
    } 

    const cols = getColumnCount();
    const colWrappers = [];
    for(let i=0; i<cols; i++) {
        const col = document.createElement('div');
        col.className = 'flex flex-col gap-6 sm:gap-8 w-full';
        colWrappers.push(col);
        grid.appendChild(col);
    }

    filtered.forEach((p, index) => {
        colWrappers[index % cols].appendChild(generateProductCardHTML(p));
    });
    
    requestAnimationFrame(() => setupScrollReveal());
}

function generateProductCardHTML(p) {
    const cleanPrice = Number(p.price.toString().replace(/[^0-9.,]/g, ''));
    const mainImg = (p.image1 && typeof p.image1 === 'string' && p.image1.trim() !== '') ? p.image1 : 'https://placehold.co/400x500/F8E9EA/423133';
    
    const card = document.createElement('div'); 
    card.className = `w-full relative cursor-pointer opacity-0 transform translate-y-4 transition-all duration-500 ease-out group scroll-reveal`; 
    card.addEventListener('click', () => openProductPage(p.id));
    
    card.innerHTML = `
        <div class="w-full relative rounded-[24px] overflow-hidden group shadow-sm hover:shadow-xl bg-luxury-bg border border-luxury-blush transition-all duration-500">
            <span class="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm text-luxury-dark text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                <i class="fas fa-heart text-luxury-rose"></i> Handmade
            </span>
            <img loading="lazy" src="${mainImg}" alt="${p.name}" class="block w-full h-auto object-cover opacity-0 transition-all duration-700 group-hover:scale-105" onload="this.classList.remove('opacity-0')">
            
            <div class="absolute bottom-3 right-3 z-10 translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <button onclick="window.th_updateCartQty('${p.id}', 1, event)" class="bg-white text-luxury-dark hover:text-white hover:bg-luxury-rose w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-colors">
                    <i class="fas fa-plus text-sm"></i>
                </button>
            </div>
        </div>
        <div class="pt-4 pb-2 px-2 flex flex-col justify-start text-left w-full">
            <h3 class="font-sans font-semibold text-[14px] text-luxury-dark leading-snug w-full transition-colors group-hover:text-luxury-rose mb-1.5 line-clamp-2">${p.name}</h3>
            <span class="font-poppins font-bold text-luxury-dark text-[16px] tracking-tight">₹${cleanPrice}</span>
        </div>`;
    return card;
}

function openProductPage(id) { 
    const p = products.find(x => x.id == id); 
    const cleanPrice = Number(p.price.toString().replace(/[^0-9.,]/g, '')); 
    
    modalImages = [p.image1, p.image2, p.image3, p.image4, p.image5].filter(img => typeof img === 'string' && img.trim() !== '');
    if (modalImages.length === 0) modalImages.push('https://placehold.co/400x500/F8E9EA/423133');
    
    const track = document.getElementById('modal-carousel-track'); const thumbContainer = document.getElementById('modal-thumbnails'); 
    track.style.transition = 'none'; let html = '';
    modalImages.forEach(imgSrc => { html += `<div class="w-full h-full flex-shrink-0 flex items-center justify-center relative bg-transparent" onclick="openLightboxFromCarousel()"><img loading="lazy" src="${imgSrc}" class="w-full h-full object-cover"></div>`; }); 
    track.innerHTML = html; currentSlideIndex = 0; track.style.transform = `translateX(0)`;
    
    thumbContainer.innerHTML = ''; 
    if (modalImages.length > 1) { 
        modalImages.forEach((imgSrc, index) => { 
            const thumb = document.createElement('img'); thumb.src = imgSrc; 
            thumb.className = `w-14 h-14 object-cover rounded-xl border-2 transition-all cursor-pointer ${index === 0 ? 'border-luxury-rose scale-105 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`; 
            thumb.id = `thumb-${index}`; thumb.onclick = () => { goToSlide(index); }; thumbContainer.appendChild(thumb); 
        }); 
    } 
    
    document.getElementById('modal-title').textContent = p.name; 
    document.getElementById('modal-price').textContent = cleanPrice; 
    document.getElementById('modal-specs').innerHTML = p.specs || 'No details provided.'; 
    
    updateProductButtons(p.id);
    document.getElementById('customer-view').classList.add('hidden'); document.getElementById('product-view').classList.remove('hidden');
    window.scrollTo(0, 0); currentModalLevel = 1; safePushState(1); 
}

function closeProductPage() { document.getElementById('product-view').classList.add('hidden'); document.getElementById('customer-view').classList.remove('hidden'); window.scrollTo(0, 0); }

function updateProductButtons(id) {
    const actionContainer = document.getElementById('modal-action-buttons'); if(!actionContainer) return;
    actionContainer.innerHTML = `
        <button onclick="window.th_updateCartQty('${id}', 1, event)" class="w-full bg-white border border-luxury-dark text-luxury-dark hover:bg-luxury-bg font-bold px-4 py-4 rounded-full flex items-center justify-center gap-2 text-[12px] uppercase tracking-wider transition-colors shadow-sm min-h-[48px]">Add to Cart</button>
        <button onclick="window.th_routeCheckoutFromModal('${id}', event)" class="w-full bg-luxury-dark text-white hover:bg-luxury-gold font-bold px-4 py-4 rounded-full flex items-center justify-center gap-2 text-[12px] uppercase tracking-wider shadow-md transition-colors min-h-[48px]">Buy Now</button>
    `;
}

function syncSearch(val) { currentSearchQuery = val; clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { requestAnimationFrame(() => renderProducts(val)); }, 250); }
function filterMainCategory(cat) { currentMainCategory = cat; activeSubCategories = []; renderFilters(); renderProducts(currentSearchQuery); }

function renderFilters() {
    const mainContainer = document.getElementById('main-category-filters'); const mainCats = ['All', 'Pipe Cleaner Crafts', 'Canvas Paintings', 'Clay Art Paintings'];
    if(mainContainer) { mainContainer.innerHTML = ''; mainCats.forEach(cat => { const btn = document.createElement('button'); btn.className = `text-[10px] font-bold uppercase tracking-widest whitespace-nowrap px-5 py-3 border-b-2 transition-colors ${currentMainCategory === cat ? 'text-luxury-dark border-luxury-dark' : 'text-gray-400 border-transparent hover:text-luxury-dark'}`; btn.textContent = cat; btn.onclick = () => filterMainCategory(cat); mainContainer.appendChild(btn); }); }
}

function updateCartCount() { requestAnimationFrame(() => { const count = cart.reduce((sum, item) => sum + parseInt(item.qty || 1), 0); document.querySelectorAll('#cart-count, #product-page-cart-count').forEach(el => { if(el) el.textContent = count; }); }); }
function updateCartQty(id, delta, event) {
    if(event) { event.preventDefault(); event.stopPropagation(); } 
    let existing = cart.find(x => x.id === id);
    if(existing) { existing.qty = parseInt(existing.qty || 1); existing.qty += delta; if(existing.qty <= 0) { cart = cart.filter(x => x.id !== id); showToast("Removed from Cart", "fa-times"); } } else if(delta > 0) { const p = products.find(x => x.id === id); if(p) { cart.push({ id: p.id, name: p.name, price: p.price, image: p.image1, qty: 1 }); showToast("Added to Cart", "fa-check"); } }
    localStorage.setItem('th_cart', JSON.stringify(cart)); updateCartCount();
    requestAnimationFrame(() => { const sidebar = document.getElementById('cart-sidebar'); if(sidebar && !sidebar.classList.contains('translate-x-full')) { renderCart(); } });
}
window.th_updateCartQty = updateCartQty;

function renderCart() { 
    const container = document.getElementById('cart-items-container'); const totalsContainer = document.getElementById('cart-totals-container');
    if (cart.length === 0) { container.innerHTML = '<div class="text-center text-gray-400 mt-20"><i class="fas fa-shopping-bag text-4xl mb-4 opacity-30"></i><p class="font-sans text-sm">Your cart is empty.</p></div>'; totalsContainer.classList.add('hidden'); document.getElementById('btn-cart-checkout').classList.add('hidden'); return; } 
    container.innerHTML = ''; let sellingSubtotal = 0;    
    cart.forEach(item => { 
        const cleanPrice = Number(item.price.toString().replace(/[^0-9.,]/g, '')); const qty = parseInt(item.qty || 1); sellingSubtotal += (cleanPrice * qty); const itemImg = (item.image && typeof item.image === 'string' && item.image.trim() !== '') ? item.image : 'https://placehold.co/150/F8E9EA/423133';
        container.innerHTML += `<div class="flex gap-4 border border-luxury-blush bg-white p-3 rounded-2xl shadow-sm"><img src="${itemImg}" class="w-20 h-24 object-cover bg-luxury-bg border border-luxury-blush rounded-xl"><div class="flex flex-col justify-center flex-grow pr-2"><h4 class="font-sans text-[13px] font-semibold text-luxury-dark leading-snug mb-1 line-clamp-2">${item.name}</h4><div class="font-poppins text-luxury-dark font-bold text-[14px] mb-3">₹${cleanPrice}</div><div class="flex items-center gap-3 bg-luxury-bg rounded-full border border-luxury-blush w-fit h-[36px]"><button onclick="window.th_updateCartQty('${item.id}', -1, event)" class="w-8 h-full flex items-center justify-center hover:bg-luxury-blush text-luxury-dark"><i class="fas fa-minus text-[10px]"></i></button><span class="text-[12px] font-bold text-luxury-dark min-w-[20px] text-center">${qty}</span><button onclick="window.th_updateCartQty('${item.id}', 1, event)" class="w-8 h-full flex items-center justify-center hover:bg-luxury-blush text-luxury-dark"><i class="fas fa-plus text-[10px]"></i></button></div></div></div>`; 
    }); 
    document.getElementById('cart-final-total').textContent = `₹${sellingSubtotal}`; totalsContainer.classList.remove('hidden'); document.getElementById('btn-cart-checkout').classList.remove('hidden');
}

function toggleCart() { const sidebar = document.getElementById('cart-sidebar'); if (sidebar.classList.contains('translate-x-full')) { currentModalLevel = 1; safePushState(1); forceOpenCart(); } else { safeBack(); forceCloseCart(); } }
function forceOpenCart() { const overlay = document.getElementById('cart-overlay'); const sidebar = document.getElementById('cart-sidebar'); renderCart(); requestAnimationFrame(() => { overlay.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); requestAnimationFrame(() => { overlay.classList.remove('opacity-0'); sidebar.classList.remove('translate-x-full'); }); }); }
function forceCloseCart() { const overlay = document.getElementById('cart-overlay'); const sidebar = document.getElementById('cart-sidebar'); requestAnimationFrame(() => { overlay.classList.add('opacity-0'); sidebar.classList.add('translate-x-full'); setTimeout(() => { overlay.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }, 300); }); }

function openLightboxFromCarousel() { currentLightboxIndex = currentSlideIndex; const lb = document.getElementById('lightbox-modal'); const track = document.getElementById('lightbox-track'); track.innerHTML = ''; modalImages.forEach((src) => { track.innerHTML += `<div class="w-full h-full flex-shrink-0 flex items-center justify-center p-4"><img src="${src}" class="max-w-full max-h-full object-contain"></div>`; }); track.style.transition = 'none'; track.style.transform = `translateX(-${currentLightboxIndex * 100}%)`; currentModalLevel = 2; safePushState(2); lb.classList.remove('hidden'); requestAnimationFrame(() => { lb.classList.remove('opacity-0'); }); setupLightboxTouch(); }
function forceCloseLightbox() { const lb = document.getElementById('lightbox-modal'); requestAnimationFrame(() => { lb.classList.add('opacity-0'); setTimeout(() => { lb.classList.add('hidden'); }, 200); }); }
function moveLightboxSlide(direction) { if (isLightboxAnimating) return; isLightboxAnimating = true; currentLightboxIndex += direction; if (currentLightboxIndex < 0) currentLightboxIndex = modalImages.length - 1; if (currentLightboxIndex >= modalImages.length) currentLightboxIndex = 0; const track = document.getElementById('lightbox-track'); requestAnimationFrame(() => { track.style.transition = 'transform 0.4s ease-out'; track.style.transform = `translateX(-${currentLightboxIndex * 100}%)`; }); setTimeout(() => { isLightboxAnimating = false; }, 400); }

function moveSlide(direction) { if (isAnimating) return; isAnimating = true; currentSlideIndex += direction; if (currentSlideIndex < 0) currentSlideIndex = modalImages.length - 1; if (currentSlideIndex >= modalImages.length) currentSlideIndex = 0; const track = document.getElementById('modal-carousel-track'); requestAnimationFrame(() => { track.style.transition = 'transform 0.4s ease-out'; track.style.transform = `translateX(-${currentSlideIndex * 100}%)`; }); updateActiveThumb(currentSlideIndex, modalImages.length); setTimeout(() => { isAnimating = false; }, 400); }
function goToSlide(index) { if (isAnimating || index === currentSlideIndex) return; isAnimating = true; currentSlideIndex = index; const track = document.getElementById('modal-carousel-track'); requestAnimationFrame(() => { track.style.transition = 'transform 0.4s ease-out'; track.style.transform = `translateX(-${currentSlideIndex * 100}%)`; }); updateActiveThumb(currentSlideIndex, modalImages.length); setTimeout(() => { isAnimating = false; }, 400); }
function setupTouchCarousel() { let startX = 0; let endX = 0; const track = document.getElementById('modal-carousel-track'); if(track) { track.replaceWith(track.cloneNode(true)); const newTrack = document.getElementById('modal-carousel-track'); newTrack.addEventListener('touchstart', (e) => { startX = e.changedTouches[0].screenX; }, {passive: true}); newTrack.addEventListener('touchend', (e) => { endX = e.changedTouches[0].screenX; requestAnimationFrame(() => { if (endX < startX - 30) moveSlide(1); else if (endX > startX + 30) moveSlide(-1); }); }, {passive: true}); } }
function setupLightboxTouch() { let lbStartX = 0; let lbEndX = 0; const track = document.getElementById('lightbox-track'); if(track) { track.replaceWith(track.cloneNode(true)); const newTrack = document.getElementById('lightbox-track'); newTrack.addEventListener('touchstart', (e) => { lbStartX = e.changedTouches[0].screenX; }, {passive: true}); newTrack.addEventListener('touchend', (e) => { lbEndX = e.changedTouches[0].screenX; requestAnimationFrame(() => { if (lbEndX < lbStartX - 30) moveLightboxSlide(1); else if (lbEndX > lbStartX + 30) moveLightboxSlide(-1); }); }, {passive: true}); } }
function updateActiveThumb(activeIndex, totalImages) { requestAnimationFrame(() => { for(let i = 0; i < totalImages; i++) { const thumb = document.getElementById(`thumb-${i}`); if(thumb) { if(i === activeIndex) { thumb.classList.add('border-luxury-rose', 'scale-105', 'opacity-100'); thumb.classList.remove('border-transparent', 'opacity-60'); } else { thumb.classList.remove('border-luxury-rose', 'scale-105', 'opacity-100'); thumb.classList.add('border-transparent', 'opacity-60'); } } } }); }

function forceCloseProfileModal() { const modal = document.getElementById('profile-modal'); const box = document.getElementById('profile-box'); requestAnimationFrame(() => { modal.classList.add('opacity-0'); box.classList.remove('modal-open-state'); box.classList.add('modal-closed'); setTimeout(() => { modal.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }, 300); }); }
function forceCloseCommissionForm() { const modal = document.getElementById('commission-modal'); const box = document.getElementById('commission-box'); requestAnimationFrame(() => { modal.classList.add('opacity-0'); box.classList.remove('modal-open-state'); box.classList.add('modal-closed'); setTimeout(() => { modal.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }, 300); }); }
function forceClosePaymentModal() { const modal = document.getElementById('payment-modal'); const box = document.getElementById('payment-box'); requestAnimationFrame(() => { modal.classList.add('opacity-0'); box.classList.remove('modal-open-state'); box.classList.add('modal-closed'); setTimeout(() => { modal.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); pendingOrderPayload = null; }, 300); }); }

function isProfileComplete() { return shiprocketProfile.first_name && shiprocketProfile.email && shiprocketProfile.phone && shiprocketProfile.address_1 && shiprocketProfile.city && shiprocketProfile.pincode; }
function routeCheckoutFromModal(id, event) { if(event) { event.preventDefault(); event.stopPropagation(); } const p = products.find(x => x.id == id); routeCheckout(p); }
window.th_routeCheckoutFromModal = routeCheckoutFromModal;
function routeCheckoutFromCart(event) { if(event) { event.preventDefault(); event.stopPropagation(); } forceCloseCart(); setTimeout(() => { routeCheckout(null); }, 300); }
function routeCheckout(product = null) { if(product) { currentCommissionContext = 'single'; singleProductToCommission = product; } else { currentCommissionContext = 'cart'; singleProductToCommission = null; if(cart.length === 0) return showToast("Your cart is empty!", "fa-times", "text-red-500"); } currentModalLevel = 2; safePushState(2); if(isProfileComplete()) { showCommissionModal(); } else { showProfileModal(); } }
function openProfileFromHeader() { currentCommissionContext = 'header'; currentModalLevel = 1; safePushState(1); showProfileModal(); }
function editProfile() { forceCloseCommissionForm(); setTimeout(() => { showProfileModal(); }, 300); }

function showProfileModal() { const modal = document.getElementById('profile-modal'); const box = document.getElementById('profile-box'); modal.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); requestAnimationFrame(() => { modal.classList.remove('opacity-0'); box.classList.remove('modal-closed'); box.classList.add('modal-open-state'); }); document.getElementById('prof-fname').value = shiprocketProfile.first_name || ''; document.getElementById('prof-email').value = shiprocketProfile.email || ''; document.getElementById('prof-phone').value = shiprocketProfile.phone || ''; document.getElementById('prof-add1').value = shiprocketProfile.address_1 || ''; document.getElementById('prof-city').value = shiprocketProfile.city || ''; document.getElementById('prof-state').value = shiprocketProfile.state || ''; document.getElementById('prof-pin').value = shiprocketProfile.pincode || ''; }
function saveProfileAndContinue() { shiprocketProfile.first_name = document.getElementById('prof-fname').value.trim(); shiprocketProfile.email = document.getElementById('prof-email').value.trim(); shiprocketProfile.phone = document.getElementById('prof-phone').value.trim(); shiprocketProfile.address_1 = document.getElementById('prof-add1').value.trim(); shiprocketProfile.city = document.getElementById('prof-city').value.trim(); shiprocketProfile.state = document.getElementById('prof-state').value.trim(); shiprocketProfile.pincode = document.getElementById('prof-pin').value.trim(); if(!shiprocketProfile.first_name || !shiprocketProfile.phone || !shiprocketProfile.address_1 || !shiprocketProfile.city || !shiprocketProfile.pincode) { alert("Please complete all required fields (*)."); return; } localStorage.setItem('th_shiprocket_profile', JSON.stringify(shiprocketProfile)); forceCloseProfileModal(); if (currentCommissionContext === 'header') { showToast("Profile Saved", "fa-check"); } else { setTimeout(() => { showCommissionModal(); }, 300); } }

function showCommissionModal() { const modal = document.getElementById('commission-modal'); const box = document.getElementById('commission-box'); modal.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); requestAnimationFrame(() => { modal.classList.remove('opacity-0'); box.classList.remove('modal-closed'); box.classList.add('modal-open-state'); }); document.getElementById('summary-name').textContent = shiprocketProfile.first_name; }

function submitCommission() {
    const btn = document.getElementById('final-checkout-btn'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading UPI...'; btn.disabled = true;

    let sellingSubtotal = 0; let itemsToSave = [];
    if(currentCommissionContext === 'single' && singleProductToCommission) {
        const cleanPrice = Number(singleProductToCommission.price.toString().replace(/[^0-9.,]/g, '')); sellingSubtotal = cleanPrice; itemsToSave = [{ id: singleProductToCommission.id, name: singleProductToCommission.name, price: cleanPrice, qty: 1, image: singleProductToCommission.image1 }];
    } else {
        cart.forEach((item) => { 
            const cleanPrice = Number(item.price.toString().replace(/[^0-9.,]/g, '')); const qty = parseInt(item.qty || 1); sellingSubtotal += (cleanPrice * qty); itemsToSave.push({ id: item.id, name: item.name, price: cleanPrice, qty: qty, image: item.image });
        });
    }
    
    let fullAddress = `${shiprocketProfile.address_1}, ${shiprocketProfile.city}, ${shiprocketProfile.state} - ${shiprocketProfile.pincode}`;
    let artDetails = `Phone: ${shiprocketProfile.phone} | Patron: ${shiprocketProfile.first_name} | Email: ${shiprocketProfile.email} | Address: ${fullAddress}`;

    pendingOrderPayload = { order_details: JSON.stringify(itemsToSave), subtotal: sellingSubtotal, total: sellingSubtotal, customer_reqs: artDetails, status: 'payment_pending' }; // STATUS SET TO PAYMENT PENDING
    
    const formattedTotal = Number(sellingSubtotal).toFixed(2); const cleanUpiId = (settings.upiId || "khushisj315@oksbi").trim();
    currentOrderReference = `TH_${shiprocketProfile.first_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5)}_${String(Date.now()).slice(-4)}`; 
    const upiLink = `upi://pay?pa=${cleanUpiId}&pn=Twisted_Happiness&am=${formattedTotal}&cu=INR&tn=${currentOrderReference}`;
    
    btn.innerHTML = 'Place Order & Pay'; btn.disabled = false; forceCloseCommissionForm();
    
    setTimeout(() => {
        document.getElementById('payment-amount').textContent = `₹${formattedTotal}`;
        document.getElementById('payment-step-1').classList.remove('hidden'); document.getElementById('payment-step-1').classList.add('flex');
        document.getElementById('payment-step-utr').classList.add('hidden'); document.getElementById('payment-step-utr').classList.remove('flex');
        document.getElementById('payment-step-2').classList.add('hidden'); document.getElementById('payment-step-2').classList.remove('flex');

        if (isMobileDevice()) {
            document.getElementById('payment-mobile-btn').href = upiLink; document.getElementById('payment-mobile-container').classList.remove('hidden'); document.getElementById('payment-qr-container').classList.add('hidden');
        } else {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}&margin=10`; document.getElementById('payment-qr-img').src = qrUrl; document.getElementById('payment-qr-container').classList.remove('hidden'); document.getElementById('payment-mobile-container').classList.add('hidden');
        }

        const pModal = document.getElementById('payment-modal'); const pBox = document.getElementById('payment-box'); pModal.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); requestAnimationFrame(() => { pModal.classList.remove('opacity-0'); pBox.classList.remove('modal-closed'); pBox.classList.add('modal-open-state'); });
    }, 300);
}

function showUtrStep() {
    document.getElementById('payment-step-1').classList.add('hidden'); document.getElementById('payment-step-1').classList.remove('flex');
    document.getElementById('payment-step-utr').classList.remove('hidden'); document.getElementById('payment-step-utr').classList.add('flex');
}

async function confirmPaymentAndOrder() {
    if(!pendingOrderPayload) return;
    const utrVal = document.getElementById('payment-utr').value.trim();
    const noteVal = document.getElementById('payment-note').value.trim();
    
    if(!utrVal) return alert("Please enter the UTR / Transaction ID to verify your payment.");

    const btn = document.getElementById('btn-submit-order'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...'; btn.disabled = true;

    // Append UTR and Notes to customer_reqs to preserve DB Schema
    pendingOrderPayload.customer_reqs += ` | UTR: ${utrVal} | Note: ${noteVal || 'None'}`;

    const { error } = await _supabase.from('orders').insert([pendingOrderPayload]);
    if (error) { showToast("Network error. Please try again.", "fa-times", "text-red-500"); btn.innerHTML = 'Submit Order'; btn.disabled = false; return; }

    document.getElementById('payment-step-utr').classList.add('hidden'); document.getElementById('payment-step-utr').classList.remove('flex');
    document.getElementById('payment-step-2').classList.remove('hidden'); document.getElementById('payment-step-2').classList.add('flex');

    if(currentCommissionContext === 'cart') { cart = []; localStorage.setItem('th_cart', JSON.stringify(cart)); updateCartCount(); }
}

function showToast(msg, icon = 'fa-check', color = 'text-luxury-rose') { const t = document.getElementById('toast'); document.getElementById('toast-msg').textContent = msg; document.getElementById('toast-icon').className = `fas ${icon} ${color} text-sm drop-shadow-sm`; requestAnimationFrame(() => { t.classList.remove('opacity-0', 'translate-y-10'); setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000); }); }
function setupScrollReveal() { const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if(entry.isIntersecting) { requestAnimationFrame(() => { entry.target.classList.remove('opacity-0', 'translate-y-4'); observer.unobserve(entry.target); }); } }); }, { threshold: 0.05, rootMargin: '50px' }); document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el)); }