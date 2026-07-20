# Reliability infrastructure

This branch moves caption rendering from a synchronous request into a durable,
database-backed job lifecycle.

## Runtime model

- `render_jobs` stores the resumable state, lease, retry schedule, progress,
  output, and terminal error.
- `render_attempts` is an append-only audit trail for every worker attempt.
- A worker claims one job with `FOR UPDATE SKIP LOCKED`. Expired leases are
  recoverable after a process or deployment interruption.
- Failed attempts use exponential backoff. A terminal failure refunds the
  reserved credit once through an atomic database function.
- Finished MP4s are uploaded to the private InsForge `renders` bucket. The app
  proxies authenticated downloads instead of exposing storage keys.
- `project_drafts` keeps the latest autosave. `project_versions` stores periodic
  restorable snapshots and creates a safety snapshot before every restore.

## Required deployment configuration

1. Apply `migrations/20260720100010_add-reliability-infrastructure.sql` through
   the InsForge migration workflow.
2. Create a private storage bucket named `renders`.
3. Set server-only `INSFORGE_URL` and `INSFORGE_API_KEY` variables on Railway.
4. Leave `RENDER_WORKER_ENABLED=true` (or unset). Set it to `false` only when a
   dedicated external worker owns job processing.

The migration and backend configuration are intentionally not applied from this
branch while other work is in flight. No production state changes are required
to review the code.
