
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes("placeholder") &&
  !supabaseKey.includes("placeholder")
);

if (!isSupabaseConfigured) {
  console.warn(
    "⚠️ Supabase is not configured. Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY in .env file.\n" +
    "Copy .env from your other machine or see .env.example."
  );
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co",
  isSupabaseConfigured ? supabaseKey : "placeholder-key"
);

