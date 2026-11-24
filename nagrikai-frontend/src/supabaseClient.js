
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

// Supabase is only needed for OTP login. The rest of the app works without it.
export const supabase = createClient(supabaseUrl, supabaseKey);
