/**
 * Twisted Happiness - Studio Admin Engine
 */

const SUPABASE_URL = "https://gvrfucjtnyqfkdynrmqs.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_8jru2BqvTdE9bcwNOLIHAA_dx6aUCM0";
let _supabase;
let allOrders = [];

document.addEventListener('DOMContentLoaded', () => {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    bindAdminEvents();
    checkSession();
});

function bindAdminEvents() {
    document.getElementById('admin-login-form')?.addEventListener('submit', attemptLogin);
    document.getElementById('btn-logout')?.addEventListener('click', logoutAdmin);
    
    document.getElementById('tab-inventory')?.addEventListener('click', () => {
        document.getElementById('admin-inventory-section').classList.remove('hidden');
        document.getElementById('admin-orders-section').classList.add('hidden');
        document.getElementById('tab-inventory').classList.add('text-luxury-rose', 'border-b-2', 'border-luxury-rose');
        document.getElementById('tab-orders').classList.remove('text-luxury-rose', 'border-b-2', 'border-luxury-rose');
    });
    
    document.getElementById('tab-orders')?.addEventListener('click', () => {
        document.getElementById('admin-orders-section').classList.remove('hidden');
        document.getElementById('admin-inventory-section').classList.add('hidden');
        document.getElementById('tab-orders').classList.add('text-luxury-rose', 'border-b-2', 'border-luxury-rose');
        document.getElementById('tab-inventory').classList.remove('text-luxury-rose', 'border-b-2', 'border-luxury-rose');
        fetchOrders();
    });

    document.getElementById('subtab-pending')?.addEventListener('click', () => switchOrderTab('pending'));
    document.getElementById('subtab-active')?.addEventListener('click', () => switchOrderTab('active'));
    document.getElementById('subtab-completed')?.addEventListener('click', () => switchOrderTab('completed'));
}

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) unlockDashboard(); 
}

async function attemptLogin(e) { 
    e.preventDefault();
    const email = document.getElementById('admin-user').value.trim(); const pass = document.getElementById('admin-pass').value.trim(); 
    const btn = document.getElementById('login-btn'); 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true; 
    try {
        const { data, error } = await _supabase.auth.signInWithPassword({ email: email, password: pass });
        if (error) throw error;
        if (data.session) unlockDashboard();
    } catch (err) { alert("Access Denied"); btn.innerHTML = 'Enter Studio'; btn.disabled = false; }
}

async function logoutAdmin() { await _supabase.auth.signOut(); window.location.reload(); }

function unlockDashboard() {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.remove('hidden');
    fetchOrders(); 
}

function switchOrderTab(tab) {
    document.querySelectorAll('[id^="subtab-"]').forEach(btn => btn.className = 'text-gray-400 font-bold text-xs uppercase tracking-widest pb-2 hover:text-luxury-dark');
    document.querySelectorAll('[id^="admin-"][id$="-orders"]').forEach(sec => sec.classList.add('hidden'));

    if(tab === 'pending') {
        document.getElementById('subtab-pending').className = 'text-luxury-dark font-bold text-xs uppercase tracking-widest pb-2 border-b-2 border-luxury-dark';
        document.getElementById('admin-pending-orders').classList.remove('hidden');
    } else if(tab === 'active') {
        document.getElementById('subtab-active').className = 'text-luxury-dark font-bold text-xs uppercase tracking-widest pb-2 border-b-2 border-luxury-dark';
        document.getElementById('admin-active-orders').classList.remove('hidden');
    } else {
        document.getElementById('subtab-completed').className = 'text-luxury-dark font-bold text-xs uppercase tracking-widest pb-2 border-b-2 border-luxury-dark';
        document.getElementById('admin-completed-orders').classList.remove('hidden');
    }
}

async function fetchOrders() {
    try {
        const { data, error } = await _supabase.from('orders').select('*').order('created_at', { ascending: false }); 
        if (error) throw error; 
        allOrders = data;
        renderOrders();
    } catch (err) { console.error(err); }
}

