CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  headline text NOT NULL CHECK (char_length(btrim(headline)) BETWEEN 3 AND 80),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 20 AND 600),
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 60),
  author_role text CHECK (author_role IS NULL OR char_length(btrim(author_role)) <= 60),
  country_code text CHECK (country_code IS NULL OR char_length(country_code) = 2),
  abbreviated boolean NOT NULL DEFAULT false,
  plan_at_review text NOT NULL DEFAULT 'unknown',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  featured boolean NOT NULL DEFAULT false,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Paid plans only. Kept as a SECURITY DEFINER helper so the policy does not
-- depend on the caller being able to read their own profile row directly.
CREATE OR REPLACE FUNCTION public.has_paid_plan(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND plan IN ('starter','pro','teams','founding_lifetime')
  )
$$;

REVOKE ALL ON FUNCTION public.has_paid_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_paid_plan(uuid) TO authenticated, service_role;

CREATE POLICY "Approved reviews are public"
  ON public.reviews FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Authors can read their own review"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read every review"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Paying customers can write one review"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_paid_plan(auth.uid()));

CREATE POLICY "Authors can edit their own review"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can moderate reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors can delete their own review"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Moderation state is never client-writable. Without this an author could
-- simply set status = 'approved' on their own row and publish themselves.
CREATE OR REPLACE FUNCTION public.guard_review_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.featured := false;
    NEW.review_note := NULL;
    RETURN NEW;
  END IF;

  -- An edit by the author sends the review back for re-approval.
  NEW.status := 'pending';
  NEW.featured := OLD.featured AND false;
  NEW.review_note := OLD.review_note;
  NEW.user_id := OLD.user_id;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_review_moderation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_reviews_moderation
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_review_moderation();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX reviews_public_idx ON public.reviews (status, featured DESC, rating DESC, created_at DESC);