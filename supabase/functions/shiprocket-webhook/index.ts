import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const payload = await req.json()
    const orderIdStr = payload.order_id || payload.channel_order_id // Get the TH_XXX ID
    const status = payload.current_status // E.g., 'DELIVERED', 'OUT FOR DELIVERY', 'SHIPPED'
    const awb = payload.awb

    // Map Shiprocket Status to your Database Status
    let dbStatus = 'shipped'
    if (status === 'DELIVERED') dbStatus = 'completed'
    else if (status === 'OUT FOR DELIVERY') dbStatus = 'out_for_delivery'
    else if (status === 'CANCELED' || status === 'RTO INITIATED') dbStatus = 'cancelled'

    // Connect to your database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Update the order in real-time
    await supabase
      .from('orders')
      .update({ 
         status: dbStatus,
         tracking_data: JSON.stringify({ awb: awb, current_status: status })
      })
      .ilike('customer_reqs', `%${orderIdStr}%`)

    return new Response("Webhook processed successfully", { status: 200 })
  } catch (error) {
    return new Response("Error processing webhook", { status: 400 })
  }
})