import AdminControlPanel from "../components/AdminControlPanel.jsx";
import AdminRoute from "../components/AdminRoute.jsx";

/** Admin-only dashboard: system health, user directory, product/inventory admin controls. */
export default function AdminDashboard() {
  return (
    <AdminRoute>
      <main className="operations-page">
        <header className="operations-page-header">
          <div>
            <p className="eyebrow">Administration / Control</p>
            <h1>Admin dashboard</h1>
            <p>Review system security and operational control status.</p>
          </div>
        </header>
        <AdminControlPanel />
      </main>
    </AdminRoute>
  );
}
