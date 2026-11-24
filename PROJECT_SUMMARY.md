# NagrikAI — Project Summary

> *Your City. Your Voice. Your Intelligence.*

## Overview

**NagrikAI** is a civic-tech mobile application prototype built for citizens of **Greater Noida, India**. It empowers residents to report urban issues (potholes, waterlogging, broken streetlights, etc.), track complaints through responsible authorities, and stay informed about their city — all from a smartphone.

The project is currently a **frontend prototype** with a fully navigable, 30-screen UI, backed by real authentication (Supabase OTP) and live external APIs.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Mobile Packaging | Capacitor 8 (Android) |
| Authentication | Supabase (OTP via SMS) |
| Maps | React-Leaflet + Leaflet.js |
| Icons | Lucide React |
| Weather API | Open-Meteo (free, no key) |
| Reverse Geocoding | BigDataCloud API |
| News Translation | MyMemory Translation API |
| Language Support | English & Hindi (bilingual UI) |

---

## Key Features

- **Phone OTP Login** — Supabase-powered SMS authentication for Indian mobile numbers (+91)
- **Civic Issue Reporting** — Photo capture, GPS tagging, AI-assisted category detection, severity rating
- **Duplicate Detection** — Flags nearby reports to avoid redundant submissions
- **Interactive Map** — Leaflet map with issue markers, traffic overlays, and filter layers
- **GroundTruth AI** — Before/after photo comparison to verify claimed repairs
- **Responsible Authority Matching** — Automatically suggests the correct government department (e.g., GNIDA) based on GPS location
- **Official Complaint Handoff** — Generates structured complaint drafts for official portals
- **Reference Tracking** — Timeline view to track complaint status
- **Weather & Air Quality** — Live 3-day forecast from Open-Meteo with AQI info
- **NagrikAI Chatbot** — City-aware AI assistant for civic queries
- **Voice Assistant** — Voice input support (Web Speech API hook, demo mode)
- **Civic Navigation** — Route suggestions that avoid reported hazards
- **City Analytics** — Weekly report stats and resolution metrics dashboard
- **Bilingual UI** — Full English ↔ Hindi translation via DOM-level translation engine
- **Accessibility Settings** — Larger text, reduced motion, high contrast, voice guidance
- **Privacy Controls** — Anonymous reporting, granular location permissions

---

## Project Structure

```
NagrikAI/
└── nagrikai-frontend/          # Main frontend app
    ├── src/
    │   ├── App.jsx             # All 30 screens + app logic (~3500 lines)
    │   ├── main.jsx            # React entry point
    │   ├── styles.css          # Global styles
    │   ├── supabaseClient.js   # Supabase auth client
    │   └── translations.js     # English → Hindi translation map & DOM engine
    ├── android/                # Capacitor Android project
    ├── index.html              # App shell HTML
    ├── capacitor.config.json   # App ID: com.nagrikai.app
    ├── package.json            # Dependencies & build scripts
    └── vite.config.js          # Vite build config
```

---

## Screens (30 total)

`Splash` → `Welcome` → `Language` → `Login` → `OTP Verification` → `Home` → `Explore Map` → `Map Filters` → `Capture Report` → `Review Report` → `Possible Duplicate` → `Report Submitted` → `Issue Details` → `GroundTruth AI` → `Responsible Authority` → `Complaint Handoff` → `Reference Tracking` → `Weather & Air` → `Ask NagrikAI` → `Voice Assistant` → `Civic Navigation` → `City Analytics` → `Profile` → `Report History` → `Notifications` → `Accessibility` → `Privacy & Settings` → `Loading` → `Empty History` → `Connection Error`

---

## Status

This is a **frontend prototype**. The following are simulated/demo:

- AI issue detection (category & confidence)
- Duplicate detection algorithm
- Official government portal handoff
- Offline report queuing
- Push notifications
- Camera / GPS in browser (Capacitor handles native)

**Live integrations**: Supabase auth, Open-Meteo weather, BigDataCloud reverse geocoding, MyMemory news translation.

---

## Setup

```bash
cd nagrikai-frontend
pnpm install          # or npm install
# Create .env with:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_PUBLISHABLE_KEY=...
pnpm dev              # Start dev server
pnpm build            # Build for web/Android
npx cap sync android  # Sync to Android project
```

---

*Generated: 2026-11-23*
