import Dashboard from "./Dashboard";
import LoginPage from "./pages/LoginPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./hooks/useAuth.jsx";
import AuthProvider from "./hooks/AuthProvider.jsx";
import ToastProvider from "./components/ToastProvider.jsx";

/* ============================================================
   FORGELOGIC AI — SFDC MULTI-WINDOW CONSOLE (root)
   Mounts the high-density multi-window transactional container
   matrix as the primary application interface.
   ============================================================ */
function AuthenticatedApp() {
  const { initializing, isAuthenticated } = useAuth();
  if (initializing) return <main className="operations-page"><p className="operation-empty">Loading ERP session...</p></main>;
  if (!isAuthenticated()) return <LoginPage />;
  return <ProtectedRoute><div className="app-root-container"><Dashboard /></div></ProtectedRoute>;
}

export default function App() {
  return <ToastProvider><AuthProvider><AuthenticatedApp /></AuthProvider></ToastProvider>;
}
