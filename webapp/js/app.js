/**
 * Twisted Happiness - Core Storefront Engine
 * Version: 16.5.0 - Fully Repaired & Hardened
 */

const SUPABASE_URL = "https://gvrfucjtnyqfkdynrmqs.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_8jru2BqvTdE9bcwNOLIHAA_dx6aUCM0";
let _supabase;

// DISCOUNT_TIERS removed. Now dynamically fetched from the Admin Premium Discount Engine.

function safeJSONParse(key, fallback) { 
    try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : fallback; } 
    catch (e) { localStorage.removeItem(key); return fallback; } 
}

let settings = safeJSONParse('th_settings', { storeName: "Twisted Happiness", instagram: "https://www.instagram.com/khushiified_art?igsh=aW1vZ2N4cTl2OWo=", whatsapp: "9909310501", upiId: "khushisj315@oksbi", countryCode: "+91" });
window.settings = settings; // Exposes settings to inline HTML scripts
let cart = safeJSONParse('th_cart', []); 
let localWishlist = safeJSONParse('th_wishlist', []);
let savedAddresses = safeJSONParse('th_saved_addresses', []);

let products = []; let currentMainCategory = 'All'; let activeSubCategories = []; let currentSortMode = 'random'; let currentSearchQuery = ''; 
let searchTimeout = null; let modalImages = []; let currentSlideIndex = 0; let isAnimating = false; let currentLightboxIndex = 0; let isLightboxAnimating = false; let currentModalLevel = 0; let statePushed = false;
let checkoutStep = 1; let pendingOrderPayload = null; window.buyNowPayload = null; let currentOrderReference = null; let currentDeliveryFee = 0; let activeCouponValue = 0; let activeCouponCode = "";
let paymentMethod = 'upi'; let currentUpiDiscount = 0;

window.setPaymentMethod = function(method) {
    paymentMethod = method;
    
    // Update UI Buttons securely
    const btnUpi = document.getElementById('btn-pay-upi');
    const btnCod = document.getElementById('btn-pay-cod');
    const upiContainer = document.getElementById('upi-details-container');
    const codContainer = document.getElementById('cod-details-container');
    const btnConfirm = document.getElementById('btn-confirm-payment');

    const activeClass = "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all bg-white border border-luxury-rose text-luxury-rose shadow-sm";
    const inactiveClass = "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all bg-transparent border border-transparent text-gray-500 hover:text-luxury-dark";

    if (method === 'cod') {
        if(btnCod) btnCod.className = activeClass;
        if(btnUpi) btnUpi.className = inactiveClass;
        if(upiContainer) { upiContainer.classList.add('hidden'); upiContainer.classList.remove('flex'); }
        if(codContainer) { codContainer.classList.remove('hidden'); codContainer.classList.add('flex'); }
        if(btnConfirm) btnConfirm.innerHTML = 'Confirm COD Order <i class="fas fa-box"></i>';
    } else {
        if(btnUpi) btnUpi.className = activeClass;
        if(btnCod) btnCod.className = inactiveClass;
        if(codContainer) { codContainer.classList.add('hidden'); codContainer.classList.remove('flex'); }
        if(upiContainer) { upiContainer.classList.remove('hidden'); upiContainer.classList.add('flex'); }
        if(btnConfirm) btnConfirm.innerHTML = 'I Have Completed Payment <i class="fas fa-check-circle"></i>';
    }
    
    // Force backend-authoritative math recalculation (removes UPI discount for COD)
    updateCheckoutUI(); 
    if (checkoutStep === 3) window.preparePaymentGateway();
};
let selectedAddressIndex = savedAddresses.length > 0 ? 0 : -1; let editingAddressIndex = null; let currentSessionUser = null; let authModalMode = "login"; 
// Bouquet builder removed 

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
        const { data, error } = await _supabase.rpc('get_public_config');
        if(data && !error) {
            const cloud = data;
            // We stringify public_offers back into promoCodes so the UI's VIP logic works natively, but coupons are completely omitted!
            settings = { 
                promoText: cloud.promo_text, 
                promoCodes: JSON.stringify(cloud.public_offers || []), 
                storeName: cloud.store_name, 
                instagram: cloud.instagram_url, 
                whatsapp: cloud.whatsapp_num, 
                upiId: cloud.upi_id, 
                countryCode: cloud.country_code || "+91" 
            };
            localStorage.setItem('th_settings', JSON.stringify(settings));
            window.settings = settings; 
        }
    } catch(e) { console.warn("Local storage fallback active", e); }
    applyDynamicSettings(); bindDOMEvents(); injectSkeletons(); fetchDatabase(); setupSocialLinks();
}

function applyDynamicSettings() {
    const name = "Twisted Happiness";
    document.title = `${name} | Fine Art & Handcrafted Gifts`;
    ['dynamic-store-name', 'footer-dynamic-name', 'preloader-brand'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).textContent = name;
    });
    if(document.getElementById('current-year')) document.getElementById('current-year').textContent = new Date().getFullYear();

    const basePromo = "✨ 100% Handcrafted Fine Art & Gifts 🎀 Bespoke Canvas & Textured Clay Paintings 🌸 Unlock VIP Discounts Up To 15% Off 🦋";
    let dynamicPromo = "";
    if (settings.promoText) {
        try {
            const parsed = JSON.parse(settings.promoText);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].trim() !== "") {
                dynamicPromo = ' 🌸 ' + parsed.join(' 🌸 ') + ' 🦋 ';
            }
        } catch(e) { }
    }
    
    const combinedPromo = basePromo + dynamicPromo;
    const seamlessText = `${combinedPromo} &nbsp; &nbsp; ${combinedPromo} &nbsp; &nbsp; ${combinedPromo}`;
    if(document.getElementById('promo-marquee-1')) document.getElementById('promo-marquee-1').innerHTML = `<div class="animate-marquee">${seamlessText}</div>`;
    if(document.getElementById('promo-marquee-2')) document.getElementById('promo-marquee-2').innerHTML = `<div class="animate-marquee">${seamlessText}</div>`;
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

function bindDOMEvents() {
    // 🎀 Emotional "Leaving" Prompt
    window.addEventListener('beforeunload', function (e) {
        if (cart.length > 0 || window.buyNowPayload) {
            const msg = "Wait! Are you sure you want to leave me behind with your beautiful cart? 🥺🎀";
            e.preventDefault();
            e.returnValue = msg;
            return msg;
        }
    });
    
    // 📱 Native Mobile Hardware Back Button Handling
    window.addEventListener('popstate', (e) => {
        const level = e.state ? e.state.level : 0;
        
        if (level < 2) {
            if(window.forceCloseLightbox) window.forceCloseLightbox();
            window.closePolicyModal('return-policy-modal', 'return-policy-box');
            window.closePolicyModal('privacy-policy-modal', 'privacy-policy-box');
            window.closePolicyModal('offers-modal', 'offers-box');
            window.closePolicyModal('review-modal', 'review-box');
            if(window.closeCustomerAuthModal) window.closeCustomerAuthModal();
            if(window.closeTrackOrderModal) window.closeTrackOrderModal();
        }
        
        if (level < 1) {
            window.closeProductPage();
            
            const chk = document.getElementById('checkout-overlay');
            if (chk && !chk.classList.contains('hidden')) { chk.classList.remove('opacity-100'); chk.classList.add('opacity-0'); setTimeout(() => { chk.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }, 300); }
            
            const prof = document.getElementById('customer-profile-overlay');
            if (prof && !prof.classList.contains('hidden')) { prof.classList.remove('opacity-100'); prof.classList.add('opacity-0'); setTimeout(() => { prof.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }, 300); }
        }
    });

    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); window.location.href = '/admin.html'; } });
    document.getElementById('prof-pin')?.addEventListener('input', handlePincodeInput);
    
    // Quick enter key submission
    document.getElementById('searchInputDesk')?.addEventListener('keypress', (e) => { if(e.key === 'Enter') e.target.blur(); });
    document.getElementById('searchInputMob')?.addEventListener('keypress', (e) => { if(e.key === 'Enter') e.target.blur(); });
    document.getElementById('checkout-promo-input')?.addEventListener('keypress', (e) => { if(e.key === 'Enter') { e.preventDefault(); window.applyCouponCode(); } });
    
    document.getElementById('searchInputDesk')?.addEventListener('input', (e) => syncSearch(e.target.value));
    document.getElementById('searchInputMob')?.addEventListener('input', (e) => syncSearch(e.target.value));
    document.getElementById('sortInputMob')?.addEventListener('change', (e) => setSortMode(e.target.value));
    document.getElementById('sortInputDesk')?.addEventListener('change', (e) => setSortMode(e.target.value));
    document.getElementById('sub-category-filters-mob')?.addEventListener('change', (e) => filterSubCategory(e.target.value));
    document.getElementById('track-order-form-guest')?.addEventListener('submit', handleTrackOrderGuest);
    document.getElementById('customer-auth-form')?.addEventListener('submit', handleAuthFormSubmit);
    setupTouchCarousel(); setupLightboxTouch();
}

async function setupAuthSessionListener() {
    const { data: { session } } = await _supabase.auth.getSession();
    currentSessionUser = session ? session.user : null;
    updateHeaderAvatar();
    if (currentSessionUser) syncCloudWishlist();

    // Heartbeat: Automatically refresh the user token in the background so they don't get logged out!
    setInterval(async () => { if(currentSessionUser) await _supabase.auth.getSession(); }, 5 * 60 * 1000);

    _supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') { currentSessionUser = null; savedAddresses = []; }
        else { currentSessionUser = session ? session.user : null; }
        
        updateHeaderAvatar();
        if (currentSessionUser) {
            syncCloudWishlist();
            if (document.getElementById('checkout-overlay') && !document.getElementById('checkout-overlay').classList.contains('hidden')) syncCloudAddresses();
        }
    });
}

function updateHeaderAvatar() {
    const btn = document.getElementById('header-account-btn');
    if (btn) {
        const avatarUrl = currentSessionUser?.user_metadata?.avatar_url || currentSessionUser?.user_metadata?.picture || 'https://i.ibb.co/0RRrFK9N/TH-logo-1.png';
        btn.innerHTML = currentSessionUser ? `<img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover border-2 border-luxury-rose shadow-sm">` : `<i class="far fa-user text-lg"></i>`;
    }
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
    const avatarUrl = meta.avatar_url || meta.picture || 'https://i.ibb.co/0RRrFK9N/TH-logo-1.png';
    const fullName = meta.full_name || 'Esteemed Patron';
    
    if(document.getElementById('profile-avatar')) document.getElementById('profile-avatar').src = avatarUrl;
    if(document.getElementById('profile-meta-name')) document.getElementById('profile-meta-name').textContent = fullName;
    if(document.getElementById('profile-meta-email')) document.getElementById('profile-meta-email').textContent = currentSessionUser.email;
    if(document.getElementById('profile-edit-name')) document.getElementById('profile-edit-name').value = fullName !== 'Esteemed Patron' ? fullName : '';
    
    o.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); 
    
    if(window.th_switchProfileTab) window.th_switchProfileTab('orders');

    await syncCloudAddresses();
    renderProfileAddressBook();
    renderCustomerOrdersPipeline(); 
    
    requestAnimationFrame(() => { o.classList.remove('opacity-0'); o.classList.add('opacity-100'); }); 
};

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



window.th_editProfileAddress = function(i) {
    editingAddressIndex = i; const a = savedAddresses[i];
    document.getElementById('padd-fname').value = a.first_name || ''; document.getElementById('padd-lname').value = a.last_name || ''; document.getElementById('padd-phone').value = a.phone || ''; document.getElementById('padd-add1').value = a.address_1 || ''; document.getElementById('padd-add2').value = a.address_2 || ''; document.getElementById('padd-city').value = a.city || ''; document.getElementById('padd-state').value = a.state || ''; document.getElementById('padd-pin').value = a.pincode || ''; 
    document.getElementById('profile-add-address-form').classList.remove('hidden');
    document.getElementById('pcontent-addresses').scrollTo({top: document.getElementById('pcontent-addresses').scrollHeight, behavior: 'smooth'});
};

