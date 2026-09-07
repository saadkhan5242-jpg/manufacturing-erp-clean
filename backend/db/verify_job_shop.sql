-- Run with psql after `npm run db:migrate`.

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('work_centers', 'work_orders', 'schedules')
ORDER BY table_name;

SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('work_centers', 'work_orders', 'schedules')
ORDER BY tablename, indexname;

SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid::regclass::text IN ('work_centers', 'work_orders', 'schedules')
ORDER BY table_name, conname;

-- Insert a work center and work order, then schedule against them.
INSERT INTO work_centers (code, name, daily_capacity_hours)
VALUES ('TEST-WC-001', 'Verification Cell', 8)
RETURNING id;

INSERT INTO work_orders (order_number, part_number, quantity, due_date)
VALUES ('TEST-WO-001', 'TEST-PART-001', 10, CURRENT_DATE + 7)
RETURNING id;

-- Replace the IDs below with the returned IDs when running manually.
-- INSERT INTO schedules (work_order_id, work_center_id, start_time, end_time)
-- VALUES (1, 1, NOW(), NOW() + INTERVAL '2 hours');

-- Verify cascade behavior after testing:
-- DELETE FROM work_orders WHERE order_number = 'TEST-WO-001';
-- SELECT * FROM schedules WHERE work_order_id = <deleted_work_order_id>;
