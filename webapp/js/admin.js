/**
 * Twisted Happiness - Studio Admin Engine
 * Version: 16.0.0 - Fully Repaired & Upgraded
 */

const SUPABASE_URL = "https://gvrfucjtnyqfkdynrmqs.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_8jru2BqvTdE9bcwNOLIHAA_dx6aUCM0";
let _supabase;

const countryCodeMapping = { "+91": "🇮🇳 IN (+91)", "+1": "🇺🇸 US (+1)", "+44": "🇬🇧 UK (+44)" };

function safeJSONParse(key, fallback) { 
    try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : fallback; } 
    catch (e) { localStorage.removeItem(key); return fallback; } 
}

let settings = safeJSONParse('th_settings', { storeName: "Twisted Happiness", instagram: "https://www.instagram.com/khushiified_art?igsh=aW1vZ2N4cTl2OWo=", whatsapp: "9909310501", upiId: "khushisj315@oksbi", countryCode: "+91" });
let products = []; let allOrders = []; let selectedFilesData = []; let editModeId = null; let mainImageIndex = 0; let originalEditImages = [];

function initApp() {
    try { 
        // PersistSession: false ensures Admin logs out when closing the tab and doesn't override customer accounts!
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }); 
        populateCountryCodes(); bindAdminEvents(); checkSession();
    } catch (e) { console.error("Supabase Init Error:", e); }
}
document.addEventListener('DOMContentLoaded', initApp);

function populateCountryCodes() {
    const select = document.getElementById('admin-country-code'); if (!select) return;
    for (const [code, label] of Object.entries(countryCodeMapping)) { const option = document.createElement('option'); option.value = code; option.textContent = label; select.appendChild(option); }
}

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) { const { data } = await _supabase.from('store_config').select('id').limit(1); if (data && data.length > 0) return unlockDashboard(); else await _supabase.auth.signOut(); } 
    document.getElementById('login-view').classList.remove('hidden');
}

async function attemptLogin(e) { 
    e.preventDefault(); const email = document.getElementById('admin-user').value.trim(), pass = document.getElementById('admin-pass').value.trim(), btn = document.getElementById('login-btn'); 
    if(!email || !pass) return; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...'; btn.disabled = true; 
    try { const { data, error } = await _supabase.auth.signInWithPassword({ email: email, password: pass }); if (error) throw error; if (data.session) { const { data: chk } = await _supabase.from('store_config').select('id').limit(1); if (chk && chk.length > 0) return unlockDashboard(); else { await _supabase.auth.signOut(); throw new Error("Unauthorized"); } } } 
    catch (err) { alert("Access Denied: Check your credentials."); btn.innerHTML = 'Enter Studio'; btn.disabled = false; }
}

const escapeHTML = (str) => String(str ?? '').replace(/[&<>'"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[m]);
const safeCSV = (val) => '"' + String(val ?? '').replace(/"/g, '""') + '"';

let thOrdersFetchTimeout = null;
const thDebouncedFetchOrders = () => {
    if (thOrdersFetchTimeout) clearTimeout(thOrdersFetchTimeout);
    thOrdersFetchTimeout = setTimeout(() => { fetchOrders().catch(e => console.error(e)); }, 300);
};

async function logoutAdmin() {
    if (window.th_orders_channel) {
        await _supabase.removeChannel(window.th_orders_channel);
        window.th_orders_channel = null;
    }
    await _supabase.auth.signOut(); 
    window.location.href = '/'; 
}

function unlockDashboard() {
    document.getElementById('login-view').classList.add('hidden'); document.getElementById('admin-dashboard').classList.remove('hidden');
    requestAnimationFrame(() => {
        document.getElementById('admin-dashboard').classList.remove('opacity-0');
        fetchRuntimeSettings().catch(e => console.error(e)); 
        fetchDatabase().catch(e => console.error(e)); 
        fetchOrders().catch(e => console.error(e)); 
        showToast('Studio Unlocked', 'fa-unlock'); 
        
        if (!window.th_orders_channel) {
            window.th_orders_channel = _supabase.channel('custom-orders-channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                    thDebouncedFetchOrders();
                })
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') { console.log('Realtime orders synced successfully.'); }
                    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { console.error('Realtime orders channel error:', err); }
                });
        }
    });
}

