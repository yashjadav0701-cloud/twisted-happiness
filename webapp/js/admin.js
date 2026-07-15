/**
 * Twisted Happiness - Studio Admin Engine
 * Version: 15.5.0 - Fully Stable, Uncompressed & Globally Bound
 */

const SUPABASE_URL = "https://gvrfucjtnyqfkdynrmqs.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_8jru2BqvTdE9bcwNOLIHAA_dx6aUCM0";
let _supabase;

const countryCodeMapping = { "+91": "🇮🇳 IN (+91)", "+1": "🇺🇸 US (+1)", "+44": "🇬🇧 UK (+44)" };

// 🛡️ DEFENSIVE CACHE PARSER
function safeJSONParse(key, fallback) { 
    try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : fallback; } 
    catch (e) { localStorage.removeItem(key); return fallback; } 
}

// 📦 GLOBAL STATE
let settings = safeJSONParse('th_settings', { storeName: "Twisted Happiness", instagram: "https://www.instagram.com/khushiified_art?igsh=aW1vZ2N4cTl2OWo=", whatsapp: "9909310501", upiId: "khushisj315@oksbi", countryCode: "+91" });

let products = []; 
let allOrders = []; 
let selectedFilesData = []; 
let editModeId = null; 
let mainImageIndex = 0;

// 🚀 INITIALIZATION
function initApp() {
    try { 
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 
        populateCountryCodes();
        bindAdminEvents();
        checkSession();
    } catch (e) { console.error("Supabase Init Error:", e); }
}
document.addEventListener('DOMContentLoaded', initApp);

function populateCountryCodes() {
    const select = document.getElementById('admin-country-code'); if (!select) return;
    for (const [code, label] of Object.entries(countryCodeMapping)) {
        const option = document.createElement('option'); option.value = code; option.textContent = label; select.appendChild(option);
    }
}

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) unlockDashboard(); else document.getElementById('login-view').classList.remove('hidden');
}

async function attemptLogin(e) { 
    e.preventDefault(); 
    const email = document.getElementById('admin-user').value.trim();
    const pass = document.getElementById('admin-pass').value.trim();
    const btn = document.getElementById('login-btn'); 
    
    if(!email || !pass) return; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...'; btn.disabled = true; 
    
    try { 
        const { data, error } = await _supabase.auth.signInWithPassword({ email: email, password: pass }); 
        if (error) throw error; if (data.session) unlockDashboard(); 
    } catch (err) { alert("Access Denied: Check your credentials."); btn.innerHTML = 'Enter Studio'; btn.disabled = false; }
}

async function logoutAdmin() { await _supabase.auth.signOut(); window.location.href = '/'; }

function unlockDashboard() {
    document.getElementById('login-view').classList.add('hidden'); 
    document.getElementById('admin-dashboard').classList.remove('hidden');
    requestAnimationFrame(() => {
        document.getElementById('admin-dashboard').classList.remove('opacity-0');
        fetchRuntimeSettings(); // Fetch live config from cloud
        fetchDatabase(); 
        fetchOrders(); 
        showToast('Studio Unlocked', 'fa-unlock'); 
    });
}

async function fetchRuntimeSettings() {
    try {
        const { data } = await _supabase.from('store_config').select('*').limit(1);
        if(data && data.length > 0) {
            const cloud = data[0];
            settings = { promoText: cloud.promo_text, instagram: cloud.instagram_url, whatsapp: cloud.whatsapp_num, upiId: cloud.upi_id, countryCode: cloud.country_code || "+91" };
            localStorage.setItem('th_settings', JSON.stringify(settings));
        }
    } catch(e) {}
    
    // Setup Promo Lines
    const container = document.getElementById('promo-lines-container');
    if(container) {
        container.innerHTML = '';
        let lines = [];
        try { lines = JSON.parse(settings.promoText || '[]'); } catch(e) { lines = [settings.promoText]; }
        if (!Array.isArray(lines) || lines.length === 0) lines = [""];
        lines.forEach(l => window.th_addPromoLine(l));
    }

    document.getElementById('admin-wa').value = settings.whatsapp || ''; 
    document.getElementById('admin-country-code').value = settings.countryCode || '+91'; 
    if(document.getElementById('admin-upi-id')) document.getElementById('admin-upi-id').value = settings.upiId || 'khushisj315@oksbi';
    if(document.getElementById('admin-ig')) document.getElementById('admin-ig').value = settings.instagram || 'https://www.instagram.com/khushiified_art?igsh=aW1vZ2N4cTl2OWo=';
}

