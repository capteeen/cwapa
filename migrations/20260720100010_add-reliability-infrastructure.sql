CREATE TABLE public.usage_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_available integer NOT NULL DEFAULT 10 CHECK (credits_available >= 0),
  lifetime_credits_used integer NOT NULL DEFAULT 0 CHECK (lifetime_credits_used >= 0),
  lifetime_credits_refunded integer NOT NULL DEFAULT 0 CHECK (lifetime_credits_refunded >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 160),
  title text NOT NULL DEFAULT 'Caption render' CHECK (char_length(title) BETWEEN 1 AND 180),
  source_url text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'leased', 'processing', 'retrying', 'succeeded', 'failed', 'cancelled')),
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts smallint NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 8),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  worker_id text,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_url text,
  output_key text,
  output_bytes bigint CHECK (output_bytes IS NULL OR output_bytes >= 0),
  error_code text,
  error_message text,
  credit_cost smallint NOT NULL DEFAULT 1 CHECK (credit_cost > 0),
  credit_refunded boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE public.render_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.render_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number smallint NOT NULL CHECK (attempt_number > 0),
  worker_id text,
  status text NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'abandoned')),
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (job_id, attempt_number)
);

CREATE TABLE public.usage_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.render_jobs(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('render_reserved', 'render_refunded', 'manual_adjustment')),
  credit_delta integer NOT NULL CHECK (credit_delta <> 0),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_drafts (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  source_revision integer NOT NULL CHECK (source_revision > 0),
  reason text NOT NULL DEFAULT 'autosave' CHECK (reason IN ('autosave', 'manual', 'before_restore', 'render')),
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_number)
);

CREATE INDEX render_jobs_user_created_idx ON public.render_jobs(user_id, created_at DESC);
CREATE INDEX render_jobs_queue_idx ON public.render_jobs(status, next_attempt_at, created_at)
WHERE status IN ('queued', 'retrying', 'leased', 'processing');
CREATE INDEX render_attempts_job_idx ON public.render_attempts(job_id, attempt_number DESC);
CREATE INDEX usage_ledger_user_created_idx ON public.usage_ledger(user_id, created_at DESC);
CREATE INDEX project_drafts_user_idx ON public.project_drafts(user_id);
CREATE INDEX project_versions_project_created_idx ON public.project_versions(project_id, created_at DESC);
CREATE INDEX project_versions_user_created_idx ON public.project_versions(user_id, created_at DESC);

CREATE TRIGGER usage_accounts_updated_at BEFORE UPDATE ON public.usage_accounts
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER render_jobs_updated_at BEFORE UPDATE ON public.render_jobs
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.usage_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_accounts_select_own ON public.usage_accounts FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY render_jobs_select_own ON public.render_jobs FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY render_attempts_select_own ON public.render_attempts FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY usage_ledger_select_own ON public.usage_ledger FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY project_drafts_select_own ON public.project_drafts FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY project_versions_select_own ON public.project_versions FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.usage_accounts, public.render_jobs, public.render_attempts,
  public.usage_ledger, public.project_drafts, public.project_versions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.usage_accounts, public.render_jobs,
  public.render_attempts, public.usage_ledger, public.project_drafts,
  public.project_versions FROM authenticated;