window.th_addPromoLine = function(text = '') {
    const container = document.getElementById('promo-lines-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = "flex gap-2 items-center";
    div.innerHTML = `
        <input type="text" placeholder="Enter promo text..." value="${text}" class="promo-line-input flex-1 bg-white border border-luxury-blush rounded-lg px-3 py-2 text-[10px] font-medium text-luxury-dark outline-none focus:border-luxury-rose">
        <button type="button" onclick="this.parentElement.remove()" class="text-gray-400 hover:text-red-500 px-2 transition-colors"><i class="fas fa-times text-[12px]"></i></button>
    `;
    container.appendChild(div);
};

// Premium Discount Engine Logic
window.th_openDiscountModal = function(index = -1) {
    let d = { id: Date.now().toString(), name: '', type: 'offer', code: '', discountType: 'percent', val: '', maxDiscount: '', condType: 'min_spend', condVal: '', isActive: true, expiry: '' };
    if (index >= 0) {
        try { const arr = JSON.parse(settings.promoCodes || '[]'); d = arr[index]; document.getElementById('disc-index').value = index; } catch(e){}
    } else { document.getElementById('disc-index').value = -1; }
    
    document.getElementById('disc-name').value = d.name || '';
    document.getElementById('disc-type').value = d.type || 'offer';
    document.getElementById('disc-code').value = d.code || '';
    document.getElementById('disc-discount-type').value = d.discountType || 'percent';
    document.getElementById('disc-val').value = d.val || '';
    document.getElementById('disc-max').value = d.maxDiscount || '';
    document.getElementById('disc-cond-type').value = d.condType || 'min_spend';
    document.getElementById('disc-cond-val').value = d.condVal || '';
    document.getElementById('disc-active').checked = d.isActive !== false;
    document.getElementById('disc-expiry').value = d.expiry || '';
    
    window.th_toggleDiscountFields();
    
    const m = document.getElementById('discount-engine-modal');
    m.classList.remove('hidden'); requestAnimationFrame(() => m.classList.remove('opacity-0'));
};

window.th_closeDiscountModal = function() {
    const m = document.getElementById('discount-engine-modal');
    m.classList.add('opacity-0'); setTimeout(() => m.classList.add('hidden'), 300);
};

window.th_toggleDiscountFields = function() {
    const type = document.getElementById('disc-type').value;
    const dType = document.getElementById('disc-discount-type').value;
    const cType = document.getElementById('disc-cond-type').value;
    
    document.getElementById('wrap-code').style.display = type === 'coupon' ? 'block' : 'none';
    document.getElementById('wrap-max').style.display = dType === 'percent' ? 'block' : 'none';
    document.getElementById('wrap-cond-val').style.display = (cType === 'min_spend' || cType === 'min_qty') ? 'block' : 'none';
};

window.th_saveDiscountRule = function() {
    const name = document.getElementById('disc-name').value.trim();
    if (!name) return alert("Name is required.");
    const val = parseFloat(document.getElementById('disc-val').value) || 0;
    if (val < 0) return alert("Value cannot be negative.");
    
    const obj = {
        id: Date.now().toString(),
        name: name,
        type: document.getElementById('disc-type').value,
        code: document.getElementById('disc-code').value.trim().toUpperCase(),
        discountType: document.getElementById('disc-discount-type').value,
        val: val,
        maxDiscount: parseFloat(document.getElementById('disc-max').value) || null,
        condType: document.getElementById('disc-cond-type').value,
        condVal: parseFloat(document.getElementById('disc-cond-val').value) || 0,
        isActive: document.getElementById('disc-active').checked,
        expiry: document.getElementById('disc-expiry').value || null
    };
    
    let arr = []; try { arr = JSON.parse(settings.promoCodes || '[]'); } catch(e){}
    const idx = parseInt(document.getElementById('disc-index').value);
    if (idx >= 0) arr[idx] = obj; else arr.push(obj);
    
    settings.promoCodes = JSON.stringify(arr);
    window.th_renderDiscountsList();
    window.th_closeDiscountModal();
    
    // Bulletproof Auto-Sync (Simulates physical click)
    const saveBtn = document.querySelector('#settings-form button[type="submit"]');
    if(saveBtn) saveBtn.click();
};

window.th_deleteDiscount = function(index) {
    if(!confirm("Delete this discount rule?")) return;
    let arr = []; try { arr = JSON.parse(settings.promoCodes || '[]'); } catch(e){}
    arr.splice(index, 1);
    settings.promoCodes = JSON.stringify(arr);
    window.th_renderDiscountsList();
    
    // Bulletproof Auto-Sync (Simulates physical click)
    const saveBtn = document.querySelector('#settings-form button[type="submit"]');
    if(saveBtn) saveBtn.click();
};

window.th_renderDiscountsList = function() {
    const c = document.getElementById('premium-discounts-container');
    if (!c) return;
    let arr = []; try { arr = JSON.parse(settings.promoCodes || '[]'); } catch(e){}
    c.innerHTML = '';
    
    if (arr.length === 0) {
        c.innerHTML = '<p class="text-[9px] text-gray-400 italic">No offers or coupons active.</p>';
        return;
    }
    
    arr.forEach((d, i) => {
        const valStr = d.discountType === 'percent' ? `${d.val}%` : `₹${d.val}`;
        const badge = d.type === 'coupon' ? `<span class="bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded text-[7px] uppercase font-bold">Coupon: ${d.code}</span>` : `<span class="bg-luxury-rose/10 text-luxury-rose border border-luxury-rose/20 px-2 py-0.5 rounded text-[7px] uppercase font-bold">Auto VIP Offer</span>`;
        const status = d.isActive ? '<i class="fas fa-circle text-green-500 text-[6px]"></i> Active' : '<i class="fas fa-circle text-red-500 text-[6px]"></i> Inactive';
        
        c.innerHTML += `
        <div class="bg-white border border-luxury-blush p-3 rounded-xl shadow-sm flex justify-between items-center hover:border-luxury-rose transition-colors cursor-pointer" onclick="window.th_openDiscountModal(${i})">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <h4 class="font-bold text-[11px] text-luxury-dark uppercase tracking-widest">${d.name}</h4>
                    ${badge}
                </div>
                <p class="text-[9px] text-gray-500 font-medium">${valStr} OFF | Min Spend: ₹${d.condVal} <span class="ml-2 ${d.isActive ? 'text-green-600' : 'text-red-500'} font-bold">${status}</span></p>
            </div>
            <button type="button" onclick="event.stopPropagation(); window.th_deleteDiscount(${i})" class="text-gray-300 hover:text-red-500 w-8 h-8 rounded-full flex items-center justify-center transition-colors"><i class="fas fa-trash text-[10px]"></i></button>
        </div>`;
    });
};

async function fetchRuntimeSettings() {
    try {
        const { data } = await _supabase.from('store_config').select('*').limit(1);
        if(data && data.length > 0) {
            const cloud = data[0]; settings = { promoText: cloud.promo_text, promoCodes: cloud.promo_codes, instagram: cloud.instagram_url, whatsapp: cloud.whatsapp_num, upiId: cloud.upi_id, countryCode: cloud.country_code || "+91" };
            localStorage.setItem('th_settings', JSON.stringify(settings));
        }
    } catch(e) { console.warn("Failed to fetch settings, using cache."); }
    
    if(!settings) settings = {}; 

    const container = document.getElementById('promo-lines-container');
    if(container) {
        container.innerHTML = ''; let lines = [];
        try { lines = JSON.parse(settings.promoText || '[]'); } catch(e) { lines = [settings.promoText]; }
        if (!Array.isArray(lines) || lines.length === 0) lines = [""];
        lines.forEach(l => window.th_addPromoLine(l));
    }

    window.th_renderDiscountsList();

    if(document.getElementById('admin-wa')) document.getElementById('admin-wa').value = settings.whatsapp || ''; 
    if(document.getElementById('admin-country-code')) document.getElementById('admin-country-code').value = settings.countryCode || '+91'; 
    if(document.getElementById('admin-upi-id')) document.getElementById('admin-upi-id').value = settings.upiId || 'khushisj315@oksbi';
    if(document.getElementById('admin-ig')) document.getElementById('admin-ig').value = settings.instagram || 'https://www.instagram.com/khushiified_art?igsh=aW1vZ2N4cTl2OWo=';
}

async function saveSettings(e) { 
    e.preventDefault(); 
    const inputs = document.querySelectorAll('.promo-line-input');
    const pArray = Array.from(inputs).map(inp => inp.value.trim()).filter(val => val !== "");
    const pStr = JSON.stringify(pArray);

    // Using the centralized object for discounts directly from memory
    const cStr = settings.promoCodes || '[]';

    const i = document.getElementById('admin-ig').value.trim(), w = document.getElementById('admin-wa').value.trim(), c = document.getElementById('admin-country-code').value, u = document.getElementById('admin-upi-id').value.trim();
    const payload = { id: 1, promo_text: pStr, promo_codes: cStr, instagram_url: i, whatsapp_num: w, country_code: c, upi_id: u };
    
    try {
        const { error } = await _supabase.from('store_config').upsert([payload]); if (error) throw error;
        settings = { promoText: pStr, promoCodes: cStr, instagram: i, whatsapp: w, countryCode: c, upiId: u };
        localStorage.setItem('th_settings', JSON.stringify(settings)); showToast('Settings Saved & Synced to Cloud', 'fa-check'); 
    } catch(err) { showToast('Failed to sync settings', 'fa-times', 'text-red-500'); console.error(err); }
}

let adminInvSearch = ''; let adminInvFilter = 'All';

function bindAdminEvents() {
    document.getElementById('admin-inv-search')?.addEventListener('input', (e) => { adminInvSearch = e.target.value.toLowerCase(); renderAdminProducts(); });
    document.getElementById('admin-inv-filter')?.addEventListener('change', (e) => { adminInvFilter = e.target.value; renderAdminProducts(); });
    document.getElementById('admin-login-form')?.addEventListener('submit', attemptLogin); document.getElementById('btn-logout')?.addEventListener('click', logoutAdmin); document.getElementById('tab-inventory')?.addEventListener('click', () => switchAdminTab('inventory')); document.getElementById('tab-orders')?.addEventListener('click', () => switchAdminTab('orders')); document.getElementById('subtab-active')?.addEventListener('click', () => switchOrderTab('active')); document.getElementById('subtab-completed')?.addEventListener('click', () => switchOrderTab('completed')); document.getElementById('subtab-rejected')?.addEventListener('click', () => switchOrderTab('rejected')); document.getElementById('settings-form')?.addEventListener('submit', saveSettings); document.getElementById('inventory-form')?.addEventListener('submit', saveProduct); document.getElementById('p-image-file')?.addEventListener('change', handleFileSelection); document.getElementById('p-main-category')?.addEventListener('change', togglePaintingFields); document.getElementById('cancel-edit-btn')?.addEventListener('click', cancelEdit);
}

async function fetchDatabase() { 
    const list = document.getElementById('admin-product-list');
    if(list) list.innerHTML = '<div class="text-center text-gray-400 py-10 text-[10px] uppercase tracking-[0.2em] font-medium"><i class="fas fa-spinner fa-spin text-2xl block mb-2 opacity-30"></i> Loading Inventory...</div>';
    try { 
        const { data, error } = await _supabase.from('creations').select('*').order('created_at', { ascending: false }); 
        if (error) throw error;
        const getImg = (arr, idx) => (arr && arr.length > idx) ? (arr[idx].data || arr[idx] || '') : '';
        products = (data || []).map(row => {
            let parsedImages = []; 
            try { 
                if(typeof row.image_url === 'string') parsedImages = JSON.parse(row.image_url);
                else parsedImages = row.image_url || []; 
            } catch(e) {}
            return {
                id: row.id, name: row.name || 'Untitled Art', category: row.category || '', mainCategory: row.main_category || 'Pipe Cleaner Crafts', price: row.price || 0, prepTime: row.prep_time || '3-5', specs: row.specs || '', dimensions: row.dimensions || '', isCustomizable: row.is_customizable || false,
                image1: getImg(parsedImages, 0), image2: getImg(parsedImages, 1), image3: getImg(parsedImages, 2), image4: getImg(parsedImages, 3), image5: getImg(parsedImages, 4)
            };
        });
        
        if(document.getElementById('main-cat-list')) document.getElementById('main-cat-list').innerHTML = [...new Set(products.map(p => p.mainCategory).filter(Boolean))].map(c => `<option value="${c}">`).join('');
        if(document.getElementById('sub-cat-list')) document.getElementById('sub-cat-list').innerHTML = [...new Set(products.map(p => p.category).filter(Boolean))].map(c => `<option value="${c}">`).join('');
        if(document.getElementById('admin-inv-filter')) document.getElementById('admin-inv-filter').innerHTML = `<option value="All">All Categories</option>` + [...new Set(products.map(p => p.mainCategory).filter(Boolean))].map(c => `<option value="${c}">${c}</option>`).join('');

        renderAdminProducts(); renderAdminCategories();

    } catch (error) { 
        console.error("Admin DB Fetch Error:", error); 
        if(list) list.innerHTML = `<div class="p-5 text-red-500 text-xs font-bold text-center">Database Connection Error: ${error.message}</div>`;
    } 
}

function renderAdminProducts() { 
    const list = document.getElementById('admin-product-list'); 
    if(!list) return;
    list.innerHTML = ''; 
    
    let filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(adminInvSearch);
        const matchesFilter = adminInvFilter === 'All' || p.mainCategory === adminInvFilter;
        return matchesSearch && matchesFilter;
    });

    if(filteredProducts.length === 0) { 
        list.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10 text-[10px] uppercase tracking-[0.2em] font-medium"><i class="fas fa-box-open text-2xl block mb-3 opacity-30"></i> No creations match criteria.</div>'; 
        return; 
    } 
    
    const fragment = document.createDocumentFragment();
    filteredProducts.forEach(p => { 
        const cleanPrice = Number(String(p.price || 0).replace(/[^0-9.,]/g, '')); 
        const adminImg = (typeof p.image1 === 'string' && p.image1.trim() !== '') ? p.image1 : 'https://placehold.co/100/F8E9EA/423133';
        const item = document.createElement('div'); 
        item.className = "flex justify-between items-center bg-white p-3 hover:bg-luxury-bg transition-colors duration-400 border border-luxury-blush rounded-xl shadow-sm";
        item.innerHTML = `<div class="flex gap-3 items-center w-full min-w-0"><img loading="lazy" decoding="async" src="${adminImg}" alt="${p.name}" class="w-12 h-12 shrink-0 object-cover bg-luxury-bg border border-luxury-blush rounded-lg"><div class="flex flex-col justify-center min-w-0 flex-grow"><h4 class="font-bitter text-[12px] font-semibold text-luxury-dark leading-tight truncate mb-0.5" title="${p.name}">${p.name}</h4><div class="flex justify-between items-center w-full pr-2"><p class="font-poppins text-[10px] text-luxury-rose font-bold">₹${cleanPrice}</p><span class="text-[8px] text-gray-400 uppercase tracking-widest truncate max-w-[80px] ml-2">${p.mainCategory}</span></div></div></div><div class="flex gap-2 items-center pl-2 shrink-0 border-l border-luxury-blush/60"><button type="button" onclick="window.th_triggerEdit('${p.id}')" class="text-gray-400 hover:text-luxury-rose text-sm cursor-pointer w-7 h-7 rounded-full bg-white border border-luxury-blush flex items-center justify-center transition-colors"><i class="fas fa-pen text-[9px]"></i></button><button type="button" onclick="window.th_triggerDelete('${p.id}')" class="text-gray-400 hover:text-red-500 text-sm cursor-pointer w-7 h-7 rounded-full bg-white border border-luxury-blush flex items-center justify-center transition-colors"><i class="fas fa-trash text-[9px]"></i></button></div>`;
        fragment.appendChild(item);
    }); 
    list.appendChild(fragment);
}

