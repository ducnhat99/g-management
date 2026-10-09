-- CreateTable
CREATE TABLE "gold_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_label" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "gold_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshots" (
    "id" UUID NOT NULL,
    "gold_type_id" UUID NOT NULL,
    "buy_price" BIGINT NOT NULL,
    "sell_price" BIGINT NOT NULL,
    "source_updated_at" TIMESTAMPTZ(3) NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "gold_type_id" UUID NOT NULL,
    "quantity_chi" DECIMAL(10,3) NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "purchased_at" DATE NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gold_types_code_key" ON "gold_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "price_snapshots_gold_type_id_source_updated_at_key" ON "price_snapshots"("gold_type_id", "source_updated_at");

-- CreateIndex
CREATE INDEX "purchases_user_id_purchased_at_idx" ON "purchases"("user_id", "purchased_at" DESC);

-- AddForeignKey
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_gold_type_id_fkey" FOREIGN KEY ("gold_type_id") REFERENCES "gold_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_gold_type_id_fkey" FOREIGN KEY ("gold_type_id") REFERENCES "gold_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Added by hand: Prisma cannot express CHECK constraints.
ALTER TABLE "price_snapshots"
    ADD CONSTRAINT "price_snapshots_buy_price_positive" CHECK ("buy_price" > 0),
    ADD CONSTRAINT "price_snapshots_sell_price_positive" CHECK ("sell_price" > 0),
    ADD CONSTRAINT "price_snapshots_buy_lte_sell" CHECK ("buy_price" <= "sell_price");

ALTER TABLE "purchases"
    ADD CONSTRAINT "purchases_quantity_chi_positive" CHECK ("quantity_chi" > 0),
    ADD CONSTRAINT "purchases_unit_price_positive" CHECK ("unit_price" > 0);

-- Added by hand: row level security with no policies, so the Supabase anon/authenticated roles
-- can read nothing. Prisma connects as the table owner (postgres), which RLS does not restrict.
ALTER TABLE "gold_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchases" ENABLE ROW LEVEL SECURITY;
-- IF EXISTS: the shadow database used by `migrate dev` may not have this table.
ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
