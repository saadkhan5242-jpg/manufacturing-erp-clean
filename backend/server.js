import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { validateEnvironment } from "./config/environment.js";

// Master System Routers
import aiRouter from "./routes/aiRouter.js";
import aiFileGeneratorRouter from "./routes/aiFileGeneratorRouter.js";   
import aiModuleGeneratorRouter from "./routes/aiModuleGeneratorRouter.js"; 
import workCentersRouter from "./routes/workCentersRouter.js";
import inventoryRouter from "./routes/inventoryRouter.js";
import capacityRouter from "./routes/capacityRouter.js";
import suppliersRouter from "./routes/suppliersRouter.js";
import productsRouter from "./routes/productsRouter.js";
import partsRouter from "./routes/partsRouter.js";
import purchaseOrdersRouter from "./routes/purchaseOrdersRouter.js";
import maintenanceRouter from "./routes/maintenanceRouter.js";
import routingRouter from "./routes/routingRouter.js";
import documentsRouter from "./routes/documentsRouter.js";
import reportsRouter from "./routes/reportsRouter.js";
import { createModuleRouter } from "./routes/moduleRouter.js";
import errorHandler from "./middleware/errorHandler.js";
import { authenticate, protectWrites, requireRoles } from "./middleware/auth.js";
import authRouter from "./routes/authRouter.js";
import { ensureAdminPassword } from "./auth/authService.js";
import timeTrackingRouter from "./routes/timeTrackingRouter.js";
import mrpRouter from "./routes/mrpRouter.js";
import accountingRouter from "./routes/accountingRouter.js";
import postgresWorkCentersRouter from "./routes/postgresWorkCentersRouter.js";
import postgresWorkOrdersRouter from "./routes/postgresWorkOrdersRouter.js";
import postgresSchedulesRouter from "./routes/postgresSchedulesRouter.js";

// Global Shop Solutions Module Extensions
import bomRouter from "./routes/bomRouter.js";
import shopFloorRouter from "./routes/shopFloorRouter.js";
import documentIntakeRouter from "./routes/documentIntakeRouter.js";
import dashboardRouter from "./routes/dashboardRouter.js";
import laborRouter from "./routes/laborRouter.js";
import laborLogRouter from "./routes/laborLogRouter.js";
import biRouter from "./routes/biRouter.js";
import { startLaborAccumulatorDaemon } from "./services/laborAccumulatorDaemon.js";
import flJobsRouter from "./routes/flJobsRouter.js";
import flVendorsRouter from "./routes/flVendorsRouter.js";
import flQuotesRouter from "./routes/flQuotesRouter.js";
import flAiRouter from "./routes/flAiRouter.js";
import flCadRouter from "./routes/flCadRouter.js";
import healthRouter from "./routes/healthRouter.js";
import aiServiceRouter from "./ai/aiServiceRouter.js";
import cadRouter from "./cad/cadRouter.js";
import quickbooksRouter from "./quickbooks/quickbooksRouter.js";
import { setupSwagger } from "./config/swagger.js";
import { metricsMiddleware } from "./middleware/metrics.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json());
app.use(metricsMiddleware);
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

// Setup OpenAPI / Swagger UI documentation at /api-docs
setupSwagger(app);

// 1. Open Authorization Routes
app.use("/api/auth", authRouter);

// Protect every API/AI write route, including routers registered below.
app.use("/api", protectWrites);
app.use("/ai", protectWrites);

