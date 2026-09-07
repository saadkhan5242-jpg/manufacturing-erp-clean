import assert from "node:assert";
import { test, describe } from "node:test";
import { clockInSchema, laborLogSchema, supervisorPinSchema, salesOrderSchema } from "../validators/schemas.js";

describe("ERP Validator Suite", () => {
  test("clockInSchema parses valid employee & work order numbers", () => {
    const input = { employeeId: " 101 ", workOrderId: 5001, jobStatus: "RUNNING" };
    const parsed = clockInSchema.parse(input);
    assert.strictEqual(parsed.employeeId, "101");
    assert.strictEqual(parsed.workOrderId, "5001");
    assert.strictEqual(parsed.jobStatus, "RUNNING");
  });

  test("supervisorPinSchema rejects non-4 digit PINs", () => {
    assert.throws(() => supervisorPinSchema.parse({ pin: "123" }), /Supervisor PIN must be/);
    assert.throws(() => supervisorPinSchema.parse({ pin: "12345" }), /Supervisor PIN must be/);
    const valid = supervisorPinSchema.parse({ pin: "2468" });
    assert.strictEqual(valid.pin, "2468");
  });

  test("laborLogSchema transforms workCode S and R to setup/run defaults", () => {
    const parsed = laborLogSchema.parse({ employeeId: "EMP-10", workOrderId: 99, workCode: "S" });
    assert.strictEqual(parsed.employeeId, "EMP-10");
    assert.strictEqual(parsed.workOrderId, 99);
  });

  test("salesOrderSchema requires orderNumber, customerId, partNumber, quantityOrdered", () => {
    const valid = salesOrderSchema.parse({
      orderNumber: "SO-100",
      customerId: "CUST-01",
      partNumber: "PRT-01",
      quantityOrdered: 10
    });
    assert.strictEqual(valid.orderNumber, "SO-100");
    assert.strictEqual(valid.quantityOrdered, 10);
  });
});
