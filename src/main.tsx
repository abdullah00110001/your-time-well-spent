import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from '@capacitor/core';

// Global error handlers to prevent app crashes
window.addEventListener("unhandledrejection", (event) => {
  console.error("[App] Unhandled promise rejection:", event.reason);
  event.preventDefault();
});

window.addEventListener("error", (event) => {
  console.error("[App] Uncaught error:", event.error || event.message);
  event.preventDefault();
});

// Cleanup any previously-registered service worker (PWA was removed).
// This runs on both web and native to undo prior installs on existing devices.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => {});
  if ('caches' in window) {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n))).catch(() => {});
  }
}

// Note: Native splash screen is hidden manually from App.tsx after auth resolves.
void Capacitor; // keep import for tree-shake stability

createRoot(document.getElementById("root")!).render(<App />);
