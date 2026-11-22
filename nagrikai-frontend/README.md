# NagrikAI — English + Hindi Frontend Prototype

A mobile-first React + Vite implementation of the 30-screen NagrikAI UI reference, with a global English/Hindi language switch.

## Run locally

1. Install Node.js 18 or newer.
2. Extract this folder.
3. Open a terminal inside `nagrikai-frontend` (the folder containing `package.json`).
4. Run:

```bash
npm install
npm run dev
```

5. Open the localhost URL printed by Vite (usually `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## Language switching

- Choose English or Hindi on the onboarding language screen.
- Use the `हिंदी` / `EN` switch in the top status area to change language from any screen.
- The selected language is saved in browser local storage and restored on the next visit.
- The translation dictionary is in `src/translations.js`. Add or edit English-to-Hindi entries there.
- Navigation IDs and application state remain language-neutral, so switching language does not reset the current screen or report state.

## Included

- All 30 screens represented in the supplied design reference.
- English and Hindi UI copy, including navigation and screen preview panel.
- Shared components, connected demo navigation and local React state.
- Responsive mobile-first layout and desktop screen selector.

## Prototype limitations

This is still a frontend prototype. It does not yet connect to a real backend, SMS OTP, device camera, photo upload, precise GPS, live maps/routing, weather/AQI providers, AI models, push notifications or government complaint portals. Sample content and simulated actions are labelled in the UI.

## GitHub

```bash
git add .
git commit -m "Add NagrikAI English and Hindi frontend"
git push
```
