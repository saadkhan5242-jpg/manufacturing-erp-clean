import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useState } from "react";
import apiClient from "./lib/apiClient.js";
import "./ChartsSection.css";

function ChartsSection() {
  const [productionData, setProductionData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiClient.get("/api/dashboard/completion-history", { query: { days: 7 } }),
      apiClient.get("/api/inventory/stock-ledger")
    ]).then(([production, inventory]) => {
      setProductionData((production.history || []).map((row) => ({ day: row.day, units: row.completed })));
      setInventoryData((Array.isArray(inventory) ? inventory : inventory.items || []).map((row) => ({ item: row.partNumber, qty: row.quantity })));
    }).catch((loadError) => setError(loadError.message));
  }, []);

  return (
    <div className="charts-container chart-production">
      {error && <p role="alert">{error}</p>}
      <div className="chart-card">
        <h2>Production output</h2><span className="chart-meta">Units per day</span>
        <ResponsiveContainer height={250} width="100%"><LineChart data={productionData} margin={{ top: 16, right: 10, bottom: 0, left: -20 }}>
          <Line dot={{ fill: "#137c73", r: 3 }} type="monotone" dataKey="units" stroke="#137c73" strokeWidth={3} />
          <CartesianGrid stroke="#e5eeea" vertical={false} /><XAxis axisLine={false} dataKey="day" tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip />
        </LineChart></ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h2>Inventory levels</h2><span className="chart-meta">Current stock by class</span>
        <ResponsiveContainer height={250} width="100%"><BarChart data={inventoryData} margin={{ top: 16, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#e5eeea" vertical={false} /><XAxis axisLine={false} dataKey="item" tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar barSize={22} dataKey="qty" fill="#3e7cb1" radius={[4, 4, 0, 0]} />
        </BarChart></ResponsiveContainer>
      </div>
    </div>
  );
}

export default ChartsSection;