function renderProfileAddressBook() {
    const container = document.getElementById('profile-address-list');
    if (!container) return;
    
    let html = '';
    if (savedAddresses.length === 0) {
        html += '<p class="text-[11px] text-gray-500 font-medium bg-white p-4 rounded-xl border border-luxury-blush">No addresses saved yet.</p>';
    } else {
        savedAddresses.forEach((a, i) => { 
            html += `
            <div class="bg-white border border-luxury-blush rounded-xl p-4 shadow-sm flex justify-between items-center mb-3">
                <div>
                    <p class="font-bold text-luxury-dark text-[11px] uppercase tracking-wider mb-1">${a.first_name} ${a.last_name || ''}</p>
                    <p class="text-gray-500 text-[10px] leading-relaxed">${a.address_1}${a.address_2 ? ', ' + a.address_2 : ''}<br>${a.city}, ${a.state} - <span class="font-bold text-luxury-dark">${a.pincode}</span></p>
                </div>
                <div class="flex gap-2">
                    <button type="button" onclick="window.th_editProfileAddress(${i})" class="text-luxury-rose hover:text-white hover:bg-luxury-rose border border-luxury-rose/30 bg-luxury-rose/5 w-8 h-8 rounded-full flex items-center justify-center transition-colors"><i class="fas fa-pen text-[10px]"></i></button>
                    <button type="button" onclick="window.th_deleteAddress('${a.id}')" class="text-red-400 hover:text-red-600 border border-red-200 bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors"><i class="fas fa-trash-alt text-[10px]"></i></button>
                </div>
            </div>`; 
        });
    }
    container.innerHTML = html;
}

window.th_deleteAddress = async function(addressId) {
    if(!confirm("Delete this saved address?")) return;
    showInteractionLoader("Deleting...");
    try {
        if (!currentSessionUser) throw new Error("Unauthorized");
        const { error } = await _supabase.from('addresses').delete().eq('id', addressId).eq('user_id', currentSessionUser.id);
        if (error) throw error;
        await syncCloudAddresses();
        
        // Fix: Reset selectedAddressIndex safely if it's out of bounds
        if (selectedAddressIndex >= savedAddresses.length) {
            selectedAddressIndex = savedAddresses.length > 0 ? 0 : -1;
        }
        
        renderProfileAddressBook();
        window.showToast("Address deleted", "fa-trash");
    } catch(e) {
        window.showToast("Error deleting address", "fa-times", "text-red-500");
    }
    hideInteractionLoader();
};

window.th_saveProfileAddress = async function(e) {
    if(e) e.preventDefault();
    const a = { 
        first_name: document.getElementById('padd-fname').value.trim(), 
        last_name: document.getElementById('padd-lname').value.trim(), 
        email: currentSessionUser ? currentSessionUser.email : '', 
        phone: document.getElementById('padd-phone').value.trim(), 
        address_1: document.getElementById('padd-add1').value.trim(), 
        address_2: document.getElementById('padd-add2').value.trim(), 
        city: document.getElementById('padd-city').value.trim(), 
        state: document.getElementById('padd-state').value.trim(), 
        pincode: document.getElementById('padd-pin').value.trim() 
    };
    
    if(!a.first_name || !a.phone || !a.address_1 || !a.city || !a.pincode) { 
        window.showToast("Please fill all required fields", "fa-exclamation-circle", "text-red-500"); 
        return false; 
    }
    
    showInteractionLoader("Saving Address...");
    
    if (currentSessionUser) { 
        try { 
            a.user_id = currentSessionUser.id; 
            let err; 
            if (editingAddressIndex !== null) { 
                const { error } = await _supabase.from('addresses').update(a).eq('id', savedAddresses[editingAddressIndex].id).eq('user_id', currentSessionUser.id); 
                err = error; 
            } else { 
                const { error } = await _supabase.from('addresses').insert([a]); 
                err = error; 
            } 
            if (err) throw err; 
            await syncCloudAddresses(); 
            renderProfileAddressBook(); 
        } catch (err) { 
            alert("Failed to save address: " + err.message); 
            hideInteractionLoader(); 
            return false; 
        } 
    } else { 
        if (editingAddressIndex !== null) { 
            savedAddresses[editingAddressIndex] = a; 
        } else { 
            savedAddresses.push(a); 
        } 
        localStorage.setItem('th_saved_addresses', JSON.stringify(savedAddresses)); 
        renderProfileAddressBook(); 
    }
    
    editingAddressIndex = null; 
    document.getElementById('profile-add-address-form').reset(); 
    document.getElementById('profile-add-address-form').classList.add('hidden'); 
    hideInteractionLoader(); 
    window.showToast("Address Saved", "fa-check"); 
    return true;
};

window.closeCustomerProfile = function() { const o = document.getElementById('customer-profile-overlay'); requestAnimationFrame(() => { o.classList.remove('opacity-100'); o.classList.add('opacity-0'); setTimeout(() => { o.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }, 300); }); };
window.handleCustomerLogout = async function() { showInteractionLoader("Signing Out..."); await _supabase.auth.signOut(); savedAddresses = []; selectedAddressIndex = -1; window.closeCustomerProfile(); hideInteractionLoader(); window.showToast("Signed Out Safely", "fa-sign-out-alt"); };

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

function getDiscountPercent(idStr) { let h = 0; for (let i = 0; i < idStr.length; i++) h = idStr.charCodeAt(i) + ((h << 5) - h); return (Math.abs(h) % 31) + 10; }
function getActiveOffers() {
    let all = [];
    try { all = JSON.parse(settings.promoCodes || '[]'); } catch(e) {}
    const now = new Date();
    return all.filter(d => {
        if (d.type !== 'offer' || !d.isActive) return false;
        if (d.expiry && new Date(d.expiry) < now) return false;
        return true;
    }).sort((a, b) => b.condVal - a.condVal);
}

function calculateCartDiscount(sub) { 
    let d = 0, cTier = null, nTier = null; 
    
    // VIP and Coupons now stack together!
    
    const offers = getActiveOffers();
    for (let i = 0; i < offers.length; i++) { 
        if (sub >= offers[i].condVal) { 
            cTier = offers[i]; 
            nTier = i > 0 ? offers[i - 1] : null; 
            break; 
        } 
    } 
    if (!cTier && sub > 0 && offers.length > 0) nTier = offers[offers.length - 1]; 
    if (cTier) { 
        if (cTier.discountType === 'percent') d = Math.round(sub * (cTier.val / 100)); 
        else if (cTier.discountType === 'flat') d = cTier.val; 
        if (cTier.maxDiscount && d > cTier.maxDiscount) d = cTier.maxDiscount;
    } 
    return { discount: d, currentTier: cTier, nextTier: nTier, amountNeeded: nTier ? nTier.condVal - sub : 0 }; 
}
function calculateTotalPrepTime(items) { let minD = 999; items.forEach(i => { const pt = i.prepTime || '3'; const m = pt.match(/\d+/g); if(m && m.length >= 1) { let mp = parseInt(m[0]); if (mp < minD) minD = mp; } else { if (3 < minD) minD = 3; } }); if (minD === 999) minD = 3; const tq = items.reduce((s, i) => s + parseInt(i.qty || 1), 0); return `${minD * tq} Days`; }
function updateCartCount() { requestAnimationFrame(() => { const c = cart.reduce((s, i) => s + parseInt(i.qty || 1), 0); document.querySelectorAll('#cart-count, #product-page-cart-count').forEach(el => { if(el) el.textContent = c; }); }); }
function calculateEDDBracket(pt) { 
    const m = (pt || '3').match(/\d+/g); 
    let craftDays = m && m.length > 1 ? parseInt(m[1]) : (m && m.length > 0 ? parseInt(m[0]) : 3);
    let totalDays = craftDays + 6; 
    const dt = new Date(); dt.setDate(dt.getDate() + totalDays);
    const opt = { day: 'numeric', month: 'short', year: 'numeric' }; 
    return `Estimated Delivery by ${dt.toLocaleDateString('en-IN', opt)}. Great art takes time! 🎨✨`; 
}

window.applyCouponCode = async function() {
    const i = document.getElementById('checkout-promo-input'), f = document.getElementById('checkout-promo-feedback'); if(!i || !f) return; const c = i.value.trim().toUpperCase();
    f.textContent = "Validating..."; f.className = "text-[9px] font-bold uppercase tracking-wide mt-1.5 text-luxury-gold block";
    
    if (!c) {
        activeCouponValue = 0; activeCouponCode = ""; window.activeCouponType = null;
        f.textContent = "Please enter a code."; f.className = "text-[9px] font-bold uppercase tracking-wide mt-1.5 text-red-500 block";
        updateCheckoutUI(); return;
    }

    let ss = 0;
    const listToRender = window.buyNowPayload ? [window.buyNowPayload] : cart;
    listToRender.forEach((item) => { ss += (Number(String(item.price || 0).replace(/[^0-9.,]/g, '')) * parseInt(item.qty || 1)); }); 

    try {
        // Prepare auth header if user is signed in (needed for first_order logic)
        const authHeaders = currentSessionUser ? { Authorization: `Bearer ${(await _supabase.auth.getSession()).data.session?.access_token}` } : {};
        
        const { data, error } = await _supabase.functions.invoke('validate-coupon', {
            body: { couponCode: c, subtotal: ss },
            headers: authHeaders
        });

        if (error) throw error;
        if (data && data.error) throw new Error(data.error);

        if (data && data.valid) {
            activeCouponValue = data.discountValue; 
            activeCouponCode = data.code; 
            window.activeCouponType = data.type; 
            f.textContent = `${data.code} applied! ${data.type === 'percent' ? data.val + '% OFF' : '₹' + data.val + ' OFF'}.`; 
            f.className = "text-[9px] font-bold uppercase tracking-wide mt-1.5 text-green-600 block";
        } else {
            activeCouponValue = 0; activeCouponCode = ""; window.activeCouponType = null;
            f.textContent = data?.message || "Invalid Coupon Code."; 
            f.className = "text-[9px] font-bold uppercase tracking-wide mt-1.5 text-red-500 block";
        }
    } catch (err) {
        console.error("Coupon Error:", err);
        activeCouponValue = 0; activeCouponCode = ""; window.activeCouponType = null;
        f.textContent = err.message || "Error validating coupon."; 
        f.className = "text-[9px] font-bold uppercase tracking-wide mt-1.5 text-red-500 block";
    }
    updateCheckoutUI();
};

function fetchDatabase() { 
    _supabase.from('creations').select('*').order('created_at', { ascending: false }).then(({data, error}) => {
        if(error) { const pg = document.getElementById('product-grid'); if(pg) { pg.innerHTML = '<div class="col-span-full text-center py-20 text-red-500 font-medium text-sm w-full"><i class="fas fa-wifi text-4xl block mb-3 opacity-50"></i> Unable to load collection. Please check your connection and try again.</div>'; } dismissPreloader(); return; }
        const getImg = (arr, idx) => (arr && arr.length > idx) ? (arr[idx].data || arr[idx] || '') : '';
        products = (data || []).map(r => { let pi = []; try { pi = typeof r.image_url === 'string' ? JSON.parse(r.image_url) : (r.image_url || []); } catch(e) {}
            return { id: r.id, name: r.name || 'Untitled Art', category: r.category || '', mainCategory: r.main_category || 'Pipe Cleaner Crafts', price: r.price || 0, prepTime: r.prep_time || '3-5', specs: r.specs || '', dimensions: r.dimensions || '', isCustomizable: r.is_customizable || false, image1: getImg(pi, 0), image2: getImg(pi, 1), image3: getImg(pi, 2), image4: getImg(pi, 3), image5: getImg(pi, 4) };
        });
        requestAnimationFrame(() => { renderFilters(); renderProducts(); setTimeout(dismissPreloader, 400); });
    });
}

