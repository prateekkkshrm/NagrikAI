# NagrikAI — Frontend Prototype

A mobile-first React + Vite implementation of the 30-screen NagrikAI UI reference.

## Run locally

1. Install Node.js (18+ recommended).
2. Extract this folder.
3. Open a terminal in the project folder and run:

```bash
npm install
npm run dev
```

4. Open the local URL printed by Vite (usually `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## What's included

- All 30 screens represented in the supplied UI reference.
- Shared components for buttons, cards, fields, navigation, status bar and map.
- Connected onboarding, reporting, duplicate-check, submission, authority, tracking, profile and settings flows.
- Local React state for form fields, filters, toggles, severity, OTP inputs, navigation and demo toasts.
- Responsive mobile layout and a desktop prototype screen selector.

## Important prototype limitations

This is a frontend prototype with simulated/sample content. It does **not** yet connect to:
- A real backend, database or authentication provider.
- SMS OTP delivery or phone verification.
- Device camera, photo upload, precise GPS or push notifications.
- Live maps, routing, weather or AQI providers.
- A real AI/vision model or government complaint portal.

Those integrations require API credentials, backend endpoints, provider selection and production privacy/security work. The UI explicitly labels key sample data and simulated actions.

## Suggested GitHub push

```bash
git init
git add .
git commit -m "Add NagrikAI frontend prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

If your GitHub repository already exists, skip `git init` and make sure the `origin` remote points to the correct repository.
