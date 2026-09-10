import { createHash } from "node:crypto";
import { query, withTransaction } from "../db.js";

function userId(req) {
  const value = Number(req.user?.sub || req.user?.id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function signatureFor(req, payload) {
  return createHash("sha256")
    .update(JSON.stringify({ userId: userId(req), email: req.user?.email || "", payload }))
    .digest("hex");
}

function publicInstrument(row) {
  if (!row) return undefined;
  return {
    id: Number(row.id),
    instrumentNumber: row.instrumentNumber,
    instrumentType: row.instrumentType,
    description: row.description,
    serialNumber: row.serialNumber,
    ownerWorkCenterId: row.ownerWorkCenterId ? Number(row.ownerWorkCenterId) : null,
    calibrationDueAt: row.calibrationDueAt,
    status: row.status
  };
}

export async function assertSetupCalibrationValid({ workOrderId, routingStepId, measurementInstrumentId }) {
  const assignments = (await query(
    `SELECT rsi.measurement_instrument_id AS "measurementInstrumentId", mi.instrument_number AS "instrumentNumber", mi.calibration_due_at AS "calibrationDueAt", mi.status
     FROM routing_step_required_instruments rsi
     JOIN measurement_instruments mi ON mi.id = rsi.measurement_instrument_id
     WHERE rsi.work_order_id = $1 AND rsi.routing_step_id = $2 AND rsi.required_for_status = 'SETUP'`,
    [workOrderId, routingStepId]
  )).rows;

  const selected = measurementInstrumentId
    ? (await query(
        `SELECT id AS "measurementInstrumentId", instrument_number AS "instrumentNumber", calibration_due_at AS "calibrationDueAt", status
         FROM measurement_instruments WHERE id = $1`,
        [measurementInstrumentId]
      )).rows
    : [];
  const instruments = assignments.length > 0 ? assignments : selected;
  if (assignments.length > 0 && measurementInstrumentId && !assignments.some((instrument) => Number(instrument.measurementInstrumentId) === Number(measurementInstrumentId))) {
    const error = new Error("Measurement instrument is not assigned to this routing step");
    error.statusCode = 409;
    throw error;
  }

  for (const instrument of instruments) {
    const expired = new Date(instrument.calibrationDueAt).getTime() < Date.now();
    if (instrument.status !== "active" || expired) {
      const error = new Error(`Calibration expired or unavailable for ${instrument.instrumentNumber}`);
      error.statusCode = 409;
      error.code = "CALIBRATION_EXPIRED";
      throw error;
    }
  }
}

export async function submitInspectionRecord(input, req) {
  const signatureHash = signatureFor(req, input);
  const result = input.measurements.some((measurement) => measurement.passFail === "fail") ? "fail" : "pass";

  return withTransaction(async (client) => {
    const inspection = (await client.query(
      `INSERT INTO inspection_records
        (work_order_id, routing_step_id, inspection_type, measurement_instrument_id, operator_user_id, employee_id, result, signature_hash, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, work_order_id AS "workOrderId", routing_step_id AS "routingStepId", inspection_type AS "inspectionType", result, signature_hash AS "signatureHash", signed_at AS "signedAt"`,
      [input.workOrderId, input.routingStepId, input.inspectionType, input.measurementInstrumentId || null, userId(req), input.employeeId, result, signatureHash, input.notes]
    )).rows[0];

    const measurements = [];
    for (const measurement of input.measurements) {
      measurements.push((await client.query(
        `INSERT INTO inspection_measurements
          (inspection_record_id, characteristic_number, description, nominal_value, lower_tolerance, upper_tolerance, actual_value, unit, pass_fail)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, characteristic_number AS "characteristicNumber", description, nominal_value AS "nominalValue", lower_tolerance AS "lowerTolerance", upper_tolerance AS "upperTolerance", actual_value AS "actualValue", unit, pass_fail AS "passFail"`,
        [inspection.id, measurement.characteristicNumber, measurement.description, measurement.nominalValue, measurement.lowerTolerance, measurement.upperTolerance, measurement.actualValue, measurement.unit, measurement.passFail]
      )).rows[0]);
    }

    if (result === "fail") {
      await client.query("UPDATE job_routing SET status = 'QC-HOLD' WHERE id = $1", [input.routingStepId]);
      await client.query("UPDATE work_orders SET status = 'hold', updated_at = NOW() WHERE id = $1", [input.workOrderId]);
    }

    return { ...inspection, measurements };
  });
}

export async function submitFaiReport(input, req) {
  const signatureHash = signatureFor(req, input);
  return (await query(
    `INSERT INTO fai_reports
      (work_order_id, part_number, part_name, revision, report_number, form1, form2, form3, result, prepared_by, signature_hash)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11)
     RETURNING id, work_order_id AS "workOrderId", part_number AS "partNumber", report_number AS "reportNumber", result, signature_hash AS "signatureHash", signed_at AS "signedAt"`,
    [input.workOrderId, input.partNumber, input.partName, input.revision, input.reportNumber, JSON.stringify(input.form1), JSON.stringify(input.form2), JSON.stringify(input.form3), input.result, userId(req), signatureHash]
  )).rows[0];
}

export async function fileNcr(input, req) {
  const signatureHash = signatureFor(req, input);
  const ncrNumber = `NCR-${Date.now()}`;
  const capaNumber = `CAPA-${Date.now()}`;

  return withTransaction(async (client) => {
    const ncr = (await client.query(
      `INSERT INTO non_conformance_reports
        (ncr_number, work_order_id, routing_step_id, inventory_lot_id, reported_by, employee_id, quantity_scrapped, defect_code, description, severity, status, signature_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'capa_open', $11)
       RETURNING id, ncr_number AS "ncrNumber", work_order_id AS "workOrderId", routing_step_id AS "routingStepId", inventory_lot_id AS "inventoryLotId", quantity_scrapped AS "quantityScrapped", status, signature_hash AS "signatureHash", reported_at AS "reportedAt"`,
      [ncrNumber, input.workOrderId, input.routingStepId || null, input.inventoryLotId || null, userId(req), input.employeeId, input.quantityScrapped, input.defectCode, input.description, input.severity, signatureHash]
    )).rows[0];

    if (input.routingStepId) {
      await client.query("UPDATE job_routing SET status = 'QC-HOLD' WHERE id = $1", [input.routingStepId]);
      await client.query("UPDATE work_order_router_operations SET status = 'qc-hold', active = FALSE, updated_at = NOW() WHERE work_order_id = $1 AND sequence_number = (SELECT sequence_number FROM job_routing WHERE id = $2)", [input.workOrderId, input.routingStepId]);
    }
    await client.query("UPDATE work_orders SET status = 'hold', updated_at = NOW() WHERE id = $1", [input.workOrderId]);
    if (input.inventoryLotId) {
      await client.query("UPDATE inventory_lots SET quality_status = 'QC-Hold', hold_reason = $2 WHERE id = $1", [input.inventoryLotId, input.description]);
    }

    const capa = (await client.query(
      `INSERT INTO corrective_preventive_actions
        (capa_number, ncr_id, owner_user_id, containment_action, due_at, status)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '14 days', 'open')
       RETURNING id, capa_number AS "capaNumber", ncr_id AS "ncrId", containment_action AS "containmentAction", due_at AS "dueAt", status`,
      [capaNumber, ncr.id, userId(req), "Freeze routing step, segregate affected inventory, and start root-cause review"]
    )).rows[0];

    return { ncr, capa };
  });
}

export async function createMeasurementInstrument(input) {
  return publicInstrument((await query(
    `INSERT INTO measurement_instruments
      (instrument_number, instrument_type, description, serial_number, owner_work_center_id, calibration_due_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, instrument_number AS "instrumentNumber", instrument_type AS "instrumentType", description, serial_number AS "serialNumber", owner_work_center_id AS "ownerWorkCenterId", calibration_due_at AS "calibrationDueAt", status`,
    [input.instrumentNumber, input.instrumentType, input.description, input.serialNumber, input.ownerWorkCenterId || null, input.calibrationDueAt, input.status]
  )).rows[0]);
}

export async function recordCalibrationEvent(input) {
  return withTransaction(async (client) => {
    const event = (await client.query(
      `INSERT INTO instrument_calibration_events
        (measurement_instrument_id, calibrated_at, calibration_due_at, calibrated_by, certificate_document_id, result, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, measurement_instrument_id AS "measurementInstrumentId", calibrated_at AS "calibratedAt", calibration_due_at AS "calibrationDueAt", result`,
      [input.measurementInstrumentId, input.calibratedAt, input.calibrationDueAt, input.calibratedBy || null, input.certificateDocumentId || null, input.result, input.notes]
    )).rows[0];

    await client.query(
      "UPDATE measurement_instruments SET calibration_due_at = $1, status = $2, updated_at = NOW() WHERE id = $3",
      [input.calibrationDueAt, input.result === "failed" ? "out_of_service" : "active", input.measurementInstrumentId]
    );
    return event;
  });
}

export async function listMeasurementInstruments() {
  return (await query(
    `SELECT id, instrument_number AS "instrumentNumber", instrument_type AS "instrumentType", description, serial_number AS "serialNumber", owner_work_center_id AS "ownerWorkCenterId", calibration_due_at AS "calibrationDueAt", status
     FROM measurement_instruments
     ORDER BY calibration_due_at ASC, instrument_number ASC
     LIMIT 100`
  )).rows.map(publicInstrument);
}
