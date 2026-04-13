DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HolidayAudience') THEN
    CREATE TYPE "HolidayAudience" AS ENUM ('ALL', 'STAFF', 'STUDENT');
  END IF;
END
$$;

ALTER TABLE "holidays"
  ADD COLUMN IF NOT EXISTS "audience" "HolidayAudience" NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS "all_classes" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS "holiday_class_targets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "holiday_id" UUID NOT NULL REFERENCES "holidays"("id") ON DELETE CASCADE,
  "class_id" UUID NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "holiday_class_targets_holiday_id_class_id_key" UNIQUE ("holiday_id", "class_id")
);

CREATE INDEX IF NOT EXISTS "holiday_class_targets_school_id_class_id_idx"
  ON "holiday_class_targets" ("school_id", "class_id");

CREATE INDEX IF NOT EXISTS "holidays_school_id_audience_start_date_idx"
  ON "holidays" ("school_id", "audience", "start_date");