async function saveSettings(e) { 
    e.preventDefault(); 
    
    // Gather Promo Lines
    const inputs = document.querySelectorAll('.promo-line-input');
    const pArray = Array.from(inputs).map(inp => inp.value.trim()).filter(val => val !== "");
    const pStr = JSON.stringify(pArray);

    const i = document.getElementById('admin-ig').value.trim();
    const w = document.getElementById('admin-wa').value.trim();
    const c = document.getElementById('admin-country-code').value;
    const u = document.getElementById('admin-upi-id').value.trim();
    
    const payload = { id: 1, promo_text: pStr, instagram_url: i, whatsapp_num: w, country_code: c, upi_id: u };
    
    try {
        const { error } = await _supabase.from('store_config').upsert([payload]);
        if (error) throw error;
        settings = { promoText: pStr, instagram: i, whatsapp: w, countryCode: c, upiId: u };
        localStorage.setItem('th_settings', JSON.stringify(settings)); 
        showToast('Settings Saved & Synced to Cloud', 'fa-check'); 
    } catch(err) {
        showToast('Failed to sync settings', 'fa-times', 'text-red-500');
    }
}

function bindAdminEvents() {
    document.getElementById('admin-login-form')?.addEventListener('submit', attemptLogin);
    document.getElementById('btn-logout')?.addEventListener('click', logoutAdmin);
    document.getElementById('tab-inventory')?.addEventListener('click', () => switchAdminTab('inventory'));
    document.getElementById('tab-orders')?.addEventListener('click', () => switchAdminTab('orders'));
    document.getElementById('subtab-active')?.addEventListener('click', () => switchOrderTab('active'));
    document.getElementById('subtab-completed')?.addEventListener('click', () => switchOrderTab('completed'));
    document.getElementById('settings-form')?.addEventListener('submit', saveSettings);
    document.getElementById('inventory-form')?.addEventListener('submit', saveProduct);
    document.getElementById('p-image-file')?.addEventListener('change', handleFileSelection);
    document.getElementById('p-main-category')?.addEventListener('change', togglePaintingFields);
    document.getElementById('cancel-edit-btn')?.addEventListener('click', cancelEdit);
}

// 🚨 INVENTORY ENGINE
// Dynamic Promo Functions
window.th_addPromoLine = function(val = "") {
    const container = document.getElementById('promo-lines-container'); if(!container) return;
    const div = document.createElement('div'); div.className = "flex items-center gap-2";
    div.innerHTML = `<input type="text" value="${val}" placeholder="e.g. Free Shipping..." class="promo-line-input w-full bg-luxury-bg border border-luxury-blush rounded-lg px-3 py-2 text-[11px] font-medium outline-none focus:ring-2 focus:ring-luxury-rose/30"><button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 w-8 h-8 flex items-center justify-center shrink-0 border border-luxury-blush rounded-lg bg-white shadow-sm"><i class="fas fa-times"></i></button>`;
    container.appendChild(div);
};

async function fetchDatabase() { 
    const list = document.getElementById('admin-product-list');
    if(list) list.innerHTML = '<div class="text-center text-gray-400 py-10 text-[10px] uppercase tracking-[0.2em] font-medium"><i class="fas fa-spinner fa-spin text-2xl block mb-2 opacity-30"></i> Loading Inventory...</div>';
    try { 
        const { data, error } = await _supabase.from('creations').select('*').order('created_at', { ascending: false }); 
        if (error) throw error;
        
        products = (data || []).map(row => {
            let parsedImages = []; try { parsedImages = typeof row.image_url === 'string' ? JSON.parse(row.image_url) : (row.image_url || []); } catch(e) {}
            return {
                id: row.id, name: row.name || 'Untitled Art', category: row.category || '', mainCategory: row.main_category || 'Pipe Cleaner Crafts', price: row.price || 0, prepTime: row.prep_time || '3-5', specs: row.specs || '', dimensions: row.dimensions || '', isCustomizable: row.is_customizable || false,
                image1: parsedImages.length > 0 ? parsedImages[0].data : '', image2: parsedImages.length > 1 ? parsedImages[1].data : '', image3: parsedImages.length > 2 ? parsedImages[2].data : '', image4: parsedImages.length > 3 ? parsedImages[3].data : '', image5: parsedImages.length > 4 ? parsedImages[4].data : ''
            };
        });
        
        renderAdminProducts(); renderAdminCategories();
    } catch (error) { 
        console.error("Admin DB Fetch Error:", error); 
        if(list) list.innerHTML = `<div class="p-5 text-red-500 text-xs font-bold text-center">Database Connection Error: ${error.message}</div>`;
    } 
}