function togglePaintingFields() {
    const val = document.getElementById('p-main-category').value, container = document.getElementById('painting-fields-container');
    if(val === 'Canvas Paintings' || val === 'Clay Art Paintings') { container.classList.remove('hidden'); } else { container.classList.add('hidden'); document.getElementById('p-dimensions').value = ''; document.getElementById('p-customizable').checked = false; }
    document.getElementById('p-category').value = ''; renderAdminCategories(); 
}

function renderAdminCategories() { const datalist = document.getElementById('sub-cat-list'), mainCat = document.getElementById('p-main-category').value; if(datalist) { const relevantProducts = products.filter(p => p.mainCategory === mainCat); const allSubs = [...new Set(relevantProducts.map(p => p.category).filter(c => c))]; datalist.innerHTML = ''; allSubs.forEach(cat => { const option = document.createElement('option'); option.value = cat; datalist.appendChild(option); }); } }

function compressImageToBlob(file) { 
    return new Promise((resolve) => { 
        const MAX_BYTES = 500 * 1024; // 500 KB strict ceiling
        const MIN_BYTES = 400 * 1024; // 400 KB strict floor

        const reader = new FileReader(); 
        reader.readAsDataURL(file); 
        reader.onload = (e) => { 
            const img = new Image(); img.src = e.target.result; 
            img.onload = () => { 
                // Logarithmic binary search to scale dimensions and quality
                let minPower = 0.01; 
                let maxPower = 4.0; // Allows upscaling tiny files by 400%
                let currentPower = 1.0; 
                let bestBlob = null;
                let bestDiff = Infinity;

                const attemptCompression = (attemptsLeft) => {
                    if (attemptsLeft === 0) return resolve(bestBlob);

                    const scale = Math.max(0.1, Math.min(currentPower, 3.5));
                    const quality = Math.max(0.1, Math.min(currentPower, 1.0));

                    const canvas = document.createElement('canvas'); 
                    const w = Math.round(img.width * scale);
                    const h = Math.round(img.height * scale);
                    
                    canvas.width = w; canvas.height = h; 
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h); 

                    canvas.toBlob((blob) => { 
                        const diff = Math.abs((MAX_BYTES + MIN_BYTES) / 2 - blob.size);
                        if (diff < bestDiff) { bestDiff = diff; bestBlob = blob; }

                        if (blob.size >= MIN_BYTES && blob.size <= MAX_BYTES) {
                            return resolve(blob);
                        }

                        if (blob.size > MAX_BYTES) {
                            maxPower = currentPower; 
                        } else if (blob.size < MIN_BYTES) {
                            minPower = currentPower; 
                        }

                        currentPower = (minPower + maxPower) / 2;
                        attemptCompression(attemptsLeft - 1);
                        
                    }, 'image/jpeg', quality);
                };
                
                attemptCompression(12); // 12 iterations for precision
            }; 
        }; 
    }); 
}

