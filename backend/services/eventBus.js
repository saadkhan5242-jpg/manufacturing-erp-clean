import { EventEmitter } from "node:events";
import { logger } from "../utils/logger.js";

class ErpEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  publish(eventName, payload) {
    logger.info({ eventName, payload }, `⚡ Event Bus Published: ${eventName}`);
    this.emit(eventName, payload);
    this.emit("*", { eventName, payload });
  }

  subscribe(eventName, handler) {
    this.on(eventName, async (payload) => {
      try {
        await handler(payload);
      } catch (err) {
        logger.error({ eventName, error: err.message }, `❌ Event Bus Handler Exception on ${eventName}`);
      }
    });
  }
}

export const ERP_EVENTS = {
  WORK_ORDER_CREATED: "work_order.created",
  WORK_ORDER_UPDATED: "work_order.updated",
  LABOR_LOGGED: "labor.logged",
  LABOR_CLOCKED_OUT: "labor.clocked_out",
  INVENTORY_ADJUSTED: "inventory.adjusted",
  SALES_ORDER_SUBMITTED: "sales_order.submitted",
  QUALITY_INSPECTION_RECORDED: "quality.inspection_recorded"
};

export const eventBus = new ErpEventBus();
export default eventBus;
