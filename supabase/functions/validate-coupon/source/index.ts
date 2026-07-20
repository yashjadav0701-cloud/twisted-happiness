import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {

  // =========================================================
  // 1. CORS CONFIGURATION
  // =========================================================

  const reqOrigin = req.headers.get("origin") || ""

  const isAllowedOrigin =
    reqOrigin.includes("localhost") ||
    reqOrigin.includes("127.0.0.1") ||
    reqOrigin.endsWith(".netlify.app")

  const allowedOrigin = isAllowedOrigin
    ? reqOrigin
    : "https://twisted-happiness.netlify.app"

  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json"
  }


  // =========================================================
  // 2. HANDLE PREFLIGHT REQUEST
  // =========================================================

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    })
  }


  // =========================================================
  // 3. ONLY ALLOW POST REQUESTS
  // =========================================================

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        valid: false,
        message: "Method not allowed."
      }),
      {
        status: 405,
        headers: corsHeaders
      }
    )
  }


  try {

    // =========================================================
    // 4. READ REQUEST DATA
    // =========================================================

    const body = await req.json()

    const rawCouponCode = body?.couponCode

    const couponCode = String(rawCouponCode || "")
      .trim()
      .toLowerCase()

    const subtotal = Number(body?.subtotal || 0)


    // =========================================================
    // 5. BASIC VALIDATION
    // =========================================================

    if (!couponCode) {
      return new Response(
        JSON.stringify({
          valid: false,
          message: "Coupon code is required."
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      )
    }

    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return new Response(
        JSON.stringify({
          valid: false,
          message: "Invalid subtotal."
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      )
    }


    // =========================================================
    // 6. SUPABASE ENVIRONMENT VARIABLES
    // =========================================================

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") || ""

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") || ""


    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Supabase configuration is missing."
      )
    }


    // =========================================================
    // 7. ADMIN CLIENT
    // =========================================================

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    )


    // =========================================================
    // 8. IDENTIFY LOGGED-IN USER
    // =========================================================

    let user_id: string | null = null

    const authHeader =
      req.headers.get("Authorization")


    if (authHeader && anonKey) {

      const supabaseAuth = createClient(
        supabaseUrl,
        anonKey,
        {
          global: {
            headers: {
              Authorization: authHeader
            }
          }
        }
      )


      const {
        data: { user }
      } =
        await supabaseAuth.auth.getUser()


      if (user) {
        user_id = user.id
      }
    }


    // =========================================================
    // 9. FETCH PROMO CODES CREATED FROM ADMIN PANEL
    // =========================================================

    const {
      data: configData,
      error: configError
    } =
      await supabaseAdmin
        .from("store_config")
        .select("promo_codes")
        .eq("id", 1)
        .single()


    if (configError || !configData) {
      throw new Error(
        "Could not retrieve store configuration."
      )
    }


    // =========================================================
    // 10. PARSE PROMO CODE DATA
    // =========================================================

    let promoCodes: any[] = []


    if (Array.isArray(configData.promo_codes)) {

      promoCodes =
        configData.promo_codes

    } else if (
      typeof configData.promo_codes === "string"
    ) {

      try {

        const parsed =
          JSON.parse(
            configData.promo_codes
          )


        if (Array.isArray(parsed)) {
          promoCodes = parsed
        }

      } catch {

        throw new Error(
          "Invalid promo code configuration."
        )
      }
    }


    // =========================================================
    // 11. CASE-INSENSITIVE COUPON MATCHING
    // =========================================================
    //
    // These all match the same coupon:
    //
    // INSTA10
    // insta10
    // Insta10
    // iNsTa10
    //
    // Spaces are also safely removed:
    //
    // " INSTA10 "
    //
    // =========================================================

    const matched = promoCodes.find(
      (coupon: any) => {

        const storedCode =
          String(
            coupon?.code || ""
          )
            .trim()
            .toLowerCase()


        const storedType =
          String(
            coupon?.type || ""
          )
            .trim()
            .toLowerCase()


        return (
          storedCode === couponCode &&
          storedType === "coupon"
        )
      }
    )


    // =========================================================
    // 12. COUPON DOES NOT EXIST
    // =========================================================

    if (!matched) {

      return new Response(
        JSON.stringify({
          valid: false,
          message: "Invalid Coupon Code."
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      )
    }


    // =========================================================
    // 13. CHECK WHETHER COUPON IS ACTIVE
    // =========================================================

    if (matched.isActive === false) {

      return new Response(
        JSON.stringify({
          valid: false,
          message:
            "This coupon is no longer active."
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      )
    }


    // =========================================================
    // 14. CHECK EXPIRY DATE
    // =========================================================

    if (matched.expiry) {

      const expiryDate =
        new Date(
          matched.expiry
        )


      if (
        Number.isNaN(
          expiryDate.getTime()
        ) ||
        new Date() > expiryDate
      ) {

        return new Response(
          JSON.stringify({
            valid: false,
            message:
              "This coupon has expired."
          }),
          {
            status: 200,
            headers: corsHeaders
          }
        )
      }
    }


    // =========================================================
    // 15. MINIMUM SPEND CONDITION
    // =========================================================

    const conditionType =
      String(
        matched.condType || ""
      )
        .trim()
        .toLowerCase()


    if (
      conditionType === "min_spend" &&
      subtotal <
      Number(
        matched.condVal || 0
      )
    ) {

      return new Response(
        JSON.stringify({
          valid: false,
          message:
            `Minimum spend of ₹${matched.condVal} required.`
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      )
    }


    // =========================================================
    // 16. FIRST ORDER CONDITION
    // =========================================================

    if (
      conditionType === "first_order"
    ) {

      if (!user_id) {

        return new Response(
          JSON.stringify({
            valid: false,
            message:
              "Please sign in to verify your first purchase."
          }),
          {
            status: 200,
            headers: corsHeaders
          }
        )
      }


      const {
        count,
        error: orderError
      } =
        await supabaseAdmin
          .from("orders")
          .select("*", {
            count: "exact",
            head: true
          })
          .eq(
            "user_id",
            user_id
          )


      if (orderError) {
        throw new Error(
          "Could not verify first-order eligibility."
        )
      }


      if ((count || 0) > 0) {

        return new Response(
          JSON.stringify({
            valid: false,
            message:
              "Valid for first purchase only."
          }),
          {
            status: 200,
            headers: corsHeaders
          }
        )
      }
    }


    // =========================================================
    // 17. RETURN VALID COUPON DATA
    // =========================================================

    const discountType =
      String(
        matched.discountType || ""
      )
        .trim()
        .toLowerCase()


    const discountValue =
      Number(
        matched.val || 0
      )


    return new Response(
      JSON.stringify({

        valid: true,

        // Original code created in Admin panel
        code: matched.code,

        // Example:
        // percentage
        // fixed
        type: discountType,

        // Example:
        // 10 = 10%
        // 100 = ₹100
        val: discountValue,

        // Frontend can use this value
        discountValue: discountValue

      }),
      {
        status: 200,
        headers: corsHeaders
      }
    )


  } catch (error: any) {

    console.error(
      "Coupon validation error:",
      error
    )


    return new Response(
      JSON.stringify({

        valid: false,

        message:
          error?.message ||
          "Coupon validation failed."

      }),
      {
        status: 500,
        headers: corsHeaders
      }
    )
  }
})