async function handleFileSelection(e) { 
    const files = e.target.files; if (files.length === 0) return; 
    if (selectedFilesData.length + files.length > 5) { alert("Maximum 5 images allowed."); e.target.value = ""; return; } 
    const btn = document.getElementById('btn-save-product'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; btn.disabled = true; 
    for (let i = 0; i < files.length; i++) { const file = files[i]; const blob = await compressImageToBlob(file); const tempUrl = URL.createObjectURL(blob); selectedFilesData.push({ name: file.name, blob: blob, data: tempUrl, isNew: true }); } 
    renderImagePreviews(); btn.innerHTML = editModeId ? 'Update Product' : 'Publish to Collection'; btn.disabled = false; e.target.value = ""; 
}

function renderImagePreviews() {
    const pContainer = document.getElementById('image-preview-container'), helpText = document.getElementById('image-help-text'); pContainer.innerHTML = '';
    if (selectedFilesData.length === 0) { pContainer.classList.add('hidden'); helpText.classList.add('hidden'); return; }
    pContainer.classList.remove('hidden'); helpText.classList.remove('hidden');
    if(mainImageIndex >= selectedFilesData.length) mainImageIndex = 0;
    selectedFilesData.forEach((fileObj, i) => { pContainer.innerHTML += `<div onclick="window.th_setMainImage(${i})" class="relative aspect-[4/5] bg-luxury-bg rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${i === mainImageIndex ? 'border-luxury-rose shadow-md scale-105 z-10' : 'border-luxury-blush opacity-60'}">${i === mainImageIndex ? '<span class="absolute top-2 left-2 bg-luxury-rose text-white text-[7px] px-1.5 py-0.5 rounded-sm z-10 shadow-sm">COVER</span>' : ''}<button type="button" onclick="window.th_removeSelectedImage(${i}, event)" class="absolute top-2 right-2 bg-white/90 text-luxury-dark w-6 h-6 rounded-full flex items-center justify-center z-20"><i class="fas fa-times text-[10px]"></i></button><img src="${fileObj.data}" class="w-full h-full object-cover"></div>`; });
}

window.th_setMainImage = function(index) { if (index === 0) return; const selectedImage = selectedFilesData.splice(index, 1)[0]; selectedFilesData.unshift(selectedImage); mainImageIndex = 0; renderImagePreviews(); };
window.th_removeSelectedImage = function(index, event) { event.stopPropagation(); selectedFilesData.splice(index, 1); mainImageIndex = 0; renderImagePreviews(); };

async function saveProduct(e) { 
    e.preventDefault();
    const btn = document.getElementById('btn-save-product'), name = document.getElementById('p-name').value; 
    if(selectedFilesData.length === 0) return alert("Provide at least one image."); 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...'; btn.disabled = true; 
    if (mainImageIndex !== 0 && selectedFilesData.length > 1) { const mainImg = selectedFilesData.splice(mainImageIndex, 1)[0]; selectedFilesData.unshift(mainImg); }

    let uploadedUrls = [];
    for(let i=0; i<selectedFilesData.length; i++) {
        let item = selectedFilesData[i];
        if(item.isNew) {
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
            const { error } = await _supabase.storage.from('art-images').upload(fileName, item.blob, { contentType: 'image/webp' });
            if(error) { alert("Upload failed!"); btn.innerHTML = 'Publish to Collection'; btn.disabled = false; return; }
            const { data: publicUrlData } = _supabase.storage.from('art-images').getPublicUrl(fileName); uploadedUrls.push({ data: publicUrlData.publicUrl });
        } else { uploadedUrls.push({ data: item.data }); }
    }

    const cleanNumericPrice = parseFloat(document.getElementById('p-price').value) || 0, mainCat = document.getElementById('p-main-category').value;
    const payload = { name: name, main_category: mainCat, category: document.getElementById('p-category').value || 'General', price: cleanNumericPrice, prep_time: document.getElementById('p-prep').value || '3-5', specs: document.getElementById('p-specs').value || '', dimensions: (mainCat !== 'Pipe Cleaner Crafts') ? document.getElementById('p-dimensions').value : '', is_customizable: (mainCat !== 'Pipe Cleaner Crafts') ? document.getElementById('p-customizable').checked : false, image_url: uploadedUrls.length > 0 ? JSON.stringify(uploadedUrls) : undefined };

    let err;
    if (editModeId) { 
        if (uploadedUrls.length === 0) delete payload.image_url; 
        
        // Permanent Server Cleanup for Replaced Images
        const finalUrls = uploadedUrls.map(u => u.data);
        const orphanedFiles = [];
        originalEditImages.forEach(oldUrl => {
            if (!finalUrls.includes(oldUrl)) {
                const fileName = oldUrl.substring(oldUrl.lastIndexOf('/') + 1);
                if(fileName) orphanedFiles.push(fileName);
            }
        });
        if (orphanedFiles.length > 0) {
            await _supabase.storage.from('art-images').remove(orphanedFiles);
        }

        const { error } = await _supabase.from('creations').update(payload).eq('id', editModeId); err = error; 
    } 
    else { const { error } = await _supabase.from('creations').insert([payload]); err = error; }

    if(!err) { showToast("Added to Collection!", "fa-check"); cancelEdit(); fetchDatabase(); } else { showToast("Error saving", "fa-times", "text-red-500"); console.error(err); }
    btn.innerHTML = editModeId ? 'Update Product' : 'Publish to Collection'; btn.disabled = false; 
}

window.th_triggerEdit = function(id) { 
    const p = products.find(x => x.id === id); if(!p) return; editModeId = p.id; 
    document.getElementById('p-main-category').value = p.mainCategory || 'Pipe Cleaner Crafts'; togglePaintingFields();
    document.getElementById('p-name').value = p.name; document.getElementById('p-category').value = p.category; document.getElementById('p-price').value = p.price; document.getElementById('p-prep').value = p.prepTime || ''; document.getElementById('p-specs').value = p.specs; document.getElementById('p-dimensions').value = p.dimensions || ''; document.getElementById('p-customizable').checked = p.isCustomizable || false; document.getElementById('p-image-file').value = ''; 
    selectedFilesData = []; originalEditImages = [];
    if(p.image1) { selectedFilesData.push({name: 'img1', data: p.image1, isNew: false}); originalEditImages.push(p.image1); }
    if(p.image2) { selectedFilesData.push({name: 'img2', data: p.image2, isNew: false}); originalEditImages.push(p.image2); }
    if(p.image3) { selectedFilesData.push({name: 'img3', data: p.image3, isNew: false}); originalEditImages.push(p.image3); }
    if(p.image4) { selectedFilesData.push({name: 'img4', data: p.image4, isNew: false}); originalEditImages.push(p.image4); }
    if(p.image5) { selectedFilesData.push({name: 'img5', data: p.image5, isNew: false}); originalEditImages.push(p.image5); }
    mainImageIndex = 0; renderImagePreviews();
    document.getElementById('form-title').innerHTML = `Editing: <span class="text-luxury-rose">${p.name}</span>`; document.getElementById('cancel-edit-btn').classList.remove('hidden'); document.getElementById('btn-save-product').innerHTML = 'Update Product'; window.scrollTo({top: 0, behavior: 'smooth'}); 
};

function cancelEdit() { 
    editModeId = null; mainImageIndex = 0; originalEditImages = []; document.getElementById('inventory-form').reset(); document.getElementById('p-main-category').value = 'Pipe Cleaner Crafts'; togglePaintingFields();
    selectedFilesData = []; renderImagePreviews(); document.getElementById('form-title').textContent = 'Add New Art Piece'; document.getElementById('cancel-edit-btn').classList.add('hidden'); document.getElementById('btn-save-product').innerHTML = 'Publish to Collection'; 
}

window.th_triggerDelete = async function(id) { 
    const p = products.find(x => x.id === id); if(!confirm(`Remove "${p.name}"?`)) return; showToast("Removing...", "fa-spinner fa-spin"); 
    
    // Purge images from storage before deleting the database row
    const imgsToDelete = [p.image1, p.image2, p.image3, p.image4, p.image5]
        .filter(Boolean)
        .map(url => url.substring(url.lastIndexOf('/') + 1));
        
    if (imgsToDelete.length > 0) {
        await _supabase.storage.from('art-images').remove(imgsToDelete);
    }

    const { error } = await _supabase.from('creations').delete().eq('id', id);
    if(!error) { showToast("Piece Removed", "fa-trash"); fetchDatabase(); } else { showToast("Error removing piece", "fa-times", "text-red-500"); }
};

function switchAdminTab(tab) {
    const invBtn = document.getElementById('tab-inventory'), ordBtn = document.getElementById('tab-orders'), invSec = document.getElementById('admin-inventory-section'), ordSec = document.getElementById('admin-orders-section');
    if(tab === 'inventory') {
        invBtn.className = "text-white bg-luxury-dark font-bold text-[9px] uppercase tracking-[0.1em] px-4 py-2.5 rounded-full shadow-sm transition-colors";
        ordBtn.className = "text-gray-500 bg-luxury-bg hover:text-luxury-dark font-bold text-[9px] uppercase tracking-[0.1em] px-4 py-2.5 rounded-full shadow-sm relative transition-colors";
        invSec.classList.remove('hidden'); ordSec.classList.add('hidden');
    } else {
        ordBtn.className = "text-white bg-luxury-dark font-bold text-[9px] uppercase tracking-[0.1em] px-4 py-2.5 rounded-full shadow-sm relative transition-colors";
        invBtn.className = "text-gray-500 bg-luxury-bg hover:text-luxury-dark font-bold text-[9px] uppercase tracking-[0.1em] px-4 py-2.5 rounded-full shadow-sm transition-colors";
        ordSec.classList.remove('hidden'); invSec.classList.add('hidden'); switchOrderTab('active'); fetchOrders();
    }
}

function switchOrderTab(tab) {
    const activeBtn = document.getElementById('subtab-active'), completedBtn = document.getElementById('subtab-completed'), rejectedBtn = document.getElementById('subtab-rejected'), activeSec = document.getElementById('admin-active-orders'), completedSec = document.getElementById('admin-completed-orders'), rejectedSec = document.getElementById('admin-rejected-orders'), title = document.getElementById('order-section-title');
    
    const activeClass = "text-white bg-luxury-dark font-bold text-[9px] uppercase tracking-[0.1em] px-6 py-3 rounded-full shadow-sm transition-colors border border-luxury-dark";
    const inactiveClass = "text-gray-500 bg-luxury-bg hover:text-luxury-dark font-bold text-[9px] uppercase tracking-[0.1em] px-6 py-3 rounded-full shadow-sm transition-colors border border-luxury-blush";
    
    if(activeBtn) activeBtn.className = tab === 'active' ? activeClass : inactiveClass;
    if(completedBtn) completedBtn.className = tab === 'completed' ? activeClass.replace('bg-luxury-dark', 'bg-luxury-rose').replace('border-luxury-dark', 'border-luxury-rose') : inactiveClass;
    if(rejectedBtn) rejectedBtn.className = tab === 'rejected' ? activeClass.replace('bg-luxury-dark', 'bg-red-500').replace('border-luxury-dark', 'border-red-500') : inactiveClass;
    
    if(activeSec) activeSec.classList.add('hidden'); if(completedSec) completedSec.classList.add('hidden'); if(rejectedSec) rejectedSec.classList.add('hidden');
    
    if(tab === 'active') {
        if(activeSec) activeSec.classList.remove('hidden'); title.textContent = "Concierge Desk: Active Workspace";
    } else if(tab === 'completed') {
        if(completedSec) completedSec.classList.remove('hidden'); title.textContent = "The Archives: Elegantly Delivered";
    } else if(tab === 'rejected') {
        if(rejectedSec) rejectedSec.classList.remove('hidden'); title.textContent = "Rejected Orders: Payment Failed";
    }
}

async function fetchOrders() {
    try {
        const { data, error } = await _supabase.from('orders').select('*').order('created_at', { ascending: false }); 
        if (error) throw error; 
        
        // Globally assign data securely
        allOrders = data || [];
        
        const pendingCount = allOrders.filter(o => o.status === 'new' || o.status === 'pending').length; 
        const badge = document.getElementById('admin-order-badge');
        if (badge) {
            if (pendingCount > 0) { badge.textContent = pendingCount; badge.classList.remove('hidden'); } 
            else { badge.classList.add('hidden'); }
        }
        
        updateAnalyticsDashboard(); 
        
        // Force the UI to render directly, bypassing any missing object confusion
        if (typeof window.th_renderDashboard === 'function') {
            window.th_renderDashboard();
        } else {
            // Hard Failsafe: if Phase 9 engine fails, render natively
            renderActiveOrders();
            renderCompletedOrders();
            renderRejectedOrders();
        }
    } catch (err) { 
        console.error("Error fetching orders", err); 
        const container = document.getElementById('admin-active-orders');
        if (container) container.innerHTML = `<div class="text-center text-red-500 py-10 font-bold">Database connection failed.</div>`;
    }
}

function updateAnalyticsDashboard() {
    let totalRevenue = 0, currentMonthRevenue = 0, activeCount = 0, completedCount = 0;
    const now = new Date(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear();
    allOrders.forEach(o => {
        if (o.status === 'completed') {
            completedCount++; const orderTotal = parseFloat(o.total) || 0; totalRevenue += orderTotal;
            const orderDate = new Date(o.created_at);
            if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) { currentMonthRevenue += orderTotal; }
        } else if (['new', 'pending', 'curating', 'ready'].includes(o.status)) { activeCount++; }
    });
    const revEl = document.getElementById('analytics-revenue'), monthEl = document.getElementById('analytics-month'), actEl = document.getElementById('analytics-active'), compEl = document.getElementById('analytics-completed');
    if (revEl) revEl.textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;
    if (monthEl) monthEl.textContent = `₹${currentMonthRevenue.toLocaleString('en-IN')}`;
    if (actEl) actEl.textContent = activeCount;
    if (compEl) compEl.textContent = completedCount;
}

function extractCustomerData(orderOrString) { 
    let name = "Esteemed Patron", phone = "", prepTime = "a few days", orderId = "TH_LEGACY", address = "";
    const parseDBData = (data) => { if (!data) return {}; if (typeof data === 'object') return data; try { return JSON.parse(data); } catch(e) { return {}; } };
    
    let safeStr = "";
    if (typeof orderOrString === 'object' && orderOrString !== null) {
        safeStr = orderOrString.customer_reqs || "";
        const sd = parseDBData(orderOrString.shipping_data);
        if (sd.first_name || sd.last_name) name = `${sd.first_name || ''} ${sd.last_name || ''}`.trim();
        if (sd.phone) phone = sd.phone;
        if (sd.address_1 || sd.city) address = [sd.address_1, sd.address_2, sd.city, sd.state, sd.pincode].filter(Boolean).join(', ');
        if (orderOrString.id) orderId = orderOrString.id.split('-')[0].toUpperCase();
    } else { safeStr = orderOrString || ""; }

    const nameMatch = safeStr.match(/Patron:\s*([^|]+)/), phoneMatch = safeStr.match(/Phone:\s*([^|]+)/) || safeStr.match(/Ph:\s*([^|]+)/), prepMatch = safeStr.match(/Est.\s*Prep:\s*([^|]+)/), idMatch = safeStr.match(/ID:\s*([^|]+)/), addrMatch = safeStr.match(/Address:\s*([^|]+)/); 
    if (name === "Esteemed Patron" && nameMatch) name = nameMatch[1].trim();
    if (!phone && phoneMatch) phone = phoneMatch[1].trim();
    if (!address && addrMatch) address = addrMatch[1].trim();
    if (prepMatch) prepTime = prepMatch[1].trim();
    if (orderId === "TH_LEGACY" && idMatch) orderId = idMatch[1].trim();
    
    return { name, phone, prepTime, orderId, address, parseDBData };
}

function buildFinTrackInfo(order, parseDBData) {
    let payMethod = escapeHTML((order.payment_method || 'upi').toUpperCase());
    let payStatus = escapeHTML((order.payment_status || 'pending').toUpperCase());
    let payColor = payStatus === 'PAID' ? 'text-green-600' : (payStatus === 'FAILED' ? 'text-red-500' : 'text-yellow-600');
    
    let bdHtml = '';
    let bd = parseDBData(order.discount_breakdown);
    if (Object.keys(bd).length > 0) {
        bdHtml = `<div class="bg-white border border-luxury-blush rounded-lg p-3 text-[10px] text-gray-500 shadow-sm mt-3 flex flex-col gap-1"><div class="flex justify-between"><span>Subtotal:</span><span class="font-bold text-luxury-dark">₹${escapeHTML(order.subtotal || order.total)}</span></div>${bd.vip_discount ? `<div class="flex justify-between"><span>VIP Discount:</span><span class="text-luxury-rose">-₹${escapeHTML(bd.vip_discount)}</span></div>` : ''}${bd.coupon_discount ? `<div class="flex justify-between"><span>Coupon (${escapeHTML(bd.coupon_code || '')}):</span><span class="text-luxury-rose">-₹${escapeHTML(bd.coupon_discount)}</span></div>` : ''}${bd.upi_discount ? `<div class="flex justify-between"><span>UPI Discount:</span><span class="text-luxury-rose">-₹${escapeHTML(bd.upi_discount)}</span></div>` : ''}${order.delivery_fee ? `<div class="flex justify-between"><span>Delivery:</span><span>+₹${escapeHTML(order.delivery_fee)}</span></div>` : ''}</div>`;
    } else if (order.discount > 0) {
        bdHtml = `<div class="bg-white border border-luxury-blush rounded-lg p-3 text-[10px] text-gray-500 shadow-sm mt-3 flex flex-col gap-1"><div class="flex justify-between"><span>Subtotal:</span><span class="font-bold text-luxury-dark">₹${escapeHTML(order.subtotal || order.total)}</span></div><div class="flex justify-between"><span>Legacy Discount:</span><span class="text-luxury-rose">-₹${escapeHTML(order.discount)}</span></div>${order.delivery_fee ? `<div class="flex justify-between"><span>Delivery:</span><span>+₹${escapeHTML(order.delivery_fee)}</span></div>` : ''}</div>`;
    }
    
    let trackHtml = '';
    let t = parseDBData(order.tracking_data);
    if (t.awb) {
        trackHtml = `<div class="bg-[#E0F2FE] border border-blue-200 text-[#1E3A8A] rounded-lg p-3 text-[10px] mt-3 shadow-sm font-bold flex justify-between items-center"><span><i class="fas fa-truck-fast mr-1"></i> AWB: ${escapeHTML(t.awb)}</span><span class="uppercase tracking-widest text-[8px] bg-white px-2 py-1 rounded">${escapeHTML(t.current_status || 'SHIPPED')}</span></div>`;
    }
    
    return `<div class="flex gap-2 mt-3 mb-2"><span class="bg-gray-100 text-gray-600 border border-gray-200 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest"><i class="fas fa-wallet mr-1"></i> ${payMethod}</span><span class="bg-gray-50 border border-gray-200 ${payColor} px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest">${payStatus}</span></div>${bdHtml}${trackHtml}`;
}

function buildOrderItemsVisual(orderDetailsData) {
    let html = "";
    try { 
        const items = typeof orderDetailsData === 'string' ? JSON.parse(orderDetailsData) : orderDetailsData; 
        html = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">`;
        items.forEach(i => { const img = escapeHTML(i.image || 'https://placehold.co/100/F8E9EA/423133'); html += `<div class="flex items-center gap-3 bg-white p-2 rounded-lg border border-luxury-blush shadow-sm"><img src="${img}" class="w-12 h-12 object-cover rounded-md border border-luxury-blush bg-luxury-bg"><div><p class="text-[11px] font-bitter font-semibold text-luxury-dark line-clamp-1">${escapeHTML(i.name)}</p><p class="text-[9px] font-poppins font-bold text-luxury-rose">${escapeHTML(i.qty)}x <span class="text-gray-400 font-medium">₹${escapeHTML(i.price)}</span></p></div></div>`; }); html += `</div>`;
    } catch { html = `<p class="font-bitter text-luxury-dark text-[13px] whitespace-pre-wrap font-semibold mb-2 leading-relaxed">${escapeHTML((orderDetailsData || '').trim())}</p>`; }
    return html;
}

function renderActiveOrders(customOrders) {
    const container = document.getElementById('admin-active-orders'); container.innerHTML = '';
    const activeOrders = customOrders || allOrders.filter(o => ['new', 'pending', 'curating', 'ready', 'shipped', 'out_for_delivery'].includes(o.status));
    if (activeOrders.length === 0) { container.innerHTML = '<div class="text-center text-gray-400 py-10 text-[10px] uppercase tracking-[0.2em] font-medium"><i class="fas fa-inbox text-2xl mb-3 opacity-50 block"></i> Your workspace is clear.</div>'; return; }

    activeOrders.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const customerData = extractCustomerData(order); const visualItems = buildOrderItemsVisual(order.order_details);
        const finTrackHtml = buildFinTrackInfo(order, customerData.parseDBData);
        let statusBadge = "", actionButton = "";

        // STRICT ID SANITIZATION FOR INLINE JS EXECUTION
        const safeId = String(order.id).replace(/[^a-zA-Z0-9_-]/g, '');

        if (order.status === 'new' || order.status === 'pending') {
            statusBadge = `<span class="bg-yellow-100 text-yellow-700 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md">Awaiting Verification</span>`;
            actionButton = `<button type="button" onclick="window.th_rejectOrder('${safeId}')" class="px-4 py-2.5 rounded-full text-gray-400 border hover:text-red-500 font-bold text-[9px] uppercase tracking-widest">Deny (No Payment)</button><button type="button" onclick="window.th_startCrafting('${safeId}')" class="px-5 py-2.5 rounded-full bg-green-600 text-white font-bold text-[9px] uppercase tracking-widest hover:bg-white hover:text-green-600 transition-colors shadow-sm"><i class="fas fa-magic mr-1"></i> Verify & Start Crafting</button>`;
        } else if (order.status === 'curating') {
            statusBadge = `<span class="bg-blue-100 text-blue-700 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md">Artisan At Work</span>`;
            actionButton = `<button type="button" onclick="window.th_markOrderReady('${safeId}')" class="px-5 py-2.5 rounded-full bg-luxury-gold text-white font-bold text-[9px] uppercase tracking-widest hover:bg-white hover:text-luxury-gold shadow-sm"><i class="fas fa-paint-brush mr-2"></i> ✨ Masterpiece Crafted</button>`;
        } else if (order.status === 'ready') {
            statusBadge = `<span class="bg-purple-100 text-purple-700 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md">Awaiting Dispatch</span>`;
            actionButton = `<button type="button" onclick="window.th_pushToShiprocket('${safeId}', event)" class="px-5 py-2.5 rounded-full bg-[#E0F2FE] text-[#1E3A8A] font-bold text-[9px] uppercase tracking-widest shadow-sm"><i class="fas fa-rocket mr-1.5"></i> Push to Shiprocket</button>`;
        } else if (order.status === 'shipped' || order.status === 'out_for_delivery') {
            statusBadge = `<span class="bg-blue-100 text-blue-700 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md">Shipped via Shiprocket</span>`;
            actionButton = `<span class="text-[10px] text-blue-500 font-bold uppercase tracking-widest"><i class="fas fa-truck-fast"></i> Auto-Syncing Tracking</span>`;
        }

        container.innerHTML += `<div class="border border-luxury-blush rounded-xl p-5 bg-luxury-bg shadow-sm relative overflow-hidden group hover:border-luxury-rose/50 transition-colors"><div class="absolute top-0 left-0 w-1.5 h-full ${order.status === 'new' || order.status === 'pending' ? 'bg-yellow-400' : (order.status === 'curating' ? 'bg-luxury-gold' : 'bg-luxury-rose')}"></div><div class="flex justify-between items-start mb-4"><div><h4 class="font-logo font-normal text-xl text-luxury-dark mb-0.5">${escapeHTML(customerData.name)}</h4><span class="text-[8px] font-bold text-gray-400 uppercase tracking-widest"><i class="far fa-clock mr-1"></i> ${escapeHTML(date)} | ${escapeHTML(customerData.orderId)}</span></div>${statusBadge}</div><div class="mb-2">${visualItems}</div>${finTrackHtml}<div class="bg-white border border-luxury-blush p-3 mt-3 rounded-lg text-gray-500 text-[10px] sm:text-[11px] leading-relaxed font-sans shadow-inner whitespace-pre-wrap">${customerData.address ? `<div class="mb-2 pb-2 border-b border-luxury-blush"><i class="fas fa-map-marker-alt text-luxury-rose mr-1"></i> <strong>Address:</strong> ${escapeHTML(customerData.address)}</div>` : ''}${escapeHTML(order.customer_reqs || 'No legacy notes.')}</div><div class="flex flex-col xl:flex-row xl:justify-between xl:items-center border-t border-luxury-blush pt-4 mt-4 gap-4"><div><p class="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Final Invoice Total</p><p class="font-poppins font-extrabold text-luxury-dark text-xl">₹${escapeHTML(order.total)}</p></div><div class="flex gap-2 w-full xl:w-auto justify-start xl:justify-end flex-wrap"><button type="button" onclick="window.th_openOrderDetail('${safeId}')" class="px-4 py-2.5 rounded-full bg-white border border-luxury-blush text-luxury-dark hover:text-luxury-rose hover:border-luxury-rose/50 font-bold text-[9px] uppercase tracking-widest transition-colors shadow-sm"><i class="fas fa-search-plus mr-1"></i> Inspect</button>${actionButton}</div></div></div>`;
    });
}

