// Tests for the reference server: validation, tokens, duplicate handling,
// configuration freezing, and static serving. Run with: npm test

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { startServer } from "../server/server.js";
import * as E from "../src/engine.js";
import { DEFAULT_STUDY_CONFIG, cloneConfig } from "../src/study-config.js";

const SUBMIT = "submit-token-for-tests-0123456789";
const ADMIN = "admin-token-for-tests-0123456789";

let server;
let base;
let dataDir;

function researchConfig() {
  const c = cloneConfig(DEFAULT_STUDY_CONFIG);
  c.mode = "research";
  c.studyVersion = "1.0.0";
  c.storage = { adapter: "remote-endpoint", endpointUrl: "http://127.0.0.1", submitToken: SUBMIT };
  for (const k of Object.keys(c.consent)) {
    if (typeof c.consent[k] === "string") c.consent[k] = c.consent[k].replace(/\[[^\]]*\]/g, "filled");
  }
  return c;
}

function researchRecord(overrides = {}) {
  const cfg = researchConfig();
  const s = E.createSession();
  E.begin(s);
  E.submitEligibility(s, cfg, { ageCategory: "age_16", meetsCriteria: true });
  E.giveAssent(s, cfg);
  E.continueScenario(s);
  E.confirmVerificationDisplayed(s);
  E.initialDecision(s, "start");
  E.simulationComplete(s);
  E.idDecision(s, "continue");
  E.beginQuestionnaire(s);
  E.submitQuestionnaire(s, { risk_exposure: "4" });
  E.markSubmitted(s);
  return { ...E.buildRecord(s, cfg), ...overrides };
}

async function api(pathname, { method = "GET", body, submit, admin } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (submit) headers["X-Study-Token"] = submit;
  if (admin) headers.Authorization = `Bearer ${admin}`;
  const res = await fetch(base + pathname, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, headers: res.headers };
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agecheck-test-"));
  server = await startServer({ port: 0, host: "127.0.0.1", submitToken: SUBMIT, adminToken: ADMIN, dataDir, log: () => {} });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("static serving", () => {
  test("serves the app with security headers and no camera or microphone permission", async () => {
    const res = await fetch(base + "/");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("permissions-policy"), /camera=\(\)/);
    assert.match(res.headers.get("permissions-policy"), /microphone=\(\)/);
    assert.ok(res.headers.get("content-security-policy").includes("default-src 'self'"));
    const html = await res.text();
    assert.ok(html.includes("AgeCheck Study"));
    assert.ok(!html.includes('type="file"'));
  });

  test("does not serve files outside the allow list", async () => {
    for (const p of ["/package.json", "/server/server.js", "/.git/config", "/tests/engine.test.js", "/../package.json"]) {
      const res = await fetch(base + p);
      assert.equal(res.status, 404, p);
    }
  });

  test("study.config.json is 404 until a configuration is deployed", async () => {
    const res = await fetch(base + "/study.config.json");
    assert.equal(res.status, 404);
  });
});

