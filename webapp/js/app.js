/**
 * Twisted Happiness - Core Storefront Engine
 * Version: 15.5.0 - 100% Complete, Stable, & Globally Bound
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

// ==========================================
// 🛡️ CACHE & STATE MANAGEMENT
// ==========================================
function safeJSONParse(key, fallback) { 
    try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : fallback; } 
    catch (e) { localStorage.removeItem(key); return fallback; } 
}

let settings = safeJSONParse('th_settings', { storeName: "Twisted Happiness", instagram: "https://www.instagram.com/khushiified_art?igsh=aW1vZ2N4cTl2OWo=", whatsapp: "9909310501", upiId: "khushisj315@oksbi", countryCode: "+91" });
let cart = safeJSONParse('th_cart', []); 
let localWishlist = safeJSONParse('th_wishlist', []);
let savedAddresses = safeJSONParse('th_saved_addresses', []);

let products = []; let currentMainCategory = 'All'; let activeSubCategories = []; let currentSortMode = 'newest'; let currentSearchQuery = ''; 
let searchTimeout = null; let modalImages = []; let currentSlideIndex = 0; let isAnimating = false; let currentLightboxIndex = 0; let isLightboxAnimating = false; let currentModalLevel = 0; let statePushed = false;
let checkoutStep = 1; let pendingOrderPayload = null; let currentOrderReference = null; let currentDeliveryFee = 0; let activeCouponValue = 0; let activeCouponCode = "";
let selectedAddressIndex = savedAddresses.length > 0 ? 0 : -1; let editingAddressIndex = null; let currentSessionUser = null; let authModalMode = "login"; 
let activeBuild = { flowers: [], fillers: [], wrapping: 'Vintage Kraft', ribbon: 'Satin Bow' }; 

// ==========================================
// 🚀 INITIALIZATION & SETTINGS
// ==========================================
function initApp() {
    try { 
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 
        setupAuthSessionListener(); 
        fetchRuntimeSettings();
    } catch (e) { console.error("Supabase Init Error:", e); dismissPreloader(); }
}
document.addEventListener('DOMContentLoaded', initApp);

async function fetchRuntimeSettings() {
    try {
        const { data } = await _supabase.from('store_config').select('*').limit(1);
        if(data && data.length > 0) {
            const cloud = data[0];
            settings = { promoText: cloud.promo_text, storeName: cloud.store_name, instagram: cloud.instagram_url, whatsapp: cloud.whatsapp_num, upiId: cloud.upi_id, countryCode: cloud.country_code || "+91" };
            localStorage.setItem('th_settings', JSON.stringify(settings));
        }
    } catch(e) { console.warn("Local storage fallback active"); }
    applyDynamicSettings(); bindDOMEvents(); injectSkeletons(); fetchDatabase(); setupSocialLinks();
}

function applyDynamicSettings() {
    const name = "Twisted Happiness";
    document.title = `${name} | Fine Art & Handcrafted Gifts`;
    ['dynamic-store-name', 'footer-dynamic-name', 'preloader-brand'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).textContent = name;
    });
    if(document.getElementById('current-year')) document.getElementById('current-year').textContent = new Date().getFullYear();

    // Inject Dynamic Promo Text
    const defaultPromo = "✨ 100% Handcrafted Fine Art & Gifts ✨ Bespoke Canvas & Textured Clay Paintings ✨ Custom Sizing Up To 40x24\" ✨ Unlock VIP Discounts Up To 15% Off";
    let promoToDisplay = defaultPromo;
    if (settings.promoText) {
        try {
            const parsed = JSON.parse(settings.promoText);
            promoToDisplay = parsed.length > 0 ? parsed.join(' 🌸 ') + ' 🌸 ' : defaultPromo;
        } catch(e) { promoToDisplay = settings.promoText; }
    }
    
    if(document.getElementById('promo-marquee-1')) document.getElementById('promo-marquee-1').textContent = promoToDisplay;
    if(document.getElementById('promo-marquee-2')) document.getElementById('promo-marquee-2').textContent = promoToDisplay;
}

function setupSocialLinks() {
    const phone = (settings.whatsapp || "9909310501").replace(/\D/g, ''), code = (settings.countryCode || "91").replace(/\D/g, '');
    const msg = "Hello!%20I%20am%20exploring%20your%20beautiful%20collection.";
    const waLink = document.getElementById('footer-whatsapp'), floatLink = document.getElementById('floating-wa-btn');
    if(waLink) waLink.href = `https://wa.me/${code}${phone}?text=${msg}`;
    if(floatLink) floatLink.href = `https://wa.me/${code}${phone}?text=${msg}`;
    
    const igLink = document.getElementById('footer-instagram');
    if(igLink) {
        if (settings.instagram && settings.instagram.trim() !== "") {
            let cleanIg = settings.instagram.trim();
            if (!cleanIg.startsWith('http://') && !cleanIg.startsWith('https://')) cleanIg = 'https://' + cleanIg;
            igLink.href = cleanIg; igLink.classList.remove('hidden'); igLink.classList.add('flex'); 
        } else { igLink.classList.add('hidden'); igLink.classList.remove('flex'); }
    }
}

// ==========================================
// 🚨 UI LOADERS & UTILITIES
// ==========================================
function dismissPreloader() { const p = document.getElementById('luxury-page-preloader'); if(p && !p.classList.contains('hidden')){ p.style.opacity = '0'; p.style.pointerEvents = 'none'; setTimeout(() => p.remove(), 700); } }
function showInteractionLoader(txt = "Please wait...") { const l = document.getElementById('interaction-loader'); if(!l) return; document.getElementById('interaction-loader-text').textContent = txt; l.classList.remove('hidden'); l.classList.add('flex'); requestAnimationFrame(() => l.classList.remove('opacity-0')); }
function hideInteractionLoader() { const l = document.getElementById('interaction-loader'); if(!l) return; l.classList.add('opacity-0'); setTimeout(() => { l.classList.add('hidden'); l.classList.remove('flex'); }, 300); }
function isMobileDevice() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); }

window.showToast = function(msg, icon = 'fa-check', color = 'text-luxury-rose') { 
    const t = document.getElementById('toast'); if(!t) return;
    document.getElementById('toast-msg').textContent = msg; 
    document.getElementById('toast-icon').className = `fas ${icon} ${color} text-sm drop-shadow-sm`; 
    requestAnimationFrame(() => { t.classList.remove('opacity-0', 'translate-y-10'); setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000); }); 
};

window.safePushState = function(level) { try { history.pushState({ level: level }, ""); statePushed = true; } catch(e) { statePushed = false; } };

function setupScrollReveal() { 
    const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if(entry.isIntersecting) { requestAnimationFrame(() => { entry.target.classList.remove('opacity-0', 'translate-y-4'); observer.unobserve(entry.target); }); } }); }, { threshold: 0.05, rootMargin: '50px' }); 
    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el)); 
}

function injectSkeletons() {
    const loadingGrid = document.getElementById('product-grid'); if(!loadingGrid) return; let skeletonHTML = '';
    for(let i=0; i<12; i++) { const delay = (i % 6) * 0.05; skeletonHTML += `<div class="w-full relative opacity-100 transform translate-y-0" style="animation: fadeInUp 0.4s ease-out forwards; animation-delay: ${delay}s;"><div class="w-full bg-luxury-blush/30 rounded-2xl aspect-[4/5] mb-3"></div><div class="px-1"><div class="h-3 rounded-full bg-luxury-blush/60 w-3/4 mb-2.5"></div><div class="h-4 rounded-full bg-luxury-blush/60 w-1/3"></div></div></div>`; }
    loadingGrid.innerHTML = skeletonHTML;
}

// ==========================================
// 🚨 DOM EVENT BINDING
// ==========================================
function bindDOMEvents() {
    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); window.location.href = '/admin.html'; } });
    document.getElementById('prof-pin')?.addEventListener('input', handlePincodeInput);
    document.getElementById('searchInputDesk')?.addEventListener('input', (e) => syncSearch(e.target.value));
    document.getElementById('searchInputMob')?.addEventListener('input', (e) => syncSearch(e.target.value));
    document.getElementById('sortInputMob')?.addEventListener('change', (e) => setSortMode(e.target.value));
    document.getElementById('sortInputDesk')?.addEventListener('change', (e) => setSortMode(e.target.value));
    document.getElementById('sub-category-filters-mob')?.addEventListener('change', (e) => filterSubCategory(e.target.value));
    document.getElementById('track-order-form')?.addEventListener('submit', handleTrackOrder);
    document.getElementById('track-order-form-guest')?.addEventListener('submit', handleTrackOrderGuest);
    document.getElementById('customer-auth-form')?.addEventListener('submit', handleAuthFormSubmit);
    setupTouchCarousel(); setupLightboxTouch();
}

// ==========================================
// 🚨 AUTHENTICATION & PROFILE
// ==========================================
function setupAuthSessionListener() {
    _supabase.auth.onAuthStateChange((event, session) => {
        currentSessionUser = session ? session.user : null;
        const btn = document.getElementById('header-account-btn');
        if (btn) btn.innerHTML = currentSessionUser ? `<i class="fas fa-user-check text-[#D9778A] text-lg"></i>` : `<i class="far fa-user text-lg"></i>`;
        if (currentSessionUser) syncCloudWishlist();
        if (document.getElementById('checkout-overlay') && !document.getElementById('checkout-overlay').classList.contains('hidden')) syncCloudAddresses();
    });
}

window.handleAccountHeaderClick = function() { if (currentSessionUser) window.openCustomerProfile(); else window.openCustomerAuthModal(); };
window.openCustomerAuthModal = function() { authModalMode = "login"; document.getElementById('auth-panel-heading').textContent = "Welcome Back"; document.getElementById('btn-auth-submit').textContent = "Sign In"; document.getElementById('customer-auth-form').reset(); window.openPolicyModal('customer-auth-modal', 'customer-auth-box'); };
window.closeCustomerAuthModal = function() { window.closePolicyModal('customer-auth-modal', 'customer-auth-box'); };
window.toggleAuthViewMode = function() { authModalMode = (authModalMode === "login") ? "signup" : "login"; document.getElementById('auth-panel-heading').textContent = authModalMode === "login" ? "Welcome Back" : "Create Account"; document.getElementById('btn-auth-submit').textContent = authModalMode === "login" ? "Sign In" : "Register Account"; };

async function handleAuthFormSubmit(e) {
    e.preventDefault(); const em = document.getElementById('auth-email').value.trim(), pw = document.getElementById('auth-password').value, b = document.getElementById('btn-auth-submit');
    b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; b.disabled = true;
    try {
        if (authModalMode === "login") { const { error } = await _supabase.auth.signInWithPassword({ email: em, password: pw }); if (error) throw error; window.showToast("Welcome Back!", "fa-user-check"); } 
        else { const { error } = await _supabase.auth.signUp({ email: em, password: pw }); if (error) throw error; window.showToast("Registration Successful!", "fa-check-circle"); }
        window.closeCustomerAuthModal(); if(cart.length > 0) setTimeout(() => { window.openCheckoutBase(); }, 500);
    } catch(err) { alert(err.message); } finally { b.innerHTML = authModalMode === "login" ? "Sign In" : "Register Account"; b.disabled = false; }
}

window.handleGoogleOAuthLogin = async function() { try { const { error } = await _supabase.auth.signInWithOAuth({ provider: 'google', options: { queryParams: { prompt: 'select_account' }, redirectTo: window.location.origin } }); if (error) throw error; } catch (err) { alert(err.message); } };

window.openCustomerProfile = async function() { 
    if(!currentSessionUser) return; currentModalLevel = 1; window.safePushState(1); 
    const o = document.getElementById('customer-profile-overlay'); 
    
    const meta = currentSessionUser.user_metadata || {};
    const avatarUrl = meta.avatar_url || 'https://i.ibb.co/0RRrFK9N/TH-logo-1.png';
    const fullName = meta.full_name || 'Esteemed Patron';
    
    if(document.getElementById('profile-avatar')) document.getElementById('profile-avatar').src = avatarUrl;
    if(document.getElementById('profile-meta-name')) document.getElementById('profile-meta-name').textContent = fullName;
    if(document.getElementById('profile-meta-email')) document.getElementById('profile-meta-email').textContent = currentSessionUser.email;
    if(document.getElementById('profile-edit-name')) document.getElementById('profile-edit-name').value = fullName !== 'Esteemed Patron' ? fullName : '';
    
    o.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); 
    
    // Default to the Orders Tab
    if(window.th_switchProfileTab) window.th_switchProfileTab('orders');

    await syncCloudAddresses();
    renderProfileAddressBook();
    renderCustomerOrdersPipeline(); 
    
    requestAnimationFrame(() => { o.classList.remove('opacity-0'); o.classList.add('opacity-100'); }); 
};

// Logic for switching tabs
window.th_switchProfileTab = function(tab) {
    const oBtn = document.getElementById('ptab-orders'), aBtn = document.getElementById('ptab-addresses');
    const oCon = document.getElementById('pcontent-orders'), aCon = document.getElementById('pcontent-addresses');
    if(!oBtn) return;
    
    const activeClass = "px-5 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors border-b-2 border-luxury-rose text-luxury-rose whitespace-nowrap";
    const inactiveClass = "px-5 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors border-b-2 border-transparent text-gray-400 hover:text-luxury-dark whitespace-nowrap";

    if (tab === 'orders') {
        oBtn.className = activeClass; aBtn.className = inactiveClass;
        oCon.classList.remove('hidden'); oCon.classList.add('flex');
        aCon.classList.add('hidden'); aCon.classList.remove('flex');
    } else {
        aBtn.className = activeClass; oBtn.className = inactiveClass;
        aCon.classList.remove('hidden'); aCon.classList.add('flex');
        oCon.classList.add('hidden'); oCon.classList.remove('flex');
    }
};

window.th_updateUserProfile = async function(e) {
    e.preventDefault();
    const newName = document.getElementById('profile-edit-name').value.trim();
    const btn = document.getElementById('btn-update-profile');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
    try {
        const { error } = await _supabase.auth.updateUser({ data: { full_name: newName } });
        if(error) throw error;
        window.showToast("Profile Updated", "fa-check");
        if(document.getElementById('profile-meta-name')) document.getElementById('profile-meta-name').textContent = newName;
    } catch(err) { window.showToast("Error updating", "fa-times", "text-red-500"); }
    btn.innerHTML = 'Update'; btn.disabled = false;
};

function renderProfileAddressBook() {
    const container = document.getElementById('profile-address-list');
    if (!container) return;
    
    if (savedAddresses.length === 0) {
        container.innerHTML = '<p class="text-[11px] text-gray-500 font-medium">No addresses saved yet. Add one during checkout.</p>';
        return;
    }
    
    // Add instruction note
    container.innerHTML = '<p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">Addresses can be added or edited securely during checkout.</p>';
    
    let html = '';
    savedAddresses.forEach((a) => { 
        html += `
        <div class="bg-white border border-luxury-blush rounded-xl p-4 shadow-sm flex justify-between items-center">
            <div>
                <p class="font-bold text-luxury-dark text-[11px] uppercase tracking-wider mb-1">${a.first_name} ${a.last_name || ''}</p>
                <p class="text-gray-500 text-[10px] leading-relaxed">${a.address_1}${a.address_2 ? ', ' + a.address_2 : ''}<br>${a.city}, ${a.state} - <span class="font-bold text-luxury-dark">${a.pincode}</span></p>
            </div>
            <button type="button" onclick="window.th_deleteAddress('${a.id}')" class="text-red-400 hover:text-red-600 bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors"><i class="fas fa-trash-alt text-[10px]"></i></button>
        </div>`; 
    });
    container.innerHTML = html;
}

window.th_deleteAddress = async function(addressId) {
    if(!confirm("Delete this saved address?")) return;
    showInteractionLoader("Deleting...");
    try {
        await _supabase.from('addresses').delete().eq('id', addressId);
        await syncCloudAddresses();
        renderProfileAddressBook();
        window.showToast("Address deleted", "fa-trash");
    } catch(e) {
        window.showToast("Error deleting address", "fa-times", "text-red-500");
    }
    hideInteractionLoader();
};

window.closeCustomerProfile = function() { const o = document.getElementById('customer-profile-overlay'); requestAnimationFrame(() => { o.classList.remove('opacity-100'); o.classList.add('opacity-0'); setTimeout(() => { o.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }, 300); }); };
window.handleCustomerLogout = async function() { showInteractionLoader("Signing Out..."); await _supabase.auth.signOut(); savedAddresses = []; selectedAddressIndex = -1; window.closeCustomerProfile(); hideInteractionLoader(); window.showToast("Signed Out Safely", "fa-sign-out-alt"); };

// ==========================================
// 🚨 WISHLIST LOGIC
// ==========================================
async function syncCloudWishlist() { if (!currentSessionUser) return; try { const { data } = await _supabase.from('wishlist').select('product_id').eq('user_id', currentSessionUser.id); if (data) localWishlist = data.map(w => w.product_id); localStorage.setItem('th_wishlist', JSON.stringify(localWishlist)); } catch(e) {} }

window.th_toggleWishlistProduct = async function(pid, e) {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    const idx = localWishlist.indexOf(String(pid)), isA = idx === -1;
    if (isA) localWishlist.push(String(pid)); else localWishlist.splice(idx, 1);
    localStorage.setItem('th_wishlist', JSON.stringify(localWishlist));
    if (currentSessionUser) { try { if (isA) await _supabase.from('wishlist').insert([{ user_id: currentSessionUser.id, product_id: String(pid) }]); else await _supabase.from('wishlist').delete().eq('user_id', currentSessionUser.id).eq('product_id', String(pid)); } catch(er) {} }
    window.showToast(isA ? "Added to Wishlist" : "Removed from Wishlist", "fa-heart", isA ? "text-red-500" : "text-gray-300"); updateWishlistUIElements(pid, isA);
};

function updateWishlistUIElements(id, isA) {
    const btn = document.getElementById('modal-wishlist-toggle-btn'); if (btn && document.getElementById('product-view').getAttribute('data-current-id') == id) btn.innerHTML = `<i class="${isA ? 'fas fa-heart text-red-500' : 'far fa-heart text-gray-300'}"></i>`;
    document.querySelectorAll(`[data-card-id="${id}"] .wish-icon`).forEach(c => { c.className = isA ? "fas fa-heart text-red-500 wish-icon" : "far fa-heart text-gray-300 wish-icon"; });
}

// ==========================================
// 🚨 MATH & CALCULATORS
// ==========================================
function getDiscountPercent(idStr) { let h = 0; for (let i = 0; i < idStr.length; i++) h = idStr.charCodeAt(i) + ((h << 5) - h); return (Math.abs(h) % 31) + 10; }
function calculateCartDiscount(sub) { let d = 0, cTier = null, nTier = null; for (let i = 0; i < DISCOUNT_TIERS.length; i++) { if (sub >= DISCOUNT_TIERS[i].threshold) { cTier = DISCOUNT_TIERS[i]; nTier = i > 0 ? DISCOUNT_TIERS[i - 1] : null; break; } } if (!cTier && sub > 0) nTier = DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1]; if (cTier) { if (cTier.type === 'percent') d = Math.round(sub * (cTier.value / 100)); else d = cTier.value; } return { discount: d, currentTier: cTier, nextTier: nTier, amountNeeded: nTier ? nTier.threshold - sub : 0 }; }
function calculateTotalPrepTime(items) { let minD = 999; items.forEach(i => { const pt = i.prepTime || '3'; const m = pt.match(/\d+/g); if(m && m.length >= 1) { let mp = parseInt(m[0]); if (mp < minD) minD = mp; } else { if (3 < minD) minD = 3; } }); if (minD === 999) minD = 3; const tq = items.reduce((s, i) => s + parseInt(i.qty || 1), 0); return `${minD * tq} Days`; }
function updateCartCount() { requestAnimationFrame(() => { const c = cart.reduce((s, i) => s + parseInt(i.qty || 1), 0); document.querySelectorAll('#cart-count, #product-page-cart-count').forEach(el => { if(el) el.textContent = c; }); }); }
function calculateEDDBracket(pt) { const m = (pt || '3').match(/\d+/g); let minD = m && m.length > 0 ? parseInt(m[0]) : 3, maxD = m && m.length > 1 ? parseInt(m[1]) : minD + 2; const td = new Date(), minDt = new Date(), maxDt = new Date(); minDt.setDate(td.getDate() + minD + 2); maxDt.setDate(td.getDate() + maxD + 4); const opt = { day: 'numeric', month: 'short' }; return `Estimated Delivery: ${minDt.toLocaleDateString('en-IN', opt)} — ${maxDt.toLocaleDateString('en-IN', opt)}`; }

window.applyCouponCode = function() {
    const i = document.getElementById('checkout-promo-input'), f = document.getElementById('checkout-promo-feedback'); if(!i || !f) return; const c = i.value.trim().toUpperCase();
    if (c === "WELCOME10") { activeCouponValue = 10; activeCouponCode = "WELCOME10"; f.textContent = "WELCOME10 applied! Extra 10% OFF."; f.className = "text-[9px] font-bold uppercase tracking-wide mt-1.5 text-green-600 block"; } 
    else if (c === "ARTISAN30") { activeCouponValue = 30; activeCouponCode = "ARTISAN30"; f.textContent = "ARTISAN30 applied! Extra 30% OFF."; f.className = "text-[9px] font-bold uppercase tracking-wide mt-1.5 text-green-600 block"; } 
    else { activeCouponValue = 0; activeCouponCode = ""; f.textContent = "Invalid Coupon Code."; f.className = "text-[9px] font-bold uppercase tracking-wide mt-1.5 text-red-500 block"; }
    updateCheckoutUI();
};

// ==========================================
// 🚨 DATABASE FETCHING
// ==========================================
function fetchDatabase() { 
    _supabase.from('creations').select('*').order('created_at', { ascending: false }).then(({data, error}) => {
        if(error) { dismissPreloader(); return; }
        products = (data || []).map(r => { let pi = []; try { pi = JSON.parse(r.image_url) || []; } catch(e) {}
            return { id: r.id, name: r.name || 'Untitled Art', category: r.category || '', mainCategory: r.main_category || 'Pipe Cleaner Crafts', price: r.price || 0, prepTime: r.prep_time || '3-5', specs: r.specs || '', dimensions: r.dimensions || '', isCustomizable: r.is_customizable || false, image1: pi.length > 0 ? pi[0].data : '', image2: pi.length > 1 ? pi[1].data : '', image3: pi.length > 2 ? pi[2].data : '', image4: pi.length > 3 ? pi[3].data : '', image5: pi.length > 4 ? pi[4].data : '' };
        });
        requestAnimationFrame(() => { renderFilters(); renderProducts(); setTimeout(dismissPreloader, 400); });
    });
}

function renderProducts(sq = '') { 
    const g = document.getElementById('product-grid'); if(!g) return; g.innerHTML = ''; 
    let f = products.filter(p => p.name.toLowerCase().includes(sq.toLowerCase()));
    if(currentMainCategory !== 'All') f = f.filter(p => p.mainCategory === currentMainCategory);
    if(activeSubCategories.length > 0) f = f.filter(p => activeSubCategories.includes(p.category));
    if(currentSortMode === 'low') f.sort((a,b) => parseFloat(a.price) - parseFloat(b.price)); 
    if(currentSortMode === 'high') f.sort((a,b) => parseFloat(b.price) - parseFloat(a.price)); 
    if(currentSortMode === 'newest') f.reverse(); 

    if(f.length === 0) { g.innerHTML = '<div class="col-span-full text-center py-20 text-gray-400 font-medium text-sm w-full"><i class="fas fa-box-open text-4xl block mb-3 opacity-30"></i> No creations found matching your search.</div>'; return; }
    const frag = document.createDocumentFragment();
    f.forEach((p) => { frag.appendChild(generateProductCardHTML(p)); }); g.appendChild(frag); setupScrollReveal();
}

function generateProductCardHTML(p) {
    const cp = Number(String(p.price || 0).replace(/[^0-9.,]/g, '')), dp = getDiscountPercent(String(p.id)), op = Math.round(cp * (1 + (dp / 100))), img = (typeof p.image1 === 'string' && p.image1.trim() !== '') ? p.image1 : 'https://placehold.co/400x500/F8E9EA/423133', isH = localWishlist.includes(String(p.id));
    const c = document.createElement('div'); c.className = `w-full relative cursor-pointer opacity-0 transform translate-y-4 transition-all duration-400 ease-out group scroll-reveal`; c.setAttribute('data-card-id', p.id); c.addEventListener('click', () => window.openProductPage(p.id));
    c.innerHTML = `<div class="w-full relative rounded-2xl overflow-hidden group shadow-sm bg-gradient-to-tr from-luxury-bg to-white border border-luxury-blush aspect-[4/5] mb-2"><span class="absolute top-2.5 left-2.5 z-10 bg-white/95 text-luxury-dark text-[7px] sm:text-[8px] font-bold px-2.5 py-1 rounded-md uppercase tracking-[0.15em] border border-luxury-blush shadow-sm">${p.category || 'Art'}</span><button type="button" class="wishlist-btn absolute top-2.5 right-2.5 bg-white/95 w-7 h-7 flex items-center justify-center rounded-full border border-luxury-blush z-20 shadow-sm transition-transform active:scale-95"><i class="${isH ? 'fas fa-heart text-red-500' : 'far fa-heart text-gray-300'} wish-icon"></i></button><img loading="lazy" decoding="async" src="${img}" alt="${p.name}" class="absolute inset-0 w-full h-full object-cover"></div><div class="px-1 flex flex-col justify-start text-left w-full"><h3 class="font-bitter font-semibold text-[11px] sm:text-[12px] text-luxury-dark leading-snug w-full transition-colors group-hover:text-luxury-rose mb-0.5 line-clamp-2">${p.name}</h3><div class="flex items-center md:items-baseline gap-1.5 flex-wrap w-full"><span class="font-poppins font-extrabold text-luxury-dark text-[14px] sm:text-[15px] tracking-tight leading-none">₹${cp}</span><span class="font-poppins text-gray-400 text-[9px] font-medium line-through leading-none">₹${op}</span></div></div>`;
    const wb = c.querySelector('.wishlist-btn'); if (wb) wb.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); window.th_toggleWishlistProduct(p.id, e); }); return c;
}

// ==========================================
// 🚨 PRODUCT PAGE MODAL
// ==========================================
window.openProductPage = function(id) { 
    const p = products.find(x => x.id == id); if(!p) return; document.getElementById('product-view').setAttribute('data-current-id', p.id);
    activeBuild = { flowers: [], wrapping: 'Classic Kraft' }; // Reset the visual builder
    renderVisualCustomizer(p); // Render the visual studio if applicable
    const cp = Number(String(p.price || 0).replace(/[^0-9.,]/g, '')), dp = getDiscountPercent(String(p.id)), op = Math.round(cp * (1 + (dp / 100)));
    modalImages = [p.image1, p.image2, p.image3, p.image4, p.image5].filter(img => typeof img === 'string' && img.trim() !== ''); if (modalImages.length === 0) modalImages.push('https://placehold.co/400x500/F8E9EA/423133');
    
    const tr = document.getElementById('modal-carousel-track'), th = document.getElementById('modal-thumbnails'); tr.style.transition = 'none'; let html = '';
    modalImages.forEach(src => { html += `<div class="w-full h-full flex-shrink-0 flex items-center justify-center relative bg-transparent" onclick="window.openLightboxFromCarousel()"><img loading="lazy" src="${src}" class="w-full max-h-full object-contain"></div>`; }); tr.innerHTML = html; currentSlideIndex = 0; tr.style.transform = `translateX(0)`;
    
    th.innerHTML = ''; if (modalImages.length > 1) { modalImages.forEach((src, idx) => { const tm = document.createElement('img'); tm.src = src; tm.className = `w-12 h-12 object-cover rounded-md border-2 transition-all cursor-pointer ${idx === 0 ? 'border-luxury-rose scale-105 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`; tm.id = `thumb-${idx}`; tm.addEventListener('click', () => window.goToSlide(idx)); th.appendChild(tm); }); } 
    
    document.getElementById('modal-wishlist-toggle-btn').onclick = (e) => window.th_toggleWishlistProduct(p.id, e); updateWishlistUIElements(p.id, (localWishlist || []).includes(String(p.id)));

    if(document.getElementById('modal-title')) document.getElementById('modal-title').textContent = p.name; if(document.getElementById('modal-main-category')) document.getElementById('modal-main-category').textContent = p.mainCategory; if(document.getElementById('modal-sub-category')) document.getElementById('modal-sub-category').textContent = p.category || 'Fine Art Medium'; if(document.getElementById('breadcrumb-main-cat')) document.getElementById('breadcrumb-main-cat').textContent = p.mainCategory; if(document.getElementById('breadcrumb-sub-cat')) document.getElementById('breadcrumb-sub-cat').textContent = p.name.substring(0, 20) + (p.name.length > 20 ? '...' : ''); if(document.getElementById('modal-price')) document.getElementById('modal-price').textContent = cp; if(document.getElementById('modal-original-price')) document.getElementById('modal-original-price').textContent = "₹" + op; if(document.getElementById('modal-discount-tag')) document.getElementById('modal-discount-tag').textContent = `${dp}% OFF`; if(document.getElementById('modal-specs')) document.getElementById('modal-specs').innerHTML = p.specs || 'No details provided.'; if(document.getElementById('modal-edd-delivery-tag')) document.getElementById('modal-edd-delivery-tag').textContent = calculateEDDBracket(p.prepTime || '3-5');

    const cg = document.getElementById('modal-care-guide'); if (cg) { if (p.mainCategory === 'Canvas Paintings') cg.innerHTML = `<li>Keep away from prolonged direct sunlight.</li><li>Avoid areas with extreme humidity.</li><li>Dust gently with a clean, dry microfiber cloth.</li>`; else if (p.mainCategory === 'Clay Art Paintings') cg.innerHTML = `<li><strong>Highly fragile.</strong> Handle edges with care.</li><li>Keep strictly away from moisture.</li><li>Dust very lightly using a soft brush.</li>`; else cg.innerHTML = `<li>Keep away from direct, harsh sunlight.</li><li>Lightly dust with a soft, dry brush.</li><li>Do not expose to moisture.</li>`; }
    const bc = document.getElementById('art-badges-container'), db = document.getElementById('modal-dimensions-badge'), cb = document.getElementById('modal-custom-badge'); if(bc) bc.classList.add('hidden'); if(db) db.classList.add('hidden'); if(cb) cb.classList.add('hidden'); if(p.mainCategory === 'Canvas Paintings' || p.mainCategory === 'Clay Art Paintings') { bc?.classList.remove('hidden'); if(p.dimensions && db) { document.getElementById('modal-dimensions-text').textContent = p.dimensions; db.classList.remove('hidden'); } if(p.isCustomizable) cb?.classList.remove('hidden'); }
    
    renderRelatedProducts(p.id, p.mainCategory, p.category); updateProductButtons(p.id);
    document.getElementById('customer-view')?.classList.add('hidden'); document.getElementById('product-view')?.classList.remove('hidden'); window.scrollTo(0, 0); currentModalLevel = 1; window.safePushState(1); 
};

window.closeProductPage = function() { document.getElementById('product-view')?.classList.add('hidden'); document.getElementById('customer-view')?.classList.remove('hidden'); window.scrollTo(0, 0); };

function updateProductButtons(id) {
    const ac = document.getElementById('modal-action-buttons'); if(!ac) return; const ci = cart.find(i => i.id == id); const q = ci ? parseInt(ci.qty || 1) : 0;
    if(q > 0) ac.innerHTML = `<div class="flex items-center justify-between w-full h-full bg-white border border-luxury-rose rounded-full px-2 sm:px-4 py-3 shadow-sm min-h-[44px]"><button type="button" onclick="window.th_updateCartQty('${id}', -1, event)" class="w-8 h-8 rounded-full bg-luxury-bg hover:bg-luxury-blush border border-luxury-blush flex items-center justify-center shrink-0"><i class="fas fa-minus text-xs"></i></button><span class="text-base sm:text-lg font-bold text-luxury-rose font-poppins min-w-[20px] text-center">${q}</span><button type="button" onclick="window.th_updateCartQty('${id}', 1, event)" class="w-8 h-8 rounded-full bg-luxury-bg hover:bg-luxury-blush border border-luxury-blush flex items-center justify-center shrink-0"><i class="fas fa-plus text-xs"></i></button></div><button type="button" onclick="window.openCheckoutBase()" class="w-full bg-luxury-dark text-white hover:bg-[#D9778A] font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider shadow-md active:scale-[0.98] transition-colors min-h-[44px]"><i class="fas fa-bolt text-luxury-gold"></i> Checkout</button>`; 
    else ac.innerHTML = `<button type="button" onclick="window.th_updateCartQty('${id}', 1, event)" class="w-full bg-white border border-luxury-dark text-luxury-dark hover:bg-luxury-bg font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider transition-colors shadow-sm active:scale-[0.98] min-h-[44px]"><i class="fas fa-shopping-bag"></i> Add to Bag</button><button type="button" onclick="window.routeCheckoutFromModal('${id}', event)" class="w-full bg-luxury-dark text-white hover:bg-[#D9778A] font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider shadow-md active:scale-[0.98] transition-colors min-h-[44px]"><i class="fas fa-bolt text-luxury-gold"></i> Buy Now</button>`; 
}

function renderRelatedProducts(cid, mc, sc) {
    const g = document.getElementById('related-products-grid'), s = document.getElementById('related-products-section'); if(!g || !s) return; g.innerHTML = '';
    let r = products.filter(p => p.id != cid), ssc = r.filter(p => p.category === sc), smc = r.filter(p => p.mainCategory === mc && p.category !== sc);
    let fr = [...ssc, ...smc].slice(0, 14); if (fr.length === 0) { s.classList.add('hidden'); return; } else s.classList.remove('hidden');
    const f = document.createDocumentFragment(); fr.forEach(p => { f.appendChild(generateProductCardHTML(p)); }); g.appendChild(f); setupScrollReveal();
}

// ==========================================
// 🚨 CART & CHECKOUT ENGINE
// ==========================================
window.th_updateCartQty = function(id, d, e) {
    if(e) { e.preventDefault(); e.stopPropagation(); } let ex = cart.find(x => x.id == id);
    if(ex) { ex.qty = parseInt(ex.qty || 1) + d; if(ex.qty <= 0) { cart = cart.filter(x => x.id != id); window.showToast("Removed from Bag", "fa-times"); } else { if(d > 0) window.showToast("Quantity Increased", "fa-plus"); } } 
    else if(d > 0) { 
        const p = products.find(x => x.id == id); 
        if(p) { 
            // Capture visual builder specs
            let customSpecsStr = "";
            if (p.mainCategory === 'Pipe Cleaner Crafts' && p.name.toLowerCase().includes('bouquet')) {
                 customSpecsStr = `Flowers: ${activeBuild.flowers.length > 0 ? activeBuild.flowers.join(', ') : 'Standard'} | Fillers: ${activeBuild.fillers.length > 0 ? activeBuild.fillers.join(', ') : 'None'} | Wrap: ${activeBuild.wrapping} | Ribbon: ${activeBuild.ribbon}`;
            }
            
            cart.push({ 
                id: p.id, 
                name: p.name, 
                price: p.price, 
                prepTime: p.prepTime, 
                image: p.image1, 
                isCustomizable: p.isCustomizable, 
                mainCategory: p.mainCategory, 
                customSpecs: customSpecsStr, // Save the configuration
                qty: 1 
            }); 
            window.showToast("Added to Bag", "fa-check"); 
        } 
    }
    localStorage.setItem('th_cart', JSON.stringify(cart)); updateCartCount();
    const pv = document.getElementById('product-view'); if(pv && !pv.classList.contains('hidden')) updateProductButtons(id);
    if(document.getElementById('checkout-overlay') && !document.getElementById('checkout-overlay').classList.contains('hidden')){ if (cart.length === 0) { window.closeCheckout(); return window.showToast("Bag is empty!", "fa-times"); } renderCheckoutItems(); updateCheckoutUI(); }
};

window.openCheckoutBase = function() {
    if(cart.length === 0) return window.showToast("Your bag is empty!", "fa-times", "text-red-500");
    if(!currentSessionUser) { window.showToast("Please Sign In to Checkout", "fa-user-lock", "text-luxury-rose"); window.openCustomerAuthModal(); return; }
    currentModalLevel = 1; window.safePushState(1); checkoutStep = 1; const o = document.getElementById('checkout-overlay'); if(!o) return;
    o.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); document.getElementById('payment-success-view')?.classList.add('hidden'); document.getElementById('payment-success-view')?.classList.remove('flex'); document.getElementById('payment-gateway-view')?.classList.remove('hidden'); document.getElementById('payment-gateway-view')?.classList.add('flex');
    renderCheckoutItems(); syncCloudAddresses(); requestAnimationFrame(() => { o.classList.remove('opacity-0'); o.classList.add('opacity-100'); o.scrollTo(0, 0); });
};

window.closeCheckout = function() {
    const o = document.getElementById('checkout-overlay'); if(!o) return;
    requestAnimationFrame(() => { o.classList.remove('opacity-100'); o.classList.add('opacity-0'); setTimeout(() => { o.classList.add('hidden'); if(document.getElementById('return-policy-modal')?.classList.contains('hidden') && document.getElementById('privacy-policy-modal')?.classList.contains('hidden')){ document.body.classList.remove('overflow-hidden'); } pendingOrderPayload = null; renderProducts(currentSearchQuery); }, 300); });
};

window.routeCheckoutFromModal = function(id, e) { 
    if(e) { e.preventDefault(); e.stopPropagation(); } const p = products.find(x => x.id == id); if(!p) return; let ex = cart.find(x => x.id == id);
    if(!ex) { cart.push({ id: p.id, name: p.name, price: p.price, prepTime: p.prepTime, image: p.image1, isCustomizable: p.isCustomizable, mainCategory: p.mainCategory, qty: 1 }); localStorage.setItem('th_cart', JSON.stringify(cart)); updateCartCount(); }
    window.openCheckoutBase(); 
};

function renderCheckoutItems() {
    const c = document.getElementById('checkout-items-list'); if(!c) return; if (cart.length === 0) { c.innerHTML = '<div class="text-center py-10 text-gray-400 font-medium text-sm"><i class="fas fa-shopping-bag text-4xl block mb-3 opacity-30"></i> Your bag is completely empty.</div>'; document.getElementById('cart-upsell-container')?.classList.add('hidden'); return; }
    let h = ''; cart.forEach(i => { const cp = Number((i.price || 0).toString().replace(/[^0-9.,]/g, '')), dp = getDiscountPercent(String(i.id)), op = Math.round(cp * (1 + (dp / 100))), img = (typeof i.image1 === 'string' && i.image1.trim() !== '') ? i.image1 : (typeof i.image === 'string' ? i.image : 'https://placehold.co/150/F8E9EA/423133'), q = parseInt(i.qty || 1);
        h += `<div class="flex flex-col sm:flex-row gap-4 border border-luxury-blush bg-white p-4 rounded-2xl shadow-sm"><img src="${img}" class="w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-xl border border-luxury-blush shrink-0 bg-luxury-bg"><div class="flex flex-col justify-between w-full"><div><h4 class="font-bitter text-[14px] sm:text-[15px] font-semibold text-luxury-dark mb-1 leading-snug">${i.name}</h4><p class="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">${i.mainCategory || i.category || 'Handcrafted Art'}</p>
${i.customSpecs ? `<p class="text-[9px] font-medium text-luxury-rose mb-3 bg-luxury-rose/10 inline-block px-2 py-1 rounded-md border border-luxury-rose/20 leading-relaxed">${i.customSpecs}</p>` : `<div class="mb-3"></div>`}<div class="flex items-baseline gap-2 mb-4"><span class="font-poppins text-luxury-dark font-bold text-[16px] sm:text-[18px]">₹${cp}</span><span class="font-poppins text-gray-400 text-[11px] line-through">₹${op}</span><span class="text-green-600 font-bold text-[10px] ml-1">${dp}% Off</span></div></div><div class="flex items-center gap-3"><div class="flex items-center bg-white border border-luxury-blush rounded-full h-[36px] overflow-hidden shadow-sm"><button type="button" onclick="window.th_updateCartQty('${i.id}', -1, event)" class="w-10 h-full flex items-center justify-center text-luxury-dark hover:bg-luxury-blush transition-colors"><i class="fas fa-minus text-[10px]"></i></button><div class="w-10 h-full flex items-center justify-center border-l border-r border-luxury-blush text-[12px] font-bold text-luxury-rose bg-luxury-bg">${q}</div><button type="button" onclick="window.th_updateCartQty('${i.id}', 1, event)" class="w-10 h-full flex items-center justify-center text-luxury-dark hover:bg-luxury-blush transition-colors"><i class="fas fa-plus text-[10px]"></i></button></div></div></div></div>`;
    });
    const dw = document.getElementById('comm-dimensions-wrapper'); if (cart.some(i => i.isCustomizable)) dw?.classList.remove('hidden'); else dw?.classList.add('hidden'); c.innerHTML = h;
    
    // Trigger Upsell rendering
    renderCartUpsells();
}

// ==========================================
// 🚨 ADDRESS BOOK
// ==========================================
async function syncCloudAddresses() {
    if (currentSessionUser) { try { const { data } = await _supabase.from('addresses').select('*').order('created_at', { ascending: true }); savedAddresses = data || []; selectedAddressIndex = savedAddresses.length > 0 ? 0 : -1; } catch (e) {} } 
    else { savedAddresses = safeJSONParse('th_saved_addresses', []); selectedAddressIndex = savedAddresses.length > 0 ? 0 : -1; } renderAddressBook();
}

function renderAddressBook() {
    const c = document.getElementById('address-book-container'), f = document.getElementById('checkout-profile-form'), ba = document.getElementById('btn-show-add-address'); if (!c || !f) return;
    if (savedAddresses.length === 0) { c.innerHTML = ''; c.classList.add('hidden'); f.classList.remove('hidden'); if(ba) ba.classList.add('hidden'); clearAddressForm(); editingAddressIndex = null; } 
    else { c.classList.remove('hidden'); let h = ''; savedAddresses.forEach((a, i) => { const s = i === selectedAddressIndex; h += `<div class="border ${s ? 'border-[#D9778A] bg-[#FFF0F2]' : 'border-luxury-blush bg-white'} rounded-xl p-4 flex gap-4 cursor-pointer transition-colors relative shadow-sm" onclick="window.selectAddress(${i})"><div class="pt-1 shrink-0"><div class="w-4 h-4 rounded-full border-2 ${s ? 'border-[#D9778A] flex items-center justify-center bg-white' : 'border-gray-300 bg-white'}">${s ? '<div class="w-2 h-2 rounded-full bg-[#D9778A]"></div>' : ''}</div></div><div class="flex-grow pr-8"><p class="font-bold text-luxury-dark text-[12px] uppercase tracking-wider mb-1">${a.first_name} ${a.last_name || ''}</p><p class="text-gray-500 text-[11px] leading-relaxed mb-2">${a.address_1}${a.address_2 ? ', ' + a.address_2 : ''}<br>${a.city}, ${a.state} - <span class="font-bold text-luxury-dark">${a.pincode}</span></p><p class="text-luxury-dark font-medium text-[11px]"><i class="fas fa-phone-alt text-luxury-rose/70 mr-1.5 text-[9px]"></i> ${a.phone}</p></div><button type="button" onclick="window.editAddress(${i}, event)" class="absolute top-4 right-4 text-[9px] text-gray-400 hover:text-luxury-rose uppercase font-bold tracking-widest bg-white w-8 h-8 rounded-full border border-luxury-blush flex items-center justify-center transition-colors"><i class="fas fa-pen"></i></button></div>`; }); c.innerHTML = h; f.classList.add('hidden'); if(ba) ba.classList.remove('hidden'); } updateCheckoutUI(); 
}

window.selectAddress = function(i) { selectedAddressIndex = i; document.getElementById('checkout-profile-form').classList.add('hidden'); document.getElementById('btn-show-add-address').classList.remove('hidden'); renderAddressBook(); };
window.showAddressForm = function() { editingAddressIndex = null; clearAddressForm(); document.getElementById('checkout-profile-form').classList.remove('hidden'); document.getElementById('btn-show-add-address').classList.add('hidden'); if(savedAddresses.length > 0) document.getElementById('btn-cancel-address')?.classList.remove('hidden'); updateCheckoutUI(); };
window.hideAddressForm = function() { document.getElementById('checkout-profile-form').classList.add('hidden'); document.getElementById('btn-show-add-address').classList.remove('hidden'); editingAddressIndex = null; updateCheckoutUI(); };
window.editAddress = function(i, e) { e.stopPropagation(); editingAddressIndex = i; const a = savedAddresses[i]; document.getElementById('prof-fname').value = a.first_name || ''; document.getElementById('prof-lname').value = a.last_name || ''; document.getElementById('prof-email').value = a.email || ''; document.getElementById('prof-phone').value = a.phone || ''; document.getElementById('prof-add1').value = a.address_1 || ''; document.getElementById('prof-add2').value = a.address_2 || ''; document.getElementById('prof-city').value = a.city || ''; document.getElementById('prof-state').value = a.state || ''; document.getElementById('prof-pin').value = a.pincode || ''; document.getElementById('checkout-profile-form').classList.remove('hidden'); document.getElementById('btn-show-add-address').classList.add('hidden'); document.getElementById('btn-cancel-address')?.classList.remove('hidden'); updateCheckoutUI(); };

window.saveAddressFromForm = async function() {
    const a = { first_name: document.getElementById('prof-fname').value.trim(), last_name: document.getElementById('prof-lname').value.trim(), email: document.getElementById('prof-email').value.trim(), phone: document.getElementById('prof-phone').value.trim(), address_1: document.getElementById('prof-add1').value.trim(), address_2: document.getElementById('prof-add2').value.trim(), city: document.getElementById('prof-city').value.trim(), state: document.getElementById('prof-state').value.trim(), pincode: document.getElementById('prof-pin').value.trim() };
    if(!a.first_name || !a.phone || !a.address_1 || !a.city || !a.pincode) return window.showToast("Please fill all required fields", "fa-exclamation-circle", "text-red-500");
    showInteractionLoader("Saving Address...");
    if (currentSessionUser) { try { a.user_id = currentSessionUser.id; if (editingAddressIndex !== null) await _supabase.from('addresses').update(a).eq('id', savedAddresses[editingAddressIndex].id); else await _supabase.from('addresses').insert([a]); await syncCloudAddresses(); } catch (e) { alert("Failed to save address: " + e.message); hideInteractionLoader(); return false; } } 
    else { if (editingAddressIndex !== null) { savedAddresses[editingAddressIndex] = a; selectedAddressIndex = editingAddressIndex; } else { savedAddresses.push(a); selectedAddressIndex = savedAddresses.length - 1; } localStorage.setItem('th_saved_addresses', JSON.stringify(savedAddresses)); }
    editingAddressIndex = null; renderAddressBook(); hideInteractionLoader(); window.showToast("Address Saved", "fa-check"); return true;
};

function clearAddressForm() { ['fname','lname','email','phone','add1','add2','city','state','pin'].forEach(id => document.getElementById('prof-'+id).value = ''); }

// ==========================================
// 🚨 CHECKOUT NAVIGATION & PAYMENT
// ==========================================
function calculateDynamicDelivery(sub, pin, items) {
    if (sub >= 2499 || sub === 0) return 0; let tw = 0;
    items.forEach(i => { let dw = 0.2, vw = 0.2; const c = i.mainCategory || i.category || '', q = parseInt(i.qty || 1); if (c.includes('Canvas')) { dw = 1.5; vw = (45 * 35 * 5) / 5000; } else if (c.includes('Clay')) { dw = 0.8; vw = (25 * 25 * 10) / 5000; } else { dw = 0.15; vw = (15 * 10 * 5) / 5000; } tw += Math.max(dw, vw) * q; });
    const ws = Math.ceil(tw / 0.5); let z = 'D'; 
    if (pin && String(pin).length >= 2) { const p2 = parseInt(String(pin).substring(0, 2)), p3 = parseInt(String(pin).substring(0, 3)); if (p3 === 387 || p3 === 388) z = 'A'; else if ((p2 >= 36 && p2 <= 42) || p2 === 39) z = 'B'; else if (p2 === 19 || (p2 >= 78 && p2 <= 79)) z = 'E'; }
    let br = 0, ar = 0; switch(z) { case 'A': br = 35; ar = 35; break; case 'B': br = 45; ar = 40; break; case 'E': br = 85; ar = 80; break; default: br = 55; ar = 50; break; }
    return br + (ws > 1 ? ((ws - 1) * ar) : 0);
}

window.goToCheckoutStep = function(s) { 
    if (s === 1) { checkoutStep = 1; updateCheckoutUI(); } 
    else if (s === 2) { if (cart.length === 0) return window.showToast("Your bag is empty!", "fa-times", "text-red-500"); checkoutStep = 2; updateCheckoutUI(); } 
    else if (s === 3) { if (cart.length === 0) return; if (savedAddresses.length === 0 || selectedAddressIndex === -1) return window.showToast("Please provide a delivery address.", "fa-exclamation-circle", "text-red-500"); window.preparePaymentGateway(); }
};

function updateCheckoutUI() {
    let ts = 0, ss = 0, ti = 0; cart.forEach((i) => { const cp = Number(String(i.price || 0).replace(/[^0-9.,]/g, '')), q = parseInt(i.qty || 1), dp = getDiscountPercent(String(i.id)); ts += (Math.round(cp * (1 + (dp / 100))) * q); ss += (cp * q); ti += q; });
    let cPin = ''; const cf = document.getElementById('checkout-profile-form'); if (cf && !cf.classList.contains('hidden') && document.getElementById('prof-pin')) cPin = document.getElementById('prof-pin').value.trim(); else if (savedAddresses.length > 0 && selectedAddressIndex !== -1) cPin = savedAddresses[selectedAddressIndex].pincode;
    const de = document.getElementById('qo-delivery-fee'); if (ss >= 2499) { currentDeliveryFee = 0; if(de) de.innerHTML = '<span class="text-green-600 font-bold uppercase tracking-widest text-[10px]">Free</span>'; } else if (cPin.length >= 2) { currentDeliveryFee = calculateDynamicDelivery(ss, cPin, cart); if(de) de.innerHTML = `₹${currentDeliveryFee}`; } else { currentDeliveryFee = 0; if(de) de.innerHTML = '<span class="text-gray-400 text-[10px] font-medium">Calculated next step</span>'; }
    const { discount: vd, currentTier: ct } = calculateCartDiscount(ss); let cd = activeCouponValue > 0 ? Math.round(ss * (activeCouponValue / 100)) : 0; const rc = document.getElementById('qo-coupon-row'); if (rc) { if (cd > 0) { document.getElementById('qo-coupon-discount').textContent = `- ₹${cd}`; rc.classList.remove('hidden'); } else { rc.classList.add('hidden'); } }
    const ft = ss - vd - cd + currentDeliveryFee, pd = ts - ss, tos = pd + vd + cd;
    
    if(document.getElementById('qo-item-count')) document.getElementById('qo-item-count').textContent = ti; 
    if(document.getElementById('qo-original-value')) document.getElementById('qo-original-value').textContent = `₹${ts}`; 
    if(document.getElementById('qo-product-discount')) document.getElementById('qo-product-discount').textContent = `- ₹${pd}`;
    
    const vr = document.getElementById('qo-vip-row'); if(vr) { if(vd > 0) { document.getElementById('qo-vip-label').textContent = ct.label; document.getElementById('qo-vip-discount').textContent = `- ₹${vd}`; vr.classList.remove('hidden'); } else { vr.classList.add('hidden'); } }
    
    const vipProgress = document.getElementById('vip-progress-container');
    if (vipProgress) {
        if (nt) {
            const progressPercent = Math.min(100, (ss / nt.threshold) * 100);
            vipProgress.innerHTML = `<div class="flex justify-between items-end mb-1"><span class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">VIP Status</span><span class="text-[9px] font-bold text-luxury-rose uppercase tracking-widest">Add ₹${nt.threshold - ss} for ${nt.label} 🌸</span></div><div class="w-full bg-luxury-blush/30 h-1.5 rounded-full overflow-hidden"><div class="bg-luxury-rose h-full rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div></div>`;
            vipProgress.classList.remove('hidden');
        } else if (ct) {
            vipProgress.innerHTML = `<p class="text-[10px] font-bold text-luxury-rose uppercase tracking-widest text-center"><i class="fas fa-crown text-luxury-gold mr-1"></i> Maximum VIP Tier Unlocked!</p>`;
            vipProgress.classList.remove('hidden');
        } else {
            vipProgress.classList.add('hidden');
        }
    }

    if(document.getElementById('qo-total-savings')) document.getElementById('qo-total-savings').textContent = tos; 
    if(document.getElementById('qo-final-total')) document.getElementById('qo-final-total').textContent = `₹${ft}`;
    
    const f = document.getElementById('progress-bar-fill');
    const i1 = document.getElementById('step-indicator-1');
    const i2 = document.getElementById('step-indicator-2');
    const i3 = document.getElementById('step-indicator-3');
    const sb = document.getElementById('checkout-price-sidebar');
    const mb = document.getElementById('checkout-action-btn-mobile');
    const db = document.getElementById('checkout-action-btn-desk'); 
    
    if(!f) return;
    
    if(mb) { 
        if(checkoutStep === 1) { mb.innerHTML = `Next: Delivery <i class="fas fa-arrow-right ml-1"></i>`; mb.disabled = cart.length===0; mb.className=`w-full bg-luxury-dark text-white hover:bg-[#D9778A] py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.15em] transition-all shadow-float flex items-center justify-center gap-2 ${cart.length===0?'opacity-50 cursor-not-allowed':''}`; } 
        else if (checkoutStep === 2) { mb.innerHTML = `Next: Secure Payment <i class="fas fa-lock ml-1"></i>`; mb.disabled = false; mb.className="w-full bg-luxury-dark text-white hover:bg-[#D9778A] py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.15em] transition-all shadow-float flex items-center justify-center gap-2"; } 
    }
    
    if(db) { 
        if(checkoutStep === 1) { db.innerHTML = `Next: Delivery <i class="fas fa-arrow-right ml-1"></i>`; db.disabled = cart.length===0; db.className=`hidden lg:flex w-full bg-luxury-dark text-white hover:bg-[#D9778A] py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.15em] transition-all shadow-float items-center justify-center gap-2 mt-2 ${cart.length===0?'opacity-50 cursor-not-allowed':''}`; } 
        else if (checkoutStep === 2) { db.innerHTML = `Next: Secure Payment <i class="fas fa-lock ml-1"></i>`; db.disabled = false; db.className="hidden lg:flex w-full bg-luxury-dark text-white hover:bg-[#D9778A] py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.15em] transition-all shadow-float items-center justify-center gap-2 mt-2"; } 
    }
    
    if(sb) { 
        if(window.innerWidth < 1024) { sb.className = (checkoutStep === 1) ? "block w-full mt-2" : "hidden w-full mt-2"; } 
        else { sb.className = (checkoutStep === 1 || checkoutStep === 2) ? "block lg:col-span-4 w-full lg:mt-0" : "hidden lg:block lg:col-span-4 w-full lg:mt-0"; } 
    }
    
    const aCl = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-[#D9778A] text-white shadow-md border-2 border-white group-hover:scale-105", iCl = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-white text-gray-400 border-2 border-luxury-blush group-hover:scale-105";
    if (checkoutStep === 1) { document.getElementById('checkout-step-1')?.classList.remove('hidden'); document.getElementById('checkout-step-2')?.classList.add('hidden'); document.getElementById('checkout-step-3')?.classList.add('hidden'); f.style.width = '0%'; if(i1) i1.className = aCl; if(i2) i2.className = iCl; if(i3) i3.className = iCl; } 
    else if (checkoutStep === 2) { document.getElementById('checkout-step-1')?.classList.add('hidden'); document.getElementById('checkout-step-2')?.classList.remove('hidden'); document.getElementById('checkout-step-3')?.classList.add('hidden'); f.style.width = '50%'; if(i1) i1.className = aCl; if(i2) i2.className = aCl; if(i3) i3.className = iCl; } 
    else if (checkoutStep === 3) { document.getElementById('checkout-step-1')?.classList.add('hidden'); document.getElementById('checkout-step-2')?.classList.add('hidden'); document.getElementById('checkout-step-3')?.classList.remove('hidden'); f.style.width = '100%'; if(i1) i1.className = aCl; if(i2) i2.className = aCl; if(i3) i3.className = aCl; }
}

window.handleMobileStickyAction = function() { window.handleCheckoutAction(); };
window.handleCheckoutAction = function() {
    if (checkoutStep === 1) { if (cart.length === 0) return window.showToast("Your bag is empty!", "fa-times", "text-red-500"); if (!currentSessionUser) { window.showToast("Please Sign In to Checkout", "fa-user-lock", "text-luxury-rose"); window.openCustomerAuthModal(); return; } checkoutStep = 2; updateCheckoutUI(); renderAddressBook(); document.getElementById('checkout-overlay')?.scrollTo({top: 0, behavior: 'smooth'}); } 
    else if (checkoutStep === 2) { const f = document.getElementById('checkout-profile-form'); if (f && !f.classList.contains('hidden')) { window.saveAddressFromForm().then(s=>{ if(!s) return; }); } if (savedAddresses.length === 0 || selectedAddressIndex === -1) { return window.showToast("Please provide a delivery address.", "fa-exclamation-circle", "text-red-500"); } window.preparePaymentGateway(); }
};

window.preparePaymentGateway = function() {
    const t = document.getElementById('comm-type') ? document.getElementById('comm-type').value : 'Standard Order', c = document.getElementById('comm-colors') ? document.getElementById('comm-colors').value.trim() : 'No notes', dims = document.getElementById('comm-dimensions') ? document.getElementById('comm-dimensions').value.trim() : ''; 
    const giftNote = document.getElementById('is-gift-toggle')?.checked ? document.getElementById('comm-gift-note').value.trim() : '';
    showInteractionLoader("Securing Order Engine...");
    let ss = 0, tpt = "", its = []; cart.forEach((i) => { const cp = Number(String(i.price || 0).replace(/[^0-9.,]/g, '')), q = parseInt(i.qty || 1); ss += (cp * q); its.push({ id: i.id, name: i.name, price: cp, qty: q, image: i.image || i.image1 }); }); tpt = calculateTotalPrepTime(cart);
    const ta = savedAddresses[selectedAddressIndex]; currentDeliveryFee = calculateDynamicDelivery(ss, ta.pincode, cart);
    const { discount: vd } = calculateCartDiscount(ss); let cd = activeCouponValue > 0 ? Math.round(ss * (activeCouponValue / 100)) : 0; const ft = ss - vd - cd + currentDeliveryFee; 
    const scc = (settings.countryCode || '+91'), fcp = scc + " " + ta.phone; let fa = `${ta.address_1}, ${ta.address_2 ? ta.address_2 + ', ' : ''}${ta.city}, ${ta.state} - ${ta.pincode}`;
    const cln = ta.first_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10); currentOrderReference = `TH_${cln}_${String(Date.now()).slice(-4)}`; 
    
    let ad = `ID: ${currentOrderReference} | Ph: ${fcp} | Patron: ${ta.first_name} ${ta.last_name || ''} | Email: ${ta.email} | Address: ${fa} | Purpose: ${t} | Notes: ${c} | Delivery Fee: ₹${currentDeliveryFee}`; 
    if(giftNote) ad += ` | Gift Message: "${giftNote}"`;
    if(activeCouponValue > 0) ad += ` | Coupon: ${activeCouponCode} (-₹${cd})`; 
    if(dims && document.getElementById('comm-dimensions-wrapper') && !document.getElementById('comm-dimensions-wrapper').classList.contains('hidden')) ad += ` | Size: ${dims}`; 
    ad += ` | Est. Prep: ${tpt}`;
    const fmt = Number(ft).toFixed(2), uId = (settings.upiId || "khushisj315@oksbi").trim(), uLnk = `upi://pay?pa=${uId}&pn=Twisted_Happiness&am=${fmt}&cu=INR&tn=${currentOrderReference}`;
    pendingOrderPayload = { order_details: JSON.stringify(its), subtotal: ss, discount: vd, total: ft, customer_reqs: ad, status: 'new', user_id: currentSessionUser ? currentSessionUser.id : null };
    setTimeout(() => { checkoutStep = 3; if(document.getElementById('checkout-payment-amount')) document.getElementById('checkout-payment-amount').textContent = `₹${fmt}`; const vb = document.getElementById('btn-confirm-payment'); if(vb) { vb.innerHTML = 'I Have Completed Payment <i class="fas fa-check-circle"></i>'; vb.disabled = false; } if (isMobileDevice()) { if(document.getElementById('payment-mobile-btn')) document.getElementById('payment-mobile-btn').href = uLnk; document.getElementById('payment-mobile-container')?.classList.remove('hidden'); document.getElementById('payment-qr-container')?.classList.add('hidden'); } else { const qrUrl = `https://quickchart.io/qr?size=250&margin=2&text=${encodeURIComponent(uLnk)}`; if(document.getElementById('payment-qr-img')) document.getElementById('payment-qr-img').src = qrUrl; document.getElementById('payment-qr-container')?.classList.remove('hidden'); document.getElementById('payment-mobile-container')?.classList.add('hidden'); } updateCheckoutUI(); document.getElementById('checkout-overlay')?.scrollTo({top: 0, behavior: 'smooth'}); hideInteractionLoader(); }, 1500); 
};

window.confirmPaymentAndOrder = async function() {
    if(!pendingOrderPayload) return; const b = document.getElementById('btn-confirm-payment'); if(b) { b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Securing Order...'; b.disabled = true; }
    
    const { error } = await _supabase.from('orders').insert([pendingOrderPayload]);
    
    if (error) { window.showToast("Error: " + error.message, "fa-times", "text-red-500"); if(b) { b.innerHTML = 'I Have Completed Payment <i class="fas fa-check-circle"></i>'; b.disabled = false; } return; }
    document.getElementById('payment-gateway-view')?.classList.add('hidden'); document.getElementById('payment-gateway-view')?.classList.remove('flex'); if(document.getElementById('success-ref-note')) document.getElementById('success-ref-note').textContent = currentOrderReference; document.getElementById('payment-success-view')?.classList.remove('hidden'); document.getElementById('payment-success-view')?.classList.add('flex');
    cart = []; localStorage.setItem('th_cart', JSON.stringify(cart)); updateCartCount(); 
};

// ==========================================
// 🚨 ORDER TRACKING LOGIC
// ==========================================
async function renderCustomerOrdersPipeline() {
    const c = document.getElementById('customer-orders-pipeline'); 
    if(!c || !currentSessionUser) return; 
    
    c.innerHTML = '<div class="text-center py-8 text-gray-400 text-[11px] font-medium"><i class="fas fa-spinner fa-spin mr-2"></i> Fetching your archive...</div>';
    
    try { 
        const { data } = await _supabase.from('orders').select('*').eq('user_id', currentSessionUser.id).order('created_at', { ascending: false }); 
        
        if(!data || data.length === 0) { 
            c.innerHTML = '<div class="text-center p-10 text-gray-400 text-[11px] uppercase tracking-widest"><i class="fas fa-box-open text-3xl block mb-3 opacity-30"></i> No commissions found.</div>'; 
            return; 
        } 
        
        let html = ''; 
        data.forEach(o => { 
            const dt = new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); 
            
            let step = 1;
            let statusText = "Verifying Payment";
            if (o.status === 'curating') { step = 2; statusText = "Artisan is Crafting"; }
            else if (o.status === 'ready') { step = 3; statusText = "Dispatched"; }
            else if (o.status === 'completed') { step = 4; statusText = "Delivered"; }
            else if (o.status === 'cancelled') { step = 0; statusText = "Cancelled / Denied"; }

            const idm = (o.customer_reqs || '').match(/ID:\s*([^|]+)/); 
            const exId = idm ? idm[1].trim() : 'TH_ORDER'; 

            let itemsHtml = '';
            try {
                const items = JSON.parse(o.order_details);
                items.forEach(i => { itemsHtml += `<img src="${i.image}" class="w-10 h-10 rounded-md object-cover border border-luxury-blush bg-luxury-bg shrink-0" title="${i.name} (x${i.qty})">`; });
            } catch(e) {}

            let progressBarHtml = '';
            if (step > 0) {
                progressBarHtml = `
                <div class="relative flex justify-between items-center w-full max-w-sm mx-auto mt-6 mb-2">
                    <div class="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-luxury-blush z-0 rounded-full"></div>
                    <div class="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-luxury-rose z-0 rounded-full transition-all duration-700" style="width: ${(step-1) * 33.33}%"></div>
                    <div class="relative z-10 flex flex-col items-center gap-2"><div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-luxury-rose text-white shadow-md border-2 border-white' : 'bg-white border-2 border-luxury-blush text-gray-300'}"><i class="fas fa-receipt"></i></div><span class="text-[7px] font-bold uppercase tracking-widest ${step >= 1 ? 'text-luxury-dark' : 'text-gray-400'} absolute -bottom-5 w-max">Placed</span></div>
                    <div class="relative z-10 flex flex-col items-center gap-2"><div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-luxury-rose text-white shadow-md border-2 border-white' : 'bg-white border-2 border-luxury-blush text-gray-300'}"><i class="fas fa-paint-brush"></i></div><span class="text-[7px] font-bold uppercase tracking-widest ${step >= 2 ? 'text-luxury-dark' : 'text-gray-400'} absolute -bottom-5 w-max">Crafting</span></div>
                    <div class="relative z-10 flex flex-col items-center gap-2"><div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-luxury-rose text-white shadow-md border-2 border-white' : 'bg-white border-2 border-luxury-blush text-gray-300'}"><i class="fas fa-box"></i></div><span class="text-[7px] font-bold uppercase tracking-widest ${step >= 3 ? 'text-luxury-dark' : 'text-gray-400'} absolute -bottom-5 w-max">Shipped</span></div>
                    <div class="relative z-10 flex flex-col items-center gap-2"><div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${step >= 4 ? 'bg-green-500 text-white shadow-md border-2 border-white' : 'bg-white border-2 border-luxury-blush text-gray-300'}"><i class="fas fa-check"></i></div><span class="text-[7px] font-bold uppercase tracking-widest ${step >= 4 ? 'text-green-600' : 'text-gray-400'} absolute -bottom-5 w-max">Delivered</span></div>
                </div>`;
            } else {
                progressBarHtml = `<div class="text-center text-red-500 font-bold text-[9px] uppercase tracking-widest py-3">Order Cancelled</div>`;
            }

            html += `
            <details class="bg-white border border-luxury-blush rounded-2xl shadow-sm group overflow-hidden cursor-pointer mb-3">
                <summary class="p-4 sm:p-5 list-none flex flex-col sm:flex-row justify-between sm:items-center gap-4 outline-none">
                    <div class="flex flex-col">
                        <span class="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-1">Order ${exId}</span>
                        <h4 class="font-poppins font-bold ${step === 0 ? 'text-red-500' : 'text-luxury-dark'} text-sm mb-1">${statusText}</h4>
                        <p class="text-gray-400 text-[10px]">${dt} • <span class="font-bold text-luxury-dark">₹${o.total}</span></p>
                    </div>
                    <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                        <div class="flex gap-2 overflow-x-auto max-w-[150px] scrollbar-hide py-1">${itemsHtml}</div>
                        <i class="fas fa-chevron-down text-gray-300 transition-transform group-open:rotate-180"></i>
                    </div>
                </summary>
                <div class="p-4 sm:p-5 pt-0 border-t border-luxury-blush mt-2 bg-luxury-bg/50">
                    ${progressBarHtml}
                    <div class="mt-6 bg-white border border-luxury-blush p-3 rounded-xl text-[10px] text-gray-500 whitespace-pre-wrap font-medium">
                        <p class="font-bold text-luxury-dark mb-1 uppercase tracking-widest text-[8px]">Request Details</p>
                        ${o.customer_reqs}
                    </div>
                </div>
            </details>`; 
        }); 
        c.innerHTML = html; 
    } catch(err) { 
        c.innerHTML = '<div class="text-center text-red-500 py-4 text-xs">Failed to load archive.</div>'; 
    }
}

window.openTrackOrderModal = function() { document.getElementById('track-order-id-guest').value = ''; document.getElementById('track-result-container-guest').classList.add('hidden'); window.openPolicyModal('track-order-modal', 'track-order-box'); };
window.closeTrackOrderModal = function() { window.closePolicyModal('track-order-modal', 'track-order-box'); };

async function handleTrackOrder(e) {
    e.preventDefault(); const oid = document.getElementById('track-order-id').value.trim(); if(!oid) return; const b = document.getElementById('btn-track-submit'); const oTxt = b.innerHTML; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...'; b.disabled = true;
    try { const { data, error } = await _supabase.from('orders').select('status').ilike('customer_reqs', `%${oid}%`).limit(1); if (error) throw error; const rc = document.getElementById('track-result-container'), rs = document.getElementById('track-result-status'), rd = document.getElementById('track-result-desc'); if(data && data.length > 0) { const s = data[0].status; rc.classList.remove('hidden'); if(s === 'new' || s === 'pending') { rs.textContent = "Verifying Payment"; rs.className = "font-poppins font-bold text-yellow-600 text-lg tracking-wide mb-2"; rd.textContent = "We have received your request and are verifying the transaction with our bank. We will begin crafting shortly!"; } else if (s === 'curating') { rs.textContent = "Artisan is Crafting"; rs.className = "font-poppins font-bold text-luxury-gold text-lg tracking-wide mb-2"; rd.textContent = "Your payment is verified and our artisan is currently pouring love into your handcrafted piece."; } else if (s === 'ready') { rs.textContent = "Ready for Dispatch"; rs.className = "font-poppins font-bold text-purple-600 text-lg tracking-wide mb-2"; rd.textContent = "Your masterpiece is complete, securely packaged, and awaiting courier pickup."; } else if (s === 'completed') { rs.textContent = "Elegantly Delivered"; rs.className = "font-poppins font-bold text-green-600 text-lg tracking-wide mb-2"; rd.textContent = "Your order has been successfully delivered. Thank you for curating your space!"; } } else { rc.classList.remove('hidden'); rs.textContent = "Not Found"; rs.className = "font-poppins font-bold text-red-500 text-lg tracking-wide mb-2"; rd.textContent = "We couldn't find an active order with that reference ID."; } } catch(err) { window.showToast("Network Error", "fa-times", "text-red-500"); } b.innerHTML = oTxt; b.disabled = false;
}

async function handleTrackOrderGuest(e) {
    e.preventDefault(); const oid = document.getElementById('track-order-id-guest').value.trim(); if(!oid) return; const b = document.getElementById('btn-track-submit-guest'); const oTxt = b.innerHTML; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...'; b.disabled = true;
    try { const { data, error } = await _supabase.from('orders').select('status').ilike('customer_reqs', `%${oid}%`).limit(1); if (error) throw error; const rc = document.getElementById('track-result-container-guest'), rs = document.getElementById('track-result-status-guest'), rd = document.getElementById('track-result-desc-guest'); if(data && data.length > 0) { const s = data[0].status; rc.classList.remove('hidden'); if(s === 'new' || s === 'pending') { rs.textContent = "Verifying Payment"; rs.className = "font-poppins font-bold text-yellow-600 text-lg tracking-wide mb-2"; rd.textContent = "We have received your request and are verifying the transaction with our bank. We will begin crafting shortly!"; } else if (s === 'curating') { rs.textContent = "Artisan is Crafting"; rs.className = "font-poppins font-bold text-luxury-gold text-lg tracking-wide mb-2"; rd.textContent = "Your payment is verified and our artisan is currently pouring love into your handcrafted piece."; } else if (s === 'ready') { rs.textContent = "Ready for Dispatch"; rs.className = "font-poppins font-bold text-purple-600 text-lg tracking-wide mb-2"; rd.textContent = "Your masterpiece is complete, securely packaged, and awaiting courier pickup."; } else if (s === 'completed') { rs.textContent = "Elegantly Delivered"; rs.className = "font-poppins font-bold text-green-600 text-lg tracking-wide mb-2"; rd.textContent = "Your order has been successfully delivered. Thank you for curating your space!"; } } else { rc.classList.remove('hidden'); rs.textContent = "Not Found"; rs.className = "font-poppins font-bold text-red-500 text-lg tracking-wide mb-2"; rd.textContent = "We couldn't find an active order with that reference ID."; } } catch(err) { window.showToast("Network Error", "fa-times", "text-red-500"); } b.innerHTML = oTxt; b.disabled = false;
}

// ==========================================
// 🚨 CACHED UI NAVIGATION (Lightbox / Carousel)
// ==========================================
window.openLightboxFromCarousel = function() { currentLightboxIndex = currentSlideIndex; const lb = document.getElementById('lightbox-modal'); const tr = document.getElementById('lightbox-track'); if(!lb || !tr) return; tr.innerHTML = ''; modalImages.forEach((src) => { tr.innerHTML += `<div class="w-full h-full flex-shrink-0 flex items-center justify-center p-2 md:p-8"><img loading="lazy" decoding="async" src="${src}" class="w-full max-h-full object-contain"></div>`; }); tr.style.transition = 'none'; tr.style.transform = `translateX(-${currentLightboxIndex * 100}%)`; document.getElementById('lightbox-counter').textContent = `${currentLightboxIndex + 1} / ${modalImages.length}`; currentModalLevel = 2; window.safePushState(2); lb.classList.remove('hidden'); requestAnimationFrame(() => { lb.classList.remove('opacity-0'); }); setupLightboxTouch(); };
window.forceCloseLightbox = function() { const lb = document.getElementById('lightbox-modal'); if(!lb) return; requestAnimationFrame(() => { lb.classList.add('opacity-0'); setTimeout(() => { lb.classList.add('hidden'); }, 200); }); };
window.moveLightboxSlide = function(dir) { if (isLightboxAnimating) return; isLightboxAnimating = true; currentLightboxIndex += dir; if (currentLightboxIndex < 0) currentLightboxIndex = modalImages.length - 1; if (currentLightboxIndex >= modalImages.length) currentLightboxIndex = 0; const tr = document.getElementById('lightbox-track'); if(!tr) return; requestAnimationFrame(() => { tr.style.transition = 'transform 0.4s ease-out'; tr.style.transform = `translateX(-${currentLightboxIndex * 100}%)`; }); document.getElementById('lightbox-counter').textContent = `${currentLightboxIndex + 1} / ${modalImages.length}`; setTimeout(() => { isLightboxAnimating = false; }, 400); };
function moveSlide(dir) { if (isAnimating) return; isAnimating = true; currentSlideIndex += dir; if (currentSlideIndex < 0) currentSlideIndex = modalImages.length - 1; if (currentSlideIndex >= modalImages.length) currentSlideIndex = 0; const tr = document.getElementById('modal-carousel-track'); if(!tr) return; requestAnimationFrame(() => { tr.style.transition = 'transform 0.4s ease-out'; tr.style.transform = `translateX(-${currentSlideIndex * 100}%)`; }); updateActiveThumb(currentSlideIndex, modalImages.length); setTimeout(() => { isAnimating = false; }, 400); }
window.goToSlide = function(idx) { if (isAnimating || idx === currentSlideIndex) return; isAnimating = true; currentSlideIndex = idx; const tr = document.getElementById('modal-carousel-track'); if(!tr) return; requestAnimationFrame(() => { tr.style.transition = 'transform 0.4s ease-out'; tr.style.transform = `translateX(-${currentSlideIndex * 100}%)`; }); updateActiveThumb(currentSlideIndex, modalImages.length); setTimeout(() => { isAnimating = false; }, 400); };
function setupTouchCarousel() { let sX = 0, eX = 0; const tr = document.getElementById('modal-carousel-track'); if(tr) { tr.replaceWith(tr.cloneNode(true)); const nt = document.getElementById('modal-carousel-track'); nt.addEventListener('touchstart', (e) => { sX = e.changedTouches[0].screenX; }, {passive: true}); nt.addEventListener('touchend', (e) => { eX = e.changedTouches[0].screenX; requestAnimationFrame(() => { if (eX < sX - 30) moveSlide(1); else if (eX > sX + 30) moveSlide(-1); }); }, {passive: true}); } }
function setupLightboxTouch() { let lsX = 0, leX = 0; const tr = document.getElementById('lightbox-track'); if(tr) { tr.replaceWith(tr.cloneNode(true)); const nt = document.getElementById('lightbox-track'); nt.addEventListener('touchstart', (e) => { lsX = e.changedTouches[0].screenX; }, {passive: true}); nt.addEventListener('touchend', (e) => { leX = e.changedTouches[0].screenX; requestAnimationFrame(() => { if (leX < lsX - 30) window.moveLightboxSlide(1); else if (leX > lsX + 30) window.moveLightboxSlide(-1); }); }, {passive: true}); } }
function updateActiveThumb(aIdx, tot) { requestAnimationFrame(() => { for(let i = 0; i < tot; i++) { const th = document.getElementById(`thumb-${i}`); if(th) { if(i === aIdx) { th.classList.add('border-luxury-rose', 'scale-105', 'opacity-100'); th.classList.remove('border-transparent', 'opacity-60'); } else { th.classList.remove('border-luxury-rose', 'scale-105', 'opacity-100'); th.classList.add('border-transparent', 'opacity-60'); } } } }); }

// ==========================================
// 🚨 SEARCH, SORT & FILTER
// ==========================================
function syncSearch(val) { currentSearchQuery = val; if(document.getElementById('searchInputDesk') && document.getElementById('searchInputDesk').value !== val) document.getElementById('searchInputDesk').value = val; if(document.getElementById('searchInputMob') && document.getElementById('searchInputMob').value !== val) document.getElementById('searchInputMob').value = val; clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { requestAnimationFrame(() => renderProducts(val)); }, 250); }
function setSortMode(val) { currentSortMode = val; if(document.getElementById('sortInputDesk')) document.getElementById('sortInputDesk').value = val; if(document.getElementById('sortInputMob')) document.getElementById('sortInputMob').value = val; renderProducts(currentSearchQuery); }
function filterMainCategory(cat) { currentMainCategory = cat; activeSubCategories = []; renderFilters(); renderProducts(currentSearchQuery); }
function filterSubCategory(cat) { activeSubCategories = cat === 'All' ? [] : [cat]; renderFilters(); renderProducts(currentSearchQuery); }

function renderFilters() {
    const mc = document.getElementById('main-category-filters'); const mCats = ['All', 'Pipe Cleaner Crafts', 'Canvas Paintings', 'Clay Art Paintings'];
    if(mc) { mc.innerHTML = ''; mCats.forEach(c => { const btn = document.createElement('button'); btn.className = `text-[9px] sm:text-[10px] font-bold uppercase tracking-widest whitespace-nowrap px-4 py-2.5 border-b-[2px] transition-colors ${currentMainCategory === c ? 'text-luxury-rose border-luxury-rose' : 'text-gray-400 border-transparent hover:text-luxury-dark'}`; btn.textContent = c; btn.onclick = () => filterMainCategory(c); mc.appendChild(btn); }); }
    let subs = []; if(currentMainCategory === 'All') { subs = [...new Set(products.map(p => p.category).filter(c => c))]; } else { subs = [...new Set(products.filter(p => p.mainCategory === currentMainCategory).map(p => p.category).filter(c => c))]; } activeSubCategories = activeSubCategories.filter(c => subs.includes(c));
    const scm = document.getElementById('sub-category-filters-mob'); if(scm) { let hMob = `<option value="All">All Sub-Categories</option>`; subs.forEach(c => { const isS = activeSubCategories.length === 1 && activeSubCategories[0] === c; hMob += `<option value="${c}" ${isS ? 'selected' : ''}>${c}</option>`; }); scm.innerHTML = hMob; }
    const scd = document.getElementById('desktop-checkbox-filters'); if(scd) { let hDesk = ''; subs.forEach(c => { const isC = activeSubCategories.includes(c); hDesk += `<label class="flex items-center gap-3 cursor-pointer group w-full p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-luxury-blush"><div class="relative flex items-center justify-center w-[14px] h-[14px] rounded border border-luxury-rose/50 bg-white group-hover:border-luxury-rose transition-colors shrink-0 overflow-hidden shadow-sm"><input type="checkbox" value="${c}" class="peer sr-only" onchange="window.th_toggleSubCategory('${c}')" ${isC ? 'checked' : ''}><div class="absolute inset-0 bg-luxury-rose scale-0 peer-checked:scale-100 transition-transform duration-300 origin-center"></div><i class="fas fa-check text-[7px] text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 absolute z-10"></i></div><span class="text-[10px] font-bold text-luxury-dark tracking-[0.1em] transition-colors truncate uppercase ${isC ? 'text-luxury-rose' : ''}">${c}</span></label>`; }); scd.innerHTML = hDesk || `<p class="text-[9px] text-gray-400 italic px-2 pt-2">No sub-categories</p>`; }
}

// ==========================================
// 🚨 SMART ADDRESS AUTO-FILL
// ==========================================
let pincodeTimeout;

function handlePincodeInput(e) {
    // 1. Trigger the delivery fee UI update immediately
    if (document.getElementById('checkout-overlay') && !document.getElementById('checkout-overlay').classList.contains('hidden')) {
        updateCheckoutUI();
    }

    const pin = e.target.value.trim();
    
    // Only process if it's exactly 6 digits
    if (pin.length === 6 && /^\d+$/.test(pin)) {
        clearTimeout(pincodeTimeout);
        pincodeTimeout = setTimeout(() => fetchCityStateFromPin(pin), 400);
    } else {
        // Clear fields if the pincode is altered or invalid
        document.getElementById('prof-city').value = '';
        document.getElementById('prof-state').value = '';
    }
}

async function fetchCityStateFromPin(pincode) {
    const loader = document.getElementById('pin-loader');
    const cityInput = document.getElementById('prof-city');
    const stateInput = document.getElementById('prof-state');

    if (loader) loader.classList.remove('hidden');

    try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await response.json();

        if (data && data[0].Status === "Success") {
            // Extract the first PostOffice details
            const postOffice = data[0].PostOffice[0];
            
            cityInput.value = postOffice.District || postOffice.Region;
            stateInput.value = postOffice.State;
            
            // Visual feedback for auto-fill
            cityInput.classList.add('bg-green-50', 'border-green-200');
            stateInput.classList.add('bg-green-50', 'border-green-200');
            
            setTimeout(() => {
                cityInput.classList.remove('bg-green-50', 'border-green-200');
                stateInput.classList.remove('bg-green-50', 'border-green-200');
            }, 1500);

        } else {
            window.showToast("Invalid Pincode entered.", "fa-exclamation-circle", "text-red-500");
            cityInput.value = '';
            stateInput.value = '';
        }
    } catch (error) {
        console.error("Postal API Error:", error);
        window.showToast("Network error while fetching location.", "fa-wifi", "text-yellow-500");
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

// ==========================================
// 🚨 SMART CART UPSELL LOGIC
// ==========================================
function renderCartUpsells() {
    const uc = document.getElementById('cart-upsell-container');
    if (!uc) return;

    if (cart.length === 0) {
        uc.classList.add('hidden');
        return;
    }

    // 1. Gather IDs currently in the cart to avoid suggesting them
    const cartIds = cart.map(i => String(i.id));

    // 2. Prioritize suggesting lower-cost/giftable items like 'Pipe Cleaner Crafts'
    let upsells = products.filter(p => !cartIds.includes(String(p.id)) && p.mainCategory === 'Pipe Cleaner Crafts');
    
    // 3. Fallback: If no Pipe Cleaners are left, suggest the cheapest available product not in cart
    if (upsells.length === 0) {
        upsells = products.filter(p => !cartIds.includes(String(p.id))).sort((a, b) => a.price - b.price);
    }

    // 4. Hide if nothing left to suggest
    if (upsells.length === 0) {
        uc.classList.add('hidden');
        return;
    }

    // 5. Select the top recommendation
    const suggestion = upsells[0];
    const img = (typeof suggestion.image1 === 'string' && suggestion.image1.trim() !== '') ? suggestion.image1 : 'https://placehold.co/150/F8E9EA/423133';

    uc.innerHTML = `
        <div class="bg-gradient-to-r from-luxury-blush/30 to-transparent border border-luxury-blush rounded-2xl p-4 sm:p-5 shadow-sm flex items-center justify-between gap-4">
            <div class="flex items-center gap-4 cursor-pointer" onclick="window.openProductPage('${suggestion.id}')">
                <img src="${img}" class="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-xl border border-luxury-blush shadow-sm bg-luxury-bg shrink-0">
                <div class="flex flex-col">
                    <span class="text-[8px] sm:text-[9px] font-bold text-luxury-rose uppercase tracking-widest mb-0.5"><i class="fas fa-sparkles"></i> Perfect Pairing</span>
                    <h4 class="font-bitter font-semibold text-[12px] sm:text-[14px] text-luxury-dark leading-tight line-clamp-1">${suggestion.name}</h4>
                    <span class="font-poppins font-bold text-[11px] sm:text-[13px] text-luxury-dark mt-1">₹${suggestion.price}</span>
                </div>
            </div>
            <button type="button" onclick="window.th_updateCartQty('${suggestion.id}', 1, event)" class="shrink-0 bg-white border border-luxury-dark text-luxury-dark hover:bg-luxury-dark hover:text-white font-bold px-4 py-2.5 rounded-full text-[9px] uppercase tracking-widest transition-colors shadow-sm">
                Add
            </button>
        </div>
    `;
    uc.classList.remove('hidden');
}

window.th_submitReview = async function(pid, rating, comment) {
    if(!currentSessionUser) return window.openCustomerAuthModal();
    
    // Check if the user has a completed order containing this product_id
    const { data: verified } = await _supabase.from('orders')
        .select('id')
        .eq('user_id', currentSessionUser.id)
        .eq('status', 'completed')
        .ilike('order_details', `%${pid}%`);

    if (!verified || verified.length === 0) {
        return window.showToast("Only verified buyers can review", "fa-lock", "text-red-500");
    }

    const { error } = await _supabase.from('reviews').insert([{
        product_id: pid,
        user_id: currentSessionUser.id,
        rating: rating,
        comment: comment
    }]);

    if(error) window.showToast("Failed to post review", "fa-times", "text-red-500");
    else window.showToast("Review Posted!", "fa-star", "text-luxury-gold");
};

// ==========================================
// 🚨 VISUAL CUSTOMIZER STUDIO
// ==========================================
function renderVisualCustomizer(product) {
    const vc = document.getElementById('visual-customizer-studio');
    if (!vc) return;

    const isBouquet = product.name.toLowerCase().includes('bouquet');
    if (product.mainCategory !== 'Pipe Cleaner Crafts' || !isBouquet) {
        vc.classList.add('hidden');
        return;
    }

    const flowerOptions = ['Crimson Rose', 'Blush Peony', 'Ivory Lily', 'Golden Sunflower', 'Lilac Tulip', 'Blue Hydrangea', 'Sunset Carnation', 'Classic Daisy'];
    const fillerOptions = ['Baby\'s Breath', 'Eucalyptus Leaves', 'Lavender Sprigs', 'Golden Fern', 'Pearl Branches'];
    const wrapOptions = ['Vintage Kraft', 'Midnight Matte', 'Frosted Pearl', 'Blushing Silk', 'Holographic Clear'];
    const ribbonOptions = ['Satin Bow', 'Lace Ribbon', 'Rustic Twine', 'Velvet Ribbon'];

    const generateChips = (options, activeArrayOrString, toggleFunc, isMulti) => {
        return options.map(opt => {
            const isSelected = isMulti ? activeArrayOrString.includes(opt) : activeArrayOrString === opt;
            const activeClass = isMulti ? 'bg-luxury-rose text-white border-luxury-rose shadow-sm' : 'bg-luxury-dark text-white border-luxury-dark shadow-sm';
            const inactiveClass = isMulti ? 'bg-white text-gray-500 border-luxury-blush hover:border-luxury-rose' : 'bg-white text-gray-500 border-luxury-blush hover:border-luxury-dark';
            return `<button type="button" onclick="window.${toggleFunc}('${opt.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${isSelected ? activeClass : inactiveClass}">${opt}</button>`;
        }).join('');
    };

    vc.innerHTML = `
        <h4 class="font-bold text-[11px] uppercase tracking-widest text-luxury-dark mb-4 border-b border-luxury-blush pb-2"><i class="fas fa-magic text-luxury-rose mr-1"></i> Custom Bouquet Studio</h4>
        
        <div class="mb-5">
            <span class="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">1. Primary Flowers (Select multiple)</span>
            <div class="flex flex-wrap gap-2">${generateChips(flowerOptions, activeBuild.flowers, 'th_toggleBuildArray("flowers", ', true)}</div>
        </div>
        
        <div class="mb-5">
            <span class="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">2. Filler Foliage (Select multiple)</span>
            <div class="flex flex-wrap gap-2">${generateChips(fillerOptions, activeBuild.fillers, 'th_toggleBuildArray("fillers", ', true)}</div>
        </div>
        
        <div class="mb-5">
            <span class="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">3. Wrapping Style</span>
            <div class="flex flex-wrap gap-2">${generateChips(wrapOptions, activeBuild.wrapping, 'th_setBuildString("wrapping", ', false)}</div>
        </div>
        
        <div>
            <span class="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">4. Ribbon Accent</span>
            <div class="flex flex-wrap gap-2">${generateChips(ribbonOptions, activeBuild.ribbon, 'th_setBuildString("ribbon", ', false)}</div>
        </div>
    `;
    vc.classList.remove('hidden');
}

window.th_toggleBuildArray = function(category, value) {
    const idx = activeBuild[category].indexOf(value);
    if (idx > -1) activeBuild[category].splice(idx, 1);
    else activeBuild[category].push(value);
    const p = products.find(x => x.id == document.getElementById('product-view').getAttribute('data-current-id'));
    if(p) renderVisualCustomizer(p);
};

window.th_setBuildString = function(category, value) {
    activeBuild[category] = value;
    const p = products.find(x => x.id == document.getElementById('product-view').getAttribute('data-current-id'));
    if(p) renderVisualCustomizer(p);
};

window.th_toggleSubCategory = function(cat) { const idx = activeSubCategories.indexOf(cat); if(idx > -1) { activeSubCategories.splice(idx, 1); } else { activeSubCategories.push(cat); } renderFilters(); renderProducts(currentSearchQuery); };

window.openPolicyModal = function(mId, bId) { currentModalLevel = 2; window.safePushState(2); const mod = document.getElementById(mId); const bx = document.getElementById(bId); if(!mod || !bx) return; mod.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); requestAnimationFrame(() => { mod.classList.remove('opacity-0'); bx.classList.remove('scale-95', 'translate-y-2'); bx.classList.add('scale-100', 'translate-y-0'); }); };
window.closePolicyModal = function(mId, bId) { const mod = document.getElementById(mId); const bx = document.getElementById(bId); if(!mod || !bx) return; requestAnimationFrame(() => { mod.classList.add('opacity-0'); bx.classList.remove('scale-100', 'translate-y-0'); bx.classList.add('scale-95', 'translate-y-2'); setTimeout(() => { mod.classList.add('hidden'); if(document.getElementById('checkout-overlay')?.classList.contains('hidden')) { document.body.classList.remove('overflow-hidden'); } }, 200); }); };


// --- END OF FILE ---