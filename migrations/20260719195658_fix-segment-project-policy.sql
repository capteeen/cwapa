DROP POLICY transcript_segments_insert_own ON public.transcript_segments;

CREATE POLICY transcript_segments_insert_own ON public.transcript_segments FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id AND EXISTS (
  SELECT 1 FROM public.transcripts t
  WHERE t.id = transcript_segments.transcript_id
    AND t.project_id = transcript_segments.project_id
    AND t.user_id = (SELECT auth.uid())
));
