ALTER TABLE public.installments
ADD COLUMN short_id text;

CREATE OR REPLACE FUNCTION public.assign_installment_short_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  candidate text;
BEGIN
  IF NEW.short_id IS NULL THEN
    LOOP
      candidate := translate(encode(gen_random_bytes(6), 'base64'), '+/', '-_');
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.installments
        WHERE short_id = candidate
          AND id <> NEW.id
      );
    END LOOP;
    NEW.short_id := candidate;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER set_installment_short_id
BEFORE INSERT OR UPDATE OF short_id ON public.installments
FOR EACH ROW
EXECUTE FUNCTION public.assign_installment_short_id();

REVOKE ALL ON FUNCTION public.assign_installment_short_id() FROM PUBLIC, anon, authenticated;

UPDATE public.installments
SET short_id = NULL
WHERE short_id IS NULL;

ALTER TABLE public.installments
ALTER COLUMN short_id SET NOT NULL;

ALTER TABLE public.installments
ADD CONSTRAINT installments_short_id_format
CHECK (short_id ~ '^[A-Za-z0-9_-]{8}$');

CREATE UNIQUE INDEX installments_short_id_unique
ON public.installments (short_id);