// Customizer engine removed successfully

function renderProducts(sq = '') { 
    const g = document.getElementById('product-grid'); if(!g) return; g.innerHTML = ''; 
    let f = products.filter(p => p.name.toLowerCase().includes(sq.toLowerCase()));
    if(currentMainCategory !== 'All') f = f.filter(p => p.mainCategory === currentMainCategory);
    if(activeSubCategories.length > 0) f = f.filter(p => activeSubCategories.includes(p.category));
    if(currentSortMode === 'low') f.sort((a,b) => parseFloat(a.price) - parseFloat(b.price)); 
    if(currentSortMode === 'high') f.sort((a,b) => parseFloat(b.price) - parseFloat(a.price)); 
    // Randomly shuffles the array on page load
    if(currentSortMode === 'random') f.sort(() => Math.random() - 0.5); 

    if(f.length === 0) { g.innerHTML = '<div class="col-span-full text-center py-20 text-gray-400 font-medium text-sm w-full"><i class="fas fa-box-open text-4xl block mb-3 opacity-30"></i> No creations found matching your search.</div>'; return; }
    const frag = document.createDocumentFragment();
    f.forEach((p) => { frag.appendChild(generateProductCardHTML(p)); }); g.appendChild(frag); setupScrollReveal();
}

function generateProductCardHTML(p) {
    const cp = Number(String(p.price || 0).replace(/[^0-9.,]/g, '')), dp = getDiscountPercent(String(p.id)), op = Math.round(cp * (1 + (dp / 100))), img = (typeof p.image1 === 'string' && p.image1.trim() !== '') ? p.image1 : 'https://placehold.co/400x500/F8E9EA/423133';
    const c = document.createElement('div'); c.className = `w-full relative cursor-pointer opacity-0 transform translate-y-4 transition-all duration-400 ease-out group scroll-reveal`; c.setAttribute('data-card-id', p.id); c.addEventListener('click', () => window.openProductPage(p.id));
    c.innerHTML = `<div class="w-full relative rounded-2xl overflow-hidden group shadow-sm bg-gradient-to-tr from-luxury-bg to-white border border-luxury-blush aspect-[4/5] mb-2"><span class="absolute top-2.5 left-2.5 z-10 bg-white/95 text-luxury-dark text-[7px] sm:text-[8px] font-bold px-2.5 py-1 rounded-md uppercase tracking-[0.15em] border border-luxury-blush shadow-sm">${p.category || 'Art'}</span><img loading="lazy" decoding="async" src="${img}" alt="${p.name}" class="absolute inset-0 w-full h-full object-cover"></div><div class="px-1 flex flex-col justify-start text-left w-full"><h3 class="font-bitter font-semibold text-[11px] sm:text-[12px] text-luxury-dark leading-snug w-full transition-colors group-hover:text-luxury-rose mb-0.5 line-clamp-2">${p.name}</h3><div class="flex items-center md:items-baseline gap-1.5 flex-wrap w-full"><span class="font-poppins font-extrabold text-luxury-dark text-[14px] sm:text-[15px] tracking-tight leading-none">₹${cp}</span><span class="font-poppins text-gray-400 text-[9px] font-medium line-through leading-none">₹${op}</span></div></div>`;
    return c;
}

window.openProductPage = async function(id) {
    try {
        const p = products.find(x => String(x.id) === String(id));
        if (!p) return;
        
        // Push state for native back-button navigation
        currentModalLevel = 1; 
        window.safePushState(1);
        
        // 1. Map Text Details
        if(document.getElementById('modal-title')) document.getElementById('modal-title').textContent = p.name;
        if(document.getElementById('modal-main-category')) document.getElementById('modal-main-category').textContent = p.mainCategory;
        if(document.getElementById('modal-sub-category')) document.getElementById('modal-sub-category').textContent = p.category;
        if(document.getElementById('breadcrumb-main-cat')) document.getElementById('breadcrumb-main-cat').textContent = p.mainCategory;
        if(document.getElementById('breadcrumb-sub-cat')) document.getElementById('breadcrumb-sub-cat').textContent = p.category;
        if(document.getElementById('modal-specs')) document.getElementById('modal-specs').innerHTML = (p.specs || '').replace(/\n/g, '<br>');
        
        // 2. Price & Math
        const cp = Number(String(p.price || 0).replace(/[^0-9.,]/g, ''));
        const dp = getDiscountPercent(String(p.id));
        const op = Math.round(cp * (1 + (dp / 100)));
        
        if(document.getElementById('modal-price')) document.getElementById('modal-price').textContent = cp;
        if(document.getElementById('modal-original-price')) document.getElementById('modal-original-price').textContent = `₹${op}`;
        if(document.getElementById('modal-discount-tag')) document.getElementById('modal-discount-tag').textContent = `${dp}% OFF VIP`;
        if(document.getElementById('modal-edd-delivery-tag')) document.getElementById('modal-edd-delivery-tag').textContent = calculateEDDBracket(p.prepTime);

        // 3. Badges
        if(document.getElementById('modal-dimensions-text')) document.getElementById('modal-dimensions-text').textContent = p.dimensions || '';
        if(document.getElementById('modal-dimensions-badge')) {
            if (p.dimensions && p.mainCategory !== 'Pipe Cleaner Crafts') document.getElementById('modal-dimensions-badge').classList.remove('hidden');
            else document.getElementById('modal-dimensions-badge').classList.add('hidden');
        }
        if(document.getElementById('modal-custom-badge')) {
            if (p.isCustomizable) document.getElementById('modal-custom-badge').classList.remove('hidden');
            else document.getElementById('modal-custom-badge').classList.add('hidden');
        }
        if(document.getElementById('art-badges-container')) {
            if ((p.dimensions && p.mainCategory !== 'Pipe Cleaner Crafts') || p.isCustomizable) document.getElementById('art-badges-container').classList.remove('hidden');
            else document.getElementById('art-badges-container').classList.add('hidden');
        }

        // 4. Images & Native Carousel Setup (Flawless Amazon Swipe)
        modalImages = [p.image1, p.image2, p.image3, p.image4, p.image5].filter(img => img && img.trim() !== '');
        if(modalImages.length === 0) modalImages = ['https://placehold.co/400x500/F8E9EA/423133'];
        
        const tr = document.getElementById('modal-carousel-track');
        if(tr) {
            // We use scrollBehavior: auto natively, and manage scrolling manually to avoid jitter
            tr.className = "flex w-full h-full relative overflow-x-auto scrollbar-hide snap-x snap-mandatory touch-pan-x";
            tr.style.scrollBehavior = 'auto';
            tr.innerHTML = '';
            
            // Clones for loop illusion
            const firstClone = `<img id="slide-clone-first" loading="lazy" src="${modalImages[0]}" class="w-full h-full flex-shrink-0 object-cover snap-center snap-always">`;
            const lastClone = `<img id="slide-clone-last" loading="lazy" src="${modalImages[modalImages.length-1]}" class="w-full h-full flex-shrink-0 object-cover snap-center snap-always">`;
            
            if (modalImages.length > 1) tr.innerHTML += lastClone;
            modalImages.forEach((src, idx) => {
                tr.innerHTML += `<img id="slide-${idx}" loading="lazy" src="${src}" class="w-full h-full flex-shrink-0 object-cover cursor-zoom-in snap-center snap-always" onclick="window.openLightboxFromCarousel()">`;
            });
            if (modalImages.length > 1) tr.innerHTML += firstClone;
            
            // Align to first real slide instantly
            requestAnimationFrame(() => {
                if (modalImages.length > 1) {
                    const realFirst = document.getElementById('slide-0');
                    if(realFirst) tr.scrollLeft = realFirst.offsetLeft;
                }
            });

            // Core logic: Teleport seamlessly on scroll
            tr.onscroll = () => {
                if (modalImages.length <= 1) return;
                const maxScroll = tr.scrollWidth - tr.clientWidth;
                
                if (tr.scrollLeft === 0) {
                    tr.scrollLeft = maxScroll - tr.clientWidth;
                } else if (Math.ceil(tr.scrollLeft) >= maxScroll) {
                    tr.scrollLeft = tr.clientWidth;
                }
            };
            
            // IntersectionObserver strictly for thumbnails updates
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if(entry.isIntersecting) {
                        let targetIdx = -1;
                        if (entry.target.id === 'slide-clone-first') targetIdx = 0;
                        else if (entry.target.id === 'slide-clone-last') targetIdx = modalImages.length - 1;
                        else targetIdx = parseInt(entry.target.id.split('-')[1]);
                        
                        if (targetIdx !== -1) { currentSlideIndex = targetIdx; updateActiveThumb(targetIdx, modalImages.length); }
                    }
                });
            }, { root: tr, threshold: 0.6 });
            setTimeout(() => { document.querySelectorAll('#modal-carousel-track img').forEach(img => observer.observe(img)); }, 100);
        }
        currentSlideIndex = 0;
        
        const th = document.getElementById('modal-thumbnails');
        if (th) {
            th.innerHTML = ''; 
            if (modalImages.length > 1) { 
                modalImages.forEach((src, idx) => { 
                    const tm = document.createElement('img'); 
                    tm.src = src; 
                    tm.className = `w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-md border-2 transition-all cursor-pointer ${idx === 0 ? 'border-luxury-rose scale-105 opacity-100 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`; 
                    tm.id = `thumb-${idx}`; 
                    tm.addEventListener('click', () => window.goToSlide(idx)); 
                    th.appendChild(tm); 
                }); 
            }
        }

        // 5. Setup View State
        document.getElementById('product-view')?.setAttribute('data-current-id', p.id);
        
        const cg = document.getElementById('modal-care-guide');
        if (cg) {
            cg.innerHTML = '<li><i class="fas fa-spinner fa-spin text-luxury-rose mr-2"></i> Curating AI Care Guide...</li>';
            window.fetchAICareGuide(p.mainCategory).then(html => { 
                cg.innerHTML = html; 
            });
        }
        
        updateProductButtons(p.id);
        updateWishlistUIElements(p.id, localWishlist.includes(String(p.id)));
        renderRelatedProducts(p.id, p.mainCategory, p.category);

        // 6. Transition Screens
        document.getElementById('customer-view')?.classList.add('hidden');
        document.getElementById('product-view')?.classList.remove('hidden');
        window.scrollTo({top: 0, behavior: 'smooth'});

    } catch (error) { 
        console.error("Error opening product:", error); 
    }
};

window.closeProductPage = function() { document.getElementById('product-view')?.classList.add('hidden'); document.getElementById('customer-view')?.classList.remove('hidden'); window.scrollTo(0, 0); };

