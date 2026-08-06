ALTER TABLE public.waitlist DROP CONSTRAINT IF EXISTS waitlist_email_feature_city_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_feature_city_uniq
  ON public.waitlist (lower(email), feature, coalesce(city_id, ''));