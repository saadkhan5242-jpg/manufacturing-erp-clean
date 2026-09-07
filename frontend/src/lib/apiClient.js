import { API } from "../config.js";

const TOKEN_KEY = "erp_token";

/** Error raised for any non-2xx HTTP response, carrying status + parsed payload. */
export class ApiError extends Error {
  constructor(message, { status, details, requestId } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

function toAbsoluteUrl(path, query) {
  const base = path.startsWith("http") ? path : `${API}${path}`;
  const url = new URL(base, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function buildHeaders(body, extraHeaders) {
  const headers = new Headers(extraHeaders);
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (response.status === 204) return null;
  if (contentType.includes("application/json")) return response.json();
  const text = await response.text();
  return text || null;
}

/**
 * Core request function backing the ApiClient class. Every ERP page/component
 * calls through here so token attachment, JSON handling, and 401/error
 * broadcasting are always consistent.
 */
class ApiClient {
  async request(path, { method = "GET", body, query, headers, signal } = {}) {
    const url = toAbsoluteUrl(path, query);
    const requestHeaders = buildHeaders(body, headers);
    const requestBody = body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body);

    let response;
    try {
      response = await fetch(url, { method, headers: requestHeaders, body: requestBody, signal });
    } catch (cause) {
      const error = new ApiError("Unable to reach the ERP backend");
      error.cause = cause;
      window.dispatchEvent(new CustomEvent("erp:error", { detail: { message: error.message } }));
      throw error;
    }

    const payload = await parseResponseBody(response);

    if (!response.ok) {
      if (response.status === 401) {
        window.dispatchEvent(new Event("erp:unauthorized"));
      }
      const message = (payload && typeof payload === "object" ? payload.error || payload.message : payload) || `Request failed (${response.status})`;
      const error = new ApiError(message, {
        status: response.status,
        details: payload,
        requestId: response.headers.get("x-request-id")
      });
      if (response.status !== 401) {
        window.dispatchEvent(new CustomEvent("erp:error", { detail: { message: error.message } }));
      }
      throw error;
    }

    return payload;
  }

  get(path, options) {
    return this.request(path, { ...options, method: "GET" });
  }

  post(path, body, options) {
    return this.request(path, { ...options, method: "POST", body });
  }

  put(path, body, options) {
    return this.request(path, { ...options, method: "PUT", body });
  }

  patch(path, body, options) {
    return this.request(path, { ...options, method: "PATCH", body });
  }

  delete(path, options) {
    return this.request(path, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();

export const get = apiClient.get.bind(apiClient);
export const post = apiClient.post.bind(apiClient);
export const put = apiClient.put.bind(apiClient);
export const patch = apiClient.patch.bind(apiClient);
export const del = apiClient.delete.bind(apiClient);

export default apiClient;