function updateProductButtons(id) {
    const ac = document.getElementById('modal-action-buttons'); if(!ac) return; const ci = cart.find(i => i.id == id); const q = ci ? parseInt(ci.qty || 1) : 0;
    if(q > 0) ac.innerHTML = `<div class="flex items-center justify-between w-full h-full bg-white border border-luxury-rose rounded-full px-2 sm:px-4 py-3 shadow-sm min-h-[44px]"><button type="button" onclick="window.th_updateCartQty('${id}', -1, event)" class="w-8 h-8 rounded-full bg-luxury-bg hover:bg-luxury-blush border border-luxury-blush flex items-center justify-center shrink-0"><i class="fas fa-minus text-xs"></i></button><span class="text-base sm:text-lg font-bold text-luxury-rose font-poppins min-w-[20px] text-center">${q}</span><button type="button" onclick="window.th_updateCartQty('${id}', 1, event)" class="w-8 h-8 rounded-full bg-luxury-bg hover:bg-luxury-blush border border-luxury-blush flex items-center justify-center shrink-0"><i class="fas fa-plus text-xs"></i></button></div><button type="button" onclick="window.routeCheckoutFromModal('${id}', event)" class="w-full bg-luxury-dark text-white hover:bg-[#D9778A] font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider shadow-md active:scale-[0.98] transition-colors min-h-[44px]"><i class="fas fa-bolt text-luxury-gold"></i> Buy Now</button>`; 
    else ac.innerHTML = `<button type="button" onclick="window.th_updateCartQty('${id}', 1, event)" class="w-full bg-white border border-luxury-dark text-luxury-dark hover:bg-luxury-bg font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider transition-colors shadow-sm active:scale-[0.98] min-h-[44px]"><i class="fas fa-shopping-bag"></i> Add to Bag</button><button type="button" onclick="window.routeCheckoutFromModal('${id}', event)" class="w-full bg-luxury-dark text-white hover:bg-[#D9778A] font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider shadow-md active:scale-[0.98] transition-colors min-h-[44px]"><i class="fas fa-bolt text-luxury-gold"></i> Buy Now</button>`; 
}

function renderRelatedProducts(cid, mc, sc) {
    const g = document.getElementById('related-products-grid'), s = document.getElementById('related-products-section'); if(!g || !s) return; g.innerHTML = '';
    let r = products.filter(p => p.id != cid), ssc = r.filter(p => p.category === sc), smc = r.filter(p => p.mainCategory === mc && p.category !== sc);
    let fr = [...ssc, ...smc].slice(0, 14); if (fr.length === 0) { s.classList.add('hidden'); return; } else s.classList.remove('hidden');
    const f = document.createDocumentFragment(); fr.forEach(p => { f.appendChild(generateProductCardHTML(p)); }); g.appendChild(f); setupScrollReveal();
}

window.th_updateCartQty = function(id, d, e) {
    if(e) { e.preventDefault(); e.stopPropagation(); } let ex = cart.find(x => x.id == id);
    if(ex) { ex.qty = parseInt(ex.qty || 1) + d; if(ex.qty <= 0) { cart = cart.filter(x => x.id != id); window.showToast("Removed from Bag", "fa-times"); } else { if(d > 0) window.showToast("Quantity Increased", "fa-plus"); } } 
    else if(d > 0) { 
        const p = products.find(x => x.id == id); 
        if(p) { 
            cart.push({ id: p.id, name: p.name, price: p.price, prepTime: p.prepTime, image: p.image1, isCustomizable: p.isCustomizable, mainCategory: p.mainCategory, customSpecs: "", qty: 1 }); 
            window.showToast("Added to Bag", "fa-check"); 
        } 
    }
    localStorage.setItem('th_cart', JSON.stringify(cart)); updateCartCount();
    const pv = document.getElementById('product-view'); if(pv && !pv.classList.contains('hidden')) updateProductButtons(id);
    if(document.getElementById('checkout-overlay') && !document.getElementById('checkout-overlay').classList.contains('hidden')){ if (cart.length === 0) { window.closeCheckout(); return window.showToast("Bag is empty!", "fa-times"); } renderCheckoutItems(); updateCheckoutUI(); }
};

window.th_updateBuyNowQty = function(id, d, e) {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    if(window.buyNowPayload && window.buyNowPayload.id == id) {
        window.buyNowPayload.qty = Math.max(1, parseInt(window.buyNowPayload.qty || 1) + d);
        renderCheckoutItems();
        updateCheckoutUI();
    }
};

window.openCheckoutBase = function() {
    if(cart.length === 0 && !window.buyNowPayload) return window.showToast("Your bag is empty!", "fa-times", "text-red-500");
    if(!currentSessionUser) { window.showToast("Please Sign In to Checkout", "fa-user-lock", "text-luxury-rose"); window.openCustomerAuthModal(); return; }
    currentModalLevel = 1; window.safePushState(1); checkoutStep = 1; const o = document.getElementById('checkout-overlay'); if(!o) return;
    o.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); document.getElementById('payment-success-view')?.classList.add('hidden'); document.getElementById('payment-success-view')?.classList.remove('flex'); document.getElementById('payment-gateway-view')?.classList.remove('hidden'); document.getElementById('payment-gateway-view')?.classList.add('flex');
    renderCheckoutItems(); syncCloudAddresses(); requestAnimationFrame(() => { o.classList.remove('opacity-0'); o.classList.add('opacity-100'); o.scrollTo(0, 0); });
};

window.closeCheckout = function() {
    const o = document.getElementById('checkout-overlay'); if(!o) return;
    activeCouponValue = 0; activeCouponCode = ""; window.activeCouponType = null; const pi = document.getElementById('checkout-promo-input'); if(pi) pi.value = ''; const pf = document.getElementById('checkout-promo-feedback'); if(pf) { pf.textContent = ''; pf.classList.add('hidden'); }
    requestAnimationFrame(() => { o.classList.remove('opacity-100'); o.classList.add('opacity-0'); setTimeout(() => { o.classList.add('hidden'); if(document.getElementById('return-policy-modal')?.classList.contains('hidden') && document.getElementById('privacy-policy-modal')?.classList.contains('hidden')){ document.body.classList.remove('overflow-hidden'); } pendingOrderPayload = null; window.buyNowPayload = null; renderProducts(currentSearchQuery); }, 300); });
};

window.routeCheckoutFromModal = function(id, e) { 
    if(e) { e.preventDefault(); e.stopPropagation(); } const p = products.find(x => x.id == id); if(!p) return; 
    const ci = cart.find(i => i.id == id);
    const currentQty = ci ? parseInt(ci.qty || 1) : 1;
    window.buyNowPayload = { id: p.id, name: p.name, price: p.price, prepTime: p.prepTime, image: p.image1, isCustomizable: p.isCustomizable, mainCategory: p.mainCategory, customSpecs: "", qty: currentQty };
    window.openCheckoutBase(); 
};

function renderCheckoutItems() {
    const c = document.getElementById('checkout-items-list'); if(!c) return; 
    const listToRender = window.buyNowPayload ? [window.buyNowPayload] : cart;
    if (listToRender.length === 0) { c.innerHTML = '<div class="text-center py-10 text-gray-400 font-medium text-sm"><i class="fas fa-shopping-bag text-4xl block mb-3 opacity-30"></i> Your bag is completely empty.</div>'; document.getElementById('cart-upsell-container')?.classList.add('hidden'); return; }
    
    const titleEl = document.querySelector('#checkout-step-1 h2');
    if(titleEl) titleEl.textContent = window.buyNowPayload ? "Review Your Order" : "Review Your Bag";
    if(document.getElementById('step-label-1')) document.getElementById('step-label-1').textContent = window.buyNowPayload ? "Your Order" : "Your Bag";

    let h = ''; listToRender.forEach(i => { const cp = Number((i.price || 0).toString().replace(/[^0-9.,]/g, '')), dp = getDiscountPercent(String(i.id)), op = Math.round(cp * (1 + (dp / 100))), img = (typeof i.image1 === 'string' && i.image1.trim() !== '') ? i.image1 : (typeof i.image === 'string' ? i.image : 'https://placehold.co/150/F8E9EA/423133'), q = parseInt(i.qty || 1);
        const qtyHtml = window.buyNowPayload ? `<div class="flex items-center bg-white border border-luxury-blush rounded-full h-[36px] overflow-hidden shadow-sm"><button type="button" onclick="window.th_updateBuyNowQty('${i.id}', -1, event)" class="w-10 h-full flex items-center justify-center text-luxury-dark hover:bg-luxury-blush transition-colors"><i class="fas fa-minus text-[10px]"></i></button><div class="w-10 h-full flex items-center justify-center border-l border-r border-luxury-blush text-[12px] font-bold text-luxury-rose bg-luxury-bg">${q}</div><button type="button" onclick="window.th_updateBuyNowQty('${i.id}', 1, event)" class="w-10 h-full flex items-center justify-center text-luxury-dark hover:bg-luxury-blush transition-colors"><i class="fas fa-plus text-[10px]"></i></button></div>` : `<div class="flex items-center bg-white border border-luxury-blush rounded-full h-[36px] overflow-hidden shadow-sm"><button type="button" onclick="window.th_updateCartQty('${i.id}', -1, event)" class="w-10 h-full flex items-center justify-center text-luxury-dark hover:bg-luxury-blush transition-colors"><i class="fas fa-minus text-[10px]"></i></button><div class="w-10 h-full flex items-center justify-center border-l border-r border-luxury-blush text-[12px] font-bold text-luxury-rose bg-luxury-bg">${q}</div><button type="button" onclick="window.th_updateCartQty('${i.id}', 1, event)" class="w-10 h-full flex items-center justify-center text-luxury-dark hover:bg-luxury-blush transition-colors"><i class="fas fa-plus text-[10px]"></i></button></div>`;
        h += `<div class="flex flex-col sm:flex-row gap-4 border border-luxury-blush bg-white p-4 rounded-2xl shadow-sm"><img src="${img}" class="w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-xl border border-luxury-blush shrink-0 bg-luxury-bg"><div class="flex flex-col justify-between w-full"><div><h4 class="font-bitter text-[14px] sm:text-[15px] font-semibold text-luxury-dark mb-1 leading-snug">${i.name}</h4><p class="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">${i.mainCategory || i.category || 'Handcrafted Art'}</p>${i.customSpecs ? `<p class="text-[9px] font-medium text-luxury-rose mb-3 bg-luxury-rose/10 inline-block px-2 py-1 rounded-md border border-luxury-rose/20 leading-relaxed">${i.customSpecs}</p>` : `<div class="mb-3"></div>`}<div class="flex items-baseline gap-2 mb-4"><span class="font-poppins text-luxury-dark font-bold text-[16px] sm:text-[18px]">₹${cp}</span><span class="font-poppins text-gray-400 text-[11px] line-through">₹${op}</span><span class="text-green-600 font-bold text-[10px] ml-1">${dp}% Off</span></div></div><div class="flex items-center gap-3">${qtyHtml}</div></div></div>`;
    });
    const dw = document.getElementById('comm-dimensions-wrapper'); if (listToRender.some(i => i.isCustomizable)) dw?.classList.remove('hidden'); else dw?.classList.add('hidden'); c.innerHTML = h;
}

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

window.saveAddressFromForm = async function(e) {
    if(e) e.preventDefault(); // Prevents page reload when pressing "Enter"
    const a = { first_name: document.getElementById('prof-fname').value.trim(), last_name: document.getElementById('prof-lname').value.trim(), email: document.getElementById('prof-email').value.trim(), phone: document.getElementById('prof-phone').value.trim(), address_1: document.getElementById('prof-add1').value.trim(), address_2: document.getElementById('prof-add2').value.trim(), city: document.getElementById('prof-city').value.trim(), state: document.getElementById('prof-state').value.trim(), pincode: document.getElementById('prof-pin').value.trim() };
    if(!a.first_name || !a.phone || !a.address_1 || !a.city || !a.pincode) { window.showToast("Please fill all required fields", "fa-exclamation-circle", "text-red-500"); return false; }
    showInteractionLoader("Saving Address...");
    if (currentSessionUser) { try { a.user_id = currentSessionUser.id; let err; if (editingAddressIndex !== null) { const { error } = await _supabase.from('addresses').update(a).eq('id', savedAddresses[editingAddressIndex].id).eq('user_id', currentSessionUser.id); err = error; } else { const { error } = await _supabase.from('addresses').insert([a]); err = error; } if (err) throw err; await syncCloudAddresses(); } catch (e) { alert("Failed to save address: " + e.message); hideInteractionLoader(); return false; } } 
    else { if (editingAddressIndex !== null) { savedAddresses[editingAddressIndex] = a; selectedAddressIndex = editingAddressIndex; } else { savedAddresses.push(a); selectedAddressIndex = savedAddresses.length - 1; } localStorage.setItem('th_saved_addresses', JSON.stringify(savedAddresses)); }
    editingAddressIndex = null; renderAddressBook(); hideInteractionLoader(); window.showToast("Address Saved", "fa-check"); return true;
};

