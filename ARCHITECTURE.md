# ERP Omega-Prime Architecture & Operations Guide

## 1. System Overview

The **Manufacturing ERP Platform** is a modular, event-driven, production-ready manufacturing execution & enterprise resource planning platform.

```mermaid
graph TD
    subgraph Client ["Client & Edge Layer"]
        WEB[Web App (React 19 + Vite)]
        DESK[Electron Desktop Client]
        INGRESS[Nginx API Gateway / Ingress Router]
    end

    subgraph CoreServices ["Backend Modular Microservices"]
        AUTH_SVC[Auth & Identity Service]
        SFDC_SVC[Shop Floor Data Collection (SFDC)]
        BOM_SFC[BOM & Shop Floor Control]
        INV_SVC[Inventory & Stock Ledger]
        FIN_SVC[Accounting & WIP Ledger]
        AI_SVC[ForgeLogic AI Intelligence Engine]
    end

    subgraph EventBusLayer ["Event-Driven Messaging Spine"]
        BUS[ErpEventBus / RabbitMQ / Kafka]
    end

    subgraph DataStorage ["Data & Cache Layer"]
        PG[(PostgreSQL - Neon Cloud / Local 16)]
        REDIS[(Redis In-Memory Cache)]
        PRISMA[(Prisma ORM Layer)]
    end

    WEB --> INGRESS
    DESK --> INGRESS
    INGRESS --> AUTH_SVC
    INGRESS --> SFDC_SVC
    INGRESS --> BOM_SFC
    INGRESS --> INV_SVC
    INGRESS --> FIN_SVC
    INGRESS --> AI_SVC

    SFDC_SVC --> BUS
    BOM_SFC --> BUS
    INV_SVC --> BUS

    BUS --> FIN_SVC
    BUS --> AI_SVC

    CoreServices --> PRISMA
    PRISMA --> PG
    CoreServices --> REDIS
```

---

## 2. Key Architecture Features

1. **Modular Architecture & Event Bus**:
   - `ErpEventBus` (`backend/services/eventBus.js`) decouples domain contexts.
   - Events like `WORK_ORDER_CREATED`, `LABOR_LOGGED`, and `INVENTORY_ADJUSTED` automatically trigger dependent ledger accounting actions asynchronously.

2. **Strict Validation & Type Safety**:
   - Zod schemas in `backend/validators/schemas.js` enforce boundary safety on all requests.
   - Central TypeScript definitions in `backend/types/erpTypes.ts` and `frontend/src/types/erpTypes.ts`.

3. **Containerization & Orchestration**:
   - Production Dockerfiles in `/backend/Dockerfile` and `/frontend/Dockerfile`.
   - `docker-compose.yml` for zero-setup local dev orchestration (PostgreSQL + Redis + Backend + Frontend).
   - Enterprise Kubernetes manifests in `/k8s/` (`backend-deployment.yaml`, `frontend-deployment.yaml`, `ingress.yaml`).

4. **Observability & OpenAPI Docs**:
   - Structured Pino JSON logger (`backend/utils/logger.js`).
   - OpenTelemetry & Prometheus-ready metrics at `/api/health/metrics`.
   - Swagger / OpenAPI UI documentation served live at `/api-docs`.

---

## 3. Production Deployment & Scaling

### Running with Docker Compose:
```bash
docker-compose up --build -d
```

### Deploying to Kubernetes:
```bash
kubectl apply -f k8s/
```
