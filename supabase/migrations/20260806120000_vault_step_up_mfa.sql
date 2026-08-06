-- Step-up authentication for the document vault.
--
-- The vault holds passport and ID scans — identity-theft-grade data. A stolen
-- password alone must not open it. These policies are RESTRICTIVE: they AND
-- with the existing ownership policies, so ownership is still required and
-- nothing below weakens what already exists.
--
-- aal2 = the session has completed a second factor (TOTP) via Supabase MFA.
-- Consequences, stated plainly:
--   * Users MUST enrol MFA before their first vault upload. The vault UI
--     walks them through it (see VaultStepUp in record.vault.tsx).
--   * Everything else in the app stays aal1 — day counts and the calculator
--     are not worth an MFA prompt. Only the vault steps up.
--   * Supabase requires an aal2 session to unenrol a factor, so a user
--     cannot strand their own documents by removing MFA at aal1.

-- Table: metadata rows (document type, expiry, storage path).
CREATE POLICY "vault requires second factor"
  ON public.documents
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2')
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2');

-- Storage: the actual files. Scoped to the documents bucket only, so other
-- buckets (present or future) are untouched.
CREATE POLICY "vault files require second factor"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (bucket_id <> 'documents' OR (SELECT auth.jwt()->>'aal') = 'aal2')
  WITH CHECK (bucket_id <> 'documents' OR (SELECT auth.jwt()->>'aal') = 'aal2');

-- Note: delete_my_account() is SECURITY DEFINER and unaffected — account
-- deletion still works regardless of assurance level, which is correct:
-- erasure must never be blocked by a lost authenticator. Document files are
-- removed inside that function, not through these policies.