function renderAdminProducts() { 
    const list = document.getElementById('admin-product-list'); list.innerHTML = ''; 
    if(products.length === 0) { list.innerHTML = '<div class="text-center text-gray-400 py-10 text-[10px] uppercase tracking-[0.2em] font-medium"><i class="fas fa-box-open text-2xl block mb-2 opacity-30"></i> No creations in gallery.</div>'; return; } 
    
    const fragment = document.createDocumentFragment();
    [...products].forEach(p => { 
        const cleanPrice = Number(String(p.price || 0).replace(/[^0-9.,]/g, '')); const adminImg = (typeof p.image1 === 'string' && p.image1.trim() !== '') ? p.image1 : 'https://placehold.co/100/F8E9EA/423133';
        const item = document.createElement('div'); item.className = "flex justify-between bg-white p-4 hover:bg-luxury-bg transition-colors duration-400";
        item.innerHTML = `
            <div class="flex gap-3 items-center">
                <img loading="lazy" decoding="async" src="${adminImg}" alt="${p.name}" class="w-12 h-12 object-cover bg-luxury-bg border border-luxury-blush rounded-lg">
                <div class="flex flex-col justify-center">
                    <h4 class="font-bitter text-[12px] font-semibold text-luxury-dark leading-tight w-36 sm:w-48 truncate mb-0.5">${p.name}</h4>
                    <p class="font-poppins text-[10px] text-luxury-rose font-bold">₹${cleanPrice}</p>
                </div>
            </div>
            <div class="flex gap-4 items-center pr-2">
                <button type="button" onclick="window.th_triggerEdit('${p.id}')" class="text-gray-400 hover:text-luxury-rose text-sm cursor-pointer w-8 h-8 rounded-full bg-white border border-luxury-blush flex items-center justify-center"><i class="fas fa-pen text-[10px]"></i></button>
                <button type="button" onclick="window.th_triggerDelete('${p.id}')" class="text-gray-400 hover:text-red-500 text-sm cursor-pointer w-8 h-8 rounded-full bg-white border border-luxury-blush flex items-center justify-center"><i class="fas fa-trash text-[10px]"></i></button>
            </div>`;
        fragment.appendChild(item);
    }); 
    list.appendChild(fragment);
}

function togglePaintingFields() {
    const val = document.getElementById('p-main-category').value, container = document.getElementById('painting-fields-container');
    if(val === 'Canvas Paintings' || val === 'Clay Art Paintings') { container.classList.remove('hidden'); } else { container.classList.add('hidden'); document.getElementById('p-dimensions').value = ''; document.getElementById('p-customizable').checked = false; }
    document.getElementById('p-category').value = ''; renderAdminCategories(); 
}

function renderAdminCategories() {
    const datalist = document.getElementById('category-list'), mainCat = document.getElementById('p-main-category').value;
    if(datalist) { const relevantProducts = products.filter(p => p.mainCategory === mainCat); const allSubs = [...new Set(relevantProducts.map(p => p.category).filter(c => c))]; datalist.innerHTML = ''; allSubs.forEach(cat => { const option = document.createElement('option'); option.value = cat; datalist.appendChild(option); }); }
}

function compressImageToBlob(file, maxSize = 1600) { 
    return new Promise((resolve) => { 
        const reader = new FileReader(); reader.readAsDataURL(file); 
        reader.onload = (e) => { 
            const img = new Image(); img.src = e.target.result; 
            img.onload = () => { 
                const canvas = document.createElement('canvas'); let w = img.width, h = img.height; 
                if (w > h && w > maxSize) { h *= maxSize / w; w = maxSize; } else if (h > maxSize) { w *= maxSize / h; h = maxSize; } 
                canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h); 
                canvas.toBlob((blob) => { resolve(blob); }, 'image/webp', 0.85); 
            }; 
        }; 
    }); 
}

