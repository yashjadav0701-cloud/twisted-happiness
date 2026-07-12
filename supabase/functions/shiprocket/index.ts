import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { order_id } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: orderData } = await supabaseClient.from('orders').select('*').eq('id', order_id).single()

    // 1. Authenticate with Shiprocket
    const authRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'api.twistedhappiness@gmail.com',
        password: '*gZYSvk5QBC^1Vh6$m0NJPrfj^Zzkrd7'
      })
    });
    
    const authData = await authRes.json();
    if (!authRes.ok || !authData.token) {
        throw new Error("Login Failed: " + JSON.stringify(authData));
    }
    const token = authData.token;

    // ✨ 2. SMART DATA PARSING ✨
    const reqs = orderData.customer_reqs || "";
    
    // Extract Phone
    const phoneMatch = reqs.match(/Phone:\s*([^|]+)/);
    const cleanPhone = phoneMatch ? phoneMatch[1].replace(/\D/g, '').slice(-10) : "0000000000";

    // Extract First and Last Name properly
    const nameMatch = reqs.match(/Patron:\s*([^|]+)/);
    const fullName = nameMatch ? nameMatch[1].trim() : "Customer";
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : "."; // Uses a dot if they only provided a first name

    // Extract Real Email
    const emailMatch = reqs.match(/Email:\s*([^|]+)/);
    const billingEmail = emailMatch ? emailMatch[1].trim() : "orders@twistedhappiness.com";

    // Extract Address
    const addressMatch = reqs.match(/Address:\s*([^|]+)/);
    const fullAddress = addressMatch ? addressMatch[1].trim().substring(0, 80) : "No Address provided";
    const city = fullAddress.split(',')[1]?.trim() || "Nadiad";
    const pinMatch = fullAddress.match(/-\s*(\d{6})/);
    const pincode = pinMatch ? pinMatch[1] : "387002";

    const uniqueOrderId = orderData.id.toString() + "-" + Math.floor(Math.random() * 10000);

    // 3. Format payload
    const shiprocketPayload = {
      order_id: uniqueOrderId, 
      order_date: new Date().toISOString().split('T')[0],
      pickup_location: "Home", 
      billing_customer_name: firstName,
      billing_last_name: lastName, 
      billing_address: fullAddress,
      billing_city: city,
      billing_pincode: pincode,
      billing_state: "Gujarat",
      billing_country: "India",
      billing_email: billingEmail,
      billing_phone: cleanPhone,
      shipping_is_billing: true,
      order_items: JSON.parse(orderData.order_details).map((item: any) => ({
        name: item.name.substring(0, 50),
        sku: item.id.toString(),
        units: parseInt(item.qty),
        selling_price: parseInt(item.price),
        discount: 0,
        tax: 0,
        hsn: ""
      })),
      payment_method: "Prepaid",
      sub_total: parseInt(orderData.subtotal),
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5
    };

    // 4. Push the order
    const orderRes = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(shiprocketPayload)
    });

    const shiprocketResponse = await orderRes.json();
    
    if (!orderRes.ok || (shiprocketResponse.status_code && shiprocketResponse.status_code > 201)) {
         throw new Error(JSON.stringify(shiprocketResponse));
    }
    
    return new Response(JSON.stringify({ success: true, shiprocketResponse }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})