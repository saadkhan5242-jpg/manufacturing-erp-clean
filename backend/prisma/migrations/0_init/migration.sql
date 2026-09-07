-- CreateTable
CREATE TABLE "sales_orders" (
    "id" BIGSERIAL NOT NULL,
    "order_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "product_id" BIGINT,
    "quantity_ordered" DECIMAL(14,4) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "required_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" BIGSERIAL NOT NULL,
    "order_number" TEXT NOT NULL,
    "part_number" TEXT NOT NULL,
    "item_id" BIGINT,
    "sales_order_id" BIGINT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "quantity_ordered" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "quantity_completed" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "due_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_routing" (
    "id" BIGSERIAL NOT NULL,
    "work_order_id" BIGINT NOT NULL,
    "work_center_code" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "estimated_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "actual_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Pending',

    CONSTRAINT "job_routing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_transactions" (
    "id" BIGSERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "work_order_id" BIGINT NOT NULL,
    "routing_step_id" BIGINT NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" TIMESTAMPTZ(6),
    "setup_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "run_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pieces_produced" INTEGER NOT NULL DEFAULT 0,
    "pieces_scrapped" INTEGER NOT NULL DEFAULT 0,
    "labor_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overhead_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wip_ledger" (
    "id" BIGSERIAL NOT NULL,
    "work_order_id" BIGINT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reference" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wip_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_centers" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labor_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "machine_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overhead_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" TEXT NOT NULL,
    "work_order_id" BIGINT NOT NULL,
    "target_ship_date" DATE NOT NULL,
    "actual_ship_date" DATE,
    "quantity_shipped" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "carrier" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_order_number_key" ON "sales_orders"("order_number");
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");
CREATE INDEX "sales_orders_required_date_idx" ON "sales_orders"("required_date");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_order_number_key" ON "work_orders"("order_number");
CREATE INDEX "work_orders_sales_order_id_idx" ON "work_orders"("sales_order_id");

-- CreateIndex
CREATE INDEX "job_routing_work_center_code_idx" ON "job_routing"("work_center_code");
CREATE UNIQUE INDEX "job_routing_work_order_id_sequence_number_key" ON "job_routing"("work_order_id", "sequence_number");

-- CreateIndex
CREATE INDEX "labor_transactions_work_order_id_idx" ON "labor_transactions"("work_order_id");
CREATE INDEX "labor_transactions_routing_step_id_idx" ON "labor_transactions"("routing_step_id");

-- CreateIndex
CREATE INDEX "wip_ledger_work_order_id_idx" ON "wip_ledger"("work_order_id");
CREATE INDEX "wip_ledger_entry_type_idx" ON "wip_ledger"("entry_type");

-- CreateIndex
CREATE UNIQUE INDEX "work_centers_code_key" ON "work_centers"("code");

-- CreateIndex
CREATE INDEX "shipments_target_ship_date_idx" ON "shipments"("target_ship_date");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_routing" ADD CONSTRAINT "job_routing_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_transactions" ADD CONSTRAINT "labor_transactions_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_transactions" ADD CONSTRAINT "labor_transactions_routing_step_id_fkey" FOREIGN KEY ("routing_step_id") REFERENCES "job_routing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_ledger" ADD CONSTRAINT "wip_ledger_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
