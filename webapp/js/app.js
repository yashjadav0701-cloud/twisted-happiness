/**
 * Twisted Happiness - Enterprise Storefront Engine
 * Version: 11.0.0 - Fully Stable Unminified Build, Cache Defender, Safe Database Fetching
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
    "+91": "🇮🇳 IN (+91)", 
    "+1": "🇺🇸 US (+1)", 
    "+44": "🇬🇧 UK (+44)" 
};

// 🛡️ DEFENSIVE CACHE PARSER (Prevents Blank Screens)
function safeJSONParse(key, fallback) { 
    try { 
        const item = localStorage.getItem(key); 
        const parsed = item ? JSON.parse(item) : fallback; 
        if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
        return parsed;
    } catch (e) { 
        localStorage.removeItem(key); 
        return fallback; 
    } 
}

// 📦 GLOBAL STATE
let settings = safeJSONParse('th_settings', { storeName: "Twisted Happiness", instagram: "", whatsapp: "9909310501", upiId: "khushisj315@oksbi", countryCode: "+91" });
let cart = safeJSONParse('th_cart', []); 
let localWishlist = safeJSONParse('th_wishlist', []);
let savedAddresses = safeJSONParse('th_saved_addresses', []);

let products = []; 
let currentMainCategory = 'All'; 
let activeSubCategories = []; 
let currentSortMode = 'newest'; 
let currentSearchQuery = ''; 
let searchTimeout = null; 
let modalImages = []; 
let currentSlideIndex = 0; 
let isAnimating = false; 
let currentLightboxIndex = 0; 
let isLightboxAnimating = false; 
let currentModalLevel = 0; 
let statePushed = false;

// Checkout State
let checkoutStep = 1; 
let pendingOrderPayload = null; 
let currentOrderReference = null; 
let currentDeliveryFee = 0; 
let activeCouponValue = 0; 
let activeCouponCode = "";

// Auth & Address State
let selectedAddressIndex = savedAddresses.length > 0 ? 0 : -1; 
let editingAddressIndex = null; 
let currentSessionUser = null; 
let authModalMode = "login"; 

// 🚀 INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    try { 
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 
        setupAuthSessionListener(); 
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

// 🚨 PRELOADER & LOADERS
function dismissPreloader() {
    const preloader = document.getElementById('luxury-page-preloader');
    if (preloader && !preloader.classList.contains('hidden')) {
        preloader.style.opacity = '0';
        preloader.style.pointerEvents = 'none';
        setTimeout(() => preloader.remove(), 700);
    }
}

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

// 🚨 AUTHENTICATION 🚨
function setupAuthSessionListener() {
    _supabase.auth.onAuthStateChange((event, session) => {
        currentSessionUser = session ? session.user : null;
        const btn = document.getElementById('header-account-btn');
        if (btn) {
            btn.innerHTML = currentSessionUser ? `<i class="fas fa-user-check text-[#D9778A] text-lg"></i>` : `<i class="far fa-user text-lg"></i>`;
        }
        if (currentSessionUser) syncCloudWishlist();
        if (document.getElementById('checkout-overlay') && !document.getElementById('checkout-overlay').classList.contains('hidden')) {
            syncCloudAddresses();
        }
    });
}

function handleAccountHeaderClick() { 
    if (currentSessionUser) openCustomerProfile(); 
    else openCustomerAuthModal(); 
}

function openCustomerAuthModal() { 
    authModalMode = "login"; 
    document.getElementById('auth-panel-heading').textContent = "Welcome Back"; 
    document.getElementById('btn-auth-submit').textContent = "Sign In"; 
    document.getElementById('customer-auth-form').reset(); 
    openPolicyModal('customer-auth-modal', 'customer-auth-box'); 
}

function closeCustomerAuthModal() { 
    closePolicyModal('customer-auth-modal', 'customer-auth-box'); 
}

function toggleAuthViewMode() {
    authModalMode = (authModalMode === "login") ? "signup" : "login";
    document.getElementById('auth-panel-heading').textContent = authModalMode === "login" ? "Welcome Back" : "Create Account";
    document.getElementById('btn-auth-submit').textContent = authModalMode === "login" ? "Sign In" : "Register Account";
}

async function handleAuthFormSubmit(e) {
    e.preventDefault(); 
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('btn-auth-submit');
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; 
    btn.disabled = true;
    
    try {
        if (authModalMode === "login") {
            const { error } = await _supabase.auth.signInWithPassword({ email, password }); 
            if (error) throw error; 
            showToast("Welcome Back!", "fa-user-check");
        } else {
            const { error } = await _supabase.auth.signUp({ email, password }); 
            if (error) throw error; 
            showToast("Registration Successful!", "fa-check-circle");
        }
        closeCustomerAuthModal();
    } catch(err) { 
        alert(err.message); 
    } finally { 
        btn.innerHTML = authModalMode === "login" ? "Sign In" : "Register Account"; 
        btn.disabled = false; 
    }
}

async function handleGoogleOAuthLogin() { 
    try { 
        const { error } = await _supabase.auth.signInWithOAuth({ 
            provider: 'google', 
            options: { redirectTo: window.location.origin } 
        }); 
        if (error) throw error; 
    } catch (err) { alert(err.message); } 
}

async function openCustomerProfile() { 
    if(!currentSessionUser) return; 
    currentModalLevel = 1; safePushState(1); 
    const overlay = document.getElementById('customer-profile-overlay'); 
    document.getElementById('profile-meta-email').textContent = currentSessionUser.email; 
    overlay.classList.remove('hidden'); 
    document.body.classList.add('overflow-hidden'); 
    renderCustomerOrdersPipeline(); 
    requestAnimationFrame(() => { 
        overlay.classList.remove('opacity-0'); 
        overlay.classList.add('opacity-100'); 
    }); 
}

function closeCustomerProfile() { 
    const overlay = document.getElementById('customer-profile-overlay'); 
    requestAnimationFrame(() => { 
        overlay.classList.remove('opacity-100'); 
        overlay.classList.add('opacity-0'); 
        setTimeout(() => { 
            overlay.classList.add('hidden'); 
            document.body.classList.remove('overflow-hidden'); 
        }, 300); 
    }); 
}

async function handleCustomerLogout() { 
    showInteractionLoader("Signing Out..."); 
    await _supabase.auth.signOut(); 
    savedAddresses = []; 
    selectedAddressIndex = -1; 
    closeCustomerProfile(); 
    hideInteractionLoader(); 
    showToast("Signed Out", "fa-sign-out-alt"); 
}

// 🚨 WISHLIST 🚨
async function syncCloudWishlist() {
    if (!currentSessionUser) return;
    try { 
        const { data } = await _supabase.from('wishlist').select('product_id').eq('user_id', currentSessionUser.id); 
        if (data) localWishlist = data.map(w => w.product_id); 
        localStorage.setItem('th_wishlist', JSON.stringify(localWishlist)); 
    } catch(e) {}
}

async function toggleWishlistProduct(productId, event) {
    if(event) { event.preventDefault(); event.stopPropagation(); }
    const index = localWishlist.indexOf(productId.toString()); 
    const isAdding = index === -1;
    
    if (isAdding) localWishlist.push(productId.toString()); 
    else localWishlist.splice(index, 1);
    
    localStorage.setItem('th_wishlist', JSON.stringify(localWishlist));

    if (currentSessionUser) {
        try {
            if (isAdding) { 
                await _supabase.from('wishlist').insert([{ user_id: currentSessionUser.id, product_id: productId.toString() }]); 
            } else { 
                await _supabase.from('wishlist').delete().eq('user_id', currentSessionUser.id).eq('product_id', productId.toString()); 
            }
        } catch(e) {}
    }
    showToast(isAdding ? "Added to Wishlist" : "Removed from Wishlist", "fa-heart", isAdding ? "text-red-500" : "text-gray-300"); 
    updateWishlistUIElements(productId, isAdding);
}

function updateWishlistUIElements(id, isAdded) {
    const btn = document.getElementById('modal-wishlist-toggle-btn');
    if (btn && products.find(p => p.id == id)) {
        btn.className = isAdded ? "text-red-500 text-lg p-2 transition-colors" : "text-gray-300 hover:text-red-500 text-lg p-2 transition-colors";
    }
    const cards = document.querySelectorAll(`[data-card-id="${id}"] .wish-icon`);
    cards.forEach(c => { 
        c.className = isAdded ? "fas fa-heart text-red-500" : "far fa-heart text-gray-300"; 
    });
}

// 🚨 LOGIC CALCS 🚨
function calculateEDDBracket(prepTimeStr) {
    const matches = prepTimeStr.match(/\d+/g); 
    let minDays = matches ? parseInt(matches[0]) : 3; 
    let maxDays = matches && matches[1] ? parseInt(matches[1]) : minDays + 2;
    const today = new Date(); 
    const minDate = new Date(); minDate.setDate(today.getDate() + minDays + 2); 
    const maxDate = new Date(); maxDate.setDate(today.getDate() + maxDays + 4);
    const options = { day: 'numeric', month: 'short' }; 
    return `Estimated Delivery: ${minDate.toLocaleDateString('en-IN', options)} — ${maxDate.toLocaleDateString('en-IN', options)}`;
}

function applyCouponCode() {
    const input = document.getElementById('checkout-promo-input'); 
    const feedback = document.getElementById('checkout-promo-feedback'); 
    if(!input || !feedback) return;
    
    const code = input.value.trim().toUpperCase();
    if (code === "WELCOME10") { 
        activeCouponValue = 10; activeCouponCode = "WELCOME10"; 
        feedback.textContent = "WELCOME10 applied! Extra 10% OFF."; 
        feedback.className = "text-[9px] font-bold uppercase tracking-wide mt-1.5 text-green-600 block"; 
    } else if (code === "ARTISAN30") { 
        activeCouponValue = 30; activeCouponCode = "ARTISAN30"; 
        feedback.textContent = "ARTISAN30 applied! Extra 30% OFF."; 
        feedback.className = "text-[9px] font-bold uppercase tracking-wide mt-1.5 text-green-600 block"; 
    } else { 
        activeCouponValue = 0; activeCouponCode = ""; 
        feedback.textContent = "Invalid Coupon Code."; 
        feedback.className = "text-[9px] font-bold uppercase tracking-wide mt-1.5 text-red-500 block"; 
    }
    updateCheckoutUI();
}

async function syncCloudAddresses() {
    if (currentSessionUser) { 
        try { 
            const { data } = await _supabase.from('addresses').select('*').order('created_at', { ascending: true }); 
            savedAddresses = data || []; 
            selectedAddressIndex = savedAddresses.length > 0 ? 0 : -1; 
        } catch (err) {} 
    } else { 
        savedAddresses = safeJSONParse('th_saved_addresses', []); 
        selectedAddressIndex = savedAddresses.length > 0 ? 0 : -1; 
    }
    renderAddressBook();
}

// 🚨 DATABASE FETCHING
async function fetchDatabase() { 
    try { 
        const { data, error } = await _supabase.from('creations').select('*').order('created_at', { ascending: false }); 
        if (error) throw error;
        products = data.map(row => {
            let parsedImages = []; 
            try { parsedImages = JSON.parse(row.image_url) || []; } catch(e) {}
            return {
                id: row.id, 
                name: row.name, 
                category: row.category, 
                mainCategory: row.main_category || 'Pipe Cleaner Crafts', 
                price: row.price, 
                prepTime: row.prep_time, 
                specs: row.specs, 
                dimensions: row.dimensions || '', 
                isCustomizable: row.is_customizable || false,
                image1: parsedImages[0] ? parsedImages[0].data : '', 
                image2: parsedImages[1] ? parsedImages[1].data : '', 
                image3: parsedImages[2] ? parsedImages[2].data : '', 
                image4: parsedImages[3] ? parsedImages[3].data : '', 
                image5: parsedImages[4] ? parsedImages[4].data : ''
            };
        });
        requestAnimationFrame(() => { 
            renderFilters(); 
            renderProducts(); 
            setTimeout(dismissPreloader, 400); 
        });
    } catch (error) { 
        console.error("Database Fetch Error:", error);
        dismissPreloader(); 
    } 
}

function renderProducts(searchQuery = '') { 
    const grid = document.getElementById('product-grid'); 
    if(!grid) return; 
    grid.innerHTML = ''; 
    
    let filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if(currentMainCategory !== 'All') filtered = filtered.filter(p => p.mainCategory === currentMainCategory);
    if(activeSubCategories.length > 0) filtered = filtered.filter(p => activeSubCategories.includes(p.category));
    
    if(currentSortMode === 'low') filtered.sort((a,b) => parseFloat(a.price) - parseFloat(b.price)); 
    if(currentSortMode === 'high') filtered.sort((a,b) => parseFloat(b.price) - parseFloat(a.price)); 
    if(currentSortMode === 'newest') filtered.reverse(); 

    if(filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-20 text-gray-400 font-medium text-sm w-full"><i class="fas fa-box-open text-4xl block mb-3 opacity-30"></i> No creations found matching your search.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((p) => {
        const cleanPrice = Number((p.price || 0).toString().replace(/[^0-9.,]/g, '')); 
        const discountPercent = getDiscountPercent(p.id.toString()); 
        const originalPrice = Math.round(cleanPrice * (1 + (discountPercent / 100)));
        const mainImg = (p.image1 && p.image1.trim() !== '') ? p.image1 : 'https://placehold.co/400x500/F8E9EA/423133';
        const isHearted = localWishlist.includes(p.id.toString());
        
        const card = document.createElement('div'); 
        card.className = `w-full relative cursor-pointer opacity-0 transform translate-y-4 transition-all duration-400 ease-out group scroll-reveal`; 
        card.setAttribute('data-card-id', p.id); 
        card.addEventListener('click', () => openProductPage(p.id));
        
        card.innerHTML = `
            <div class="w-full relative rounded-2xl overflow-hidden group shadow-sm bg-gradient-to-tr from-luxury-bg to-white border border-luxury-blush aspect-[4/5] mb-2">
                <span class="absolute top-2.5 left-2.5 z-10 bg-white/95 text-luxury-dark text-[7px] sm:text-[8px] font-bold px-2.5 py-1 rounded-md uppercase tracking-[0.15em] border border-luxury-blush shadow-sm">${p.category}</span>
                <button type="button" onclick="window.th_toggleWishlistProduct('${p.id}', event)" class="absolute top-2.5 right-2.5 bg-white/95 w-7 h-7 flex items-center justify-center rounded-full border border-luxury-blush z-20 shadow-sm transition-transform active:scale-95"><i class="${isHearted ? 'fas fa-heart text-red-500' : 'far fa-heart text-gray-300'} wish-icon"></i></button>
                <img loading="lazy" decoding="async" src="${mainImg}" alt="${p.name}" class="absolute inset-0 w-full h-full object-cover">
            </div>
            <div class="px-1 flex flex-col justify-start text-left w-full">
                <h3 class="font-bitter font-semibold text-[11px] sm:text-[12px] text-luxury-dark leading-snug w-full transition-colors group-hover:text-luxury-rose mb-0.5 line-clamp-2">${p.name}</h3>
                <div class="flex items-center md:items-baseline gap-1.5 flex-wrap w-full">
                    <span class="font-poppins font-extrabold text-luxury-dark text-[14px] sm:text-[15px] tracking-tight leading-none">₹${cleanPrice}</span>
                    <span class="font-poppins text-gray-400 text-[9px] font-medium line-through leading-none">₹${originalPrice}</span>
                </div>
            </div>`;
        fragment.appendChild(card);
    }); 
    grid.appendChild(fragment); 
    setupScrollReveal();
}

function openProductPage(id) { 
    const p = products.find(x => x.id == id); if(!p) return;
    
    const cleanPrice = Number((p.price || 0).toString().replace(/[^0-9.,]/g, '')); 
    const discountPercent = getDiscountPercent(p.id.toString()); 
    const originalPrice = Math.round(cleanPrice * (1 + (discountPercent / 100)));
    
    modalImages = [p.image1, p.image2, p.image3, p.image4, p.image5].filter(img => typeof img === 'string' && img.trim() !== ''); 
    if (modalImages.length === 0) modalImages.push('https://placehold.co/400x500/F8E9EA/423133');
    
    const track = document.getElementById('modal-carousel-track');
    const thumbContainer = document.getElementById('modal-thumbnails'); 
    
    track.style.transition = 'none'; 
    let html = '';
    modalImages.forEach(imgSrc => { 
        html += `<div class="w-full h-full flex-shrink-0 flex items-center justify-center relative bg-transparent" onclick="window.openLightboxFromCarousel()"><img loading="lazy" decoding="async" src="${imgSrc}" class="w-full max-h-full object-contain"></div>`; 
    }); 
    track.innerHTML = html; 
    currentSlideIndex = 0; 
    track.style.transform = `translateX(0)`;
    
    thumbContainer.innerHTML = ''; 
    if (modalImages.length > 1) { 
        modalImages.forEach((imgSrc, index) => { 
            const thumb = document.createElement('img'); 
            thumb.src = imgSrc; 
            thumb.className = `w-12 h-12 object-cover rounded-md border-2 transition-all cursor-pointer ${index === 0 ? 'border-luxury-rose scale-105 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`; 
            thumb.id = `thumb-${index}`; 
            thumb.onclick = () => { window.goToSlide(index); }; 
            thumbContainer.appendChild(thumb); 
        }); 
    } 
    
    document.getElementById('modal-wishlist-toggle-btn').onclick = (e) => window.th_toggleWishlistProduct(p.id, e); 
    updateWishlistUIElements(p.id, localWishlist.includes(p.id.toString()));

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
    if(document.getElementById('modal-edd-delivery-tag')) document.getElementById('modal-edd-delivery-tag').textContent = calculateEDDBracket(p.prepTime || '3-5');

    const badgesContainer = document.getElementById('art-badges-container'), dimBadge = document.getElementById('modal-dimensions-badge'), custBadge = document.getElementById('modal-custom-badge');
    if(badgesContainer) badgesContainer.classList.add('hidden'); if(dimBadge) dimBadge.classList.add('hidden'); if(custBadge) custBadge.classList.add('hidden');
    if(p.mainCategory === 'Canvas Paintings' || p.mainCategory === 'Clay Art Paintings') {
        badgesContainer?.classList.remove('hidden');
        if(p.dimensions && dimBadge) { document.getElementById('modal-dimensions-text').textContent = p.dimensions; dimBadge.classList.remove('hidden'); }
        if(p.isCustomizable) custBadge?.classList.remove('hidden');
    }
    
    renderRelatedProducts(p.id, p.mainCategory, p.category); 
    updateProductButtons(p.id);
    
    document.getElementById('customer-view')?.classList.add('hidden'); 
    document.getElementById('product-view')?.classList.remove('hidden'); 
    window.scrollTo(0, 0); 
    currentModalLevel = 1; 
    safePushState(1); 
}

function closeProductPage() { 
    document.getElementById('product-view')?.classList.add('hidden'); 
    document.getElementById('customer-view')?.classList.remove('hidden'); 
    window.scrollTo(0, 0); 
}

function updateProductButtons(id) {
    const actionContainer = document.getElementById('modal-action-buttons'); 
    if(!actionContainer) return;
    
    const cartItem = cart.find(item => item.id === id); 
    const qty = cartItem ? parseInt(cartItem.qty || 1) : 0;
    
    if(qty > 0) { 
        actionContainer.innerHTML = `<div class="flex items-center justify-between w-full h-full bg-white border border-luxury-rose rounded-full px-2 sm:px-4 py-3 shadow-sm min-h-[44px]"><button type="button" onclick="window.th_updateCartQty('${id}', -1, event)" class="w-8 h-8 rounded-full bg-luxury-bg hover:bg-luxury-blush border border-luxury-blush flex items-center justify-center shrink-0"><i class="fas fa-minus text-xs"></i></button><span class="text-base sm:text-lg font-bold text-luxury-rose font-poppins min-w-[20px] text-center">${qty}</span><button type="button" onclick="window.th_updateCartQty('${id}', 1, event)" class="w-8 h-8 rounded-full bg-luxury-bg hover:bg-luxury-blush border border-luxury-blush flex items-center justify-center shrink-0"><i class="fas fa-plus text-xs"></i></button></div><button type="button" onclick="window.openCheckoutBase()" class="w-full bg-luxury-dark text-white hover:bg-[#D9778A] font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider shadow-md active:scale-[0.98] transition-colors min-h-[44px]"><i class="fas fa-bolt text-luxury-gold"></i> Checkout</button>`; 
    } else { 
        actionContainer.innerHTML = `<button type="button" onclick="window.th_updateCartQty('${id}', 1, event)" class="w-full bg-white border border-luxury-dark text-luxury-dark hover:bg-luxury-bg font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider transition-colors shadow-sm active:scale-[0.98] min-h-[44px]"><i class="fas fa-shopping-bag"></i> Add to Bag</button><button type="button" onclick="window.routeCheckoutFromModal('${id}', event)" class="w-full bg-luxury-dark text-white hover:bg-[#D9778A] font-bold px-2 py-3.5 sm:px-4 rounded-full flex items-center justify-center gap-2 text-[11px] sm:text-[12px] uppercase tracking-wider shadow-md active:scale-[0.98] transition-colors min-h-[44px]"><i class="fas fa-bolt text-luxury-gold"></i> Buy Now</button>`; 
    }
}

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
    setupScrollReveal();
}

function renderCheckoutItems() {
    const container = document.getElementById('checkout-items-list'); 
    if(!container) return; 
    
    if (cart.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-400 font-medium text-sm"><i class="fas fa-shopping-bag text-4xl block mb-3 opacity-30"></i> Your bag is completely empty.</div>';
        return;
    }
    
    let itemsHTML = '';
    cart.forEach(item => {
        const cleanPrice = Number((item.price || 0).toString().replace(/[^0-9.,]/g, '')); 
        const discountPercent = getDiscountPercent(item.id.toString()); 
        const originalPrice = Math.round(cleanPrice * (1 + (discountPercent / 100))); 
        const itemImg = (item.image1 || item.image) ? (item.image1 || item.image) : 'https://placehold.co/150/F8E9EA/423133'; 
        const qty = parseInt(item.qty || 1);
        
        itemsHTML += `<div class="flex flex-col sm:flex-row gap-4 border border-luxury-blush bg-white p-4 rounded-2xl shadow-sm"><img src="${itemImg}" class="w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-xl border border-luxury-blush shrink-0 bg-luxury-bg"><div class="flex flex-col justify-between w-full"><div><h4 class="font-bitter text-[14px] sm:text-[15px] font-semibold text-luxury-dark mb-1 leading-snug">${item.name}</h4><p class="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-3">${item.mainCategory || item.category || 'Handcrafted Art'}</p><div class="flex items-baseline gap-2 mb-4"><span class="font-poppins text-luxury-dark font-bold text-[16px] sm:text-[18px]">₹${cleanPrice}</span><span class="font-poppins text-gray-400 text-[11px] line-through">₹${originalPrice}</span><span class="text-green-600 font-bold text-[10px] ml-1">${discountPercent}% Off</span></div></div><div class="flex items-center gap-3"><div class="flex items-center bg-white border border-luxury-blush rounded-full h-[36px] overflow-hidden shadow-sm"><button type="button" onclick="window.th_updateCartQty('${item.id}', -1, event)" class="w-10 h-full flex items-center justify-center text-luxury-dark hover:bg-luxury-blush transition-colors"><i class="fas fa-minus text-[10px]"></i></button><div class="w-10 h-full flex items-center justify-center border-l border-r border-luxury-blush text-[12px] font-bold text-luxury-rose bg-luxury-bg">${qty}</div><button type="button" onclick="window.th_updateCartQty('${item.id}', 1, event)" class="w-10 h-full flex items-center justify-center text-luxury-dark hover:bg-luxury-blush transition-colors"><i class="fas fa-plus text-[10px]"></i></button></div></div></div></div>`;
    });
    
    let hasCustomizable = cart.some(item => item.isCustomizable); 
    const dimWrapper = document.getElementById('comm-dimensions-wrapper'); 
    if (hasCustomizable) dimWrapper?.classList.remove('hidden'); 
    else dimWrapper?.classList.add('hidden'); 
    
    container.innerHTML = itemsHTML;
}

function renderAddressBook() {
    const container = document.getElementById('address-book-container');
    const form = document.getElementById('checkout-profile-form');
    const btnAdd = document.getElementById('btn-show-add-address'); 
    
    if (!container || !form) return;
    
    if (savedAddresses.length === 0) { 
        container.innerHTML = ''; 
        container.classList.add('hidden'); 
        form.classList.remove('hidden'); 
        btnAdd.classList.add('hidden'); 
        clearAddressForm(); 
        editingAddressIndex = null; 
    } else {
        container.classList.remove('hidden'); 
        let html = '';
        savedAddresses.forEach((addr, i) => {
            const isSelected = i === selectedAddressIndex;
            html += `<div class="border ${isSelected ? 'border-[#D9778A] bg-[#FFF0F2]' : 'border-luxury-blush bg-white'} rounded-xl p-4 flex gap-4 cursor-pointer transition-colors relative shadow-sm" onclick="window.selectAddress(${i})"><div class="pt-1 shrink-0"><div class="w-4 h-4 rounded-full border-2 ${isSelected ? 'border-[#D9778A] flex items-center justify-center bg-white' : 'border-gray-300 bg-white'}">${isSelected ? '<div class="w-2 h-2 rounded-full bg-[#D9778A]"></div>' : ''}</div></div><div class="flex-grow pr-8"><p class="font-bold text-luxury-dark text-[12px] uppercase tracking-wider mb-1">${addr.first_name} ${addr.last_name || ''}</p><p class="text-gray-500 text-[11px] leading-relaxed mb-2">${addr.address_1}${addr.address_2 ? ', ' + addr.address_2 : ''}<br>${addr.city}, ${addr.state} - <span class="font-bold text-luxury-dark">${addr.pincode}</span></p><p class="text-luxury-dark font-medium text-[11px]"><i class="fas fa-phone-alt text-luxury-rose/70 mr-1.5 text-[9px]"></i> ${addr.phone}</p></div><button type="button" onclick="window.editAddress(${i}, event)" class="absolute top-4 right-4 text-[9px] text-gray-400 hover:text-luxury-rose uppercase font-bold tracking-widest bg-white w-8 h-8 rounded-full border border-luxury-blush flex items-center justify-center transition-colors"><i class="fas fa-pen"></i></button></div>`;
        });
        container.innerHTML = html; 
        form.classList.add('hidden'); 
        btnAdd.classList.remove('hidden');
    }
    updateCheckoutUI(); 
}

function selectAddress(index) { selectedAddressIndex = index; document.getElementById('checkout-profile-form').classList.add('hidden'); document.getElementById('btn-show-add-address').classList.remove('hidden'); renderAddressBook(); }
function showAddressForm() { editingAddressIndex = null; clearAddressForm(); document.getElementById('checkout-profile-form').classList.remove('hidden'); document.getElementById('btn-show-add-address').classList.add('hidden'); if(savedAddresses.length > 0) document.getElementById('btn-cancel-address')?.classList.remove('hidden'); updateCheckoutUI(); }
function hideAddressForm() { document.getElementById('checkout-profile-form').classList.add('hidden'); document.getElementById('btn-show-add-address').classList.remove('hidden'); editingAddressIndex = null; updateCheckoutUI(); }
function editAddress(index, event) { event.stopPropagation(); editingAddressIndex = index; const addr = savedAddresses[index]; document.getElementById('prof-fname').value = addr.first_name || ''; document.getElementById('prof-lname').value = addr.last_name || ''; document.getElementById('prof-email').value = addr.email || ''; document.getElementById('prof-phone').value = addr.phone || ''; document.getElementById('prof-add1').value = addr.address_1 || ''; document.getElementById('prof-add2').value = addr.address_2 || ''; document.getElementById('prof-city').value = addr.city || ''; document.getElementById('prof-state').value = addr.state || ''; document.getElementById('prof-pin').value = addr.pincode || ''; document.getElementById('checkout-profile-form').classList.remove('hidden'); document.getElementById('btn-show-add-address').classList.add('hidden'); document.getElementById('btn-cancel-address')?.classList.remove('hidden'); updateCheckoutUI(); }

async function saveAddressFromForm() {
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
        showToast("Please fill all required fields", "fa-exclamation-circle", "text-red-500"); 
        return false; 
    }
    
    showInteractionLoader("Saving Address...");
    
    if (currentSessionUser) {
        try {
            addr.user_id = currentSessionUser.id;
            if (editingAddressIndex !== null) { 
                await _supabase.from('addresses').update(addr).eq('id', savedAddresses[editingAddressIndex].id); 
            } else { 
                await _supabase.from('addresses').insert([addr]); 
            }
            await syncCloudAddresses();
        } catch (err) { 
            alert("Failed to save address to Cloud: " + err.message); 
            hideInteractionLoader(); 
            return false; 
        }
    } else {
        if (editingAddressIndex !== null) { 
            savedAddresses[editingAddressIndex] = addr; 
            selectedAddressIndex = editingAddressIndex; 
        } else { 
            savedAddresses.push(addr); 
            selectedAddressIndex = savedAddresses.length - 1; 
        }
        localStorage.setItem('th_saved_addresses', JSON.stringify(savedAddresses));
    }
    
    editingAddressIndex = null; 
    renderAddressBook(); 
    hideInteractionLoader(); 
    showToast("Address Saved", "fa-check"); 
    return true;
}

function clearAddressForm() { document.getElementById('prof-fname').value = ''; document.getElementById('prof-lname').value = ''; document.getElementById('prof-email').value = ''; document.getElementById('prof-phone').value = ''; document.getElementById('prof-add1').value = ''; document.getElementById('prof-add2').value = ''; document.getElementById('prof-city').value = ''; document.getElementById('prof-state').value = ''; document.getElementById('prof-pin').value = ''; }

function calculateDynamicDelivery(subtotal, pincode, items) {
    if (subtotal >= 2499 || subtotal === 0) return 0; 
    let totalChargeableWeightKg = 0;
    items.forEach(item => {
        let itemDeadWeight = 0.2; let itemVolumetricWeight = 0.2; 
        const cat = item.mainCategory || item.category || ''; 
        const qty = parseInt(item.qty || 1);
        
        if (cat.includes('Canvas')) { itemDeadWeight = 1.5; itemVolumetricWeight = (45 * 35 * 5) / 5000; } 
        else if (cat.includes('Clay')) { itemDeadWeight = 0.8; itemVolumetricWeight = (25 * 25 * 10) / 5000; } 
        else { itemDeadWeight = 0.15; itemVolumetricWeight = (15 * 10 * 5) / 5000; }
        
        const chargeablePerItem = Math.max(itemDeadWeight, itemVolumetricWeight); 
        totalChargeableWeightKg += (chargeablePerItem * qty);
    });
    
    const weightSlabs = Math.ceil(totalChargeableWeightKg / 0.5); 
    let zone = 'D'; 
    
    if (pincode && pincode.toString().length >= 2) {
        const pinPrefix = parseInt(pincode.toString().substring(0, 2));
        const pinPrefixThree = parseInt(pincode.toString().substring(0, 3));
        if (pinPrefixThree === 387 || pinPrefixThree === 388) zone = 'A'; 
        else if ((pinPrefix >= 36 && pinPrefix <= 42) || pinPrefix === 39) zone = 'B'; 
        else if (pinPrefix === 19 || (pinPrefix >= 78 && pinPrefix <= 79)) zone = 'E';
    }
    
    let baseRate = 0, additionalSlabRate = 0;
    switch(zone) { 
        case 'A': baseRate = 35; additionalSlabRate = 35; break; 
        case 'B': baseRate = 45; additionalSlabRate = 40; break; 
        case 'E': baseRate = 85; additionalSlabRate = 80; break; 
        default:  baseRate = 55; additionalSlabRate = 50; break; 
    }
    
    let finalShippingFee = baseRate; 
    if (weightSlabs > 1) finalShippingFee += ((weightSlabs - 1) * additionalSlabRate); 
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
    const fill = document.getElementById('progress-bar-fill');
    const ind1 = document.getElementById('step-indicator-1'); const lbl1 = document.getElementById('step-label-1');
    const ind2 = document.getElementById('step-indicator-2'); const lbl2 = document.getElementById('step-label-2');
    const ind3 = document.getElementById('step-indicator-3'); const lbl3 = document.getElementById('step-label-3');
    const sidebar = document.getElementById('checkout-price-sidebar');
    const mobileBtn = document.getElementById('checkout-action-btn-mobile');
    
    if(!fill) return;

    let trueSubtotal = 0, sellingSubtotal = 0, totalItems = 0; 
    cart.forEach((item) => { 
        const cleanPrice = Number((item.price || 0).toString().replace(/[^0-9.,]/g, '')); 
        const qty = parseInt(item.qty || 1); 
        const discountPercent = getDiscountPercent(item.id.toString()); 
        trueSubtotal += (Math.round(cleanPrice * (1 + (discountPercent / 100))) * qty); 
        sellingSubtotal += (cleanPrice * qty); 
        totalItems += qty; 
    });

    let currentPin = ''; 
    const form = document.getElementById('checkout-profile-form');
    if (form && !form.classList.contains('hidden') && document.getElementById('prof-pin')) {
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
    let couponSubtraction = activeCouponValue > 0 ? Math.round(sellingSubtotal * (activeCouponValue / 100)) : 0;
    const rowCoupon = document.getElementById('qo-coupon-row');
    
    if (rowCoupon) { 
        if (couponSubtraction > 0) { 
            document.getElementById('qo-coupon-discount').textContent = `- ₹${couponSubtraction}`; 
            rowCoupon.classList.remove('hidden'); 
        } else {
            rowCoupon.classList.add('hidden'); 
        }
    }

    const finalTotal = sellingSubtotal - vipDiscount - couponSubtraction + currentDeliveryFee; 
    const productDiscountTotal = trueSubtotal - sellingSubtotal; 
    const totalSavings = productDiscountTotal + vipDiscount + couponSubtraction;

    if(document.getElementById('qo-item-count')) document.getElementById('qo-item-count').textContent = totalItems;
    if(document.getElementById('qo-original-value')) document.getElementById('qo-original-value').textContent = `₹${trueSubtotal}`;
    if(document.getElementById('qo-product-discount')) document.getElementById('qo-product-discount').textContent = `- ₹${productDiscountTotal}`;
    
    const vipRow = document.getElementById('qo-vip-row');
    if(vipRow) { 
        if(vipDiscount > 0) { 
            if(document.getElementById('qo-vip-label')) document.getElementById('qo-vip-label').textContent = currentTier.label; 
            if(document.getElementById('qo-vip-discount')) document.getElementById('qo-vip-discount').textContent = `- ₹${vipDiscount}`; 
            vipRow.classList.remove('hidden'); 
        } else { 
            vipRow.classList.add('hidden'); 
        } 
    }
    
    if(document.getElementById('qo-total-savings')) document.getElementById('qo-total-savings').textContent = totalSavings;
    if(document.getElementById('qo-final-total')) document.getElementById('qo-final-total').textContent = `₹${finalTotal}`;

    // Mobile specific button handling
    if(mobileBtn) {
        if(checkoutStep === 1) {
            mobileBtn.innerHTML = `Pay ₹${finalTotal} <i class="fas fa-arrow-right ml-1"></i>`;
            if(cart.length === 0) { mobileBtn.disabled = true; mobileBtn.classList.add('opacity-50', 'cursor-not-allowed'); } else { mobileBtn.disabled = false; mobileBtn.classList.remove('opacity-50', 'cursor-not-allowed'); }
        } else if (checkoutStep === 2) {
            mobileBtn.innerHTML = `Verify to Pay ₹${finalTotal} <i class="fas fa-lock ml-1"></i>`;
            mobileBtn.disabled = false; mobileBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    if(sidebar) sidebar.className = (checkoutStep === 1 || checkoutStep === 2) ? "block lg:col-span-4 w-full mt-2 lg:mt-0" : "hidden lg:block lg:col-span-4 w-full mt-2 lg:mt-0";

    if (checkoutStep === 1) {
        document.getElementById('checkout-step-1')?.classList.remove('hidden'); document.getElementById('checkout-step-2')?.classList.add('hidden'); document.getElementById('checkout-step-3')?.classList.add('hidden'); fill.style.width = '0%';
        if(ind1) ind1.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-[#D9778A] text-white shadow-md border-2 border-white group-hover:scale-105";
        if(lbl1) lbl1.className = "text-[9px] font-bold uppercase tracking-widest text-luxury-dark";
        if(ind2) ind2.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-white text-gray-400 border-2 border-luxury-blush group-hover:scale-105";
        if(lbl2) lbl2.className = "text-[9px] font-bold uppercase tracking-widest text-gray-400";
        if(ind3) ind3.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-white text-gray-400 border-2 border-luxury-blush";
        if(lbl3) lbl3.className = "text-[9px] font-bold uppercase tracking-widest text-gray-400";
    } else if (checkoutStep === 2) {
        document.getElementById('checkout-step-1')?.classList.add('hidden'); document.getElementById('checkout-step-2')?.classList.remove('hidden'); document.getElementById('checkout-step-3')?.classList.add('hidden'); fill.style.width = '50%';
        if(ind1) ind1.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-[#D9778A] text-white shadow-md border-2 border-white group-hover:scale-105";
        if(lbl1) lbl1.className = "text-[9px] font-bold uppercase tracking-widest text-luxury-dark";
        if(ind2) ind2.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-[#D9778A] text-white shadow-md border-2 border-white group-hover:scale-105";
        if(lbl2) lbl2.className = "text-[9px] font-bold uppercase tracking-widest text-luxury-dark";
        if(ind3) ind3.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-white text-gray-400 border-2 border-luxury-blush";
        if(lbl3) lbl3.className = "text-[9px] font-bold uppercase tracking-widest text-gray-400";
    } else if (checkoutStep === 3) {
        document.getElementById('checkout-step-1')?.classList.add('hidden'); document.getElementById('checkout-step-2')?.classList.add('hidden'); document.getElementById('checkout-step-3')?.classList.remove('hidden'); fill.style.width = '100%';
        if(ind3) ind3.className = "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors bg-[#D9778A] text-white shadow-md border-2 border-white";
        if(lbl3) lbl3.className = "text-[9px] font-bold uppercase tracking-widest text-luxury-dark";
    }
}

function handleMobileStickyAction() { handleCheckoutAction(); }

function handleCheckoutAction() {
    if (checkoutStep === 1) {
        if (cart.length === 0) return showToast("Your bag is empty!", "fa-times", "text-red-500");
        checkoutStep = 2; updateCheckoutUI(); renderAddressBook(); document.getElementById('checkout-overlay')?.scrollTo({top: 0, behavior: 'smooth'});
    } else if (checkoutStep === 2) {
        const form = document.getElementById('checkout-profile-form');
        if (form && !form.classList.contains('hidden')) { const success = saveAddressFromForm(); if (!success) return; }
        if (savedAddresses.length === 0 || selectedAddressIndex === -1) { showToast("Please provide a delivery address.", "fa-exclamation-circle", "text-red-500"); return; }
        preparePaymentGateway();
    }
}

function preparePaymentGateway() {
    const type = document.getElementById('comm-type') ? document.getElementById('comm-type').value : 'Standard Order';
    const colors = document.getElementById('comm-colors') ? document.getElementById('comm-colors').value.trim() : 'No notes'; 
    const dims = document.getElementById('comm-dimensions') ? document.getElementById('comm-dimensions').value.trim() : '';
    
    showInteractionLoader("Securing Order Engine...");
    
    let sellingSubtotal = 0, totalPrepTime = "", itemsToSave = [];
    cart.forEach((item) => { 
        const cleanPrice = Number((item.price || 0).toString().replace(/[^0-9.,]/g, '')); 
        const qty = parseInt(item.qty || 1); 
        sellingSubtotal += (cleanPrice * qty); 
        itemsToSave.push({ id: item.id, name: item.name, price: cleanPrice, qty: qty, image: item.image }); 
    });
    totalPrepTime = calculateTotalPrepTime(cart);
    
    const targetAddress = savedAddresses[selectedAddressIndex]; 
    currentDeliveryFee = calculateDynamicDelivery(sellingSubtotal, targetAddress.pincode, cart);
    
    const { discount: vipDiscount } = calculateCartDiscount(sellingSubtotal); 
    let couponSubtraction = activeCouponValue > 0 ? Math.round(sellingSubtotal * (activeCouponValue / 100)) : 0;
    const finalTotal = sellingSubtotal - vipDiscount - couponSubtraction + currentDeliveryFee; 
    
    const safeCountryCode = (settings.countryCode || '+91'); 
    const fullContactPhone = safeCountryCode + " " + targetAddress.phone;
    
    let fullAddress = `${targetAddress.address_1}, ${targetAddress.address_2 ? targetAddress.address_2 + ', ' : ''}${targetAddress.city}, ${targetAddress.state} - ${targetAddress.pincode}`;
    let artDetails = `Phone: ${fullContactPhone} | Patron: ${targetAddress.first_name} ${targetAddress.last_name || ''} | Email: ${targetAddress.email} | Address: ${fullAddress} | Purpose: ${type} | Notes: ${colors} | Delivery Fee: ₹${currentDeliveryFee}`;
    if(activeCouponValue > 0) artDetails += ` | Coupon: ${activeCouponCode} (-₹${couponSubtraction})`;
    if(dims && document.getElementById('comm-dimensions-wrapper') && !document.getElementById('comm-dimensions-wrapper').classList.contains('hidden')) { artDetails += ` | Size: ${dims}`; } 
    artDetails += ` | Est. Prep: ${totalPrepTime}`; 

    const formattedTotal = Number(finalTotal).toFixed(2);
    const cleanUpiId = (settings.upiId || "khushisj315@oksbi").trim();
    const cleanNameForNote = targetAddress.first_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10); 
    currentOrderReference = `TH_${cleanNameForNote}_${String(Date.now()).slice(-4)}`; 
    
    const upiLink = `upi://pay?pa=${cleanUpiId}&pn=${settings.storeName ? settings.storeName.replace(/\s+/g, '_') : 'Twisted_Happiness'}&am=${formattedTotal}&cu=INR&tn=${currentOrderReference}`;

    pendingOrderPayload = { 
        order_details: JSON.stringify(itemsToSave), 
        subtotal: sellingSubtotal, 
        discount: vipDiscount, 
        total: finalTotal, 
        customer_reqs: artDetails, 
        status: 'new', 
        user_id: currentSessionUser ? currentSessionUser.id : null 
    };
    
    setTimeout(() => {
        checkoutStep = 3; 
        if(document.getElementById('checkout-payment-amount')) document.getElementById('checkout-payment-amount').textContent = `₹${formattedTotal}`;
        const verifyBtn = document.getElementById('btn-confirm-payment'); 
        if(verifyBtn) { verifyBtn.innerHTML = 'I Have Completed Payment <i class="fas fa-check-circle"></i>'; verifyBtn.disabled = false; }
        
        if (isMobileDevice()) {
            if(document.getElementById('payment-mobile-btn')) document.getElementById('payment-mobile-btn').href = upiLink;
            document.getElementById('payment-mobile-container')?.classList.remove('hidden'); 
            document.getElementById('payment-qr-container')?.classList.add('hidden');
        } else {
            const qrUrl = `https://quickchart.io/qr?size=250&margin=2&text=${encodeURIComponent(upiLink)}`;
            if(document.getElementById('payment-qr-img')) document.getElementById('payment-qr-img').src = qrUrl;
            document.getElementById('payment-qr-container')?.classList.remove('hidden'); 
            document.getElementById('payment-mobile-container')?.classList.add('hidden');
        }
        
        updateCheckoutUI(); 
        document.getElementById('checkout-overlay')?.scrollTo({top: 0, behavior: 'smooth'}); 
        hideInteractionLoader();
    }, 1500); 
}

async function confirmPaymentAndOrder() {
    if(!pendingOrderPayload) return; 
    const btn = document.getElementById('btn-confirm-payment'); 
    if(btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Securing Order...'; btn.disabled = true; }
    
    pendingOrderPayload.order_id = currentOrderReference; 
    const { error } = await _supabase.from('orders').insert([pendingOrderPayload]);
    
    if (error) { 
        console.error("Order writing failure:", error); 
        showToast("Network error. Please try again.", "fa-times", "text-red-500"); 
        if(btn) { btn.innerHTML = 'I Have Completed Payment <i class="fas fa-check-circle"></i>'; btn.disabled = false; } 
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

async function renderCustomerOrdersPipeline() {
    const container = document.getElementById('customer-orders-pipeline'); 
    if(!container || !currentSessionUser) return;
    
    container.innerHTML = '<div class="text-center py-8 text-gray-400 text-[11px] font-medium"><i class="fas fa-spinner fa-spin mr-2"></i> Querying secure logs...</div>';
    try {
        const { data } = await _supabase.from('orders').select('*').eq('user_id', currentSessionUser.id).order('created_at', { ascending: false });
        if(!data || data.length === 0) { 
            container.innerHTML = '<div class="text-center p-10 text-gray-400 text-[11px] uppercase tracking-widest"><i class="fas fa-box-open text-2xl block mb-2 opacity-40"></i> No commissions found.</div>'; 
            return; 
        }
        
        let html = '';
        data.forEach(order => {
            const date = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            let txt = "Verifying Payment", cls = "text-yellow-600 bg-yellow-50";
            if (order.status === 'curating') { txt = "Artisan is Crafting"; cls = "text-luxury-gold bg-luxury-gold/5"; } 
            else if (order.status === 'ready') { txt = "Ready for Dispatch"; cls = "text-purple-600 bg-purple-50"; } 
            else if (order.status === 'completed') { txt = "Elegantly Delivered"; cls = "text-green-600 bg-green-50"; }
            
            html += `<div class="bg-white border border-luxury-blush p-4 rounded-2xl shadow-sm"><div class="flex justify-between border-b pb-2 mb-2"><div><span class="text-[8px] text-gray-400 uppercase tracking-widest block">Reference</span><h4 class="font-poppins font-bold text-sm">${order.order_id || 'TH_LOG'}</h4></div><span class="text-[8px] font-bold border px-2 py-0.5 rounded uppercase ${cls}">${txt}</span></div><p class="text-gray-400 text-[10px]">Placed on ${date}</p><p class="font-bold text-luxury-dark text-[12px] mt-1">Invoice Total: ₹${order.total}</p></div>`;
        });
        container.innerHTML = html;
    } catch(err) { 
        container.innerHTML = '<div class="text-center text-red-500 py-4 text-xs">Failed to fetch.</div>'; 
    }
}

async function handleTrackOrder(e) {
    e.preventDefault(); 
    const orderId = document.getElementById('track-order-id').value.trim(); 
    if(!orderId) return;
    
    const btn = document.getElementById('btn-track-submit'); 
    const originalText = btn.innerHTML; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...'; 
    btn.disabled = true;
    
    try {
        const { data, error } = await _supabase.from('orders').select('status').ilike('customer_reqs', `%${orderId}%`).limit(1); 
        if (error) throw error;
        
        const resContainer = document.getElementById('track-result-container');
        const resStatus = document.getElementById('track-result-status');
        const resDesc = document.getElementById('track-result-desc');
        
        if(data && data.length > 0) {
            const status = data[0].status; 
            resContainer.classList.remove('hidden');
            
            if(status === 'new' || status === 'pending') { resStatus.textContent = "Verifying Payment"; resStatus.className = "font-poppins font-bold text-yellow-600 text-lg tracking-wide mb-2"; resDesc.textContent = "We have received your request and are verifying the transaction with our bank. We will begin crafting shortly!"; } 
            else if (status === 'curating') { resStatus.textContent = "Artisan is Crafting"; resStatus.className = "font-poppins font-bold text-luxury-gold text-lg tracking-wide mb-2"; resDesc.textContent = "Your payment is verified and our artisan is currently pouring love into your handcrafted piece."; } 
            else if (status === 'ready') { resStatus.textContent = "Ready for Dispatch"; resStatus.className = "font-poppins font-bold text-purple-600 text-lg tracking-wide mb-2"; resDesc.textContent = "Your masterpiece is complete, securely packaged, and awaiting courier pickup via Shiprocket."; } 
            else if (status === 'completed') { resStatus.textContent = "Elegantly Delivered"; resStatus.className = "font-poppins font-bold text-green-600 text-lg tracking-wide mb-2"; resDesc.textContent = "Your order has been successfully delivered. Thank you for curating your space with Twisted Happiness!"; }
        } else { 
            resContainer.classList.remove('hidden'); 
            resStatus.textContent = "Not Found"; 
            resStatus.className = "font-poppins font-bold text-red-500 text-lg tracking-wide mb-2"; 
            resDesc.textContent = "We couldn't find an active order with that reference ID."; 
        }
    } catch(err) { 
        showToast("Network Error", "fa-times", "text-red-500"); 
    }
    
    btn.innerHTML = originalText; 
    btn.disabled = false;
}

// GLOBALLY BIND ALL FUNCTIONS
window.openCheckoutBase = openCheckoutBase; 
window.closeCheckout = closeCheckout; 
window.handleCheckoutAction = handleCheckoutAction; 
window.handleMobileStickyAction = handleMobileStickyAction; 
window.openLightboxFromCarousel = openLightboxFromCarousel; 
window.moveLightboxSlide = moveLightboxSlide; 
window.goToSlide = goToSlide; 
window.th_toggleSubCategory = th_toggleSubCategory; 
window.routeCheckoutFromModal = routeCheckoutFromModal; 
window.th_updateCartQty = updateCartQty; 
window.updateCheckoutQty = updateCheckoutQty; 
window.goToCheckoutStep = goToCheckoutStep; 
window.confirmPaymentAndOrder = confirmPaymentAndOrder; 
window.showAddressForm = showAddressForm; 
window.hideAddressForm = hideAddressForm; 
window.saveAddressFromForm = saveAddressFromForm; 
window.selectAddress = selectAddress; 
window.editAddress = editAddress; 
window.openPolicyModal = openPolicyModal; 
window.closePolicyModal = closePolicyModal; 
window.closeProductPage = closeProductPage; 
window.handleAccountHeaderClick = handleAccountHeaderClick; 
window.closeCustomerProfile = closeCustomerProfile; 
window.handleCustomerLogout = handleCustomerLogout; 
window.toggleAuthViewMode = toggleAuthViewMode; 
window.closeCustomerAuthModal = closeCustomerAuthModal; 
window.handleGoogleOAuthLogin = handleGoogleOAuthLogin; 
window.th_toggleWishlistProduct = toggleWishlistProduct; 
window.th_applyCouponCode = applyCouponCode; 
window.openTrackOrderModal = openTrackOrderModal; 
window.closeTrackOrderModal = closeTrackOrderModal;

function showToast(msg, icon = 'fa-check', color = 'text-luxury-rose') { 
    const t = document.getElementById('toast'); 
    document.getElementById('toast-msg').textContent = msg; 
    document.getElementById('toast-icon').className = `fas ${icon} ${color} text-sm drop-shadow-sm`; 
    requestAnimationFrame(() => { 
        t.classList.remove('opacity-0', 'translate-y-10'); 
        setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000); 
    }); 
}

function setupScrollReveal() { 
    const observer = new IntersectionObserver((entries) => { 
        entries.forEach(entry => { 
            if(entry.isIntersecting) { 
                requestAnimationFrame(() => { 
                    entry.target.classList.remove('opacity-0', 'translate-y-4'); 
                    observer.unobserve(entry.target); 
                }); 
            } 
        }); 
    }, { threshold: 0.05, rootMargin: '50px' }); 
    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el)); 
}