function renderCompletedOrders(customOrders) {
    const container = document.getElementById('admin-completed-orders'); container.innerHTML = ''; const completedOrders = customOrders || allOrders.filter(o => o.status === 'completed');
    if (completedOrders.length === 0) { container.innerHTML = '<div class="text-center text-gray-400 py-10 text-[10px] uppercase tracking-[0.2em] font-medium"><i class="fas fa-archive text-2xl mb-3 opacity-50 block"></i> No archived deliveries yet.</div>'; return; }
    completedOrders.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); const customerData = extractCustomerData(order); const visualItems = buildOrderItemsVisual(order.order_details);
        const finTrackHtml = buildFinTrackInfo(order, customerData.parseDBData);
        // STRICT ID SANITIZATION FOR INLINE JS EXECUTION
        const safeId = String(order.id).replace(/[^a-zA-Z0-9_-]/g, '');

        let codPaymentAction = "";
        if (order.payment_method === 'cod' && order.payment_status !== 'paid') {
            codPaymentAction = `<button type="button" onclick="window.th_markPaymentReceived('${safeId}')" class="bg-[#dcfce7] text-[#166534] border border-[#bbf7d0] hover:bg-[#166534] hover:text-white px-3 py-1.5 rounded-full text-[9px] uppercase font-bold tracking-widest cursor-pointer transition-colors mr-3 shadow-sm"><i class="fas fa-check-circle mr-1"></i> Mark Cash Received</button>`;
        }
        container.innerHTML += `<div class="border border-luxury-blush rounded-xl p-5 bg-white shadow-sm relative overflow-hidden opacity-80 hover:opacity-100 transition-opacity"><div class="flex justify-between items-start mb-3"><div><h4 class="font-logo font-normal text-lg text-luxury-dark mb-0.5">${escapeHTML(customerData.name)}</h4><span class="text-[8px] font-bold text-gray-400 uppercase tracking-widest"><i class="fas fa-check-double mr-1 text-luxury-rose"></i> ${escapeHTML(date)} | ${escapeHTML(customerData.orderId)}</span></div><span class="bg-gray-100 text-gray-500 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border border-gray-200">Elegantly Delivered</span></div><div class="mb-3">${visualItems}</div>${finTrackHtml}<div class="flex justify-between items-center border-t border-luxury-blush pt-4 mt-4"><p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Total <span class="font-poppins text-luxury-dark text-[11px] ml-1">₹${escapeHTML(order.total)}</span></p><div class="flex items-center gap-3"><button type="button" onclick="window.th_openOrderDetail('${safeId}')" class="text-gray-500 hover:text-luxury-rose text-[10px] uppercase font-bold tracking-widest cursor-pointer transition-colors"><i class="fas fa-search-plus mr-1"></i> Inspect</button>${codPaymentAction}<button type="button" onclick="window.th_purgeOrder('${safeId}')" class="text-red-400 hover:text-red-600 text-[10px] uppercase font-bold tracking-widest cursor-pointer transition-colors"><i class="fas fa-trash-alt mr-1"></i> Purge</button></div></div></div>`;
    });
}

