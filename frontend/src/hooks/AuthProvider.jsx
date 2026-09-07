import { useCallback, useEffect, useMemo, useState } from "react";
import authClient, { ROLES } from "../lib/authClient.js";
import { AuthContext } from "./AuthContext.jsx";

/**
 * AuthProvider — single source of truth for the current session. Loads the
 * user from a stored token on mount/refresh, and reacts to `erp:unauthorized`
 * events dispatched by apiClient whenever a request comes back 401.
 */
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authClient.readStoredUser());
  const [initializing, setInitializing] = useState(Boolean(authClient.getToken()));

  const clearSession = useCallback(() => {
    authClient.logout();
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener("erp:unauthorized", clearSession);

    if (!authClient.getToken()) {
      setInitializing(false);
      return () => window.removeEventListener("erp:unauthorized", clearSession);
    }

    authClient
      .me()
      .then((result) => setUser(result.user))
      .catch(clearSession)
      .finally(() => setInitializing(false));

    return () => window.removeEventListener("erp:unauthorized", clearSession);
  }, [clearSession]);

  const login = useCallback(async (credentials) => {
    const result = await authClient.login(credentials.email, credentials.password);
    authClient.storeSession(result);
    setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(() => clearSession(), [clearSession]);

  const value = useMemo(
    () => ({
      user,
      initializing,
      login,
      logout,
      getCurrentUser: () => user,
      isAuthenticated: () => Boolean(user && authClient.getToken()),
      isAdmin: () => user?.role === ROLES.ADMIN,
      hasRole: (role) => user?.role === role
    }),
    [user, initializing, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}