describe("submissions", () => {
  test("rejects a missing or wrong study token", async () => {
    assert.equal((await api("/api/submit", { method: "POST", body: researchRecord() })).status, 401);
    assert.equal((await api("/api/submit", { method: "POST", body: researchRecord(), submit: "wrong" })).status, 401);
  });

  test("rejects records that do not match the data dictionary", async () => {
    const bad = researchRecord({ condition: "unknown", extra_field: "x" });
    const r = await api("/api/submit", { method: "POST", body: bad, submit: SUBMIT });
    assert.equal(r.status, 422);
    assert.ok(r.data.problems.some((p) => p.includes("condition")));
    assert.ok(r.data.problems.some((p) => p.includes("extra_field")));
  });

  test("rejects demo records on the research endpoint", async () => {
    const r = await api("/api/submit", { method: "POST", body: researchRecord({ record_kind: "synthetic_demo" }), submit: SUBMIT });
    assert.equal(r.status, 422);
  });

  test("accepts a valid record once and treats a resend as a duplicate, not a second record", async () => {
    const rec = researchRecord();
    const first = await api("/api/submit", { method: "POST", body: rec, submit: SUBMIT });
    assert.equal(first.status, 200);
    assert.equal(first.data.duplicate, false);
    const second = await api("/api/submit", { method: "POST", body: rec, submit: SUBMIT });
    assert.equal(second.status, 200);
    assert.equal(second.data.duplicate, true);
    const list = await api("/api/admin/records", { admin: ADMIN });
    assert.equal(list.data.records.filter((r) => r.response_id === rec.response_id).length, 1);
  });

  test("a submitted record is never downgraded by a late in-progress save", async () => {
    const rec = researchRecord();
    await api("/api/submit", { method: "POST", body: rec, submit: SUBMIT });
    const stale = { ...rec, submission_status: "in_progress", questionnaire_status: "missing", q_risk_exposure: "missing" };
    const r = await api("/api/submit", { method: "POST", body: stale, submit: SUBMIT });
    assert.equal(r.status, 200);
    const list = await api("/api/admin/records", { admin: ADMIN });
    const stored = list.data.records.find((x) => x.response_id === rec.response_id);
    assert.equal(stored.submission_status, "submitted");
    assert.equal(stored.q_risk_exposure, "4");
  });

  test("rejects oversized bodies", async () => {
    const r = await api("/api/submit", { method: "POST", body: researchRecord({ q_open_influence: "x".repeat(40000) }), submit: SUBMIT });
    assert.ok(r.status === 413 || r.status === 422);
  });
});

describe("administration", () => {
  test("admin endpoints require the admin token", async () => {
    assert.equal((await api("/api/admin/records")).status, 401);
    assert.equal((await api("/api/admin/records", { admin: SUBMIT })).status, 401);
    assert.equal((await api("/api/admin/records", { admin: ADMIN })).status, 200);
  });

  test("deletes by response code", async () => {
    const rec = researchRecord();
    await api("/api/submit", { method: "POST", body: rec, submit: SUBMIT });
    const del = await api(`/api/admin/records/${rec.response_code}`, { method: "DELETE", admin: ADMIN });
    assert.equal(del.status, 200);
    assert.equal(del.data.removed, 1);
    const again = await api(`/api/admin/records/${rec.response_code}`, { method: "DELETE", admin: ADMIN });
    assert.equal(again.data.removed, 0);
  });

  test("a configuration with placeholders cannot be deployed in research mode", async () => {
    const cfg = cloneConfig(DEFAULT_STUDY_CONFIG);
    cfg.mode = "research";
    const r = await api("/api/admin/config", { method: "PUT", body: cfg, admin: ADMIN });
    assert.equal(r.status, 422);
  });

  test("the configuration freezes once research records exist", async () => {
    // Clear records so the first deployment succeeds.
    const list = await api("/api/admin/records", { admin: ADMIN });
    for (const r of list.data.records) await api(`/api/admin/records/${r.response_code}`, { method: "DELETE", admin: ADMIN });
    const cfg = researchConfig();
    const put = await api("/api/admin/config", { method: "PUT", body: cfg, admin: ADMIN });
    assert.equal(put.status, 200, JSON.stringify(put.data));
    const served = await fetch(base + "/study.config.json");
    assert.equal(served.status, 200);
    assert.equal((await served.json()).studyVersion, "1.0.0");

    // Version mismatch is refused.
    const wrongVersion = researchRecord({ study_version: "0.9.0" });
    assert.equal((await api("/api/submit", { method: "POST", body: wrongVersion, submit: SUBMIT })).status, 409);

    const ok = await api("/api/submit", { method: "POST", body: researchRecord(), submit: SUBMIT });
    assert.equal(ok.status, 200);
    const cfg2 = researchConfig();
    cfg2.studyVersion = "1.1.0";
    const frozen = await api("/api/admin/config", { method: "PUT", body: cfg2, admin: ADMIN });
    assert.equal(frozen.status, 409);
    assert.match(frozen.data.error, /frozen/);
  });
});
