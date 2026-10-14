// Unit tests for the study engine, data dictionary, demo data, and export.
// Run with: npm test   (node --test)

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import * as E from "../src/engine.js";
import { DEFAULT_STUDY_CONFIG, cloneConfig, activationProblems, ageCategories, findPlaceholders } from "../src/study-config.js";
import { validateRecord, FIELD_NAMES, SPECIAL } from "../src/data-dictionary.js";
import { generateDemoRecords, synthesizeRecord } from "../src/demo-data.js";
import { toCSV, toJSON } from "../src/export.js";

function clock(start = 10_000) {
  let t = start;
  return { now: () => t, tick: (ms) => (t += ms) };
}

function previewConfig(overrides = {}) {
  const c = cloneConfig(DEFAULT_STUDY_CONFIG);
  Object.assign(c, overrides);
  return c;
}

function researchConfig(overrides = {}) {
  const c = previewConfig();
  c.mode = "research";
  c.studyVersion = "1.0.0";
  c.storage = { adapter: "local-device", endpointUrl: "", submitToken: "" };
  for (const k of Object.keys(c.consent)) {
    if (typeof c.consent[k] === "string") c.consent[k] = c.consent[k].replace(/\[[^\]]*\]/g, "filled");
  }
  Object.assign(c, overrides);
  return c;
}

/** Drive a session up to the verification screen. */
function toVerification(config, { condition = null, random = () => 0.25, clk = clock() } = {}) {
  const o = () => ({ now: clk.now });
  const s = E.createSession(o());
  clk.tick(1000);
  E.begin(s, o());
  clk.tick(1000);
  E.submitEligibility(s, config, { ageCategory: "age_16", meetsCriteria: true }, o());
  clk.tick(5000);
  E.giveAssent(s, config, { ...o(), random, forcedCondition: condition });
  clk.tick(1000);
  E.continueScenario(s, o());
  E.confirmVerificationDisplayed(s);
  return { s, clk, o };
}

function answersAll() {
  return {
    risk_exposure: "4",
    risk_misuse: "5",
    risk_feel: "3",
    transp_explained: "2",
    transp_expect: "2",
    id_unexpected: "5",
    id_understood: "1",
    recall_notice: "no",
    prior_experience: "yes",
    id_availability: "not_sure",
    breach_awareness: "prefer_not",
    open_influence: "I did not want to share an ID.",
    stop_reasons: ["privacy_security", "unexpected_request"],
  };
}

describe("eligibility", () => {
  test("age categories come from the approved range and never ask for a birth date", () => {
    const cats = ageCategories(previewConfig());
    assert.deepEqual(
      cats.map((c) => [c.value, c.eligible]),
      [
        ["under_16", false],
        ["age_16", true],
        ["age_17", true],
        ["over_17", false],
      ]
    );
    const wide = previewConfig();
    wide.eligibility.minAge = 14;
    wide.eligibility.maxAge = 18;
    assert.equal(ageCategories(wide).filter((c) => c.eligible).length, 5);
  });

  test("ineligible participants exit and their answers are not retained", () => {
    const s = E.createSession();
    E.begin(s);
    E.submitEligibility(s, previewConfig(), { ageCategory: "over_17", meetsCriteria: true });
    assert.equal(s.step, "ineligible");
    assert.equal(s.eligibility.ageCategory, null);
    assert.equal(s.assentGiven, false);
    assert.equal(E.hasRecord(s), false);
    assert.throws(() => E.buildRecord(s, previewConfig()));
  });

  test("not meeting recruitment criteria is ineligible even at an eligible age", () => {
    const s = E.createSession();
    E.begin(s);
    E.submitEligibility(s, previewConfig(), { ageCategory: "age_17", meetsCriteria: false });
    assert.equal(s.step, "ineligible");
  });

  test("declining assent leaves no record", () => {
    const s = E.createSession();
    E.begin(s);
    E.submitEligibility(s, previewConfig(), { ageCategory: "age_17", meetsCriteria: true });
    E.declineAssent(s);
    assert.equal(s.step, "not_participating");
    assert.equal(E.hasRecord(s), false);
  });
});