GRANT SELECT ON public.usage_accounts, public.render_jobs, public.render_attempts,
  public.usage_ledger, public.project_drafts, public.project_versions TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_render_job(
  p_source_url text,
  p_project_id uuid,
  p_title text,
  p_style jsonb,
  p_segments jsonb,
  p_idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  existing_id uuid;
  new_job_id uuid;
  available integer;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF trim(COALESCE(p_source_url, '')) = '' THEN RAISE EXCEPTION 'Source URL required'; END IF;
  IF jsonb_typeof(COALESCE(p_segments, '[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(p_segments, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Timed caption segments required';
  END IF;
  IF p_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = caller_id
  ) THEN RAISE EXCEPTION 'Project not found'; END IF;

  SELECT id INTO existing_id FROM public.render_jobs
  WHERE user_id = caller_id AND idempotency_key = p_idempotency_key;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;

  INSERT INTO public.usage_accounts (user_id) VALUES (caller_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT credits_available INTO available FROM public.usage_accounts
  WHERE user_id = caller_id FOR UPDATE;
  SELECT id INTO existing_id FROM public.render_jobs
  WHERE user_id = caller_id AND idempotency_key = p_idempotency_key;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
  IF available < 1 THEN RAISE EXCEPTION 'No render credits available'; END IF;

  UPDATE public.usage_accounts SET
    credits_available = credits_available - 1,
    lifetime_credits_used = lifetime_credits_used + 1
  WHERE user_id = caller_id;

  INSERT INTO public.render_jobs (
    user_id, project_id, idempotency_key, title, source_url, style, segments
  ) VALUES (
    caller_id, p_project_id, p_idempotency_key,
    COALESCE(NULLIF(trim(p_title), ''), 'Caption render'), trim(p_source_url),
    COALESCE(p_style, '{}'::jsonb), COALESCE(p_segments, '[]'::jsonb)
  ) RETURNING id INTO new_job_id;

  INSERT INTO public.usage_ledger (user_id, job_id, kind, credit_delta, description)
  VALUES (caller_id, new_job_id, 'render_reserved', -1, 'Caption render reserved');
  RETURN new_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_render_job(p_worker_id text, p_lease_seconds integer DEFAULT 1200)
RETURNS SETOF public.render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE claimed_id uuid;
BEGIN
  SELECT id INTO claimed_id
  FROM public.render_jobs
  WHERE (
    status IN ('queued', 'retrying') AND next_attempt_at <= now()
  ) OR (
    status IN ('leased', 'processing') AND lease_expires_at < now()
  )
  ORDER BY next_attempt_at, created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;
  IF claimed_id IS NULL THEN RETURN; END IF;

  UPDATE public.render_attempts SET status = 'abandoned', finished_at = now(),
    error_code = 'LEASE_EXPIRED', error_message = 'Worker lease expired; job resumed on another worker.'
  WHERE job_id = claimed_id AND status = 'started';

  UPDATE public.render_jobs SET
    status = 'leased', worker_id = p_worker_id,
    attempt_count = attempt_count + 1,
    lease_expires_at = now() + make_interval(secs => LEAST(GREATEST(p_lease_seconds, 60), 3600)),
    started_at = COALESCE(started_at, now()), progress = 5,
    error_code = NULL, error_message = NULL
  WHERE id = claimed_id;

  INSERT INTO public.render_attempts (job_id, user_id, attempt_number, worker_id, status)
  SELECT id, user_id, attempt_count, p_worker_id, 'started'
  FROM public.render_jobs WHERE id = claimed_id
  ON CONFLICT (job_id, attempt_number) DO UPDATE SET
    worker_id = EXCLUDED.worker_id, status = 'started', started_at = now(), finished_at = NULL;

  RETURN QUERY SELECT * FROM public.render_jobs WHERE id = claimed_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_render_progress(p_job_id uuid, p_worker_id text, p_progress integer)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  UPDATE public.render_jobs SET
    status = 'processing', progress = LEAST(GREATEST(p_progress, 5), 95),
    lease_expires_at = now() + interval '20 minutes'
  WHERE id = p_job_id AND worker_id = p_worker_id AND status IN ('leased', 'processing')
  RETURNING true;
$$;

CREATE OR REPLACE FUNCTION public.complete_render_job(
  p_job_id uuid, p_worker_id text, p_output_url text, p_output_key text, p_output_bytes bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE changed boolean := false;
BEGIN
  UPDATE public.render_jobs SET
    status = 'succeeded', progress = 100, output_url = p_output_url,
    output_key = p_output_key, output_bytes = p_output_bytes,
    lease_expires_at = NULL, completed_at = now()
  WHERE id = p_job_id AND worker_id = p_worker_id AND status IN ('leased', 'processing')
  RETURNING true INTO changed;
  IF changed THEN
    UPDATE public.render_attempts SET status = 'succeeded', finished_at = now()
    WHERE job_id = p_job_id AND attempt_number = (
      SELECT attempt_count FROM public.render_jobs WHERE id = p_job_id
    );
  END IF;
  RETURN COALESCE(changed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_render_job(
  p_job_id uuid, p_worker_id text, p_error_code text, p_error_message text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE job public.render_jobs%ROWTYPE;
DECLARE final_state text;
BEGIN
  SELECT * INTO job FROM public.render_jobs
  WHERE id = p_job_id AND worker_id = p_worker_id FOR UPDATE;
  IF job.id IS NULL OR job.status NOT IN ('leased', 'processing') THEN RETURN 'ignored'; END IF;

  UPDATE public.render_attempts SET status = 'failed', error_code = p_error_code,
    error_message = left(p_error_message, 1000), finished_at = now()
  WHERE job_id = job.id AND attempt_number = job.attempt_count;

  IF job.attempt_count < job.max_attempts THEN
    final_state := 'retrying';
    UPDATE public.render_jobs SET status = 'retrying', progress = 0,
      next_attempt_at = now() + make_interval(secs => LEAST(300, 15 * (2 ^ (job.attempt_count - 1))::integer)),
      lease_expires_at = NULL, worker_id = NULL,
      error_code = p_error_code, error_message = left(p_error_message, 1000)
    WHERE id = job.id;
  ELSE
    final_state := 'failed';
    UPDATE public.render_jobs SET status = 'failed', progress = 0,
      lease_expires_at = NULL, completed_at = now(),
      error_code = p_error_code, error_message = left(p_error_message, 1000),
      credit_refunded = true
    WHERE id = job.id;
    IF NOT job.credit_refunded THEN
      UPDATE public.usage_accounts SET
        credits_available = credits_available + job.credit_cost,
        lifetime_credits_refunded = lifetime_credits_refunded + job.credit_cost
      WHERE user_id = job.user_id;
      INSERT INTO public.usage_ledger (user_id, job_id, kind, credit_delta, description)
      VALUES (job.user_id, job.id, 'render_refunded', job.credit_cost, 'Failed render automatically refunded');
    END IF;
  END IF;
  RETURN final_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_render_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE caller_id uuid := auth.uid();
DECLARE job public.render_jobs%ROWTYPE;
BEGIN
  SELECT * INTO job FROM public.render_jobs WHERE id = p_job_id AND user_id = caller_id FOR UPDATE;
  IF job.id IS NULL OR job.status NOT IN ('queued', 'retrying') THEN RETURN false; END IF;
  UPDATE public.render_jobs SET status = 'cancelled', completed_at = now(), credit_refunded = true
  WHERE id = job.id;
  IF NOT job.credit_refunded THEN
    UPDATE public.usage_accounts SET credits_available = credits_available + job.credit_cost,
      lifetime_credits_refunded = lifetime_credits_refunded + job.credit_cost WHERE user_id = caller_id;
    INSERT INTO public.usage_ledger (user_id, job_id, kind, credit_delta, description)
    VALUES (caller_id, job.id, 'render_refunded', job.credit_cost, 'Cancelled render refunded');
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_project_draft(
  p_project_id uuid, p_segments jsonb, p_style jsonb,
  p_reason text DEFAULT 'autosave', p_create_version boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE caller_id uuid := auth.uid();
DECLARE next_revision integer;
DECLARE next_version integer;
BEGIN
  IF caller_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = caller_id
  ) THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF jsonb_typeof(COALESCE(p_segments, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Invalid segments'; END IF;

  INSERT INTO public.project_drafts (project_id, user_id, revision, segments, style, saved_at)
  VALUES (p_project_id, caller_id, 1, COALESCE(p_segments, '[]'::jsonb), COALESCE(p_style, '{}'::jsonb), now())
  ON CONFLICT (project_id) DO UPDATE SET
    revision = public.project_drafts.revision + 1,
    segments = EXCLUDED.segments, style = EXCLUDED.style, saved_at = now()
  RETURNING revision INTO next_revision;

  IF p_create_version THEN
    SELECT COALESCE(max(version_number), 0) + 1 INTO next_version
    FROM public.project_versions WHERE project_id = p_project_id;
    INSERT INTO public.project_versions (
      project_id, user_id, version_number, source_revision, reason, segments, style
    ) VALUES (
      p_project_id, caller_id, next_version, next_revision,
      CASE WHEN p_reason IN ('autosave','manual','before_restore','render') THEN p_reason ELSE 'manual' END,
      COALESCE(p_segments, '[]'::jsonb), COALESCE(p_style, '{}'::jsonb)
    );
  END IF;
  RETURN next_revision;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_project_version(p_version_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE caller_id uuid := auth.uid();
DECLARE chosen public.project_versions%ROWTYPE;
DECLARE current_draft public.project_drafts%ROWTYPE;
DECLARE transcript_uuid uuid;
DECLARE next_version integer;
DECLARE next_revision integer;
BEGIN
  SELECT * INTO chosen FROM public.project_versions
  WHERE id = p_version_id AND user_id = caller_id;
  IF chosen.id IS NULL THEN RAISE EXCEPTION 'Version not found'; END IF;

  SELECT * INTO current_draft FROM public.project_drafts
  WHERE project_id = chosen.project_id AND user_id = caller_id FOR UPDATE;
  IF current_draft.project_id IS NOT NULL THEN
    SELECT COALESCE(max(version_number), 0) + 1 INTO next_version
    FROM public.project_versions WHERE project_id = chosen.project_id;
    INSERT INTO public.project_versions (
      project_id, user_id, version_number, source_revision, reason, segments, style
    ) VALUES (
      chosen.project_id, caller_id, next_version, current_draft.revision,
      'before_restore', current_draft.segments, current_draft.style
    );
  END IF;

  INSERT INTO public.project_drafts (project_id, user_id, revision, segments, style, saved_at)
  VALUES (chosen.project_id, caller_id, 1, chosen.segments, chosen.style, now())
  ON CONFLICT (project_id) DO UPDATE SET
    revision = public.project_drafts.revision + 1,
    segments = EXCLUDED.segments, style = EXCLUDED.style, saved_at = now()
  RETURNING revision INTO next_revision;

  SELECT id INTO transcript_uuid FROM public.transcripts
  WHERE project_id = chosen.project_id AND user_id = caller_id;
  IF transcript_uuid IS NOT NULL THEN
    UPDATE public.transcripts SET full_text = (
      SELECT string_agg(trim(value->>'text'), ' ' ORDER BY ordinality)
      FROM jsonb_array_elements(chosen.segments) WITH ORDINALITY
    ) WHERE id = transcript_uuid;
    DELETE FROM public.transcript_segments WHERE transcript_id = transcript_uuid;
    INSERT INTO public.transcript_segments (
      project_id, transcript_id, user_id, position, start_seconds, end_seconds, text
    )
    SELECT chosen.project_id, transcript_uuid, caller_id, (entry.ordinality - 1)::integer,
      GREATEST((entry.value->>'start')::double precision, 0),
      GREATEST((entry.value->>'end')::double precision, (entry.value->>'start')::double precision + 0.001),
      trim(entry.value->>'text')
    FROM jsonb_array_elements(chosen.segments) WITH ORDINALITY AS entry(value, ordinality)
    WHERE trim(COALESCE(entry.value->>'text', '')) <> '';
  END IF;
  RETURN next_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_render_job(text, uuid, text, jsonb, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_render_job(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_project_draft(uuid, jsonb, jsonb, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_project_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_render_job(text, uuid, text, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_render_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_project_draft(uuid, jsonb, jsonb, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_project_version(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_render_job(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_render_progress(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_render_job(uuid, text, text, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_render_job(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
