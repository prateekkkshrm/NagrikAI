-- Authenticated citizens need to create signed URLs for report evidence so
-- GroundTruth reviewers can inspect photos without making the bucket public.
DROP POLICY IF EXISTS "report_evidence_select_authenticated" ON storage.objects;
CREATE POLICY "report_evidence_select_authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'report-evidence');
