CREATE TABLE public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  source_url text NOT NULL,
  platform text,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'processing', 'failed')),
  duration_seconds double precision NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  thumbnail_url text,
  language text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_text text NOT NULL,
  language text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transcript_segments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  transcript_id uuid NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  start_seconds double precision NOT NULL CHECK (start_seconds >= 0),
  end_seconds double precision NOT NULL CHECK (end_seconds > start_seconds),
  text text NOT NULL CHECK (char_length(text) > 0),
  UNIQUE (transcript_id, position)
);

CREATE INDEX folders_user_id_idx ON public.folders(user_id);
CREATE INDEX projects_user_id_idx ON public.projects(user_id);
CREATE INDEX projects_folder_id_idx ON public.projects(folder_id);
CREATE INDEX transcripts_user_id_idx ON public.transcripts(user_id);
CREATE INDEX transcript_segments_user_id_idx ON public.transcript_segments(user_id);
CREATE INDEX transcript_segments_project_position_idx ON public.transcript_segments(project_id, position);

CREATE TRIGGER folders_updated_at BEFORE UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER transcripts_updated_at BEFORE UPDATE ON public.transcripts
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY folders_select_own ON public.folders FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY folders_insert_own ON public.folders FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY folders_update_own ON public.folders FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY folders_delete_own ON public.folders FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY projects_select_own ON public.projects FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY projects_insert_own ON public.projects FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id AND (folder_id IS NULL OR EXISTS (
  SELECT 1 FROM public.folders f WHERE f.id = folder_id AND f.user_id = (SELECT auth.uid())
)));
CREATE POLICY projects_update_own ON public.projects FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id AND (folder_id IS NULL OR EXISTS (
  SELECT 1 FROM public.folders f WHERE f.id = folder_id AND f.user_id = (SELECT auth.uid())
)));
CREATE POLICY projects_delete_own ON public.projects FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY transcripts_select_own ON public.transcripts FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY transcripts_insert_own ON public.transcripts FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id AND EXISTS (
  SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = (SELECT auth.uid())
));
CREATE POLICY transcripts_update_own ON public.transcripts FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY transcripts_delete_own ON public.transcripts FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY transcript_segments_select_own ON public.transcript_segments FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY transcript_segments_insert_own ON public.transcript_segments FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id AND EXISTS (
  SELECT 1 FROM public.transcripts t
  WHERE t.id = transcript_id AND t.project_id = project_id AND t.user_id = (SELECT auth.uid())
));
CREATE POLICY transcript_segments_update_own ON public.transcript_segments FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY transcript_segments_delete_own ON public.transcript_segments FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.folders, public.projects, public.transcripts, public.transcript_segments TO authenticated;
GRANT UPDATE (name) ON public.folders TO authenticated;
GRANT UPDATE (folder_id, title, status, thumbnail_url, language) ON public.projects TO authenticated;
GRANT UPDATE (full_text, language) ON public.transcripts TO authenticated;
GRANT UPDATE (position, start_seconds, end_seconds, text) ON public.transcript_segments TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.transcript_segments_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.save_project(
  project_title text,
  project_source_url text,
  project_platform text,
  project_duration_seconds double precision,
  project_thumbnail_url text,
  transcript_language text,
  transcript_text text,
  transcript_segments jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_project_id uuid;
  new_transcript_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.projects (
    user_id, title, source_url, platform, duration_seconds, thumbnail_url, language
  ) VALUES (
    caller_id, project_title, project_source_url, project_platform,
    GREATEST(COALESCE(project_duration_seconds, 0), 0), project_thumbnail_url, transcript_language
  ) RETURNING id INTO new_project_id;

  INSERT INTO public.transcripts (project_id, user_id, full_text, language)
  VALUES (new_project_id, caller_id, COALESCE(transcript_text, ''), transcript_language)
  RETURNING id INTO new_transcript_id;

  INSERT INTO public.transcript_segments (
    project_id, transcript_id, user_id, position, start_seconds, end_seconds, text
  )
  SELECT
    new_project_id,
    new_transcript_id,
    caller_id,
    (entry.ordinality - 1)::integer,
    GREATEST(COALESCE((entry.value->>'start')::double precision, 0), 0),
    GREATEST(
      COALESCE((entry.value->>'end')::double precision, 0.001),
      GREATEST(COALESCE((entry.value->>'start')::double precision, 0), 0) + 0.001
    ),
    trim(entry.value->>'text')
  FROM jsonb_array_elements(COALESCE(transcript_segments, '[]'::jsonb)) WITH ORDINALITY AS entry(value, ordinality)
  WHERE trim(COALESCE(entry.value->>'text', '')) <> '';

  RETURN new_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_project(text, text, text, double precision, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_project(text, text, text, double precision, text, text, text, jsonb) TO authenticated;
