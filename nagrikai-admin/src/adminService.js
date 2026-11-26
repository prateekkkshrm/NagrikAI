const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

const SESSION_KEY = "nagrikai_admin_session_v2";

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_KEY &&
    !SUPABASE_URL.includes("your-project-ref") &&
    !SUPABASE_KEY.includes("your-supabase-anon-key")
);

function getEndpoint() {
  return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-portal`;
}

export function getSavedSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function callAdminFunction(payload, token = null) {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase credentials are missing in nagrikai-admin/.env.local (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY)."
    );
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
  if (token) {
    headers["x-admin-token"] = token;
  }

  let res;
  try {
    res = await fetch(getEndpoint(), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Unable to reach Supabase Edge Function 'admin-portal'. Check your internet connection and verify 'admin-portal' is deployed."
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      data?.error ||
        (res.status === 404
          ? "Edge Function 'admin-portal' is not deployed yet on your Supabase project."
          : `Supabase returned HTTP ${res.status}`)
    );
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function loginAdmin(username, password) {
  const cleanUser = String(username || "").trim();
  const cleanPass = String(password || "");

  const data = await callAdminFunction({
    action: "login",
    username: cleanUser,
    password: cleanPass,
  });

  const session = {
    token: data.token,
    admin: data.admin,
  };
  saveSession(session);
  return session;
}

export async function fetchDashboardData(session) {
  if (!session?.token) {
    throw new Error("Admin session missing.");
  }

  const data = await callAdminFunction({ action: "dashboard_data" }, session.token);
  return {
    reports: Array.isArray(data.reports) ? data.reports : [],
    authoMeter: data.authoMeter || null,
    history: Array.isArray(data.history) ? data.history : [],
  };
}

export async function resolveReportIssue(
  session,
  { reportId, resolutionNote, photoBase64, photoMimeType }
) {
  return await callAdminFunction(
    {
      action: "resolve_report",
      reportId,
      resolutionNote,
      photoBase64,
      photoMimeType,
    },
    session.token
  );
}

export async function updateReportStatus(session, { reportId, status, note }) {
  return await callAdminFunction(
    {
      action: "update_status",
      reportId,
      status,
      note,
    },
    session.token
  );
}

export async function verifyReportAuthenticity(session, { reportId, verdict, note }) {
  return await callAdminFunction(
    {
      action: "verify_authenticity",
      reportId,
      verdict,
      note,
    },
    session.token
  );
}

export async function askAiAssistant(session, { reportId, prompt }) {
  return await callAdminFunction(
    { action: "ai_assist", reportId, prompt },
    session.token
  );
}

export function filterReportsByPeriod(reports, period) {
  if (!Array.isArray(reports)) return [];
  if (period === "total") return reports;

  const nowDate = new Date();
  const startOfToday = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime();
  const msDay = 24 * 3600 * 1000;

  let cutoff = 0;
  if (period === "today") cutoff = startOfToday;
  else if (period === "week") cutoff = Date.now() - 7 * msDay;
  else if (period === "month") cutoff = Date.now() - 30 * msDay;
  else if (period === "year") cutoff = Date.now() - 365 * msDay;

  return reports.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
}

export function getSlaState(report) {
  if (!report) return { label: "No SLA", overdue: false, tone: "muted", hoursLeft: 999 };
  if (report.status === "Resolved") {
    return {
      label: report.resolved_on_time ? "Resolved On Time" : "Resolved Late",
      overdue: !report.resolved_on_time,
      tone: report.resolved_on_time ? "green" : "amber",
      hoursLeft: 999,
    };
  }
  const deadline = report.sla_deadline_at
    ? new Date(report.sla_deadline_at).getTime()
    : new Date(report.created_at).getTime() + 72 * 3600 * 1000;
  const diffHours = Math.round((deadline - Date.now()) / (1000 * 3600));
  if (diffHours < 0) {
    return {
      label: `Overdue ${Math.abs(diffHours)}h`,
      overdue: true,
      tone: "danger",
      hoursLeft: diffHours,
    };
  }
  if (diffHours <= 6) {
    return {
      label: `${diffHours}h left`,
      overdue: false,
      tone: "amber",
      hoursLeft: diffHours,
    };
  }
  return {
    label: `${diffHours}h SLA left`,
    overdue: false,
    tone: "teal",
    hoursLeft: diffHours,
  };
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}