describe("assignment", () => {
  test("random draw is about 1:1 and uses the injected source", () => {
    assert.equal(E.assignCondition(() => 0.1), "advance_notice");
    assert.equal(E.assignCondition(() => 0.9), "later_notice");
    let n = 0;
    const counts = { advance_notice: 0, later_notice: 0 };
    for (let i = 0; i < 1000; i += 1) counts[E.assignCondition(() => ((n += 0.37) % 1))] += 1;
    assert.ok(Math.abs(counts.advance_notice - counts.later_notice) < 150);
  });

  test("condition is assigned at assent, survives serialization, and does not change", () => {
    const { s } = toVerification(previewConfig(), { random: () => 0.9 });
    assert.equal(s.condition, "later_notice");
    assert.equal(s.assignmentMethod, "random");
    const restored = E.restoreSession(E.serializeSession(s));
    assert.equal(restored.condition, "later_notice");
    assert.equal(restored.responseId, s.responseId);
    assert.equal(restored.step, "verification");
  });

  test("forced condition works only in preview mode", () => {
    const p = toVerification(previewConfig(), { condition: "advance_notice", random: () => 0.9 });
    assert.equal(p.s.condition, "advance_notice");
    assert.equal(p.s.assignmentMethod, "forced_preview");
    const r = toVerification(researchConfig(), { condition: "advance_notice", random: () => 0.9 });
    assert.equal(r.s.condition, "later_notice");
    assert.equal(r.s.assignmentMethod, "random");
    assert.equal(r.s.recordKind, "research");
  });

  test("the record is created at assent with a UUID and a derived response code", () => {
    const { s } = toVerification(previewConfig());
    assert.match(s.responseId, /^[0-9a-f-]{36}$/);
    assert.match(s.responseCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(E.responseCodeFor(s.responseId), s.responseCode);
  });
});

describe("the six pathways", () => {
  for (const condition of ["advance_notice", "later_notice"]) {
    test(`${condition}: decline initial check -> questionnaire -> debrief`, () => {
      const cfg = previewConfig();
      const { s, clk, o } = toVerification(cfg, { condition });
      clk.tick(4000);
      E.initialDecision(s, "decline", o());
      assert.equal(s.step, "confirmation");
      E.beginQuestionnaire(s, o());
      clk.tick(60000);
      E.submitQuestionnaire(s, answersAll(), o());
      E.markSubmitted(s);
      assert.equal(s.step, "debrief");
      const r = E.buildRecord(s, cfg);
      assert.deepEqual(validateRecord(r), []);
      assert.equal(r.condition, condition);
      assert.equal(r.initial_decision, "decline");
      assert.equal(r.reached_uncertain_result, "no");
      assert.equal(r.reached_id_prompt, "no");
      assert.equal(r.id_decision, SPECIAL.NOT_REACHED);
      assert.equal(r.final_pathway, "declined_before_check");
      assert.equal(r.q_id_unexpected, SPECIAL.NOT_REACHED);
      assert.equal(r.q_id_understood, SPECIAL.NOT_REACHED);
      assert.equal(r.q_stop_reasons, "privacy_security;unexpected_request");
      assert.equal(r.ms_verification_to_initial_decision, 4000);
      assert.equal(r.ms_simulation_duration, SPECIAL.NOT_REACHED);
      assert.equal(r.ms_result_to_id_decision, SPECIAL.NOT_REACHED);
      assert.equal(r.ms_questionnaire_duration, 60000);
      assert.equal(r.submission_status, "submitted");
      assert.equal(r.questionnaire_status, "submitted");
    });

    test(`${condition}: start -> stop at ID prompt -> questionnaire -> debrief`, () => {
      const cfg = previewConfig();
      const { s, clk, o } = toVerification(cfg, { condition });
      clk.tick(2500);
      E.initialDecision(s, "start", o());
      assert.equal(s.step, "simulation");
      clk.tick(3000);
      E.simulationComplete(s, o());
      assert.equal(s.step, "result");
      clk.tick(7000);
      E.idDecision(s, "stop", o());
      E.beginQuestionnaire(s, o());
      clk.tick(45000);
      E.submitQuestionnaire(s, answersAll(), o());
      E.markSubmitted(s);
      const r = E.buildRecord(s, cfg);
      assert.deepEqual(validateRecord(r), []);
      assert.equal(r.initial_decision, "start");
      assert.equal(r.reached_id_prompt, "yes");
      assert.equal(r.id_decision, "stop");
      assert.equal(r.final_pathway, "stopped_at_id_request");
      assert.equal(r.q_id_unexpected, "5");
      assert.equal(r.ms_simulation_duration, 3000);
      assert.equal(r.ms_result_to_id_decision, 7000);
      assert.equal(r.q_stop_reasons, "privacy_security;unexpected_request");
    });

    test(`${condition}: start -> continue with ID -> questionnaire -> debrief`, () => {
      const cfg = previewConfig();
      const { s, clk, o } = toVerification(cfg, { condition });
      E.initialDecision(s, "start", o());
      clk.tick(3000);
      E.simulationComplete(s, o());
      clk.tick(1500);
      E.idDecision(s, "continue", o());
      E.beginQuestionnaire(s, o());
      E.submitQuestionnaire(s, answersAll(), o());
      E.markSubmitted(s);
      const r = E.buildRecord(s, cfg);
      assert.deepEqual(validateRecord(r), []);
      assert.equal(r.id_decision, "continue");
      assert.equal(r.final_pathway, "would_continue_with_id");
      // Stop reasons do not apply to someone who would continue.
      assert.equal(r.q_stop_reasons, SPECIAL.NOT_APPLICABLE);
    });
  }
});

describe("coding of missing, skipped, and not reached", () => {
  test("skipped items are coded skipped, not missing, once the questionnaire is submitted", () => {
    const cfg = previewConfig();
    const { s, o } = toVerification(cfg);
    E.initialDecision(s, "decline", o());
    E.beginQuestionnaire(s, o());
    E.submitQuestionnaire(s, { risk_exposure: "2" }, o());
    E.markSubmitted(s);
    const r = E.buildRecord(s, cfg);
    assert.equal(r.q_risk_exposure, "2");
    assert.equal(r.q_risk_misuse, SPECIAL.SKIPPED);
    assert.equal(r.q_recall_notice, SPECIAL.SKIPPED);
    assert.equal(r.q_open_influence, SPECIAL.SKIPPED);
    assert.equal(r.q_stop_reasons, SPECIAL.SKIPPED);
    assert.equal(r.q_demo_gender, SPECIAL.DISABLED);
    assert.equal(r.recruitment_code, SPECIAL.NOT_COLLECTED);
  });

  test("an abandoned session is incomplete with a missing questionnaire, never a refusal", () => {
    const cfg = previewConfig();
    const { s, o } = toVerification(cfg);
    E.initialDecision(s, "start", o());
    E.simulationComplete(s, o());
    const r = E.buildRecord(s, cfg);
    assert.deepEqual(validateRecord(r), []);
    assert.equal(r.final_pathway, "incomplete_session");
    assert.equal(r.id_decision, SPECIAL.NOT_REACHED);
    assert.equal(r.reached_id_prompt, "yes");
    assert.equal(r.questionnaire_status, "missing");
    assert.equal(r.q_risk_exposure, SPECIAL.MISSING);
    assert.equal(r.q_id_unexpected, SPECIAL.MISSING);
    assert.equal(r.submission_status, "in_progress");
  });

  test("a session that never reached verification is incomplete with initial decision not reached", () => {
    const cfg = previewConfig();
    const s = E.createSession();
    E.begin(s);
    E.submitEligibility(s, cfg, { ageCategory: "age_16", meetsCriteria: true });
    E.giveAssent(s, cfg);
    const r = E.buildRecord(s, cfg);
    assert.equal(r.initial_decision, SPECIAL.NOT_REACHED);
    assert.equal(r.assigned_screen_displayed, "no");
    assert.equal(r.final_pathway, "incomplete_session");
  });

  test("invalid answer values are dropped rather than stored", () => {
    const a = E.sanitizeAnswers({ risk_exposure: "9", risk_misuse: "abc", recall_notice: "  yes ", open_influence: "x".repeat(2000), stop_reasons: "notarray" });
    assert.equal(a.risk_exposure, undefined);
    assert.equal(a.risk_misuse, undefined);
    assert.equal(a.recall_notice, "yes");
    assert.equal(a.open_influence.length, 1000);
    assert.equal(a.stop_reasons, undefined);
  });

  test("demographics are recorded only when enabled", () => {
    const cfg = previewConfig();
    cfg.demographics.enabled = true;
    const { s, o } = toVerification(cfg);
    E.initialDecision(s, "decline", o());
    E.beginQuestionnaire(s, o());
    E.submitQuestionnaire(s, { demo_gender: "prefer_not" }, o());
    E.markSubmitted(s);
    const r = E.buildRecord(s, cfg);
    assert.equal(r.q_demo_gender, "prefer_not");
    assert.equal(r.q_demo_race, SPECIAL.SKIPPED);
  });

  test("recruitment code is kept only when enabled and well-formed", () => {
    const cfg = previewConfig();
    cfg.eligibility.recruitmentCode.enabled = true;
    const s = E.createSession();
    E.begin(s);
    E.submitEligibility(s, cfg, { ageCategory: "age_16", meetsCriteria: true, recruitmentCode: "PR-07" });
    E.giveAssent(s, cfg);
    assert.equal(E.buildRecord(s, cfg).recruitment_code, "PR-07");
    const s2 = E.createSession();
    E.begin(s2);
    E.submitEligibility(s2, cfg, { ageCategory: "age_16", meetsCriteria: true, recruitmentCode: "John Smith 12345678" });
    E.giveAssent(s2, cfg);
    assert.equal(E.buildRecord(s2, cfg).recruitment_code, SPECIAL.SKIPPED);
  });
});

describe("withdrawal", () => {
  test("withdrawing is its own pathway and is never coded as declining verification", () => {
    const cfg = previewConfig();
    const { s, o } = toVerification(cfg);
    E.withdraw(s, o());
    assert.equal(s.step, "withdrawn");
    const r = E.buildRecord(s, cfg);
    assert.deepEqual(validateRecord(r), []);
    assert.equal(r.final_pathway, "withdrawn");
    assert.equal(r.withdrawn_at_step, "verification");
    assert.equal(r.submission_status, "withdrawn");
    assert.notEqual(r.initial_decision, "decline");
    assert.equal(r.initial_decision, SPECIAL.WITHHELD);
    assert.equal(r.q_risk_exposure, SPECIAL.WITHHELD);
  });

  test("withdrawal after decisions withholds them unless the policy retains partial responses", () => {
    const cfg = previewConfig();
    const { s, o } = toVerification(cfg);
    E.initialDecision(s, "start", o());
    E.simulationComplete(s, o());
    E.idDecision(s, "stop", o());
    E.beginQuestionnaire(s, o());
    E.withdraw(s, o());
    const withheld = E.buildRecord(s, cfg);
    assert.equal(withheld.id_decision, SPECIAL.WITHHELD);
    assert.equal(withheld.ms_result_to_id_decision, SPECIAL.WITHHELD);
    const retainCfg = previewConfig();
    retainCfg.withdrawal.retainPartialResponses = true;
    const kept = E.buildRecord(s, retainCfg);
    assert.equal(kept.final_pathway, "withdrawn");
    assert.equal(kept.id_decision, "stop");
    assert.equal(kept.q_risk_exposure, SPECIAL.MISSING);
    assert.deepEqual(validateRecord(kept), []);
  });

  test("withdrawal is not possible before assent", () => {
    const s = E.createSession();
    assert.throws(() => E.withdraw(s));
    assert.equal(E.canWithdraw(s), false);
  });
});

describe("submission", () => {
  test("a double submit does not restart the submission", () => {
    const cfg = previewConfig();
    const { s, o } = toVerification(cfg);
    E.initialDecision(s, "decline", o());
    E.beginQuestionnaire(s, o());
    E.submitQuestionnaire(s, { risk_exposure: "1" }, o());
    assert.equal(s.submission.status, "submitting");
    assert.equal(s.submission.attempts, 1);
    E.submitQuestionnaire(s, { risk_exposure: "5" }, o());
    assert.equal(s.submission.attempts, 1);
    assert.equal(s.questionnaire.risk_exposure, "1");
    E.markSubmitted(s);
    E.submitQuestionnaire(s, { risk_exposure: "5" }, o());
    assert.equal(s.submission.status, "submitted");
    assert.equal(s.step, "debrief");
  });

  test("a failed save keeps the answers and allows a retry", () => {
    const cfg = previewConfig();
    const { s, o } = toVerification(cfg);
    E.initialDecision(s, "decline", o());
    E.beginQuestionnaire(s, o());
    E.submitQuestionnaire(s, { risk_exposure: "1" }, o());
    E.markSubmitFailed(s, "Server unreachable");
    assert.equal(s.submission.status, "failed");
    assert.equal(s.step, "questionnaire");
    assert.equal(s.questionnaire.risk_exposure, "1");
    E.retrySubmit(s);
    assert.equal(s.submission.status, "submitting");
    assert.equal(s.submission.attempts, 2);
    E.markSubmitted(s);
    assert.equal(s.step, "debrief");
  });

  test("a reload while submitting restores as failed so the participant can retry", () => {
    const cfg = previewConfig();
    const { s, o } = toVerification(cfg);
    E.initialDecision(s, "decline", o());
    E.beginQuestionnaire(s, o());
    E.submitQuestionnaire(s, {}, o());
    const restored = E.restoreSession(E.serializeSession(s));
    assert.equal(restored.submission.status, "failed");
    assert.equal(restored.condition, s.condition);
  });

  test("restoring garbage yields null", () => {
    assert.equal(E.restoreSession("not json"), null);
    assert.equal(E.restoreSession(JSON.stringify({ schema: 2 })), null);
    assert.equal(E.restoreSession(""), null);
  });
});

describe("timing", () => {
  test("times are relative and the record has no absolute timestamps", () => {
    const cfg = previewConfig();
    const { s, clk, o } = toVerification(cfg, { clk: clock(1_700_000_000_000) });
    clk.tick(1234);
    E.initialDecision(s, "start", o());
    clk.tick(3005);
    E.simulationComplete(s, o());
    clk.tick(999);
    E.idDecision(s, "continue", o());
    E.beginQuestionnaire(s, o());
    E.submitQuestionnaire(s, {}, o());
    E.markSubmitted(s);
    const r = E.buildRecord(s, cfg);
    assert.equal(r.ms_verification_to_initial_decision, 1234);
    assert.equal(r.ms_simulation_duration, 3005);
    assert.equal(r.ms_result_to_id_decision, 999);
    assert.equal(r.ms_consent_to_assent, 5000);
    for (const v of Object.values(r)) {
      if (typeof v === "number") assert.ok(v < 86_400_000, "no absolute timestamps in the record");
    }
    assert.deepEqual(Object.keys(r), FIELD_NAMES);
  });

  test("a restarted simulation after a refresh re-measures from the restart", () => {
    const cfg = previewConfig();
    const { s, clk, o } = toVerification(cfg);
    E.initialDecision(s, "start", o());
    clk.tick(1000);
    E.restartSimulation(s, o());
    clk.tick(3000);
    E.simulationComplete(s, o());
    assert.equal(E.buildRecord(s, cfg).ms_simulation_duration, 3000);
  });
});

describe("configuration", () => {
  test("defaults cannot be activated: placeholders, draft version, no storage", () => {
    const problems = activationProblems(previewConfig());
    assert.ok(problems.some((p) => p.includes("Placeholder")));
    assert.ok(problems.some((p) => p.includes("storage")));
    assert.ok(problems.some((p) => p.includes("version")));
    assert.ok(findPlaceholders(previewConfig()).length >= 5);
  });

  test("a completed configuration passes activation checks", () => {
    assert.deepEqual(activationProblems(researchConfig()), []);
    const remote = researchConfig();
    remote.storage = { adapter: "remote-endpoint", endpointUrl: "https://example.test", submitToken: "x".repeat(32) };
    assert.deepEqual(activationProblems(remote), []);
    remote.storage.submitToken = "short";
    assert.ok(activationProblems(remote).length === 1);
  });
});

describe("demo data and export", () => {
  test("synthetic records are valid, marked as demo, and cover every condition and pathway", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const records = generateDemoRecords(previewConfig(), 60, random);
    assert.equal(records.length, 60);
    const combos = new Set();
    for (const r of records) {
      assert.deepEqual(validateRecord(r), [], JSON.stringify(r));
      assert.equal(r.record_kind, "synthetic_demo");
      combos.add(`${r.condition}/${r.final_pathway}`);
    }
    assert.equal(combos.size, 10);
  });

  test("a withdrawn synthetic record withholds responses", () => {
    const r = synthesizeRecord(previewConfig(), { condition: "advance_notice", pathway: "withdrawn", random: () => 0.5 });
    assert.equal(r.final_pathway, "withdrawn");
    assert.equal(r.q_risk_exposure, SPECIAL.WITHHELD);
  });

  test("CSV export quotes free text and keeps dictionary order", () => {
    const cfg = previewConfig();
    const { s, o } = toVerification(cfg);
    E.initialDecision(s, "decline", o());
    E.beginQuestionnaire(s, o());
    E.submitQuestionnaire(s, { open_influence: 'He said "no", then left\nquickly', risk_feel: "3" }, o());
    E.markSubmitted(s);
    const csv = toCSV([E.buildRecord(s, cfg)]);
    const [header, row] = csv.split("\r\n");
    assert.equal(header, FIELD_NAMES.join(","));
    assert.ok(row.includes('"He said ""no"", then left'));
    const json = JSON.parse(toJSON([E.buildRecord(s, cfg)], { study_version: "x" }));
    assert.equal(json.count, 1);
    assert.deepEqual(Object.keys(json.records[0]), FIELD_NAMES);
  });

  test("CSV neutralizes spreadsheet formulas in free text", () => {
    const cfg = previewConfig();
    const { s, o } = toVerification(cfg);
    E.initialDecision(s, "decline", o());
    E.beginQuestionnaire(s, o());
    E.submitQuestionnaire(s, { open_influence: "=HYPERLINK(1)" }, o());
    E.markSubmitted(s);
    const csv = toCSV([E.buildRecord(s, cfg)]);
    assert.ok(csv.includes("'=HYPERLINK(1)"));
  });
});
