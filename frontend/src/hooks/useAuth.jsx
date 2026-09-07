import { useContext } from "react";
import { AuthContext } from "./AuthContext.jsx";

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth() must be called from within an <AuthProvider>");
  return context;
}

export default useAuth;
