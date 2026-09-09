/* ============================================================
   CLOUD PIPELINE MIGRATION — network target switch
   In development the app calls the local Express server; in a
   production (Electron desktop / cloud) build, all data calls are
   redirected to the live cloud deployment URL. Set the cloud URL
   via Vite env var VITE_API_URL (see frontend/.env.production).
   ============================================================ */

const DEV_API_URL = import.meta.env.VITE_DEV_API_URL || "http://localhost:4000";
export const API = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || (import.meta.env.DEV ? DEV_API_URL : "");
export const API_BASE_URL = API;
export const LOCAL_API_ORIGIN = DEV_API_URL;

/**
 * Rewrite any absolute local API URL to the active API origin.
 * Leaves relative /api and /ai paths untouched (they proxy in dev
 * and are rewritten to absolute by the fetch shim in production).
 */
export function resolveApiUrl(url) {
  if (typeof url !== "string") return url;
  if (url.startsWith(DEV_API_URL)) return API + url.slice(DEV_API_URL.length);
  if (url.startsWith("/api") || url.startsWith("/ai")) return API + url;
  return url;
}

export default { API_BASE_URL, resolveApiUrl };
