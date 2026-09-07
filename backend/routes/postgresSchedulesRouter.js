import express from "express";
import * as service from "../services/postgresScheduleService.js";

const router = express.Router();
const id = (value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const handle = (action) => async (req, res, next) => { try { const result = await action(req); if (result === undefined) return res.status(404).json({ error: "Schedule not found" }); return res.status(req.method === "POST" ? 201 : 200).json(result); } catch (error) { next(error); } };
router.get("/", handle(() => service.listSchedules()));
router.get("/:id", handle((req) => service.getSchedule(id(req.params.id))));
router.post("/", handle((req) => service.createSchedule(req.body)));
router.put("/:id", handle((req) => service.updateSchedule(id(req.params.id), req.body)));
router.delete("/:id", async (req, res, next) => { try { if (!(await service.deleteSchedule(id(req.params.id)))) return res.status(404).json({ error: "Schedule not found" }); return res.status(204).send(); } catch (error) { next(error); } });
export default router;