async function handleFileSelection(e) { 
    const files = e.target.files; if (files.length === 0) return; 
    if (selectedFilesData.length + files.length > 5) { alert("Maximum 5 images allowed."); e.target.value = ""; return; } 
    
    const btn = document.getElementById('btn-save-product'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; btn.disabled = true; 
    
    for (let i = 0; i < files.length; i++) { 
        const file = files[i]; const blob = await compressImageToBlob(file); const tempUrl = URL.createObjectURL(blob); 
        selectedFilesData.push({ name: file.name, blob: blob, data: tempUrl, isNew: true }); 
    } 
    
    renderImagePreviews(); btn.innerHTML = editModeId ? 'Update Product' : 'Publish to Collection'; btn.disabled = false; e.target.value = ""; 
}

function renderImagePreviews() {
    const pContainer = document.getElementById('image-preview-container'), helpText = document.getElementById('image-help-text'); pContainer.innerHTML = '';
    if (selectedFilesData.length === 0) { pContainer.classList.add('hidden'); helpText.classList.add('hidden'); return; }
    pContainer.classList.remove('hidden'); helpText.classList.remove('hidden');
    if(mainImageIndex >= selectedFilesData.length) mainImageIndex = 0;
    
    selectedFilesData.forEach((fileObj, i) => { 
        pContainer.innerHTML += `
        <div onclick="window.th_setMainImage(${i})" class="relative aspect-[4/5] bg-luxury-bg rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${i === mainImageIndex ? 'border-luxury-rose shadow-md scale-105 z-10' : 'border-luxury-blush opacity-60'}">
            ${i === mainImageIndex ? '<span class="absolute top-2 left-2 bg-luxury-rose text-white text-[7px] px-1.5 py-0.5 rounded-sm z-10 shadow-sm">COVER</span>' : ''}
            <button type="button" onclick="window.th_removeSelectedImage(${i}, event)" class="absolute top-2 right-2 bg-white/90 text-luxury-dark w-6 h-6 rounded-full flex items-center justify-center z-20"><i class="fas fa-times text-[10px]"></i></button>
            <img src="${fileObj.data}" class="w-full h-full object-cover">
        </div>`; 
    });
}

window.th_setMainImage = function(index) { if (index === 0) return; const selectedImage = selectedFilesData.splice(index, 1)[0]; selectedFilesData.unshift(selectedImage); mainImageIndex = 0; renderImagePreviews(); };
window.th_removeSelectedImage = function(index, event) { event.stopPropagation(); selectedFilesData.splice(index, 1); mainImageIndex = 0; renderImagePreviews(); };

async function saveProduct(e) { 
    e.preventDefault();
    const btn = document.getElementById('btn-save-product'), name = document.getElementById('p-name').value; 
    
    if(!editModeId && selectedFilesData.length === 0) return alert("Provide at least one image."); 
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
    if (editModeId) { if (uploadedUrls.length === 0) delete payload.image_url; const { error } = await _supabase.from('creations').update(payload).eq('id', editModeId); err = error; } 
    else { const { error } = await _supabase.from('creations').insert([payload]); err = error; }

    if(!err) { showToast("Added to Collection!", "fa-check"); cancelEdit(); fetchDatabase(); } else { showToast("Error saving", "fa-times", "text-red-500"); console.error(err); }
    btn.innerHTML = editModeId ? 'Update Product' : 'Publish to Collection'; btn.disabled = false; 
}

window.th_triggerEdit = function(id) { 
    const p = products.find(x => x.id === id); if(!p) return; editModeId = p.id; 
    document.getElementById('p-main-category').value = p.mainCategory || 'Pipe Cleaner Crafts'; togglePaintingFields();
    document.getElementById('p-name').value = p.name; document.getElementById('p-category').value = p.category; document.getElementById('p-price').value = p.price; document.getElementById('p-prep').value = p.prepTime || ''; document.getElementById('p-specs').value = p.specs; document.getElementById('p-dimensions').value = p.dimensions || ''; document.getElementById('p-customizable').checked = p.isCustomizable || false; document.getElementById('p-image-file').value = ''; 
    selectedFilesData = [];
    if(p.image1) selectedFilesData.push({name: 'img1', data: p.image1, isNew: false}); if(p.image2) selectedFilesData.push({name: 'img2', data: p.image2, isNew: false}); if(p.image3) selectedFilesData.push({name: 'img3', data: p.image3, isNew: false}); if(p.image4) selectedFilesData.push({name: 'img4', data: p.image4, isNew: false}); if(p.image5) selectedFilesData.push({name: 'img5', data: p.image5, isNew: false});
    mainImageIndex = 0; renderImagePreviews();
    document.getElementById('form-title').innerHTML = `Editing: <span class="text-luxury-rose">${p.name}</span>`; document.getElementById('cancel-edit-btn').classList.remove('hidden'); document.getElementById('btn-save-product').innerHTML = 'Update Product'; window.scrollTo({top: 0, behavior: 'smooth'}); 
};

function cancelEdit() { 
    editModeId = null; mainImageIndex = 0; document.getElementById('inventory-form').reset(); document.getElementById('p-main-category').value = 'Pipe Cleaner Crafts'; togglePaintingFields();
    selectedFilesData = []; renderImagePreviews(); document.getElementById('form-title').textContent = 'Add New Art Piece'; document.getElementById('cancel-edit-btn').classList.add('hidden'); document.getElementById('btn-save-product').innerHTML = 'Publish to Collection'; 
}

window.th_triggerDelete = async function(id) { 
    const p = products.find(x => x.id === id); if(!confirm(`Remove "${p.name}"?`)) return; showToast("Removing...", "fa-spinner fa-spin"); 
    const { error } = await _supabase.from('creations').delete().eq('id', id);
    if(!error) { showToast("Piece Removed", "fa-trash"); fetchDatabase(); } else { showToast("Error removing piece", "fa-times", "text-red-500"); }
};

// 🚨 TAB MANAGEMENT
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
    const activeBtn = document.getElementById('subtab-active'), completedBtn = document.getElementById('subtab-completed'), activeSec = document.getElementById('admin-active-orders'), completedSec = document.getElementById('admin-completed-orders'), title = document.getElementById('order-section-title');
    if(tab === 'active') {
        activeBtn.className = "text-white bg-luxury-dark font-bold text-[9px] uppercase tracking-[0.1em] px-6 py-3 rounded-full shadow-sm transition-colors";
        completedBtn.className = "text-gray-500 bg-luxury-bg hover:text-luxury-dark font-bold text-[9px] uppercase tracking-[0.1em] px-6 py-3 rounded-full shadow-sm transition-colors";
        activeSec.classList.remove('hidden'); completedSec.classList.add('hidden'); title.textContent = "Concierge Desk: Active Workspace";
    } else {
        completedBtn.className = "text-white bg-luxury-rose font-bold text-[9px] uppercase tracking-[0.1em] px-6 py-3 rounded-full shadow-sm transition-colors";
        activeBtn.className = "text-gray-500 bg-luxury-bg hover:text-luxury-dark font-bold text-[9px] uppercase tracking-[0.1em] px-6 py-3 rounded-full shadow-sm transition-colors";
        completedSec.classList.remove('hidden'); activeSec.classList.add('hidden'); title.textContent = "The Archives: Elegantly Delivered";
    }
}

