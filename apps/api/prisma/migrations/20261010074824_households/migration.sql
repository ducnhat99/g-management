-- Family portfolios: purchases now belong to a household shared by its members.

-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('owner', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "invite_status" AS ENUM ('pending', 'accepted', 'revoked');

-- CreateTable
CREATE TABLE "households" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL DEFAULT 'Gia đình',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "role" "member_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_invites" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "role" "member_role" NOT NULL,
    "status" "invite_status" NOT NULL DEFAULT 'pending',
    "auth_user_id" UUID,
    "invited_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "household_invites_pkey" PRIMARY KEY ("id")
);

-- Added by hand: add household_id as nullable, backfill, then make it required (10+ existing rows).
DROP INDEX "purchases_user_id_purchased_at_idx";
ALTER TABLE "purchases" ADD COLUMN "household_id" UUID;

-- Backfill: one household per user who already has purchases; that user becomes its owner.
-- The email comes from Supabase's auth.users, which the shadow database used by `migrate dev`
-- does not have (it has no purchases either, so the loop does nothing there).
DO $$
DECLARE
    r RECORD;
    new_household UUID;
    member_email TEXT;
BEGIN
    FOR r IN SELECT DISTINCT "user_id" FROM "purchases" LOOP
        new_household := gen_random_uuid();
        INSERT INTO "households" ("id", "updated_at") VALUES (new_household, CURRENT_TIMESTAMP);

        member_email := NULL;
        IF to_regclass('auth.users') IS NOT NULL THEN
            EXECUTE 'SELECT lower(email) FROM auth.users WHERE id = $1' INTO member_email USING r."user_id";
        END IF;

        INSERT INTO "household_members" ("id", "household_id", "user_id", "email", "role", "updated_at")
        VALUES (gen_random_uuid(), new_household, r."user_id", COALESCE(member_email, ''), 'owner', CURRENT_TIMESTAMP);

        UPDATE "purchases" SET "household_id" = new_household WHERE "user_id" = r."user_id";
    END LOOP;
END $$;

ALTER TABLE "purchases" ALTER COLUMN "household_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "household_members_user_id_key" ON "household_members"("user_id");

-- CreateIndex
CREATE INDEX "household_members_household_id_idx" ON "household_members"("household_id");

-- CreateIndex
CREATE INDEX "household_invites_email_status_idx" ON "household_invites"("email", "status");

-- CreateIndex
CREATE INDEX "household_invites_household_id_idx" ON "household_invites"("household_id");

-- CreateIndex
CREATE INDEX "purchases_household_id_purchased_at_idx" ON "purchases"("household_id", "purchased_at" DESC);

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Added by hand: CHECK constraints (Prisma ignores them, so they survive future migrations).
-- "One pending invite per email" and "one owner per household" are enforced in HouseholdService.
ALTER TABLE "household_invites"
    ADD CONSTRAINT "household_invites_role_not_owner" CHECK ("role" <> 'owner'),
    ADD CONSTRAINT "household_invites_email_lowercase" CHECK ("email" = lower("email"));

-- Added by hand: row level security with no policies, as for every other table.
ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "household_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "household_invites" ENABLE ROW LEVEL SECURITY;