window.th_startCrafting = async function(id) {
    const order = allOrders.find(o => o.id === id); if(!order) return; showToast("Verifying & Starting...", "fa-spinner fa-spin");
    try {
        const updatePayload = { status: 'curating' };
        if (order.payment_method === 'upi') updatePayload.payment_status = 'paid';
        
        const { error } = await _supabase.from('orders').update(updatePayload).eq('id', id); 
        if (error) throw error;
        
        showToast("Crafting Started", "fa-check"); fetchOrders(); 
        const customerData = extractCustomerData(order);
        if (customerData.phone) {
            let cleanPhone = customerData.phone.replace(/\D/g, ''); 
            if (cleanPhone.startsWith('9191') && cleanPhone.length > 11) cleanPhone = cleanPhone.substring(2);
            const acceptMsg = `Dear ${customerData.name},\n\nYour exquisite commission (${customerData.orderId}) from *Twisted Happiness* has been embraced, and our artisan has officially begun handcrafting your piece.\n\nIt will take approximately *${customerData.prepTime}* to prepare for dispatch.\n\nThank you for trusting us.`;
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(acceptMsg)}`, '_blank');
        }
    } catch(e) { showToast("Error processing order", "fa-times", "text-red-500"); console.error(e); }
};

window.th_markOrderReady = async function(id) { 
    showToast("Updating status...", "fa-spinner fa-spin"); 
    try { 
        const { error } = await _supabase.from('orders').update({ status: 'ready' }).eq('id', id); 
        if (error) throw error;
        showToast("Marked as Curated", "fa-check"); fetchOrders(); 
    } catch(e) { showToast("Error", "fa-times", "text-red-500"); console.error(e); } 
};

window.th_purgeOrder = async function(id) { 
    if(!confirm("CRITICAL WARNING: Are you sure you want to permanently delete this order? This cannot be undone.")) return; 
    showToast("Purging...", "fa-spinner fa-spin"); 
    try { 
        const { error } = await _supabase.from('orders').delete().eq('id', id); 
        if (error) throw error;
        showToast("Erased Permanently", "fa-trash"); fetchOrders(); 
    } catch(e) { showToast("Error", "fa-times", "text-red-500"); console.error(e); } 
};

window.th_rejectOrder = async function(id) {
    if(!confirm("Are you sure you want to reject and cancel this order? This will mark it as cancelled and notify the customer via WhatsApp.")) return;
    const order = allOrders.find(o => o.id === id); if(!order) return;
    showToast("Rejecting...", "fa-spinner fa-spin");
    try { 
        const { error } = await _supabase.from('orders').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', id); 
        if (error) throw error;
        showToast("Order Rejected", "fa-times"); 
        fetchOrders(); 
        
        const customerData = extractCustomerData(order);
        if (customerData.phone) {
            let cleanPhone = customerData.phone.replace(/\D/g, ''); 
            if (cleanPhone.startsWith('9191') && cleanPhone.length > 11) cleanPhone = cleanPhone.substring(2);
            const rejectMsg = `Dear ${customerData.name},\n\nWe noticed a pending order (${customerData.orderId}) at *Twisted Happiness*, but we haven't received the payment verification yet.\n\nRegrettably, this order has been cancelled. If the amount was deducted from your account, please reply to this message with a screenshot of the transaction so we can restore your order manually.\n\nThank you for understanding!`;
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(rejectMsg)}`, '_blank');
        }
    } catch(e) { showToast("Error rejecting order", "fa-times", "text-red-500"); console.error(e); }
};

window.th_markPaymentReceived = async function(id) {
    if(!confirm("Confirm that cash has been received for this COD order?")) return;
    showToast("Updating payment...", "fa-spinner fa-spin");
    try {
        const { error } = await _supabase.from('orders').update({ payment_status: 'paid' }).eq('id', id);
        if (error) throw error;
        showToast("Payment Verified", "fa-check");
        fetchOrders();
    } catch(e) { showToast("Error updating payment", "fa-times", "text-red-500"); console.error(e); }
};

function renderRejectedOrders(customOrders) {
    const container = document.getElementById('admin-rejected-orders'); if(!container) return; container.innerHTML = ''; 
    const rejectedOrders = customOrders || allOrders.filter(o => o.status === 'cancelled');
    if (rejectedOrders.length === 0) { container.innerHTML = '<div class="text-center text-gray-400 py-10 text-[10px] uppercase tracking-[0.2em] font-medium"><i class="fas fa-times-circle text-2xl mb-3 opacity-50 block"></i> No rejected orders.</div>'; return; }
    
    rejectedOrders.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); 
        const customerData = extractCustomerData(order); 
        const visualItems = buildOrderItemsVisual(order.order_details);
        const finTrackHtml = buildFinTrackInfo(order, customerData.parseDBData);
        
        // STRICT ID SANITIZATION FOR INLINE JS EXECUTION
        const safeId = String(order.id).replace(/[^a-zA-Z0-9_-]/g, '');

        container.innerHTML += `<div class="border border-red-200 rounded-xl p-5 bg-red-50 shadow-sm relative overflow-hidden"><div class="flex justify-between items-start mb-3"><div><h4 class="font-logo font-normal text-lg text-red-600 mb-0.5">${escapeHTML(customerData.name)}</h4><span class="text-[8px] font-bold text-red-400 uppercase tracking-widest"><i class="fas fa-ban mr-1"></i> ${escapeHTML(date)} | ${escapeHTML(customerData.orderId)}</span></div><span class="bg-red-100 text-red-600 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border border-red-200">Cancelled / Rejected</span></div><div class="mb-3">${visualItems}</div>${finTrackHtml}<div class="flex justify-between items-center border-t border-red-200 pt-4 mt-4"><p class="text-[9px] font-bold text-red-400 uppercase tracking-widest">Total <span class="font-poppins text-red-600 text-[11px] ml-1">₹${escapeHTML(order.total)}</span></p><div class="flex items-center gap-3"><button type="button" onclick="window.th_openOrderDetail('${safeId}')" class="text-gray-500 hover:text-luxury-rose text-[10px] uppercase font-bold tracking-widest cursor-pointer transition-colors"><i class="fas fa-search-plus mr-1"></i> Inspect</button><button type="button" onclick="window.th_purgeOrder('${safeId}')" class="text-red-500 hover:text-red-700 text-[10px] uppercase font-bold tracking-widest cursor-pointer transition-colors"><i class="fas fa-trash-alt mr-1"></i> Purge Permanently</button></div></div></div>`;
    });
}

window.th_pushToShiprocket = function(orderId, event) {
    document.getElementById('sr-order-id').value = orderId;
    const m = document.getElementById('shiprocket-modal');
    m.classList.remove('hidden'); requestAnimationFrame(() => m.classList.remove('opacity-0'));
};

window.th_confirmShiprocketSync = async function() {
    const orderId = document.getElementById('sr-order-id').value;
    const w = parseFloat(document.getElementById('sr-weight').value) || 0.5;
    const l = parseInt(document.getElementById('sr-length').value) || 10;
    const b = parseInt(document.getElementById('sr-breadth').value) || 10;
    const h = parseInt(document.getElementById('sr-height').value) || 10;
    
    const btn = document.getElementById('btn-sr-sync'); 
    const originalHtml = btn.innerHTML; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i> Syncing...'; btn.disabled = true;
    
    try {
        const { data, error } = await _supabase.functions.invoke('shiprocket', { 
            body: { order_id: orderId, weight: w, length: l, breadth: b, height: h } 
        });
        
        if(error) { alert("Supabase Edge Function Error: " + error.message); throw error; }
        if(data && data.success === false) { alert("Shiprocket API Rejected the Sync:\n" + JSON.stringify(data.error || data.message || "Unknown error")); throw new Error(data.error); }
        
        showToast("Pushed to Shiprocket 🚀", "fa-rocket", "text-[#22c55e]");
        
        const m = document.getElementById('shiprocket-modal');
        m.classList.add('opacity-0'); setTimeout(() => m.classList.add('hidden'), 300);
        fetchOrders(); 
    } catch (err) { 
        console.error("Shiprocket API Error:", err); 
        alert("Sync Failed: " + err.message); 
        showToast("Failed to sync", "fa-times", "text-red-500"); 
    }
    
    btn.innerHTML = originalHtml; btn.disabled = false;
};

window.exportOrdersCSV = function() {
    if (!allOrders || allOrders.length === 0) { return window.showToast("No orders available to export", "fa-times", "text-red-500"); }
    const headers = ["Order ID", "Date", "Status", "Payment Method", "Payment Status", "Customer Name", "Phone", "Total Amount (INR)", "Order Items"];
    const rows = allOrders.map(o => {
        const date = new Date(o.created_at).toLocaleDateString('en-IN');
        const cData = extractCustomerData(o);
        const pMethod = (o.payment_method || 'upi').toUpperCase();
        const pStatus = (o.payment_status || 'pending').toUpperCase();
        let itemsString = "";
        try { const items = JSON.parse(o.order_details); itemsString = items.map(i => `${i.qty}x ${i.name}`).join('; '); } catch(e) { itemsString = "Custom Request / Parsing Error"; }
        return `${safeCSV(o.id)},${safeCSV(date)},${safeCSV(o.status.toUpperCase())},${safeCSV(pMethod)},${safeCSV(pStatus)},${safeCSV(cData.name)},${safeCSV(cData.phone)},${safeCSV(o.total)},${safeCSV(itemsString)}`;
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); const url = URL.createObjectURL(blob);
    link.setAttribute("href", url); link.setAttribute("download", `TH_Orders_Export_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    window.showToast("Data Exported Successfully", "fa-file-download", "text-green-500");
};

