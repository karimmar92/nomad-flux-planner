GRANT SELECT ON public.waitlist TO authenticated;
GRANT SELECT ON public.radar_waitlist TO authenticated;

CREATE POLICY "Admins can read waitlist"
  ON public.waitlist FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read radar waitlist"
  ON public.radar_waitlist FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));