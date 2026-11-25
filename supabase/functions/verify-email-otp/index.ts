
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashOtp(
  secret: string,
  userId: string,
  email: string,
  otp: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${userId}|${email}|${otp}`)
  );

  return toHex(signature);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return respond({ error: "Authentication required." }, 401);
    }

    const token = authorization.slice(7);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");

    let secretKeys: Record<string, string> = {};

    if (secretKeysRaw) {
      secretKeys = JSON.parse(secretKeysRaw);
    }

    const serviceKey =
      secretKeys.default ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const otpSecret = Deno.env.get("OTP_HMAC_SECRET");

    if (!supabaseUrl || !serviceKey || !otpSecret) {
      console.error("Required server configuration is missing.");
      return respond({ error: "Server configuration error." }, 500);
    }

    if (otpSecret.length < 32) {
      return respond({ error: "Server configuration error." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Identify the citizen from their verified Supabase session.
    const { data: authData, error: authError } =
      await admin.auth.getUser(token);

    const user = authData?.user;

    if (authError || !user) {
      return respond({ error: "Invalid or expired session." }, 401);
    }

    const phoneDigits = String(user.phone || "").replace(/\D/g, "");

const normalizedPhone =
  phoneDigits.length === 12 &&
  phoneDigits.startsWith("91") &&
  /^[6-9]\d{9}$/.test(phoneDigits.slice(2))
    ? "+" + phoneDigits
    : "";

if (!user.phone_confirmed_at || !normalizedPhone) {
  return respond({
    error: "Verify your Indian mobile number first.",
  }, 403);
}
    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const otp = String(body.otp || "").trim();
    const fullName = String(body.fullName || "").trim();

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return respond({ error: "Invalid email address." }, 400);
    }

    if (!/^\d{6}$/.test(otp)) {
      return respond({ error: "Enter the six-digit email code." }, 400);
    }

    if (fullName.length < 2 || fullName.length > 100) {
      return respond({ error: "Enter a valid full name." }, 400);
    }

    // Prevent an email from being claimed by another citizen.
    const { data: existingProfile, error: lookupError } =
      await admin
        .from("citizen_profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

    if (lookupError) {
      console.error("Profile ownership lookup failed.");
      return respond({ error: "Unable to check email ownership." }, 500);
    }

    if (existingProfile && existingProfile.user_id !== user.id) {
      return respond({
        error: "This email is already linked to another citizen.",
      }, 409);
    }

    // Calculate the same server-keyed hash used when sending the OTP.
    const otpHash = await hashOtp(
      otpSecret,
      user.id,
      email,
      otp
    );

    // Atomically check expiry, attempts and one-time use.
    const { data: verificationData, error: verificationError } =
      await admin.rpc("verify_email_otp_challenge", {
        p_user_id: user.id,
        p_email: email,
        p_otp_hash: otpHash,
      });

    if (verificationError) {
      console.error("OTP verification database operation failed.");
      return respond({ error: "Verification could not be completed." }, 500);
    }

    const result = Array.isArray(verificationData)
      ? verificationData[0]
      : verificationData;

    if (!result?.verified) {
      return respond({
        error: "Incorrect, expired, or already-used email code.",
      }, 400);
    }

    // Create or update this citizen's own profile.
    const { error: saveError } = await admin
      .from("citizen_profiles")
      .upsert(
        {
          user_id: user.id,
          full_name: fullName,
          phone: normalizedPhone,
          email,
          email_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (saveError) {
      if (saveError.code === "23505") {
        return respond({
          error: "This email or phone is already linked to another citizen.",
        }, 409);
      }

      console.error("Citizen profile creation failed.");
      return respond({ error: "Could not save your citizen profile." }, 500);
    }

    // Keep existing frontend name restoration compatible.
    const { error: metadataError } =
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          full_name: fullName,
        },
      });

    if (metadataError) {
      console.error("Profile metadata synchronization failed.");
    }

    return respond({
      success: true,
      message: "Phone and email verified successfully.",
      profile: {
        fullName,
        phone: normalizedPhone,
        email,
      },
    });

  } catch (error) {
    console.error("Email verification function failed:", error);
    return respond({ error: "Unable to verify email code." }, 500);
  }
});
