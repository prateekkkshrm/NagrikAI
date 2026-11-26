
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

function generateOtp(): string {
  const limit = Math.floor(0x100000000 / 1000000) * 1000000;
  const values = new Uint32Array(1);

  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);

  return String(values[0] % 1000000).padStart(6, "0");
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
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

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const otpSecret = Deno.env.get("OTP_HMAC_SECRET");

    const fromEmail =
      Deno.env.get("RESEND_FROM_EMAIL") ||
      "NagrikAI <onboarding@resend.dev>";

    if (!supabaseUrl || !serviceKey || !resendKey || !otpSecret) {
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

    // Verify the actual Supabase citizen session.
    const { data: authData, error: authError } =
      await admin.auth.getUser(token);

    const user = authData?.user;

    if (authError || !user) {
      return respond({ error: "Invalid or expired session." }, 401);
    }

    // Require an already verified Indian phone number.
    const phoneDigits = String(user.phone || "").replace(/\D/g, "");

const normalizedPhone =
  phoneDigits.length === 12 &&
  phoneDigits.startsWith("91") &&
  /^[6-9]\d{9}$/.test(phoneDigits.slice(2))
    ? `+${phoneDigits}`
    : "";

if (!user.phone_confirmed_at || !normalizedPhone) {
      return respond({
        error: "Verify your Indian mobile number first.",
      }, 403);
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return respond({ error: "Enter a valid email address." }, 400);
    }

    // Do not allow an email belonging to another citizen.
    const { data: existingProfile, error: profileError } =
      await admin
        .from("citizen_profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

    if (profileError) {
      console.error("Profile ownership lookup failed.");
      return respond({ error: "Unable to verify email ownership." }, 500);
    }

    if (existingProfile && existingProfile.user_id !== user.id) {
      return respond({
        error: "This email is already linked to another citizen account.",
      }, 409);
    }

    // Generate and securely hash a fresh six-digit code.
    const otp = generateOtp();
    const otpHash = await hashOtp(
      otpSecret,
      user.id,
      email,
      otp
    );

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    ).toISOString();

    // Atomically enforce email and citizen rate limits.
    const { data: rateData, error: rateError } =
      await admin.rpc("issue_email_otp_challenge", {
        p_user_id: user.id,
        p_email: email,
        p_otp_hash: otpHash,
        p_expires_at: expiresAt,
      });

    if (rateError) {
      console.error("OTP challenge creation failed.");
      return respond({ error: "Unable to request an OTP." }, 500);
    }

    const decision = Array.isArray(rateData)
      ? rateData[0]
      : rateData;

    if (!decision?.allowed) {
      return respond({
        error: "Please wait before requesting another OTP.",
        retryAfter: decision?.retry_after_seconds || 60,
      }, 429);
    }

    // Send through Resend.
    const emailResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: "Your NagrikAI verification code",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;">
              <h2>Welcome to NagrikAI!</h2>
              <p>Your email verification code is:</p>
              <h1 style="font-size:36px;letter-spacing:9px;color:#087f8c;">
                ${otp}
              </h1>
              <p>This code expires in 5 minutes.</p>
              <p>Do not share this code with anyone.</p>
              <p style="color:#777;font-size:12px;">
                If you did not request this verification, ignore this email.
              </p>
            </div>
          `,
          text: `Your NagrikAI verification code is ${otp}. It expires in 5 minutes. Do not share it.`,
        }),
      }
    );

    if (!emailResponse.ok) {
      // Invalidate the challenge if delivery was rejected.
      await admin
        .from("email_otp_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("email", email)
        .is("consumed_at", null);

      console.error("Resend rejected the email request.");

      return respond({
        error: "Email delivery failed. Please try again later.",
      }, 502);
    }

    return respond({
      success: true,
      message: "Email verification code sent.",
      expiresIn: 300,
    });

  } catch (error) {
    console.error("Email OTP function failed:", error);
    return respond({ error: "Unable to send verification code." }, 500);
  }
});