// 🚨 ORDER MANAGEMENT ENGINE
async function fetchOrders() {
    try {
        const { data, error } = await _supabase.from('orders').select('*').order('created_at', { ascending: false }); 
        if (error) throw error; 
        allOrders = data;
        
        const pendingCount = allOrders.filter(o => o.status === 'new' || o.status === 'pending').length; 
        const badge = document.getElementById('admin-order-badge');
        
        if (pendingCount > 0) { 
            badge.textContent = pendingCount; 
            badge.classList.remove('hidden'); 
        } else { 
            badge.classList.add('hidden'); 
        }
        
        // Trigger Analytics Calculation
        updateAnalyticsDashboard();

        requestAnimationFrame(() => { 
            renderActiveOrders(); 
            renderCompletedOrders(); 
        });
    } catch (err) { 
        console.error("Error fetching orders", err); 
    }
}

function updateAnalyticsDashboard() {
    let totalRevenue = 0;
    let currentMonthRevenue = 0;
    let activeCount = 0;
    let completedCount = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    allOrders.forEach(o => {
        if (o.status === 'completed') {
            completedCount++;
            const orderTotal = parseFloat(o.total) || 0;
            totalRevenue += orderTotal;

            const orderDate = new Date(o.created_at);
            if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
                currentMonthRevenue += orderTotal;
            }
        } else if (['new', 'pending', 'curating', 'ready'].includes(o.status) || o.status === 'cancelled') {
            // Include cancelled in active array if you want to track them, otherwise exclude
            if (o.status !== 'cancelled') {
                activeCount++;
            }
        }
    });

    const formattedRevenue = totalRevenue.toLocaleString('en-IN');
    const formattedMonth = currentMonthRevenue.toLocaleString('en-IN');

    const revEl = document.getElementById('analytics-revenue');
    const monthEl = document.getElementById('analytics-month');
    const actEl = document.getElementById('analytics-active');
    const compEl = document.getElementById('analytics-completed');

    if (revEl) revEl.textContent = `₹${formattedRevenue}`;
    if (monthEl) monthEl.textContent = `₹${formattedMonth}`;
    if (actEl) actEl.textContent = activeCount;
    if (compEl) compEl.textContent = completedCount;
}

