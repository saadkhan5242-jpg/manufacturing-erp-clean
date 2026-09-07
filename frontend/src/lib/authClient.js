import apiClient from "./apiClient.js";

const TOKEN_KEY = "erp_token";
const USER_KEY = "erp_user";

export const ROLES = Object.freeze({
  ADMIN: "admin",
  OPERATOR: "operator",
  EMPLOYEE: "employee"
});

/** Authentication client — all /api/auth/* calls flow through the shared apiClient. */
export const authClient = {
  login(email, password) {
    return apiClient.post("/api/auth/login", { email, password });
  },

  me() {
    return apiClient.get("/api/auth/me");
  },

  adminCheck() {
    return apiClient.get("/api/auth/admin");
  },

  storeSession({ token, user }) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  readStoredUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

export default authClient;