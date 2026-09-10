import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { broadcastShopFloorEvent } from "../services/shopFloorEventBus.js";
import {
  createMeasurementInstrument,
  fileNcr,
  listMeasurementInstruments,
  recordCalibrationEvent,
  submitFaiReport,
  submitInspectionRecord
} from "../services/qmsService.js";
import {
  calibrationEventSchema,
  calibrationInstrumentSchema,
  faiReportSchema,
  inspectionRecordSchema,
  ncrSchema
} from "../validators/schemas.js";

const router = Router();

router.use(authenticate);

router.post("/inspections", validateBody(inspectionRecordSchema), async (req, res, next) => {
  try {
    const inspection = await submitInspectionRecord(req.body, req);
    broadcastShopFloorEvent("quality-inspection", inspection);
    return res.status(201).json(inspection);
  } catch (error) {
    return next(error);
  }
});

router.post("/fai-reports", validateBody(faiReportSchema), async (req, res, next) => {
  try {
    const report = await submitFaiReport(req.body, req);
    broadcastShopFloorEvent("fai-report", report);
    return res.status(201).json(report);
  } catch (error) {
    return next(error);
  }
});

router.post("/ncrs", validateBody(ncrSchema), async (req, res, next) => {
  try {
    const result = await fileNcr(req.body, req);
    broadcastShopFloorEvent("non-conformance", result);
    broadcastShopFloorEvent("capa-created", result.capa);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

router.get("/calibration/instruments", async (_req, res, next) => {
  try {
    return res.json(await listMeasurementInstruments());
  } catch (error) {
    return next(error);
  }
});

router.post("/calibration/instruments", validateBody(calibrationInstrumentSchema), async (req, res, next) => {
  try {
    const instrument = await createMeasurementInstrument(req.body);
    broadcastShopFloorEvent("calibration-instrument", instrument);
    return res.status(201).json(instrument);
  } catch (error) {
    return next(error);
  }
});

router.post("/calibration/events", validateBody(calibrationEventSchema), async (req, res, next) => {
  try {
    const event = await recordCalibrationEvent(req.body);
    broadcastShopFloorEvent("calibration-event", event);
    return res.status(201).json(event);
  } catch (error) {
    return next(error);
  }
});

export default router;