function extractCustomerData(reqsString) { 
    const safeStr = reqsString || "";
    const nameMatch = safeStr.match(/Patron:\s*([^|]+)/); const phoneMatch = safeStr.match(/Phone:\s*([^|]+)/); const prepMatch = safeStr.match(/Est.\s*Prep:\s*([^|]+)/); const idMatch = safeStr.match(/ID:\s*([^|]+)/); 
    return { name: nameMatch ? nameMatch[1].trim() : "Esteemed Patron", phone: phoneMatch ? phoneMatch[1].trim() : "", prepTime: prepMatch ? prepMatch[1].trim() : "a few days", orderId: idMatch ? idMatch[1].trim() : "TH_LEGACY" }; 
}

function buildOrderItemsVisual(orderDetailsData) {
    let items = [], html = "";
    try { 
        items = JSON.parse(orderDetailsData); html = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">`;
        items.forEach(i => { const img = i.image || 'https://placehold.co/100/F8E9EA/423133'; html += `<div class="flex items-center gap-3 bg-white p-2 rounded-lg border border-luxury-blush shadow-sm"><img src="${img}" class="w-12 h-12 object-cover rounded-md border border-luxury-blush bg-luxury-bg"><div><p class="text-[11px] font-bitter font-semibold text-luxury-dark line-clamp-1">${i.name}</p><p class="text-[9px] font-poppins font-bold text-luxury-rose">${i.qty}x <span class="text-gray-400 font-medium">₹${i.price}</span></p></div></div>`; }); html += `</div>`;
    } catch { html = `<p class="font-bitter text-luxury-dark text-[13px] whitespace-pre-wrap font-semibold mb-2 leading-relaxed">${(orderDetailsData || '').trim()}</p>`; }
    return html;
}

function renderActiveOrders() {
    const container = document.getElementById('admin-active-orders'); container.innerHTML = '';
    const activeOrders = allOrders.filter(o => o.status === 'new' || o.status === 'pending' || o.status === 'curating' || o.status === 'ready');
    if (activeOrders.length === 0) { container.innerHTML = '<div class="text-center text-gray-400 py-10 text-[10px] uppercase tracking-[0.2em] font-medium"><i class="fas fa-inbox text-2xl mb-3 opacity-50 block"></i> Your workspace is clear.</div>'; return; }

    activeOrders.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const customerData = extractCustomerData(order.customer_reqs); const visualItems = buildOrderItemsVisual(order.order_details);
        let statusBadge = "", actionButton = "";

        if (order.status === 'new' || order.status === 'pending') {
            statusBadge = `<span class="bg-yellow-100 text-yellow-700 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md">Awaiting Verification</span>`;
            actionButton = `<button type="button" onclick="window.th_rejectOrder('${order.id}')" class="px-4 py-2.5 rounded-full text-gray-400 border hover:text-red-500 font-bold text-[9px] uppercase tracking-widest">Deny (No Payment)</button><button type="button" onclick="window.th_startCrafting('${order.id}')" class="px-5 py-2.5 rounded-full bg-green-600 text-white font-bold text-[9px] uppercase tracking-widest hover:bg-white hover:text-green-600 transition-colors shadow-sm"><i class="fas fa-magic mr-1"></i> Verify & Start Crafting</button>`;
        } else if (order.status === 'curating') {
            statusBadge = `<span class="bg-blue-100 text-blue-700 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md">Artisan At Work</span>`;
            actionButton = `<button type="button" onclick="window.th_markOrderReady('${order.id}')" class="px-5 py-2.5 rounded-full bg-luxury-gold text-white font-bold text-[9px] uppercase tracking-widest hover:bg-white hover:text-luxury-gold shadow-sm"><i class="fas fa-paint-brush mr-2"></i> ✨ Masterpiece Crafted</button>`;
        } else if (order.status === 'ready') {
            statusBadge = `<span class="bg-purple-100 text-purple-700 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md">Awaiting Dispatch</span>`;
            actionButton = `<button type="button" onclick="window.th_pushToShiprocket('${order.id}', event)" class="px-5 py-2.5 rounded-full bg-[#E0F2FE] text-[#1E3A8A] font-bold text-[9px] uppercase tracking-widest shadow-sm"><i class="fas fa-rocket mr-1.5"></i> Push to Shiprocket</button><button type="button" onclick="window.th_markOrderDelivered('${order.id}')" class="px-5 py-2.5 rounded-full bg-luxury-rose text-white font-bold text-[9px] uppercase tracking-widest shadow-sm"><i class="fas fa-dove mr-2"></i> 🕊️ Delivered</button>`;
        }

        container.innerHTML += `<div class="border border-luxury-blush rounded-xl p-5 bg-luxury-bg shadow-sm relative overflow-hidden group hover:border-luxury-rose/50 transition-colors"><div class="absolute top-0 left-0 w-1.5 h-full ${order.status === 'new' || order.status === 'pending' ? 'bg-yellow-400' : (order.status === 'curating' ? 'bg-luxury-gold' : 'bg-luxury-rose')}"></div><div class="flex justify-between items-start mb-4"><div><h4 class="font-logo font-normal text-xl text-luxury-dark mb-0.5">${customerData.name}</h4><span class="text-[8px] font-bold text-gray-400 uppercase tracking-widest"><i class="far fa-clock mr-1"></i> ${date} | ${customerData.orderId}</span></div>${statusBadge}</div><div class="mb-5">${visualItems}<div class="bg-white border border-luxury-blush p-3 rounded-lg text-gray-500 text-[10px] sm:text-[11px] leading-relaxed font-sans shadow-inner whitespace-pre-wrap">${order.customer_reqs || ''}</div></div><div class="flex flex-col xl:flex-row xl:justify-between xl:items-center border-t border-luxury-blush pt-4 mt-2 gap-4"><div><p class="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Final Invoice Total</p><p class="font-poppins font-extrabold text-luxury-dark text-xl">₹${order.total}</p></div><div class="flex gap-2 w-full xl:w-auto justify-start xl:justify-end flex-wrap">${actionButton}</div></div></div>`;
    });
}

