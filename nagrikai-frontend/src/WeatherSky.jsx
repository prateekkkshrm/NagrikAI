import React, { useMemo } from "react";
import "./weatherSky.css";

/**
 * WeatherSky — translucent animated sky behind the Home screen, driven by the
 * weather data NagrikAI already loads (Open-Meteo) — no extra network calls.
 *
 * Props
 *  - weather      { code, isDay, time, sunrise, sunset } | null
 *  - reduceMotion boolean
 *  - override     { condition, phase }  (testing)
 *
 * Testing: add ?sky=rain-night to the URL.
 *   conditions: clear partly cloudy fog drizzle rain storm snow
 *   phases:     day night dawn dusk
 */

function toCondition(code) {
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

// Open-Meteo returns local-time strings ("2026-11-25T06:52") for the requested
// location, so comparing them as plain values is safe.
const minutes = (iso) => {
  if (!iso || typeof iso !== "string" || !iso.includes("T")) return 0;
  const [d, t] = iso.split("T");
  if (!d || !t) return 0;
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  return Date.UTC(y, mo - 1, da, h, mi) / 60000;
};

function clockPhaseGuess() {
  const h = new Date().getHours();
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 19) return "dusk";
  return "night";
}

function toPhase(w) {
  if (!w?.time || !w.sunrise || !w.sunset) return clockPhaseGuess();
  try {
    const now = minutes(w.time);
    const sr = minutes(w.sunrise);
    const ss = minutes(w.sunset);
    if (sr && Math.abs(now - sr) <= 40) return "dawn";
    if (ss && Math.abs(now - ss) <= 40) return "dusk";
    return w.isDay ? "day" : "night";
  } catch {
    return clockPhaseGuess();
  }
}

/* ---------- scene recipe ---------- */

const CLOUD_COUNT = {
  clear: 0, partly: 3, cloudy: 6, fog: 3, drizzle: 5, rain: 6, storm: 7, snow: 5,
};
const rand = (a, b) => a + Math.random() * (b - a);

function buildScene(condition, phase, still) {
  const isNight = phase === "night";
  const hasSun = !isNight && (condition === "clear" || condition === "partly");
  const hasMoon = isNight && ["clear", "partly", "cloudy"].includes(condition);
  const starCount = isNight
    ? condition === "clear" ? 44 : ["partly", "cloudy"].includes(condition) ? 18 : 0
    : 0;

  const clouds = Array.from({ length: CLOUD_COUNT[condition] }, (_, i) => ({
    key: i,
    top: rand(2, 34),
    width: rand(120, 250),
    dur: rand(55, 110),
    delay: -rand(0, 110), // negative = already mid-flight on first paint
    o: rand(0.7, 1),
  }));

  const dropCount = { drizzle: 34, rain: 70, storm: 110 }[condition] || 0;
  const drops = Array.from({ length: dropCount }, (_, i) => ({
    key: i,
    left: rand(-5, 105),
    h: condition === "drizzle" ? rand(10, 18) : rand(18, 34),
    dur: condition === "storm" ? rand(0.45, 0.8) : condition === "drizzle" ? rand(1.2, 1.8) : rand(0.7, 1.1),
    delay: -rand(0, 2),
  }));

  const flakes = condition === "snow"
    ? Array.from({ length: 46 }, (_, i) => ({
        key: i,
        left: rand(0, 100),
        size: rand(3, 7),
        dur: rand(7, 14),
        delay: -rand(0, 14),
        sway: rand(-40, 40),
      }))
    : [];

  const stars = Array.from({ length: starCount }, (_, i) => ({
    key: i,
    left: rand(2, 98),
    top: rand(2, 48),
    size: rand(1.5, 3),
    dur: rand(2.5, 5),
    delay: -rand(0, 5),
  }));

  return { hasSun, hasMoon, clouds, drops, flakes, stars, showBolt: condition === "storm", still };
}

/* ---------- component ---------- */

export default function WeatherSky({ weather = null, reduceMotion = false, override, className = "" }) {
  // ?sky=rain-night  (testing aid)
  const fromUrl = useMemo(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("sky");
      if (!q) return null;
      const [condition, phase = "day"] = q.split("-");
      return condition in CLOUD_COUNT ? { condition, phase } : null;
    } catch {
      return null;
    }
  }, []);

  const fromWeather = weather
    ? { condition: toCondition(weather.code), phase: toPhase(weather) }
    : { condition: "clear", phase: clockPhaseGuess() };
  const picked = override || fromUrl || fromWeather;
  const condition = (picked?.condition && picked.condition in CLOUD_COUNT) ? picked.condition : "cloudy";
  const phase = ["day", "night", "dawn", "dusk"].includes(picked?.phase) ? picked.phase : "day";

  const scene = useMemo(
    () => buildScene(condition, phase, reduceMotion),
    [condition, phase, reduceMotion]
  );

  const cls = [
    "wsky",
    `wsky--${phase}`,
    `wsky--${condition}`,
    scene.still ? "wsky--still" : "",
    className,
  ].join(" ");

  return (
    <div className={cls} aria-hidden="true" data-condition={condition} data-phase={phase}>
      <div className="wsky__sky" />

      {scene.stars.map((s) => (
        <i
          key={s.key}
          className="wsky__star"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, "--dur": `${s.dur}s`, "--delay": `${s.delay}s` }}
        />
      ))}

      {scene.hasSun && <div className="wsky__sun" />}
      {scene.hasMoon && <div className="wsky__moon" />}

      {condition === "fog" &&
        [18, 38, 58].map((t, i) => (
          <div key={t} className="wsky__fog" style={{ top: `${t}%`, "--delay": `${-i * 7}s` }} />
        ))}

      {scene.clouds.map((c) => (
        <div
          key={c.key}
          className="wsky__cloud"
          style={{ top: `${c.top}%`, "--w": `${c.width}px`, "--dur": `${c.dur}s`, "--delay": `${c.delay}s`, "--o": c.o }}
        />
      ))}

      {scene.drops.map((d) => (
        <i
          key={d.key}
          className="wsky__drop"
          style={{ left: `${d.left}%`, "--h": `${d.h}px`, "--dur": `${d.dur}s`, "--delay": `${d.delay}s` }}
        />
      ))}

      {scene.flakes.map((f) => (
        <i
          key={f.key}
          className="wsky__flake"
          style={{ left: `${f.left}%`, width: f.size, height: f.size, "--dur": `${f.dur}s`, "--delay": `${f.delay}s`, "--sway": `${f.sway}px` }}
        />
      ))}

      {scene.showBolt && (
        <>
          <div className="wsky__flash" />
          <svg className="wsky__bolt" viewBox="0 0 60 120" style={{ left: "62%" }}>
            <polygon points="34,0 8,64 28,64 18,120 52,48 32,48" />
          </svg>
          <svg className="wsky__bolt wsky__bolt--b" viewBox="0 0 60 120" style={{ left: "22%" }}>
            <polygon points="34,0 8,64 28,64 18,120 52,48 32,48" />
          </svg>
        </>
      )}
    </div>
  );
}
