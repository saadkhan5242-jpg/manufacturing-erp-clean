import { useEffect, useState } from "react";
import apiClient from "../lib/apiClient.js";

function CapacityPage() {
  const [capacity, setCapacity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCapacity() {
      try {
        setCapacity(await apiClient.get("/api/capacity"));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadCapacity();
  }, []);

  return (
    <main>
      <h1>Capacity Planning</h1>
      <p>Compare each work center&apos;s available capacity with its scheduled load.</p>

      {loading && <p>Loading capacity...</p>}
      {error && <p role="alert" style={styles.error}>{error}</p>}

      {!loading && !error && (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Work Center</th>
                <th>Capacity (hrs)</th>
                <th>Scheduled (hrs)</th>
                <th>Remaining (hrs)</th>
                <th>Utilization (%)</th>
              </tr>
            </thead>
            <tbody>
              {capacity.map((workCenter) => (
                <tr key={workCenter.workCenterId} style={getRowStyle(workCenter.utilizationPercent)}>
                  <td>{workCenter.workCenterName}</td>
                  <td>{workCenter.capacityHours}</td>
                  <td>{workCenter.scheduledHours}</td>
                  <td>{workCenter.remainingHours}</td>
                  <td>{workCenter.utilizationPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function getRowStyle(utilizationPercent) {
  if (utilizationPercent > 100) {
    return { backgroundColor: "#fee4e2", color: "#b42318" };
  }

  if (utilizationPercent < 50) {
    return { backgroundColor: "#dcfae6", color: "#067647" };
  }

  return undefined;
}

const styles = {
  error: { color: "#b42318" },
  tableWrapper: { overflowX: "auto" },
  table: { borderCollapse: "collapse", minWidth: "680px", width: "100%" }
};

export default CapacityPage;