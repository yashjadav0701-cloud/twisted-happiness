import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { category } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      throw new Error('Missing Gemini API Key in Supabase Secrets')
    }

    // Call Google Gemini API securely from the backend
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Write a comprehensive, at least 5-bullet point care guide for a handcrafted artisan product in the category: '${category}'. Return ONLY the HTML list items (<li>...</li>). Make the text sentence case. Do not include markdown formatting or wrapper tags.` }] }]
      })
    })

    const data = await response.json()
    const aiHtml = data.candidates[0].content.parts[0].text.replace(/```html|```/g, '').trim()

    // Send the generated HTML back to the frontend
    return new Response(JSON.stringify({ html: aiHtml }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})