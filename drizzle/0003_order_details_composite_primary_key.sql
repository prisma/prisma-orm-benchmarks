-- Normalize order_details to composite primary key on (order_id, product_id)
-- and remove the surrogate id column if present.

-- If duplicate (order_id, product_id) pairs exist, keep a single row.
DELETE FROM "order_details" a
USING "order_details" b
WHERE a."order_id" = b."order_id"
  AND a."product_id" = b."product_id"
  AND a.ctid < b.ctid;
--> statement-breakpoint
DO $$
DECLARE
  pk_name text;
  pk_columns text[];
BEGIN
  SELECT c.conname, array_agg(a.attname ORDER BY u.ordinality)
  INTO pk_name, pk_columns
  FROM pg_constraint c
  JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ordinality) ON true
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum = u.attnum
  WHERE c.conrelid = 'order_details'::regclass
    AND c.contype = 'p'
  GROUP BY c.conname;

  IF pk_name IS NOT NULL AND pk_columns <> ARRAY['order_id', 'product_id'] THEN
    EXECUTE format('ALTER TABLE "order_details" DROP CONSTRAINT %I', pk_name);
    pk_name := NULL;
  END IF;

  IF pk_name IS NULL THEN
    ALTER TABLE "order_details"
      ADD CONSTRAINT "order_details_pkey" PRIMARY KEY ("order_id", "product_id");
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "order_details" DROP COLUMN IF EXISTS "id";
--> statement-breakpoint
DROP SEQUENCE IF EXISTS "order_details_id_seq";
