// Usage (from nagrikai-frontend/):
//   node apply-weather-sky.mjs
// Adds the WeatherSky import and mounts it in HomeScreen. Nothing else in
// src/App.jsx is touched. A backup is saved as src/App.jsx.bak first.

import fs from "node:fs";

const file = "src/App.jsx";
let src = fs.readFileSync(file, "utf8");

if (src.includes("WeatherSky")) {
  console.log("App.jsx already mentions WeatherSky — nothing to do.");
  process.exit(0);
}

for (const f of ["src/WeatherSky.jsx", "src/weatherSky.css"]) {
  if (!fs.existsSync(f)) {
    console.error(`Missing ${f}. Copy WeatherSky.jsx and weatherSky.css into src/ first.`);
    process.exit(1);
  }
}

// 1. import
const importAnchor = /import \{ supabase \} from "\.\/supabaseClient";\r?\n/;
if (!importAnchor.test(src)) {
  console.error('Could not find the supabaseClient import line. Add this manually:\n  import WeatherSky from "./WeatherSky";');
  process.exit(1);
}
src = src.replace(importAnchor, (m) => m + 'import WeatherSky from "./WeatherSky";\n');

// 2. mount inside HomeScreen: first <div className="page"> after HomeScreen's weather setup
const marker = src.indexOf("const upcomingHours = hourlyWeather?.time");
if (marker === -1) {
  console.error("Could not locate HomeScreen. Mount WeatherSky manually (see the instructions).");
  process.exit(1);
}
const pageTag = '<div className="page">';
const at = src.indexOf(pageTag, marker);
if (at === -1) {
  console.error('Could not find HomeScreen\'s <div className="page">.');
  process.exit(1);
}

const mount = `<div className="page home-sky">
      <div className="wsky-anchor">
        <WeatherSky
          weather={
            currentWeather && dailyWeather
              ? {
                  code: currentWeather.weather_code,
                  isDay: currentWeather.is_day,
                  time: currentWeather.time,
                  sunrise: dailyWeather.sunrise[0],
                  sunset: dailyWeather.sunset[0]
                }
              : null
          }
        />
      </div>`;

src = src.slice(0, at) + mount + src.slice(at + pageTag.length);

fs.writeFileSync(file + ".bak", fs.readFileSync(file));
fs.writeFileSync(file, src);
console.log("Done. Backup saved as src/App.jsx.bak");