function clearAddressForm() { ['fname','lname','email','phone','add1','add2','city','state','pin'].forEach(id => document.getElementById('prof-'+id).value = ''); }

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
    else if (s === 2) { if (cart.length === 0 && !window.buyNowPayload) return window.showToast("Your bag is empty!", "fa-times", "text-red-500"); checkoutStep = 2; updateCheckoutUI(); } 
    else if (s === 3) { if (cart.length === 0 && !window.buyNowPayload) return; if (savedAddresses.length === 0 || selectedAddressIndex === -1) return window.showToast("Please provide a delivery address.", "fa-exclamation-circle", "text-red-500"); window.preparePaymentGateway(); }
};

function updateCheckoutUI() {
    let ts = 0, ss = 0, ti = 0; 
    const listToRender = window.buyNowPayload ? [window.buyNowPayload] : cart;
    listToRender.forEach((i) => { 
        const cp = Number(String(i.price || 0).replace(/[^0-9.,]/g, '')); 
        const q = parseInt(i.qty || 1); 
        const dp = getDiscountPercent(String(i.id)); 
        ts += (Math.round(cp * (1 + (dp / 100))) * q); 
        ss += (cp * q); 
        ti += q; 
    });
    
    let cPin = ''; 
    const cf = document.getElementById('checkout-profile-form'); 
    if (cf && !cf.classList.contains('hidden') && document.getElementById('prof-pin')) {
        cPin = document.getElementById('prof-pin').value.trim(); 
    } else if (savedAddresses.length > 0 && selectedAddressIndex !== -1) {
        cPin = savedAddresses[selectedAddressIndex].pincode;
    }
    
    const de = document.getElementById('qo-delivery-fee'); 
    if (ss >= 2499) { 
        currentDeliveryFee = 0; 
        if(de) de.innerHTML = '<span class="text-green-600 font-bold uppercase tracking-widest text-[10px]">Free</span>'; 
    } else if (cPin.length >= 2) { 
        currentDeliveryFee = calculateDynamicDelivery(ss, cPin, cart); 
        if(de) de.innerHTML = `₹${currentDeliveryFee}`; 
    } else { 
        currentDeliveryFee = 0; 
        if(de) de.innerHTML = '<span class="text-gray-400 text-[10px] font-medium">Calculated next step</span>'; 
    }
    
    const { discount: vd, currentTier: ct, nextTier: nt } = calculateCartDiscount(ss); 
    let cd = 0;
    if (activeCouponValue > 0) {
        if (window.activeCouponType === 'flat') { cd = activeCouponValue; } 
        else { 
            cd = Math.round(ss * (activeCouponValue / 100)); 
            if (window.activeCouponMax && cd > window.activeCouponMax) cd = window.activeCouponMax;
        }
        // Ensure combined stacked discounts don't make the subtotal negative
        if ((cd + vd) > ss) { cd = Math.max(0, ss - vd); }
    } 
    
    const rc = document.getElementById('qo-coupon-row'); 
    if (rc) { 
        if (cd > 0) { document.getElementById('qo-coupon-discount').textContent = `- ₹${cd}`; rc.classList.remove('hidden'); } 
        else { rc.classList.add('hidden'); } 
    }
    
    // Calculate UPI Discount (₹50 off for UPI payments > ₹300, capped by remaining subtotal)
    currentUpiDiscount = 0;
    if (paymentMethod === 'upi' && ss > 300) {
        currentUpiDiscount = Math.min(50, Math.max(0, ss - vd - cd));
    }
    
    // Dynamically manage the UPI discount row UI to match existing design
    let upiRow = document.getElementById('qo-upi-row');
    if (currentUpiDiscount > 0) {
        if (!upiRow && rc) {
            upiRow = document.createElement('div');
            upiRow.id = 'qo-upi-row';
            upiRow.className = "flex justify-between items-center mt-2";
            upiRow.innerHTML = `<span class="text-[11px] font-bold text-green-600 uppercase tracking-widest"><i class="fas fa-bolt text-luxury-gold mr-1"></i> UPI Discount</span><span id="qo-upi-discount" class="font-poppins font-bold text-[13px] text-green-600"></span>`;
            rc.parentNode.insertBefore(upiRow, rc.nextSibling);
        }
        if (upiRow) {
            document.getElementById('qo-upi-discount').textContent = `- ₹${currentUpiDiscount}`;
            upiRow.classList.remove('hidden');
        }
    } else if (upiRow) {
        upiRow.classList.add('hidden');
    }
    
    const ft = Math.max(0, ss - vd - cd - currentUpiDiscount) + currentDeliveryFee, pd = ts - ss, tos = pd + vd + cd + currentUpiDiscount;
    
    if(document.getElementById('qo-item-count')) document.getElementById('qo-item-count').textContent = ti; 
    if(document.getElementById('qo-original-value')) document.getElementById('qo-original-value').textContent = `₹${ts}`; 
    if(document.getElementById('qo-product-discount')) document.getElementById('qo-product-discount').textContent = `- ₹${pd}`;
    
    const vr = document.getElementById('qo-vip-row'); 
    if(vr) { 
        if(vd > 0) { document.getElementById('qo-vip-label').textContent = ct.name; document.getElementById('qo-vip-discount').textContent = `- ₹${vd}`; vr.classList.remove('hidden'); } 
        else { vr.classList.add('hidden'); } 
    }
    
    const vipProgress = document.getElementById('vip-progress-container');
    const bestOfferUI = document.getElementById('active-best-offer');
    
    // VIP UI remains visible and active alongside manual coupons
    if (bestOfferUI) {
        const allOffers = getActiveOffers();
        if (allOffers.length > 0) {
            bestOfferUI.classList.remove('hidden');
            document.getElementById('best-offer-title').textContent = ct ? ct.name : "Available Offers";
            document.getElementById('best-offer-desc').textContent = ct ? `Applied to your cart!` : `Spend ₹${nt ? nt.condVal - ss : 0} more to unlock.`;
        } else {
            bestOfferUI.classList.add('hidden');
        }
    }

    if (vipProgress) {
        if (nt) {
            const progressPercent = Math.min(100, (ss / nt.condVal) * 100);
            vipProgress.innerHTML = `<div class="flex justify-between items-end mb-1"><span class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">VIP Status</span><span class="text-[9px] font-bold text-luxury-rose uppercase tracking-widest">Add ₹${nt.condVal - ss} for ${nt.name} 🎀</span></div><div class="w-full bg-luxury-blush/30 h-1.5 rounded-full overflow-hidden"><div class="bg-luxury-rose h-full rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div></div>`;
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
    
    const mobBar = document.getElementById('mobile-sticky-checkout-bar');
    if (mobBar) {
        if (checkoutStep === 3) mobBar.classList.add('hidden');
        else mobBar.classList.remove('hidden');
    }

    const isCartEmpty = cart.length === 0 && !window.buyNowPayload;
    if(mb) { 
        if(checkoutStep === 1) { mb.innerHTML = `Next: Delivery <i class="fas fa-arrow-right ml-1"></i>`; mb.disabled = isCartEmpty; mb.className=`w-full bg-luxury-dark text-white hover:bg-[#D9778A] py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.15em] transition-all shadow-float flex items-center justify-center gap-2 ${isCartEmpty?'opacity-50 cursor-not-allowed':''}`; } 
        else if (checkoutStep === 2) { mb.innerHTML = `Next: Secure Payment <i class="fas fa-lock ml-1"></i>`; mb.disabled = false; mb.className="w-full bg-luxury-dark text-white hover:bg-[#D9778A] py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.15em] transition-all shadow-float flex items-center justify-center gap-2"; } 
    }
    
    if(db) { 
                if(checkoutStep === 1) { db.innerHTML = `Next: Delivery <i class="fas fa-arrow-right ml-1"></i>`; db.disabled = isCartEmpty; db.className=`hidden lg:flex w-full bg-luxury-dark text-white hover:bg-[#D9778A] py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.15em] transition-all shadow-float items-center justify-center gap-2 mt-2 ${isCartEmpty?'opacity-50 cursor-not-allowed':''}`; } 
                else if (checkoutStep === 2) { db.innerHTML = `Next: Secure Payment <i class="fas fa-lock ml-1"></i>`; db.disabled = false; db.className="hidden lg:flex w-full bg-luxury-dark text-white hover:bg-[#D9778A] py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.15em] transition-all shadow-float items-center justify-center gap-2 mt-2"; } 
            }
            
            if(sb) { 
                if (checkoutStep === 3) { 
                    sb.classList.add('hidden');
                    sb.classList.remove('block', 'lg:block');
                } else if (checkoutStep === 2 && window.innerWidth < 1024) {
                    sb.classList.add('hidden');
                    sb.classList.remove('block');
                    sb.classList.add('lg:block');
                } else {
                    sb.classList.remove('hidden');
                    sb.classList.add('block', 'lg:block');
                }
            }
    
    const aCl = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-[#D9778A] text-white shadow-md border-2 border-white group-hover:scale-105", iCl = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-white text-gray-400 border-2 border-luxury-blush group-hover:scale-105";
    if (checkoutStep === 1) { document.getElementById('checkout-step-1')?.classList.remove('hidden'); document.getElementById('checkout-step-2')?.classList.add('hidden'); document.getElementById('checkout-step-3')?.classList.add('hidden'); f.style.width = '0%'; if(i1) i1.className = aCl; if(i2) i2.className = iCl; if(i3) i3.className = iCl; } 
    else if (checkoutStep === 2) { document.getElementById('checkout-step-1')?.classList.add('hidden'); document.getElementById('checkout-step-2')?.classList.remove('hidden'); document.getElementById('checkout-step-3')?.classList.add('hidden'); f.style.width = '50%'; if(i1) i1.className = aCl; if(i2) i2.className = aCl; if(i3) i3.className = iCl; } 
    else if (checkoutStep === 3) { document.getElementById('checkout-step-1')?.classList.add('hidden'); document.getElementById('checkout-step-2')?.classList.add('hidden'); document.getElementById('checkout-step-3')?.classList.remove('hidden'); f.style.width = '100%'; if(i1) i1.className = aCl; if(i2) i2.className = aCl; if(i3) i3.className = aCl; }
}

window.handleMobileStickyAction = function() { window.handleCheckoutAction(); };
window.handleCheckoutAction = async function() {
    if (checkoutStep === 1) { 
        if (cart.length === 0 && !window.buyNowPayload) return window.showToast("Your bag is empty!", "fa-times", "text-red-500"); 
        if (!currentSessionUser) { window.showToast("Please Sign In to Checkout", "fa-user-lock", "text-luxury-rose"); window.openCustomerAuthModal(); return; } 
        checkoutStep = 2; updateCheckoutUI(); renderAddressBook(); document.getElementById('checkout-overlay')?.scrollTo({top: 0, behavior: 'smooth'}); 
    } 
    else if (checkoutStep === 2) { 
        const f = document.getElementById('checkout-profile-form'); 
        if (f && !f.classList.contains('hidden')) { 
            const saved = await window.saveAddressFromForm();
            if (!saved) return; 
        } 
        if (savedAddresses.length === 0 || selectedAddressIndex === -1) { 
            return window.showToast("Please provide a delivery address.", "fa-exclamation-circle", "text-red-500"); 
        } 
        window.preparePaymentGateway(); 
    }
};



window.preparePaymentGateway = function() {
    const t = document.getElementById('comm-type') ? document.getElementById('comm-type').value : 'Standard Order', c = document.getElementById('comm-colors') ? document.getElementById('comm-colors').value.trim() : 'No notes', dims = document.getElementById('comm-dimensions') ? document.getElementById('comm-dimensions').value.trim() : ''; 
    const giftNote = document.getElementById('is-gift-toggle')?.checked ? document.getElementById('comm-gift-note').value.trim() : '';
    showInteractionLoader("Securing Order Engine...");
    let ss = 0, tpt = "", its = []; 
    const listToRender = window.buyNowPayload ? [window.buyNowPayload] : cart;
    listToRender.forEach((i) => { const cp = Number(String(i.price || 0).replace(/[^0-9.,]/g, '')), q = parseInt(i.qty || 1); ss += (cp * q); its.push({ id: i.id, name: i.name, price: cp, qty: q, image: i.image || i.image1 }); }); 
    tpt = calculateTotalPrepTime(listToRender);
    const ta = savedAddresses[selectedAddressIndex]; currentDeliveryFee = calculateDynamicDelivery(ss, ta.pincode, cart);
    const { discount: vd } = calculateCartDiscount(ss); 
    let cd = 0;
    if (activeCouponValue > 0) {
        if (window.activeCouponType === 'flat') cd = activeCouponValue;
        else {
            cd = Math.round(ss * (activeCouponValue / 100));
            if (window.activeCouponMax && cd > window.activeCouponMax) cd = window.activeCouponMax;
        }
    }
    if ((cd + vd) > ss) cd = Math.max(0, ss - vd);
    
    currentUpiDiscount = (paymentMethod === 'upi' && ss > 300) ? Math.min(50, Math.max(0, ss - vd - cd)) : 0;
    const ft = Math.max(0, ss - vd - cd - currentUpiDiscount) + currentDeliveryFee; 
    
    let rawPhone = ta.phone.replace(/\D/g, '');
if (rawPhone.startsWith('91') && rawPhone.length > 10) rawPhone = rawPhone.substring(2);
const scc = (settings.countryCode || '+91'), fcp = scc + " " + rawPhone; let fa = `${ta.address_1}, ${ta.address_2 ? ta.address_2 + ', ' : ''}${ta.city}, ${ta.state} - ${ta.pincode}`;
    const cln = ta.first_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10); currentOrderReference = `TH_${cln}_${String(Date.now()).slice(-4)}`; 
    
    let ad = `ID: ${currentOrderReference} | Ph: ${fcp} | Patron: ${ta.first_name} ${ta.last_name || ''} | Email: ${ta.email} | Address: ${fa} | Purpose: ${t} | Notes: ${c} | Delivery Fee: ₹${currentDeliveryFee}`; 
    if(giftNote) ad += ` | Gift Message: "${giftNote}"`;
    if(activeCouponValue > 0) ad += ` | Coupon: ${activeCouponCode} (-₹${cd})`; 
    if(currentUpiDiscount > 0) ad += ` | UPI Discount: (-₹${currentUpiDiscount})`;
    if(dims && document.getElementById('comm-dimensions-wrapper') && !document.getElementById('comm-dimensions-wrapper').classList.contains('hidden')) ad += ` | Size: ${dims}`; 
    ad += ` | Est. Prep: ${tpt}`;
    const fmt = Number(ft).toFixed(2), uId = (settings.upiId || "khushisj315@oksbi").trim(), uLnk = `upi://pay?pa=${uId}&pn=Twisted_Happiness&am=${fmt}&cu=INR&tn=${currentOrderReference}`;
    pendingOrderPayload = {
    order_details: JSON.stringify(its),
    subtotal: ss,
    discount: vd + cd + currentUpiDiscount,
    total: ft,
    customer_reqs: ad,
    status: 'pending',
    user_id: currentSessionUser ? currentSessionUser.id : null,
    payment_method: paymentMethod,
    payment_status: paymentMethod === 'cod' ? 'pending' : 'paid'
};
    setTimeout(() => { 
        checkoutStep = 3; 
        if(document.getElementById('checkout-payment-amount')) document.getElementById('checkout-payment-amount').textContent = `₹${fmt}`; 
        
        const vb = document.getElementById('btn-confirm-payment'); 
        if(vb) { 
            vb.innerHTML = paymentMethod === 'cod' ? 'Confirm COD Order <i class="fas fa-box"></i>' : 'I Have Completed Payment <i class="fas fa-check-circle"></i>'; 
            vb.disabled = false; 
        } 
        
        // Generate QR / Deep link ONLY if UPI is selected
        if (paymentMethod === 'upi') {
            if (isMobileDevice()) { 
                if(document.getElementById('payment-mobile-btn')) document.getElementById('payment-mobile-btn').href = uLnk; 
                document.getElementById('payment-mobile-container')?.classList.remove('hidden'); 
                document.getElementById('payment-qr-container')?.classList.add('hidden'); 
            } else { 
                const qrUrl = `https://quickchart.io/qr?size=250&margin=2&text=${encodeURIComponent(uLnk)}`; 
                if(document.getElementById('payment-qr-img')) document.getElementById('payment-qr-img').src = qrUrl; 
                document.getElementById('payment-qr-container')?.classList.remove('hidden'); 
                document.getElementById('payment-mobile-container')?.classList.add('hidden'); 
            }
        }
        
        updateCheckoutUI(); 
        document.getElementById('checkout-overlay')?.scrollTo({top: 0, behavior: 'smooth'}); 
        hideInteractionLoader(); 
    }, 1500); 
};

window.confirmPaymentAndOrder = async function() {
    if(!pendingOrderPayload) return; 
    const b = document.getElementById('btn-confirm-payment'); 
    if(b) { b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Securing Order...'; b.disabled = true; }
    
    const listToRender = window.buyNowPayload ? [window.buyNowPayload] : cart;
    const itemsToProcess = listToRender.map(i => ({ id: i.id, qty: i.qty }));
    const currentAddress = savedAddresses[selectedAddressIndex];
    
    // Extract raw non-financial details to allow the backend to build the order strictly
    const commType = document.getElementById('comm-type') ? document.getElementById('comm-type').value : 'Standard Order';
    const commColors = document.getElementById('comm-colors') ? document.getElementById('comm-colors').value.trim() : 'No notes';
    const dims = document.getElementById('comm-dimensions') ? document.getElementById('comm-dimensions').value.trim() : '';
    const giftNote = document.getElementById('is-gift-toggle')?.checked ? document.getElementById('comm-gift-note').value.trim() : '';
    
    const securePayload = {
        items: itemsToProcess,
        address: currentAddress,
        orderReference: currentOrderReference,
        couponCode: typeof activeCouponCode !== 'undefined' ? activeCouponCode : '',
        notes: {
            type: commType,
            colors: commColors,
            dimensions: dims,
            gift: giftNote
        },
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cod' ? 'pending' : 'paid',
        status: 'pending'
    };

    try {
        const { data, error } = await _supabase.functions.invoke('create-order', {
            body: securePayload
        });
        
        if (error) throw error;
        if (data && data.error) throw new Error(data.error);

        document.getElementById('payment-gateway-view')?.classList.add('hidden'); 
        document.getElementById('payment-gateway-view')?.classList.remove('flex'); 
        if(document.getElementById('success-ref-note')) document.getElementById('success-ref-note').textContent = currentOrderReference; 
        document.getElementById('payment-success-view')?.classList.remove('hidden'); 
        document.getElementById('payment-success-view')?.classList.add('flex');
        
        if (!window.buyNowPayload) {
            cart = []; localStorage.setItem('th_cart', JSON.stringify(cart)); updateCartCount(); 
        }
        window.buyNowPayload = null;
    } catch(err) {
        console.error("Order Error:", err);
        window.showToast(err.message || "Error Securing Order", "fa-times", "text-red-500");
        if(b) { b.innerHTML = 'I Have Completed Payment <i class="fas fa-check-circle"></i>'; b.disabled = false; }
    }
};

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
            let step = 1; let statusText = "Verifying Payment";
            if (o.status === 'curating') { step = 2; statusText = "Artisan is Crafting"; }
            else if (o.status === 'ready') { step = 3; statusText = "Ready for Dispatch"; }
            else if (o.status === 'shipped' || o.status === 'dispatched' || o.status === 'out_for_delivery') { step = 3; statusText = "Shipped / In Transit"; }
            else if (o.status === 'completed' || o.status === 'delivered') { step = 4; statusText = "Delivered"; }
            else if (o.status === 'cancelled') { step = 0; statusText = "Cancelled / Denied"; }

            const idm = (o.customer_reqs || '').match(/ID:\s*([^|]+)/); 
            const exId = idm ? idm[1].trim() : 'TH_ORDER'; 

            let itemsHtml = '';
            try { const items = JSON.parse(o.order_details); items.forEach(i => { itemsHtml += `<img src="${i.image}" class="w-10 h-10 rounded-md object-cover border border-luxury-blush bg-luxury-bg shrink-0" title="${i.name} (x${i.qty})">`; }); } catch(e) {}

            let invoiceBtnHtml = '';
            if (step >= 3 && step < 4) {
                let trackUrl = "#";
                let awb = "Pending Sync";
                if (o.tracking_data) {
                    try {
                        const t = typeof o.tracking_data === 'string' ? JSON.parse(o.tracking_data) : o.tracking_data;
                        if (t.awb && t.awb !== 'Pending') { awb = t.awb; trackUrl = `https://shiprocket.co/tracking/${awb}`; }
                    } catch(e) {}
                }
                
                invoiceBtnHtml = `
                <div class="mt-4 w-full bg-blue-50/50 border border-blue-100 py-4 px-4 rounded-xl flex flex-col items-center shadow-sm gap-3">
                    <div class="text-center">
                        <h5 class="font-bold text-[11px] text-luxury-dark uppercase tracking-widest mb-1"><i class="fas fa-truck-fast mr-1 text-blue-500"></i> ${o.status === 'out_for_delivery' ? 'Out for Delivery' : 'Order Dispatched'}</h5>
                        <p class="text-[9px] text-gray-500 uppercase tracking-widest">AWB: ${awb}</p>
                    </div>
                    ${awb !== 'Pending Sync' 
                        ? `<a href="${trackUrl}" target="_blank" rel="noopener noreferrer" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-widest py-3 rounded-lg shadow-sm transition-colors text-center flex justify-center items-center gap-2"><i class="fas fa-location-arrow"></i> Track Live Status</a>` 
                        : `<div class="w-full bg-gray-200 text-gray-500 font-bold text-[10px] uppercase tracking-widest py-3 rounded-lg text-center flex justify-center items-center gap-2"><i class="fas fa-spinner fa-spin"></i> Generating Tracking Link...</div>`
                    }
                </div>`;
            } else if (step === 4) {
                const encodedOrder = encodeURIComponent(JSON.stringify({id: exId, date: dt, items: o.order_details, total: o.total, reqs: o.customer_reqs}));
                invoiceBtnHtml = `<button type="button" onclick="window.generateGirlyInvoice('${encodedOrder}')" class="mt-4 w-full bg-[#FFF0F2] text-luxury-rose hover:bg-luxury-rose hover:text-white border border-luxury-rose/30 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-colors shadow-sm flex justify-center items-center gap-2"><i class="fas fa-file-download"></i> Download Official Invoice</button>`;
            } else if (step === 3) {
                let trackUrl = "#";
                let awb = "Pending";
                if (o.tracking_data) {
                    try {
                        const t = typeof o.tracking_data === 'string' ? JSON.parse(o.tracking_data) : o.tracking_data;
                        if (t.awb && t.awb !== 'Pending') { awb = t.awb; trackUrl = `https://shiprocket.co/tracking/${awb}`; }
                    } catch(e) {}
                }
                
                invoiceBtnHtml = `
                <div class="mt-4 w-full bg-blue-50/50 border border-blue-100 py-4 px-4 rounded-xl flex flex-col items-center shadow-sm gap-3">
                    <div class="text-center">
                        <h5 class="font-bold text-[11px] text-luxury-dark uppercase tracking-widest mb-1"><i class="fas fa-box-open mr-1 text-blue-500"></i> Order Dispatched</h5>
                        <p class="text-[9px] text-gray-500 uppercase tracking-widest">AWB: ${awb}</p>
                    </div>
                    ${awb !== 'Pending' 
                        ? `<a href="${trackUrl}" target="_blank" rel="noopener noreferrer" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-widest py-3 rounded-lg shadow-sm transition-colors text-center flex justify-center items-center gap-2"><i class="fas fa-location-arrow"></i> Track Your Order</a>` 
                        : `<div class="w-full bg-gray-200 text-gray-500 font-bold text-[10px] uppercase tracking-widest py-3 rounded-lg text-center flex justify-center items-center gap-2"><i class="fas fa-spinner fa-spin"></i> Generating Tracking Link...</div>`
                    }
                </div>`;
            }

            let progressBarHtml = '';
            if (step > 0) {
                progressBarHtml = `
                <div class="mt-5 px-2 pb-2">
                    <div class="relative pl-6 border-l-2 ${step >= 4 ? 'border-green-500' : 'border-gray-200'} space-y-6 font-sans">
                        
                        <!-- Step 1: Order Pending / Confirmed -->
                        <div class="relative">
                            <div class="absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white ${step === 1 ? 'bg-yellow-400' : (step >= 2 ? 'bg-green-500' : 'bg-gray-300')} shadow-sm z-10"></div>
                            <h5 class="font-bold text-[13px] ${step === 1 ? 'text-yellow-600' : (step >= 2 ? 'text-gray-900' : 'text-gray-400')}">${step === 1 ? 'Order Pending' : 'Order Confirmed'}</h5>
                            <p class="text-[10px] text-gray-400 mb-1">${dt}</p>
                            ${step === 1 ? `<p class="text-[11px] text-gray-600 mt-1">Awaiting payment verification by the artisan.</p>` : (step >= 2 ? `<p class="text-[11px] text-gray-600 mt-1">Your order has been placed successfully and payment is verified.</p>` : '')}
                        </div>
                        
                        <!-- Step 2: Crafting / Processed -->
                        <div class="relative">
                            <div class="absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white ${step >= 2 ? 'bg-green-500' : 'bg-gray-300'} shadow-sm z-10"></div>
                            <h5 class="font-bold text-[13px] ${step >= 2 ? 'text-gray-900' : 'text-gray-400'}">Artisan is Crafting</h5>
                            ${step >= 2 ? `<p class="text-[11px] text-gray-600 mt-1">Seller has processed your order. Our artisan is currently handcrafting your piece.</p>` : ''}
                        </div>
                        
                        <!-- Step 3: Shipped -->
                        <div class="relative">
                            <div class="absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white ${step >= 3 ? 'bg-green-500' : 'bg-gray-300'} shadow-sm z-10"></div>
                            <h5 class="font-bold text-[13px] ${step >= 3 ? 'text-gray-900' : 'text-gray-400'}">Shipped</h5>
                            ${step >= 3 ? `<p class="text-[11px] text-gray-600 mt-1">Your item has been securely packaged and picked up by our delivery partner.</p>` : ''}
                        </div>
                        
                        <!-- Step 4: Delivered -->
                        <div class="relative">
                            <div class="absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white ${step >= 4 ? 'bg-green-500' : 'bg-gray-300'} shadow-sm z-10"></div>
                            <h5 class="font-bold text-[13px] ${step >= 4 ? 'text-green-600' : 'text-gray-400'}">Delivered</h5>
                            ${step >= 4 ? `<p class="text-[11px] text-gray-600 mt-1">Your item has been delivered. Thank you for shopping with us!</p>` : ''}
                        </div>

                    </div>
                </div>`;
            } else { 
                progressBarHtml = `
                <div class="mt-4 p-4 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3">
                    <i class="fas fa-times-circle text-red-500 text-lg"></i>
                    <div>
                        <h5 class="font-bold text-[12px] text-red-600 uppercase tracking-widest">Order Cancelled</h5>
                        <p class="text-[10px] text-red-400 mt-0.5">This order was cancelled or payment verification failed.</p>
                    </div>
                </div>`; 
            } 
            
            // Restoring the missing HTML append line and closing loop bracket
            const payBadgeHtml = o.payment_method === 'cod' 
                ? `<span class="bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ml-2 inline-block shadow-sm">COD</span>` 
                : `<span class="bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ml-2 inline-block shadow-sm">UPI</span>`;
                
            html += `<div class="border border-luxury-blush rounded-xl p-4 sm:p-6 mb-4 bg-white shadow-sm hover:border-luxury-rose/50 transition-colors"><div class="flex justify-between items-start border-b border-luxury-blush pb-4 mb-4"><div><h4 class="font-bold text-[12px] text-luxury-dark uppercase tracking-widest mb-1 flex items-center">Order ${exId} ${payBadgeHtml}</h4><p class="text-[10px] text-gray-500">${dt}</p></div><div class="text-right"><span class="font-poppins font-bold text-luxury-dark text-[14px]">₹${o.total}</span></div></div><div class="flex gap-2 overflow-x-auto scrollbar-hide py-1 mb-2">${itemsHtml}</div>${progressBarHtml}${invoiceBtnHtml}</div>`;
        });
        
        c.innerHTML = html; 
    } catch(err) { c.innerHTML = '<div class="text-center text-red-500 py-4 text-xs">Failed to load archive.</div>'; }
}

window.openTrackOrderModal = function() { document.getElementById('track-order-id-guest').value = ''; document.getElementById('track-result-container-guest').classList.add('hidden'); window.openPolicyModal('track-order-modal', 'track-order-box'); };
window.closeTrackOrderModal = function() { window.closePolicyModal('track-order-modal', 'track-order-box'); };



async function handleTrackOrderGuest(e) {
    e.preventDefault(); const oid = document.getElementById('track-order-id-guest').value.trim(); if(!oid) return; const b = document.getElementById('btn-track-submit-guest'); const oTxt = b.innerHTML; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...'; b.disabled = true;
    try { const { data, error } = await _supabase.from('orders').select('status').ilike('customer_reqs', `%${oid}%`).limit(1); if (error) throw error; const rc = document.getElementById('track-result-container-guest'), rs = document.getElementById('track-result-status-guest'), rd = document.getElementById('track-result-desc-guest'); if(data && data.length > 0) { const s = data[0].status; rc.classList.remove('hidden'); if(s === 'new' || s === 'pending') { rs.textContent = "Order Pending"; rs.className = "font-poppins font-bold text-yellow-600 text-lg tracking-wide mb-2"; rd.textContent = "We have received your request and are awaiting payment verification by the artisan. We will begin crafting shortly!"; } else if (s === 'curating') { rs.textContent = "Artisan is Crafting"; rs.className = "font-poppins font-bold text-luxury-gold text-lg tracking-wide mb-2"; rd.textContent = "Your payment is verified and our artisan is currently pouring love into your handcrafted piece."; } else if (s === 'ready') { rs.textContent = "Ready for Dispatch"; rs.className = "font-poppins font-bold text-purple-600 text-lg tracking-wide mb-2"; rd.textContent = "Your masterpiece is complete, securely packaged, and awaiting courier pickup."; } else if (s === 'completed') { rs.textContent = "Elegantly Delivered"; rs.className = "font-poppins font-bold text-green-600 text-lg tracking-wide mb-2"; rd.textContent = "Your order has been successfully delivered. Thank you for curating your space!"; } } else { rc.classList.remove('hidden'); rs.textContent = "Not Found"; rs.className = "font-poppins font-bold text-red-500 text-lg tracking-wide mb-2"; rd.textContent = "We couldn't find an active order with that reference ID."; } } catch(err) { window.showToast("Network Error", "fa-times", "text-red-500"); } b.innerHTML = oTxt; b.disabled = false;
}

window.openLightboxFromCarousel = function() { currentLightboxIndex = currentSlideIndex; const lb = document.getElementById('lightbox-modal'); const tr = document.getElementById('lightbox-track'); if(!lb || !tr) return; tr.innerHTML = ''; modalImages.forEach((src) => { tr.innerHTML += `<div class="w-full h-full flex-shrink-0 flex items-center justify-center p-2 md:p-8"><img loading="lazy" decoding="async" src="${src}" class="w-full max-h-full object-contain"></div>`; }); tr.style.transition = 'none'; tr.style.transform = `translateX(-${currentLightboxIndex * 100}%)`; document.getElementById('lightbox-counter').textContent = `${currentLightboxIndex + 1} / ${modalImages.length}`; currentModalLevel = 2; window.safePushState(2); lb.classList.remove('hidden'); requestAnimationFrame(() => { lb.classList.remove('opacity-0'); }); setupLightboxTouch(); };
window.forceCloseLightbox = function() { const lb = document.getElementById('lightbox-modal'); if(!lb) return; requestAnimationFrame(() => { lb.classList.add('opacity-0'); setTimeout(() => { lb.classList.add('hidden'); }, 200); }); };
window.moveLightboxSlide = function(dir) { if (isLightboxAnimating) return; isLightboxAnimating = true; currentLightboxIndex += dir; if (currentLightboxIndex < 0) currentLightboxIndex = modalImages.length - 1; if (currentLightboxIndex >= modalImages.length) currentLightboxIndex = 0; const tr = document.getElementById('lightbox-track'); if(!tr) return; requestAnimationFrame(() => { tr.style.transition = 'transform 0.4s ease-out'; tr.style.transform = `translateX(-${currentLightboxIndex * 100}%)`; }); document.getElementById('lightbox-counter').textContent = `${currentLightboxIndex + 1} / ${modalImages.length}`; setTimeout(() => { isLightboxAnimating = false; }, 400); };
window.moveSlide = function(dir) { 
    let targetId = '';
    // If clicking left on the first slide, slide smoothly into the clone!
    if (currentSlideIndex === 0 && dir === -1 && modalImages.length > 1) { targetId = 'slide-clone-last'; } 
    // If clicking right on the last slide, slide smoothly into the clone!
    else if (currentSlideIndex === modalImages.length - 1 && dir === 1 && modalImages.length > 1) { targetId = 'slide-clone-first'; } 
    else { 
        currentSlideIndex += dir; 
        if (currentSlideIndex < 0) currentSlideIndex = 0; 
        if (currentSlideIndex >= modalImages.length) currentSlideIndex = modalImages.length - 1; 
        targetId = `slide-${currentSlideIndex}`; 
    }
    const target = document.getElementById(targetId); 
    if(target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); 
};

window.goToSlide = function(idx) { 
    currentSlideIndex = idx; 
    const target = document.getElementById(`slide-${currentSlideIndex}`); 
    if(target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); 
};

function setupTouchCarousel() { 
    // The Amazon loop is now handled natively via DOM cloning in openProductPage!
    // No custom drag math needed.
}
function setupLightboxTouch() { let lsX = 0, leX = 0; const tr = document.getElementById('lightbox-track'); if(tr) { tr.replaceWith(tr.cloneNode(true)); const nt = document.getElementById('lightbox-track'); nt.addEventListener('touchstart', (e) => { lsX = e.changedTouches[0].screenX; }, {passive: true}); nt.addEventListener('touchend', (e) => { leX = e.changedTouches[0].screenX; requestAnimationFrame(() => { if (leX < lsX - 30) window.moveLightboxSlide(1); else if (leX > lsX + 30) window.moveLightboxSlide(-1); }); }, {passive: true}); } }
function updateActiveThumb(aIdx, tot) { requestAnimationFrame(() => { for(let i = 0; i < tot; i++) { const th = document.getElementById(`thumb-${i}`); if(th) { if(i === aIdx) { th.classList.add('border-luxury-rose', 'scale-105', 'opacity-100'); th.classList.remove('border-transparent', 'opacity-60'); } else { th.classList.remove('border-luxury-rose', 'scale-105', 'opacity-100'); th.classList.add('border-transparent', 'opacity-60'); } } } }); }

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

let pincodeTimeout;
function handlePincodeInput(e) {
    if (document.getElementById('checkout-overlay') && !document.getElementById('checkout-overlay').classList.contains('hidden')) updateCheckoutUI();
    const pin = e.target.value.trim();
    if (pin.length === 6 && /^\d+$/.test(pin)) {
        clearTimeout(pincodeTimeout); pincodeTimeout = setTimeout(() => fetchCityStateFromPin(pin), 400);
    } else { document.getElementById('prof-city').value = ''; document.getElementById('prof-state').value = ''; }
}

async function fetchCityStateFromPin(pincode) {
    const loader = document.getElementById('pin-loader'), cityInput = document.getElementById('prof-city'), stateInput = document.getElementById('prof-state');
    if (loader) loader.classList.remove('hidden');
    try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`); 
        const data = await response.json();
        
        // Fix: Ensure PostOffice exists and has elements
        if (data && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
            const postOffice = data[0].PostOffice[0];
            cityInput.value = postOffice.District || postOffice.Region; 
            stateInput.value = postOffice.State;
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
        window.showToast("Network error while fetching location.", "fa-wifi", "text-yellow-500"); 
    } finally { 
        if (loader) loader.classList.add('hidden'); 
    }
}