function showToast(msg, icon = 'fa-check', color = 'text-luxury-rose') { 
    const t = document.getElementById('toast'); 
    document.getElementById('toast-msg').textContent = msg; 
    document.getElementById('toast-icon').className = `fas ${icon} ${color} text-sm drop-shadow-sm`; 
    requestAnimationFrame(() => { 
        t.classList.remove('opacity-0', 'translate-y-10'); 
        setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000); 
    }); 
}
// ==========================================
// PHASE 9: UX & STATE MANAGEMENT ENGINE
// ==========================================

let th_adminState = {
    search: '',
    status: 'all',
    payment: 'all',
    sort: 'newest',
    openModalId: null
};

let thSearchTimeout;
window.th_handleSearch = function(val) {
    clearTimeout(thSearchTimeout);
    thSearchTimeout = setTimeout(() => {
        th_adminState.search = val.toLowerCase().trim();
        th_renderDashboard();
    }, 300);
};

window.th_handleFilter = function(type, val) {
    th_adminState[type] = val;
    const el = document.getElementById(`admin-filter-${type}`);
    if (el) el.value = val;
    th_renderDashboard();
};

window.th_clearFilters = function() {
    th_adminState = { search: '', status: 'all', payment: 'all', sort: 'newest', openModalId: th_adminState.openModalId };
    if(document.getElementById('admin-search')) document.getElementById('admin-search').value = '';
    if(document.getElementById('admin-filter-status')) document.getElementById('admin-filter-status').value = 'all';
    if(document.getElementById('admin-filter-payment')) document.getElementById('admin-filter-payment').value = 'all';
    if(document.getElementById('admin-filter-sort')) document.getElementById('admin-filter-sort').value = 'newest';
    th_renderDashboard();
};

// ==========================================
// PHASE 9: CENTRAL DASHBOARD RENDERER
// ==========================================