// 2. Core Operational Routers
app.use("/api/bom", bomRouter);
app.use("/api/shopfloor", shopFloorRouter);
app.use("/api/ai-document-intake", authenticate, documentIntakeRouter);
app.use("/api/mrp", mrpRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/labor", laborRouter);
app.use("/api/shop-floor", laborLogRouter);
app.use("/api/bi", biRouter);

// ForgeLogic AI — machine job shop engines
app.use("/api/fl/jobs", flJobsRouter);
app.use("/api/fl/vendors", flVendorsRouter);
app.use("/api/fl/quotes", flQuotesRouter);
app.use("/api/fl/ai", flAiRouter);
app.use("/api/fl/cad", flCadRouter);

// ForgeLogic AI — production service layers
app.use("/api/health", healthRouter);
app.use("/api/fl/ai-engine", aiServiceRouter);
app.use("/api/cad", cadRouter);
app.use("/api/quickbooks", quickbooksRouter);

// 3. Primary Core System APIs
app.use("/api/time-tracking", authenticate, timeTrackingRouter);
app.use("/api/db/work-centers", postgresWorkCentersRouter);
app.use("/api/work-orders", postgresWorkOrdersRouter);
app.use("/ai", aiRouter);
app.use("/ai/files", aiFileGeneratorRouter);
app.use("/ai/modules", aiModuleGeneratorRouter);
app.use("/api/work-centers", workCentersRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/scheduling", postgresSchedulesRouter);
app.use("/api/capacity", capacityRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/products", productsRouter);
app.use("/api/parts", partsRouter);
app.use("/api/purchase-orders", purchaseOrdersRouter);
app.use("/api/maintenance", maintenanceRouter);
app.use("/api/routings", routingRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/users", authenticate, requireRoles("admin"));
app.use("/api/tax-settings", authenticate, requireRoles("admin", "finance"));
app.use("/api/accounting/entries", authenticate, requireRoles("admin", "finance"));
app.use("/api/accounting/entries", accountingRouter);

// 5. Hardcoded Module Catalog Fallbacks
app.use("/api/boms", createModuleRouter({ filename: "boms.json", seed: [{ id: 1, productId: 1, revision: "A", components: [{ partNumber: "MAT-STEEL-001", quantity: 2, unit: "sheet" }] }] }));
app.use("/api/sales-orders", createModuleRouter({ filename: "salesOrders.json", seed: [{ id: 1, orderNumber: "SO-0001", customer: "Northstar Fabrication", status: "confirmed", dueDate: "2026-09-18", lines: [{ productId: 1, quantity: 5 }] }] }));
app.use("/api/receipts", createModuleRouter({ filename: "receipts.json", seed: [] }));
app.use("/api/quality-inspections", createModuleRouter({ filename: "qualityInspections.json", seed: [{ id: 1, workOrderId: 1, inspectionType: "First article", status: "pending", result: "" }] }));
app.use("/api/traceability", createModuleRouter({ filename: "traceability.json", seed: [] }));
app.use("/api/users", createModuleRouter({ filename: "users.json", seed: [{ id: 1, name: "Operations Admin", email: "admin@global-shop.local", role: "admin", active: true }] }));
app.use("/api/tax-settings", createModuleRouter({ filename: "taxSettings.json", seed: [{ id: 1, name: "Standard rate", code: "STANDARD", rate: 0, active: true }] }));
app.use("/api/finite-schedule", createModuleRouter({ filename: "finiteSchedule.json", seed: [] }));
app.use("/api/outside-processes", createModuleRouter({ filename: "outsideProcesses.json", seed: [] }));
app.use("/api/mrp-plans", mrpRouter);
app.use("/api/barcodes", createModuleRouter({ filename: "barcodes.json", seed: [] }));
app.use("/api/ar-invoices", createModuleRouter({ filename: "arInvoices.json", seed: [] }));
app.use("/api/ar-payments", createModuleRouter({ filename: "arPayments.json", seed: [] }));
app.use("/api/ap-invoices", createModuleRouter({ filename: "apInvoices.json", seed: [] }));
app.use("/api/ap-payments", createModuleRouter({ filename: "apPayments.json", seed: [] }));
app.use("/api/gl-reports", createModuleRouter({ filename: "glReports.json", seed: [] }));
app.use("/api/payroll", createModuleRouter({ filename: "payroll.json", seed: [] }));
app.use("/api/assets", createModuleRouter({ filename: "assets.json", seed: [] }));
app.use("/api/cad-imports", createModuleRouter({ filename: "cadImports.json", seed: [] }));
app.use("/api/engineering-changes", createModuleRouter({ filename: "engineeringChanges.json", seed: [] }));
app.use("/api/nesting-runs", createModuleRouter({ filename: "nestingRuns.json", seed: [] }));
app.use("/api/product-configurations", createModuleRouter({ filename: "productConfigurations.json", seed: [] }));
app.use("/api/quotes", createModuleRouter({ filename: "quotes.json", seed: [] }));
app.use("/api/crm", createModuleRouter({ filename: "crm.json", seed: [] }));
app.use("/api/customer-portal", createModuleRouter({ filename: "customerPortal.json", seed: [] }));
app.use("/api/rfqs", createModuleRouter({ filename: "rfqs.json", seed: [] }));
app.use("/api/vendor-performance", createModuleRouter({ filename: "vendorPerformance.json", seed: [] }));
app.use("/api/vendor-portal", createModuleRouter({ filename: "vendorPortal.json", seed: [] }));
app.use("/api/ai-document-intake", createModuleRouter({ filename: "aiDocumentIntake.json", seed: [] }));
app.use("/api/edi", createModuleRouter({ filename: "edi.json", seed: [] }));
app.use("/api/bi-dashboards", createModuleRouter({ filename: "biDashboards.json", seed: [] }));

app.use(errorHandler);

// Enhanced continuous server listening execution block
const startServer = async () => {
  try {
    validateEnvironment();

    // Gracefully handle admin initialization checks without crashing the process
    await ensureAdminPassword().catch(err => {
      console.log("⚠️ Security Warning: Admin authentication initialization skipped. Proceeding anyway...");
    });
    
    // Hold the network port open continuously
    app.listen(PORT, "0.0.0.0", () => {
      console.log("🚀 =====================================================");
      console.log("🚀 GLOBAL SHOP CLONE CORE ENGINE ONLINE & ACTIVATED!");
      console.log(`🚀 Listening continuously for frontend data calls on port ${PORT}`);
      console.log("🚀 =====================================================");

      // Boot the autonomous labor clock accumulator background daemon
      startLaborAccumulatorDaemon();
    });

    // Trap uncaught routing pipeline crashes so the server process stays alive permanently
    process.on("uncaughtException", (err) => {
      console.error("❌ Active Request Error Caught safely inside pipeline:", err);
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Promise Rejection tracked:", reason);
    });

  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exitCode = 1;
  }
};

startServer();
