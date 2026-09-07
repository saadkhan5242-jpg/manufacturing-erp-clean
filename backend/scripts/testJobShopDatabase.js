import "dotenv/config";
import { withTransaction, pool } from "../db.js";

try {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const result = await withTransaction(async (client) => {
    const workCenter = (await client.query("INSERT INTO work_centers (code, name, daily_capacity_hours) VALUES ($1, $2, $3) RETURNING id", [`TEST-${Date.now()}`, "Database Test Cell", 8])).rows[0];
    const workOrder = (await client.query("INSERT INTO work_orders (order_number, part_number, quantity, status) VALUES ($1, $2, $3, $4) RETURNING id", [`TEST-WO-${Date.now()}`, "TEST-PART", 2, "open"])).rows[0];
    const schedule = (await client.query("INSERT INTO schedules (work_order_id, work_center_id, start_time, end_time) VALUES ($1, $2, NOW(), NOW() + INTERVAL '1 hour') RETURNING id", [workOrder.id, workCenter.id])).rows[0];
    await client.query("DELETE FROM work_orders WHERE id = $1", [workOrder.id]);
    const cascadeCheck = await client.query("SELECT id FROM schedules WHERE id = $1", [schedule.id]);
    if (cascadeCheck.rowCount !== 0) throw new Error("ON DELETE CASCADE did not remove the schedule");
    return { workCenterId: workCenter.id, workOrderId: workOrder.id, scheduleId: schedule.id, cascade: true };
  });
  console.log(JSON.stringify({ passed: true, ...result }));
} catch (error) {
  console.error(`Database test failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
