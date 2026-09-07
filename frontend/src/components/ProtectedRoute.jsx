import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

/** Gate that only renders children for an authenticated session; otherwise redirects to /login. */
export default function ProtectedRoute({ children }) {
  const { initializing, isAuthenticated } = useAuth();

  if (initializing) {
    return <main className="operations-page"><p className="operation-empty">Checking session...</p></main>;
  }

  if (!isAuthenticated()) {
    return <Navigate replace to="/login" />;
  }

  return children;
}