function renderOrders() {
    const pendingSec = document.getElementById('admin-pending-orders'); pendingSec.innerHTML = '';
    const activeSec = document.getElementById('admin-active-orders'); activeSec.innerHTML = '';
    const completedSec = document.getElementById('admin-completed-orders'); completedSec.innerHTML = '';

    allOrders.forEach(order => {
        let html = `
        <div class="bg-white p-6 rounded-2xl border border-luxury-blush shadow-sm flex flex-col md:flex-row justify-between gap-4">
            <div>
                <p class="text-xs text-gray-500 mb-2 whitespace-pre-wrap">${order.customer_reqs}</p>
                <p class="font-poppins font-bold text-lg text-luxury-dark">Total: ₹${order.total}</p>
            </div>
            <div class="flex flex-col gap-2 shrink-0">`;
        
        if(order.status === 'payment_pending') {
            html += `<button onclick="window.th_acceptOrder('${order.id}')" class="bg-green-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest">Verify Payment (Approve)</button>
                     <button onclick="window.th_rejectOrder('${order.id}')" class="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest">Reject & Delete</button>`;
            pendingSec.innerHTML += html + `</div></div>`;
        } else if (order.status === 'verified') {
            html += `<span class="text-luxury-gold font-bold text-[10px] uppercase tracking-widest">Status: Preparing</span>
                     <button onclick="window.th_markOrderShipped('${order.id}')" class="bg-luxury-dark text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest mt-2">Mark Shipped</button>`;
            activeSec.innerHTML += html + `</div></div>`;
        } else if (order.status === 'shipped') {
            html += `<span class="text-blue-500 font-bold text-[10px] uppercase tracking-widest">Status: Shipped</span>
                     <button onclick="window.th_markOrderDelivered('${order.id}')" class="bg-luxury-rose text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest mt-2">Mark Delivered</button>`;
            activeSec.innerHTML += html + `</div></div>`;
        } else if (order.status === 'completed') {
            html += `<span class="text-green-500 font-bold text-[10px] uppercase tracking-widest"><i class="fas fa-check-double"></i> Delivered</span>`;
            completedSec.innerHTML += html + `</div></div>`;
        }
    });

    if(!pendingSec.innerHTML) pendingSec.innerHTML = '<p class="text-xs text-gray-400">No pending payments.</p>';
    if(!activeSec.innerHTML) activeSec.innerHTML = '<p class="text-xs text-gray-400">No active curated orders.</p>';
    if(!completedSec.innerHTML) completedSec.innerHTML = '<p class="text-xs text-gray-400">No delivered orders yet.</p>';
}

function extractPhone(reqs) { const m = reqs.match(/Phone:\s*([^|]+)/); return m ? m[1].replace(/\D/g, '') : null; }

async function acceptOrder(id) {
    const order = allOrders.find(o => o.id === id); if(!order) return;
    await _supabase.from('orders').update({ status: 'verified' }).eq('id', id); fetchOrders(); 
    const phone = extractPhone(order.customer_reqs);
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`✨ Payment Verified! Your custom piece from Twisted Happiness is now being crafted.`)}`, '_blank');
}

async function markOrderShipped(id) {
    const order = allOrders.find(o => o.id === id); if(!order) return;
    await _supabase.from('orders').update({ status: 'shipped' }).eq('id', id); fetchOrders(); 
    const phone = extractPhone(order.customer_reqs);
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`🚀 Great news! Your order from Twisted Happiness has been shipped and is on its way to you.`)}`, '_blank');
}

async function markOrderDelivered(id) {
    const order = allOrders.find(o => o.id === id); if(!order) return;
    await _supabase.from('orders').update({ status: 'completed' }).eq('id', id); fetchOrders(); 
    const phone = extractPhone(order.customer_reqs);
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`🕊️ Delivered! We hope your masterpiece brings a little Twisted Happiness into your life.`)}`, '_blank');
}

async function rejectOrder(id) { 
    if(!confirm("Reject this order?")) return; 
    const order = allOrders.find(o => o.id === id); 
    await _supabase.from('orders').delete().eq('id', id); fetchOrders(); 
    const phone = extractPhone(order.customer_reqs);
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`✨ Dear Patron,\n\nUnfortunately, your payment verification failed. If money was deducted, it will be refunded by your bank. Please try placing your order again.`)}`, '_blank');
}

window.th_acceptOrder = acceptOrder; window.th_rejectOrder = rejectOrder;
window.th_markOrderShipped = markOrderShipped; window.th_markOrderDelivered = markOrderDelivered;