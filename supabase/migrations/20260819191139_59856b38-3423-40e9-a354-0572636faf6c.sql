ALTER TABLE public.organisations ALTER COLUMN plan SET DEFAULT 'unpaid';
ALTER TABLE public.organisations ALTER COLUMN seats_purchased SET DEFAULT 10;

DROP POLICY IF EXISTS "authenticated create org" ON public.organisations;
CREATE POLICY "authenticated create org"
ON public.organisations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND plan = 'unpaid'
  AND seats_purchased = 10
);