window.prepareReviewForm = async function() {
    if(!currentSessionUser) return window.openCustomerAuthModal();
    const pid = document.getElementById('product-view').getAttribute('data-current-id');
    const { data: verified } = await _supabase.from('orders').select('status').eq('user_id', currentSessionUser.id).ilike('order_details', `%${pid}%`);
    const isDelivered = verified && verified.some(o => o.status === 'completed');
    
    if (!isDelivered) { return window.showToast("Reviews unlock after delivery! 🎁", "fa-lock", "text-luxury-rose"); }
    
    window.setReviewRating(5);
    document.getElementById('review-comment').value = '';
    window.openPolicyModal('review-modal', 'review-box');
};

window.closeReviewModal = function() { window.closePolicyModal('review-modal', 'review-box'); };

window.setReviewRating = function(rating) {
    document.getElementById('review-rating-val').value = rating;
    const stars = document.getElementById('review-stars-container').children;
    for(let i=0; i<5; i++) { stars[i].className = i < rating ? "fas fa-star cursor-pointer text-luxury-gold transition-colors" : "fas fa-star cursor-pointer text-gray-300 transition-colors hover:text-luxury-gold"; }
};

document.getElementById('review-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const pid = document.getElementById('product-view').getAttribute('data-current-id');
    const r = document.getElementById('review-rating-val').value;
    const c = document.getElementById('review-comment').value;
    window.th_submitReview(pid, r, c);
    window.closeReviewModal();
});

