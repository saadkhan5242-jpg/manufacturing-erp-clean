import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useState } from "react";
import apiClient from "./lib/apiClient.js";
import "./WorkOrderChart.css";

function WorkOrderChart() {
  const [workOrderData, setWorkOrderData] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiClient.get("/api/dashboard/completion-history", { query: { days: 7 } })
      .then((data) => { if (active) setWorkOrderData(data.history || []); })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, []);

  return (
    <div className="chart-card work-order-chart">
      <h2>Work order completion</h2><span className="chart-meta">Daily completed orders</span>
      {error && <p role="alert">{error}</p>}
      {!error && <ResponsiveContainer height={250} width="100%"><LineChart data={workOrderData} margin={{ top: 16, right: 10, bottom: 0, left: -20 }}>
        <Line
          type="monotone"
          dataKey="completed"
          stroke="#b76b16"
          strokeWidth={3}
        />
        <CartesianGrid stroke="#e5eeea" vertical={false} />
        <XAxis axisLine={false} dataKey="day" tickLine={false} />
        <YAxis axisLine={false} tickLine={false} />
        <Tooltip />
      </LineChart></ResponsiveContainer>}
    </div>
  );
}

export default WorkOrderChart;