function renderCompletedOrders() {
    const container = document.getElementById('admin-completed-orders'); container.innerHTML = ''; const completedOrders = allOrders.filter(o => o.status === 'completed');
    if (completedOrders.length === 0) { container.innerHTML = '<div class="text-center text-gray-400 py-10 text-[10px] uppercase tracking-[0.2em] font-medium"><i class="fas fa-archive text-2xl mb-3 opacity-50 block"></i> No archived deliveries yet.</div>'; return; }
    completedOrders.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); const customerData = extractCustomerData(order.customer_reqs); const visualItems = buildOrderItemsVisual(order.order_details);
        container.innerHTML += `<div class="border border-luxury-blush rounded-xl p-5 bg-white shadow-sm relative overflow-hidden opacity-80 hover:opacity-100 transition-opacity"><div class="flex justify-between items-start mb-3"><div><h4 class="font-logo font-normal text-lg text-luxury-dark mb-0.5">${customerData.name}</h4><span class="text-[8px] font-bold text-gray-400 uppercase tracking-widest"><i class="fas fa-check-double mr-1 text-luxury-rose"></i> ${date} | ${customerData.orderId}</span></div><span class="bg-gray-100 text-gray-500 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border border-gray-200">Elegantly Delivered</span></div><div class="mb-3">${visualItems}</div><div class="flex justify-between items-center border-t border-luxury-blush pt-3 mt-2"><p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Total <span class="font-poppins text-luxury-dark text-[11px] ml-1">₹${order.total}</span></p><button type="button" onclick="window.th_rejectOrder('${order.id}')" class="text-red-400 hover:text-red-600 text-[10px] uppercase font-bold tracking-widest cursor-pointer transition-colors"><i class="fas fa-trash-alt mr-1"></i> Purge</button></div></div>`;
    });
}

