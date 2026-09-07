import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

/** Gate that only renders children for an authenticated admin; otherwise redirects. */
export default function AdminRoute({ children }) {
  const { initializing, isAdmin, isAuthenticated } = useAuth();

  if (initializing) {
    return <main className="operations-page"><p className="operation-empty">Checking permissions...</p></main>;
  }

  if (!isAuthenticated()) {
    return <Navigate replace to="/login" />;
  }

  if (!isAdmin()) {
    return <Navigate replace to="/" />;
  }

  return children;
}