window.th_renderDashboard = function() {
    // 1. Hard check: If no data, force clear the loading spinner anyway
    if (!allOrders || !Array.isArray(allOrders)) {
        const container = document.getElementById('admin-active-orders');
        if(container) container.innerHTML = '<div class="text-center text-gray-400 py-10 text-[10px] uppercase tracking-[0.2em] font-medium"><i class="fas fa-inbox text-2xl mb-3 opacity-50 block"></i> No orders found.</div>';
        return;
    }
    
    // 2. Calculate Stats 
    let stats = { attention: 0, crafting: 0, ready: 0, transit: 0, completed: 0, codPending: 0 };
    allOrders.forEach(o => {
        const s = String(o.status).toLowerCase();
        if (s === 'new' || s === 'pending') stats.attention++;
        if (s === 'curating') stats.crafting++;
        if (s === 'ready') stats.ready++;
        if (s === 'shipped' || s === 'out_for_delivery') stats.transit++;
        if (s === 'completed') {
            stats.completed++;
            if (String(o.payment_method).toLowerCase() === 'cod' && String(o.payment_status).toLowerCase() !== 'paid') stats.codPending++;
        }
    });
    
    const updateEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    updateEl('stat-attention', stats.attention);
    updateEl('stat-crafting', stats.crafting);
    updateEl('stat-ready', stats.ready);
    updateEl('stat-transit', stats.transit);
    updateEl('stat-completed', stats.completed);
    updateEl('stat-cod-pending', stats.codPending);

    // 3. Filter Orders
    let filtered = allOrders.filter(order => {
        if (typeof th_adminState !== 'undefined' && th_adminState.search) {
            const sText = th_adminState.search;
            const cData = extractCustomerData(order);
            const itemsStr = order.order_details ? String(order.order_details).toLowerCase() : '';
            const searchStr = `${String(order.id)} ${cData.name || ''} ${cData.phone || ''} ${order.tracking_data || ''} ${itemsStr}`.toLowerCase();
            if (!searchStr.includes(sText)) return false;
        }
        if (typeof th_adminState !== 'undefined' && th_adminState.status !== 'all') {
            const s = String(order.status).toLowerCase();
            const f = th_adminState.status;
            if (f === 'attention' && s !== 'new' && s !== 'pending') return false;
            if (f === 'curating' && s !== 'curating') return false;
            if (f === 'ready' && s !== 'ready') return false;
            if (f === 'transit' && s !== 'shipped' && s !== 'out_for_delivery') return false;
            if (f === 'completed' && s !== 'completed') return false;
            if (f === 'rejected' && s !== 'cancelled' && s !== 'rejected') return false;
        }
        if (typeof th_adminState !== 'undefined' && th_adminState.payment !== 'all') {
            const pm = String(order.payment_method).toLowerCase();
            const ps = String(order.payment_status).toLowerCase();
            const f = th_adminState.payment;
            if (f === 'upi' && pm !== 'upi') return false;
            if (f === 'cod' && pm !== 'cod') return false;
            if (f === 'paid' && ps !== 'paid') return false;
            if (f === 'pending' && ps !== 'pending') return false;
        }
        return true;
    });

    // 4. Sort Orders
    if (typeof th_adminState !== 'undefined') {
        filtered.sort((a, b) => {
            if (th_adminState.sort === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            if (th_adminState.sort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
            if (th_adminState.sort === 'high') return (parseFloat(b.total) || 0) - (parseFloat(a.total) || 0);
            if (th_adminState.sort === 'low') return (parseFloat(a.total) || 0) - (parseFloat(b.total) || 0);
            return 0;
        });
    }

    // 5. Distribute seamlessly
    let active = [], completed = [], rejected = [];
    filtered.forEach(o => {
        const s = String(o.status).toLowerCase();
        if (s === 'completed') completed.push(o);
        else if (s === 'cancelled' || s === 'rejected') rejected.push(o);
        else active.push(o);
    });

    // THIS IS THE CRITICAL LINE THAT DELETES THE SPINNER
    renderActiveOrders(active);
    renderCompletedOrders(completed);
    renderRejectedOrders(rejected);

    // 6. Realtime Modal Refresh
    if (typeof th_adminState !== 'undefined' && th_adminState.openModalId) {
        const stillExists = allOrders.some(o => String(o.id).replace(/[^a-zA-Z0-9_-]/g, '') === th_adminState.openModalId);
        if (stillExists) window.th_openOrderDetail(th_adminState.openModalId);
        else window.th_closeOrderDetail();
    }
};

// ==========================================
// PHASE 9: ORDER INSPECTOR MODAL & TIMELINE
// ==========================================

window.th_openOrderDetail = function(orderId) {
    const safeId = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '');
    
    // FIX: Removed 'window.' so it can successfully find your database array
    if (!allOrders) return;
    const order = allOrders.find(o => String(o.id).replace(/[^a-zA-Z0-9_-]/g, '') === safeId);
    
    if (!order) return;
    
    th_adminState.openModalId = safeId;
    
    const cData = extractCustomerData(order);
    const visualItems = buildOrderItemsVisual(order.order_details);
    const finTrack = buildFinTrackInfo(order, cData.parseDBData);
    
    document.getElementById('th-modal-customer').innerHTML = `
        <p><span class="text-gray-400 w-16 inline-block">Name:</span> <strong class="text-luxury-dark">${escapeHTML(cData.name)}</strong></p>
        <p><span class="text-gray-400 w-16 inline-block">Phone:</span> <strong class="text-luxury-dark">${escapeHTML(cData.phone)}</strong></p>
        <p><span class="text-gray-400 w-16 inline-block">Email:</span> <strong class="text-luxury-dark">${escapeHTML(cData.email || 'Not Provided')}</strong></p>
        <p class="mt-2 pt-2 border-t border-luxury-blush"><span class="text-gray-400 block mb-1">Shipping Address:</span> <span class="text-luxury-dark leading-relaxed">${escapeHTML(cData.address || 'Unknown')}</span></p>
        <p class="mt-2 pt-2 border-t border-luxury-blush"><span class="text-gray-400 block mb-1">Customer Notes:</span> <span class="text-luxury-rose italic">${escapeHTML(order.customer_reqs || 'None')}</span></p>
    `;
    
    document.getElementById('th-modal-items').innerHTML = visualItems || '<span class="text-gray-400 text-[10px]">No visual data</span>';
    
    document.getElementById('th-modal-financials').innerHTML = `
        <div class="bg-white p-4 rounded-lg border border-luxury-blush shadow-sm mb-2">
            <div class="flex justify-between border-b border-luxury-blush pb-2 mb-3">
                <p class="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Order ID</p>
                <p class="text-[10px] font-bold text-luxury-dark tracking-wider">${escapeHTML(order.id)}</p>
            </div>
            ${finTrack}
        </div>
    `;
    
    const s = String(order.status).toLowerCase();
    let s1=false, s2=false, s3=false, s4=false, s5=false, s6=false;
    
    if (s === 'new' || s === 'pending') { s1=true; }
    else if (s === 'curating') { s1=true; s2=true; s3=true; }
    else if (s === 'ready') { s1=true; s2=true; s3=true; s4=true; }
    else if (s === 'shipped') { s1=true; s2=true; s3=true; s4=true; s5=true; }
    else if (s === 'out_for_delivery') { s1=true; s2=true; s3=true; s4=true; s5=true; }
    else if (s === 'completed') { s1=true; s2=true; s3=true; s4=true; s5=true; s6=true; }

    const dateStr = order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown Date';
    const getDot = (active) => active ? `<div class="absolute -left-[21px] w-3 h-3 bg-luxury-rose rounded-full border-2 border-white shadow-sm z-10"></div>` : `<div class="absolute -left-[21px] w-3 h-3 bg-gray-200 rounded-full border-2 border-white z-10"></div>`;
    
    let timelineHtml = `<div class="relative border-l-2 border-luxury-blush space-y-5 ml-2 font-sans">`;
    timelineHtml += `<div class="relative">${getDot(true)}<p class="text-[10px] font-bold uppercase tracking-widest ${s1 ? 'text-luxury-dark' : 'text-gray-400'}">Order Placed</p><p class="text-[9px] text-gray-400">${escapeHTML(dateStr)}</p></div>`;
    timelineHtml += `<div class="relative">${getDot(s2)}<p class="text-[10px] font-bold uppercase tracking-widest ${s2 ? 'text-luxury-dark' : 'text-gray-400'}">Payment Verified</p></div>`;
    timelineHtml += `<div class="relative">${getDot(s3)}<p class="text-[10px] font-bold uppercase tracking-widest ${s3 ? 'text-luxury-dark' : 'text-gray-400'}">Artisan Crafting</p></div>`;
    timelineHtml += `<div class="relative">${getDot(s4)}<p class="text-[10px] font-bold uppercase tracking-widest ${s4 ? 'text-luxury-dark' : 'text-gray-400'}">Ready & Packaged</p></div>`;
    timelineHtml += `<div class="relative">${getDot(s5)}<p class="text-[10px] font-bold uppercase tracking-widest ${s5 ? 'text-luxury-dark' : 'text-gray-400'}">In Transit</p></div>`;
    timelineHtml += `<div class="relative">${getDot(s === 'completed')}<p class="text-[10px] font-bold uppercase tracking-widest ${s === 'completed' ? 'text-green-600' : 'text-gray-400'}">Delivered</p></div>`;
    timelineHtml += `</div>`;
    
    document.getElementById('th-modal-timeline').innerHTML = timelineHtml;
    document.getElementById('th-order-modal').classList.remove('hidden');
};

window.th_closeOrderDetail = function() {
    th_adminState.openModalId = null;
    document.getElementById('th-order-modal').classList.add('hidden');
};
// --- END OF FILE ---