window.th_submitReview = async function(pid, rating, comment) {
    if (!currentSessionUser) {
        window.showToast("Please sign in to leave a review.", "fa-user-lock", "text-luxury-rose");
        return;
    }

    try {
        const { error } = await _supabase.from('reviews').insert([{ 
            product_id: pid, 
            user_id: currentSessionUser.id, 
            rating: parseInt(rating), 
            comment: comment.trim() 
        }]);
        
        if (error) {
            console.error("Review Security Rejection:", error);
            window.showToast("Failed to verify qualifying purchase.", "fa-times", "text-red-500");
        } else {
            window.showToast("Review Posted!", "fa-star", "text-luxury-gold");
        }
    } catch(err) {
        window.showToast("Network error submitting review.", "fa-wifi", "text-red-500");
    }
};

window.generateGirlyInvoice = function(encodedOrder) {
    try {
        const o = JSON.parse(decodeURIComponent(encodedOrder));
        
        // Security: Escape HTML to prevent XSS in print window
        const escapeHTML = (str) => String(str ?? '').replace(/[&<>'"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[m]);
        
        let itemsHtml = '';
        JSON.parse(o.items).forEach(i => { 
            itemsHtml += `<tr>
                <td style="padding:12px; border-bottom:1px solid #fce4e8; font-size:12px; color:#4a4a4a;">${escapeHTML(i.name)}</td>
                <td style="padding:12px; border-bottom:1px solid #fce4e8; font-size:12px; color:#4a4a4a; text-align:center;">${escapeHTML(i.qty)}</td>
                <td style="padding:12px; border-bottom:1px solid #fce4e8; font-size:12px; color:#4a4a4a; text-align:right;">₹${escapeHTML(i.price)}</td>
            </tr>`; 
        });
        
        const deliveryDate = o.delivery_date 
            ? new Date(o.delivery_date).toLocaleDateString('en-IN') 
            : (o.date || new Date().toLocaleDateString('en-IN'));
            
        const safeReqs = escapeHTML(o.reqs).replace(/ \| /g, '<br>');
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
        <html>
        <head>
            <title>Invoice - ${escapeHTML(o.id)}</title>
            <link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Poppins', sans-serif; background-color: #fffafb; margin: 0; padding: 40px; color: #333; }
                .invoice-box { max-width: 800px; margin: auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(217,119,138,0.1); border: 2px solid #fce4e8; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #fce4e8; padding-bottom: 20px; margin-bottom: 30px; }
                .logo { font-family: 'Marcellus', serif; font-size: 28px; color: #D9778A; margin: 0; }
                .sub-logo { font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #a89f9f; }
                .title { font-size: 32px; font-weight: 700; color: #D9778A; margin: 0; text-transform: uppercase; letter-spacing: 2px; }
                .details-row { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 12px; line-height: 1.8; color: #666; }
                .highlight { font-weight: 700; color: #4a4a4a; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { background-color: #FFF0F2; color: #D9778A; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; padding: 15px 12px; text-align: left; }
                .total-row { display: flex; justify-content: flex-end; font-size: 18px; font-weight: 700; color: #D9778A; margin-top: 20px; border-top: 2px solid #fce4e8; padding-top: 20px; }
                .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #a89f9f; }
                .heart { color: #D9778A; }
            </style>
        </head>
        <body>
            <div class="invoice-box">
                <div class="header">
                    <div><h1 class="logo">Twisted Happiness</h1><div class="sub-logo">Fine Art & Handcrafted Gifts</div></div>
                    <h2 class="title">Invoice</h2>
                </div>
                <div class="details-row">
                    <div>
                        <span class="highlight">Order Ref:</span> ${escapeHTML(o.id)}<br>
                        <span class="highlight">Order Date:</span> ${escapeHTML(o.date)}<br>
                        <span class="highlight">Delivery Date:</span> ${escapeHTML(deliveryDate)}
                    </div>
                    <div style="text-align: right; max-width: 250px;"><span class="highlight">Delivered To:</span><br>${safeReqs}</div>
                </div>
                <table>
                    <thead><tr><th>Item Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th></tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div class="total-row">Grand Total: ₹${escapeHTML(o.total)}</div>
                <div class="footer">Thank you for curating your space with us! Made with <span class="heart">♥</span> in India.<br><br><i>This is a computer-generated official receipt.</i></div>
            </div>
            <script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); }</script>
        </body>
        </html>
        `);
        printWindow.document.close();
    } catch(e) { window.showToast("Failed to generate invoice", "fa-times", "text-red-500"); }
};

// ==========================================
// AI Care Guide Generator & Cache Engine (Via Supabase)
// ==========================================

window.fetchAICareGuide = async function(category) {
    let cache = safeJSONParse('th_care_guides_cache', {});
    
    // 1. Fetch from Local Cache (Prevents redundant API calls)
    if (cache[category]) return cache[category];

    // 2. Pre-defined fallbacks for core inventory
    const known = {
        'Canvas Paintings': `<li>Keep away from direct sunlight to prevent color fading.</li><li>Dust gently with a dry, soft microfiber cloth.</li><li>Do not use chemical cleaners or water.</li><li>Keep in a dry environment to prevent canvas warping.</li><li>Avoid extreme temperature fluctuations to protect the paint.</li>`,
        'Clay Art Paintings': `<li>Handle with utmost care; textured elements are fragile.</li><li>Dust lightly using a soft-bristled makeup or artist brush.</li><li>Avoid hanging in high-humidity areas like bathrooms.</li><li>Do not press or lean objects against the 3D surface.</li><li>If a small piece detaches, carefully reattach with clear craft adhesive.</li>`,
        'Pipe Cleaner Crafts': `<li>Keep away from moisture and liquids to prevent rusting of the internal wire.</li><li>Fluff gently with fingers if crushed.</li><li>Use a lint roller lightly or a blow dryer on cool setting to remove dust.</li><li>Avoid prolonged exposure to direct sunlight.</li><li>Store in a rigid, dust-free box when not on display.</li>`
    };
    if(known[category]) { 
        cache[category] = known[category]; 
        localStorage.setItem('th_care_guides_cache', JSON.stringify(cache)); 
        return known[category]; 
    }

    // 3. Live AI Generation via Secure Supabase Edge Function
    try {
        const { data, error } = await _supabase.functions.invoke('generate-care-guide', {
            body: { category: category }
        });
        
        if (error) throw error;
        if (!data || !data.html) throw new Error("Invalid response from secure backend");

        const aiHtml = data.html;
        
        // Push generated data to cache
        cache[category] = aiHtml;
        localStorage.setItem('th_care_guides_cache', JSON.stringify(cache));
        return aiHtml;
    } catch(e) {
        console.error("AI Generation failed:", e);
        return `<li>Handle with care to maintain original condition.</li><li>Keep away from direct sunlight and moisture.</li><li>Clean gently with a soft, dry cloth.</li><li>Avoid dropping or placing heavy objects on the item.</li><li>Store in a clean, dust-free environment.</li>`;
    }
};

window.th_toggleSubCategory = function(cat) { const idx = activeSubCategories.indexOf(cat); if(idx > -1) { activeSubCategories.splice(idx, 1); } else { activeSubCategories.push(cat); } renderFilters(); renderProducts(currentSearchQuery); };

window.openPolicyModal = function(mId, bId) { currentModalLevel = 2; window.safePushState(2); const mod = document.getElementById(mId); const bx = document.getElementById(bId); if(!mod || !bx) return; mod.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); requestAnimationFrame(() => { mod.classList.remove('opacity-0'); bx.classList.remove('scale-95', 'translate-y-2'); bx.classList.add('scale-100', 'translate-y-0'); }); };
window.closePolicyModal = function(mId, bId) { const mod = document.getElementById(mId); const bx = document.getElementById(bId); if(!mod || !bx) return; requestAnimationFrame(() => { mod.classList.add('opacity-0'); bx.classList.remove('scale-100', 'translate-y-0'); bx.classList.add('scale-95', 'translate-y-2'); setTimeout(() => { mod.classList.add('hidden'); if(document.getElementById('checkout-overlay')?.classList.contains('hidden')) { document.body.classList.remove('overflow-hidden'); } }, 200); }); };
// --- END OF FILE ---