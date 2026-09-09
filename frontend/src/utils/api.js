import { API_BASE_URL, LOCAL_API_ORIGIN } from "../config.js";

/* ============================================================
   GLOBAL FETCH SHIM
   - Attaches the Bearer token to every API call.
   - In production (Electron / cloud), rewrites the local API origin
     and relative /api & /ai paths to the live deployment URL, so the
     desktop client communicates across remote networks.
   ============================================================ */

const nativeFetch = window.fetch.bind(window);
const LOCAL_ORIGIN = LOCAL_API_ORIGIN;

function resolveTarget(url) {
  // Absolute local URL -> active API origin (cloud in production)
  if (url.startsWith(LOCAL_ORIGIN)) return API_BASE_URL + url.slice(LOCAL_ORIGIN.length);
  // Relative API paths -> absolute to the active origin (needed in the packaged app)
  if (url.startsWith("/api") || url.startsWith("/ai")) return API_BASE_URL + url;
  return url;
}

function isApiCall(url) {
  return url.startsWith("/api") || url.startsWith("/ai") || url.startsWith(LOCAL_ORIGIN) || url.startsWith(API_BASE_URL);
}

window.fetch = (input, init = {}) => {
  const rawUrl = typeof input === "string" ? input : input.url;
  const url = resolveTarget(rawUrl);
  const token = localStorage.getItem("erp_token");

  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  if (token && isApiCall(rawUrl)) headers.set("Authorization", `Bearer ${token}`);

  const resolvedInput = typeof input === "string" ? url : new Request(url, input);
  return nativeFetch(resolvedInput, { ...init, headers });
};

export function saveSession(result) {
  localStorage.setItem("erp_token", result.token);
  localStorage.setItem("erp_user", JSON.stringify(result.user));
}

export function clearSession() {
  localStorage.removeItem("erp_token");
  localStorage.removeItem("erp_user");
}
