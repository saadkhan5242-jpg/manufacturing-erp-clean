import { createContext } from "react";

/** Shared auth state: { user, initializing, login, logout, getCurrentUser, isAuthenticated, isAdmin, hasRole }. */
export const AuthContext = createContext(null);