window.th_startCrafting = async function(id) {
    const order = allOrders.find(o => o.id === id); if(!order) return; showToast("Verifying & Starting...", "fa-spinner fa-spin");
    try {
        await _supabase.from('orders').update({ status: 'curating' }).eq('id', id); 
        showToast("Crafting Started", "fa-check"); 
        fetchOrders(); 
        const customerData = extractCustomerData(order.customer_reqs);
        if (customerData.phone) {
            let cleanPhone = customerData.phone.replace(/\D/g, ''); 
            const acceptMsg = `Dear ${customerData.name},\n\nWe have successfully received your payment for your order. Your exquisite commission from *Twisted Happiness* has been embraced, and our artisan has officially begun handcrafting your piece.\n\nIt will take approximately *${customerData.prepTime}* to prepare for dispatch.\n\nThank you for trusting us.`;
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(acceptMsg)}`, '_blank');
        }
    } catch(e) { showToast("Error processing order", "fa-times", "text-red-500"); console.error(e); }
};

window.th_markOrderReady = async function(id) { showToast("Updating status...", "fa-spinner fa-spin"); try { await _supabase.from('orders').update({ status: 'ready' }).eq('id', id); showToast("Marked as Curated", "fa-check"); fetchOrders(); } catch(e) { showToast("Error", "fa-times", "text-red-500"); } };
window.th_markOrderDelivered = async function(id) { showToast("Archiving commission...", "fa-spinner fa-spin"); try { await _supabase.from('orders').update({ status: 'completed' }).eq('id', id); showToast("Commission Archived", "fa-check"); fetchOrders(); } catch(e) { showToast("Error", "fa-times", "text-red-500"); } };

window.th_rejectOrder = async function(id) { 
    const order = allOrders.find(o => o.id === id); if(!order) return;
    if(!confirm("Deny this order? Customer will receive a WhatsApp message stating failure.")) return; 
    showToast("Declining...", "fa-spinner fa-spin"); 
    try { 
        await _supabase.from('orders').update({ status: 'cancelled' }).eq('id', id); 
        showToast("Commission Denied", "fa-trash"); 
        fetchOrders(); 
        const customerData = extractCustomerData(order.customer_reqs);
        if (customerData.phone) {
            let cleanPhone = customerData.phone.replace(/\D/g, ''); 
            const denyMsg = `Dear ${customerData.name},\n\nWe are reaching out regarding your recent order attempt at *Twisted Happiness*.\n\nUnfortunately, we were unable to verify your UPI payment. As a result, your order reservation has been canceled.\n\nIf the amount was deducted from your account, it will automatically be refunded by your bank within 2-3 business days.\n\nIf you would like to secure your handcrafted piece, please reply to this message.`;
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(denyMsg)}`, '_blank');
        }
    } catch(e) { showToast("Error", "fa-times", "text-red-500"); } 
};

window.th_pushToShiprocket = async function(orderId, event) {
    const btn = event.currentTarget; const originalHtml = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i> Syncing...'; btn.disabled = true;
    try {
        const { data, error } = await _supabase.functions.invoke('shiprocket', { body: { order_id: orderId } });
        if(error) throw error; if(data && data.success === false) { alert("Shiprocket Error:\n" + data.error); throw new Error(data.error); }
        showToast("Pushed to Shiprocket 🚀", "fa-rocket", "text-[#22c55e]");
    } catch (err) { console.error("Shiprocket API Error:", err); showToast("Failed to sync", "fa-times", "text-red-500"); }
    btn.innerHTML = originalHtml; btn.disabled = false;
};

// ==========================================
// 🚨 DATA EXPORT ENGINE
// ==========================================
window.exportOrdersCSV = function() {
    if (!allOrders || allOrders.length === 0) {
        return window.showToast("No orders available to export", "fa-times", "text-red-500");
    }
    
    // Define Headers
    const headers = ["Order ID", "Date", "Status", "Customer Name", "Phone", "Total Amount (INR)", "Order Items"];
    
    // Map data to rows
    const rows = allOrders.map(o => {
        const date = new Date(o.created_at).toLocaleDateString('en-IN');
        
        // Extract customer details safely
        const safeReqs = o.customer_reqs || "";
        const nameMatch = safeReqs.match(/Patron:\s*([^|]+)/); 
        const phoneMatch = safeReqs.match(/Ph:\s*([^|]+)/);
        const customerName = nameMatch ? nameMatch[1].trim() : "N/A";
        const customerPhone = phoneMatch ? phoneMatch[1].trim() : "N/A";

        // Parse JSON items safely
        let itemsString = "";
        try {
            const items = JSON.parse(o.order_details);
            itemsString = items.map(i => `${i.qty}x ${i.name}`).join('; ');
        } catch(e) { 
            itemsString = "Custom Request / Parsing Error"; 
        }
        
        // Escape quotes and commas for clean CSV formatting
        return `"${o.id}","${date}","${o.status.toUpperCase()}","${customerName}","${customerPhone}","${o.total}","${itemsString}"`;
    });
    
    // Construct Blob and Trigger Download
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `TH_Orders_Export_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
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
// --- END OF FILE ---