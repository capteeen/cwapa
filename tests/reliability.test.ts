import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../migrations/20260720100010_add-reliability-infrastructure.sql", import.meta.url),
  "utf8"
);

test("render jobs have durable queue, retry, and lease states", () => {
  for (const state of ["queued", "leased", "processing", "retrying", "succeeded", "failed", "cancelled"]) {
    assert.match(migration, new RegExp(`'${state}'`));
  }
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.match(migration, /lease_expires_at < now\(\)/);
  assert.match(migration, /attempt_count < job\.max_attempts/);
});

test("terminal failures and cancellations refund credits exactly once", () => {
  assert.match(migration, /IF NOT job\.credit_refunded THEN/g);
  assert.match(migration, /'render_refunded'/);
  assert.match(migration, /credits_available = credits_available \+ job\.credit_cost/);
  assert.match(migration, /credit_refunded = true/);
});

test("autosaves maintain drafts and append-only project versions", () => {
  assert.match(migration, /CREATE TABLE public\.project_drafts/);
  assert.match(migration, /CREATE TABLE public\.project_versions/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.save_project_draft/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.restore_project_version/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.claim_render_job/);
});
