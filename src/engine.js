// AgeCheck Study: the participant session as a pure state machine.
//
// No DOM, no storage, no network. The UI (src/app.js) calls these functions
// and persists the returned session; the tests drive them directly. Every
// transition records a relative time mark (milliseconds since the session
// began) so the record never needs an absolute timestamp.

import { SPECIAL, FIELDS } from "./data-dictionary.js";

export const CONDITION = {
  ADVANCE: "advance_notice",
  LATER: "later_notice",
};

export const INITIAL = { START: "start", DECLINE: "decline" };
export const ID = { CONTINUE: "continue", STOP: "stop" };

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** UUID v4 that also works in non-secure contexts (plain http on a LAN). */
export function uuidv4(randomBytes = defaultRandomBytes) {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function defaultRandomBytes(n) {
  const out = new Uint8Array(n);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(out);
  } else {
    for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

/** Uniform random in [0, 1) from the platform's cryptographic source. */
export function defaultRandom() {
  const b = defaultRandomBytes(4);
  const n = ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3];
  return n / 4294967296;
}

/** Short response code derived from the response id (no 0, O, 1, I, L). */
export function responseCodeFor(responseId) {
  const hex = responseId.replace(/-/g, "").slice(0, 16);
  let out = "";
  for (let i = 0; i < 16; i += 2) {
    const n = parseInt(hex.slice(i, i + 2), 16);
    out += CODE_ALPHABET[n % CODE_ALPHABET.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function assignCondition(random = defaultRandom) {
  return random() < 0.5 ? CONDITION.ADVANCE : CONDITION.LATER;
}

/**
 * A new session. Nothing is stored until assent; the record is created at
 * assent so ineligible or non-consenting visitors leave nothing behind.
 */
export function createSession({ now = Date.now } = {}) {
  return {
    schema: 1,
    responseId: null,
    responseCode: null,
    studyVersion: null,
    recordKind: null,
    step: "intro",
    t0: now(),
    marks: {},
    eligibility: { ageCategory: null, meetsCriteria: null, recruitmentCode: null, eligible: null },
    assentGiven: false,
    condition: null,
    assignmentMethod: null,
    assignedScreenDisplayed: false,
    initialDecision: null,
    reachedResult: false,
    idDecision: null,
    withdrawnAtStep: null,
    questionnaire: null,
    submission: { status: "not_started", error: null, attempts: 0 },
  };
}

function mark(session, name, now) {
  if (session.marks[name] === undefined) session.marks[name] = Math.max(0, now() - session.t0);
  return session;
}

function remark(session, name, now) {
  session.marks[name] = Math.max(0, now() - session.t0);
  return session;
}

function expect(session, ...steps) {
  if (!steps.includes(session.step)) {
    throw new Error(`Invalid transition from step "${session.step}" (expected ${steps.join(" or ")})`);
  }
}

// ---------------------------------------------------------------------------
// Transitions. Each mutates and returns the session.

export function begin(session, { now = Date.now } = {}) {
  expect(session, "intro");
  mark(session, "intro_continue", now);
  session.step = "eligibility";
  return session;
}

export function submitEligibility(session, config, answers, { now = Date.now } = {}) {
  expect(session, "eligibility");
  const { minAge, maxAge, recruitmentCode } = config.eligibility;
  const cat = String(answers.ageCategory || "");
  const m = cat.match(/^age_(\d+)$/);
  const ageOk = Boolean(m) && Number(m[1]) >= minAge && Number(m[1]) <= maxAge;
  const criteriaOk = answers.meetsCriteria === true;
  let code = null;
  if (recruitmentCode && recruitmentCode.enabled) {
    const raw = String(answers.recruitmentCode || "").trim();
    if (raw && new RegExp(recruitmentCode.pattern).test(raw)) code = raw;
  }
  session.eligibility = {
    ageCategory: cat || null,
    meetsCriteria: criteriaOk,
    recruitmentCode: code,
    eligible: ageOk && criteriaOk,
  };
  if (session.eligibility.eligible) {
    session.step = "consent";
    mark(session, "consent_shown", now);
  } else {
    // Ineligible answers are not retained: drop them before exiting.
    session.eligibility = { ageCategory: null, meetsCriteria: null, recruitmentCode: null, eligible: false };
    session.step = "ineligible";
  }
  return session;
}

export function declineAssent(session) {
  expect(session, "consent");
  session.step = "not_participating";
  return session;
}

/**
 * Assent creates the record and assigns the condition. The condition is
 * stored in the session so refreshes and back navigation keep it.
 */
export function giveAssent(session, config, { now = Date.now, random = defaultRandom, forcedCondition = null } = {}) {
  expect(session, "consent");
  session.assentGiven = true;
  mark(session, "assent", now);
  session.responseId = uuidv4();
  session.responseCode = responseCodeFor(session.responseId);
  session.studyVersion = config.studyVersion;
  session.recordKind = config.mode === "research" ? "research" : "preview_walkthrough";
  const forcingAllowed =
    config.mode !== "research" && config.preview && config.preview.allowForcedCondition === true;
  if (forcingAllowed && (forcedCondition === CONDITION.ADVANCE || forcedCondition === CONDITION.LATER)) {
    session.condition = forcedCondition;
    session.assignmentMethod = "forced_preview";
  } else {
    session.condition = assignCondition(random);
    session.assignmentMethod = "random";
  }
  session.submission = { status: "in_progress", error: null, attempts: 0 };
  session.step = "scenario";
  return session;
}

export function continueScenario(session, { now = Date.now } = {}) {
  expect(session, "scenario");
  session.step = "verification";
  mark(session, "verification_shown", now);
  return session;
}

/** Called by the UI once the verification card for the condition is in the DOM. */
export function confirmVerificationDisplayed(session) {
  if (session.step === "verification") session.assignedScreenDisplayed = true;
  return session;
}

export function initialDecision(session, choice, { now = Date.now } = {}) {
  expect(session, "verification");
  if (choice !== INITIAL.START && choice !== INITIAL.DECLINE) throw new Error("Invalid initial decision");
  session.initialDecision = choice;
  mark(session, "initial_decision", now);
  if (choice === INITIAL.START) {
    session.step = "simulation";
    remark(session, "simulation_start", now);
  } else {
    session.step = "confirmation";
  }
  return session;
}

/** A refresh during the simulation restarts the fixed animation. */
export function restartSimulation(session, { now = Date.now } = {}) {
  expect(session, "simulation");
  remark(session, "simulation_start", now);
  return session;
}

export function simulationComplete(session, { now = Date.now } = {}) {
  expect(session, "simulation");
  remark(session, "simulation_end", now);
  session.reachedResult = true;
  session.step = "result";
  mark(session, "result_shown", now);
  return session;
}

export function idDecision(session, choice, { now = Date.now } = {}) {
  expect(session, "result");
  if (choice !== ID.CONTINUE && choice !== ID.STOP) throw new Error("Invalid ID decision");
  session.idDecision = choice;
  mark(session, "id_decision", now);
  session.step = "confirmation";
  return session;
}

export function beginQuestionnaire(session, { now = Date.now } = {}) {
  expect(session, "confirmation");
  session.step = "questionnaire";
  mark(session, "questionnaire_shown", now);
  return session;
}

/**
 * Store the answers and move to "submitting". The UI then saves the record
 * and calls markSubmitted or markSubmitFailed. Calling this twice (a double
 * click) is a no-op after the first call.
 */
export function submitQuestionnaire(session, answers, { now = Date.now } = {}) {
  const st = session.submission.status;
  if (st === "submitting" || st === "submitted") return session;
  expect(session, "questionnaire");
  session.questionnaire = sanitizeAnswers(answers);
  mark(session, "questionnaire_submit", now);
  session.submission = { status: "submitting", error: null, attempts: session.submission.attempts + 1 };
  return session;
}

export function retrySubmit(session) {
  expect(session, "questionnaire");
  if (session.submission.status !== "failed") return session;
  session.submission = { status: "submitting", error: null, attempts: session.submission.attempts + 1 };
  return session;
}

export function markSubmitted(session) {
  if (session.submission.status !== "submitting") return session;
  session.submission = { status: "submitted", error: null, attempts: session.submission.attempts };
  session.step = "debrief";
  return session;
}

export function markSubmitFailed(session, message) {
  if (session.submission.status !== "submitting") return session;
  session.submission = { status: "failed", error: String(message || "Submission failed"), attempts: session.submission.attempts };
  return session;
}

export function finish(session) {
  expect(session, "debrief");
  session.step = "finished";
  return session;
}

/** Withdrawal is separate from declining verification and can happen at any study step after assent. */
export function withdraw(session, { now = Date.now } = {}) {
  if (!session.assentGiven) throw new Error("Cannot withdraw before assent");
  if (session.step === "withdrawn" || session.step === "finished") return session;
  session.withdrawnAtStep = session.step;
  mark(session, "withdrawn", now);
  session.submission = { status: "withdrawn", error: null, attempts: session.submission.attempts };
  session.step = "withdrawn";
  return session;
}

export function canWithdraw(session) {
  return session.assentGiven && !["withdrawn", "finished", "debrief", "ineligible", "not_participating"].includes(session.step);
}

export function hasRecord(session) {
  return Boolean(session.assentGiven && session.responseId);
}

// ---------------------------------------------------------------------------
// Answers and records.

const LIKERT_IDS = ["risk_exposure", "risk_misuse", "risk_feel", "transp_explained", "transp_expect", "id_unexpected", "id_understood"];
const CHOICE_IDS = ["recall_notice", "prior_experience", "id_availability", "breach_awareness", "demo_gender", "demo_race"];

export function sanitizeAnswers(answers) {
  const out = {};
  const a = answers || {};
  for (const id of LIKERT_IDS) {
    const v = a[id];
    if (v !== undefined && v !== null && v !== "") {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= 5) out[id] = String(n);
    }
  }
  for (const id of CHOICE_IDS) {
    const v = a[id];
    if (typeof v === "string" && v.trim()) out[id] = v.trim();
  }
  if (typeof a.open_influence === "string" && a.open_influence.trim()) {
    out.open_influence = a.open_influence.trim().slice(0, 1000);
  }
  if (Array.isArray(a.stop_reasons) && a.stop_reasons.length) {
    out.stop_reasons = a.stop_reasons.map(String);
  }
  return out;
}

export function finalPathway(session) {
  if (session.step === "withdrawn" || session.submission.status === "withdrawn") return "withdrawn";
  if (session.initialDecision === INITIAL.DECLINE) return "declined_before_check";
  if (session.idDecision === ID.STOP) return "stopped_at_id_request";
  if (session.idDecision === ID.CONTINUE) return "would_continue_with_id";
  return "incomplete_session";
}

function diff(marks, a, b) {
  if (marks[a] === undefined || marks[b] === undefined) return SPECIAL.NOT_REACHED;
  return Math.max(0, Math.round(marks[b] - marks[a]));
}

/**
 * Build the record for storage. Structural codes (not_reached, not_applicable,
 * disabled) take precedence over missing, which takes precedence over skipped.
 */
export function buildRecord(session, config) {
  if (!hasRecord(session)) throw new Error("No record exists before assent");
  const pathway = finalPathway(session);
  const withdrawn = pathway === "withdrawn";
  const withhold = withdrawn && !(config.withdrawal && config.withdrawal.retainPartialResponses);
  // A record built while the save is in flight is the submission itself.
  const submitted = session.submission.status === "submitted" || session.submission.status === "submitting";
  const q = session.questionnaire || {};
  const reachedId = session.reachedResult === true;
  const declinedOrStopped = pathway === "declined_before_check" || pathway === "stopped_at_id_request";
  const demographicsOn = Boolean(config.demographics && config.demographics.enabled);

  const likert = (id, onlyIfReachedId = false) => {
    if (onlyIfReachedId && !reachedId) return SPECIAL.NOT_REACHED;
    if (withhold) return SPECIAL.WITHHELD;
    if (!submitted) return SPECIAL.MISSING;
    return q[id] !== undefined ? q[id] : SPECIAL.SKIPPED;
  };
  const choice = (id, { disabled = false } = {}) => {
    if (disabled) return SPECIAL.DISABLED;
    if (withhold) return SPECIAL.WITHHELD;
    if (!submitted) return SPECIAL.MISSING;
    return q[id] !== undefined ? q[id] : SPECIAL.SKIPPED;
  };
  const guard = (value) => (withhold ? SPECIAL.WITHHELD : value);

  let stopReasons;
  if (!declinedOrStopped) stopReasons = SPECIAL.NOT_APPLICABLE;
  else if (withhold) stopReasons = SPECIAL.WITHHELD;
  else if (!submitted) stopReasons = SPECIAL.MISSING;
  else stopReasons = q.stop_reasons && q.stop_reasons.length ? q.stop_reasons.join(";") : SPECIAL.SKIPPED;

  let openText;
  if (withhold) openText = SPECIAL.WITHHELD;
  else if (!submitted) openText = SPECIAL.MISSING;
  else openText = q.open_influence ? q.open_influence : SPECIAL.SKIPPED;

  const rcEnabled = Boolean(config.eligibility.recruitmentCode && config.eligibility.recruitmentCode.enabled);
  let recruitmentCode;
  if (!rcEnabled) recruitmentCode = SPECIAL.NOT_COLLECTED;
  else if (withhold) recruitmentCode = SPECIAL.WITHHELD;
  else recruitmentCode = session.eligibility.recruitmentCode || SPECIAL.SKIPPED;

  const m = session.marks;
  const record = {
    response_id: session.responseId,
    response_code: session.responseCode,
    record_kind: session.recordKind,
    study_version: session.studyVersion,
    condition: session.condition,
    assignment_method: session.assignmentMethod,
    assigned_screen_displayed: session.assignedScreenDisplayed ? "yes" : "no",
    initial_decision: guard(session.initialDecision || SPECIAL.NOT_REACHED),
    reached_uncertain_result: reachedId ? "yes" : "no",
    reached_id_prompt: reachedId ? "yes" : "no",
    id_decision: guard(session.idDecision || SPECIAL.NOT_REACHED),
    final_pathway: pathway,
    withdrawn_at_step: withdrawn ? session.withdrawnAtStep || "unknown" : SPECIAL.NOT_APPLICABLE,
    submission_status: withdrawn ? "withdrawn" : submitted ? "submitted" : "in_progress",
    questionnaire_status: submitted && !withhold ? "submitted" : "missing",
    q_risk_exposure: likert("risk_exposure"),
    q_risk_misuse: likert("risk_misuse"),
    q_risk_feel: likert("risk_feel"),
    q_transp_explained: likert("transp_explained"),
    q_transp_expect: likert("transp_expect"),
    q_id_unexpected: likert("id_unexpected", true),
    q_id_understood: likert("id_understood", true),
    q_recall_notice: choice("recall_notice"),
    q_prior_experience: choice("prior_experience"),
    q_id_availability: choice("id_availability"),
    q_breach_awareness: choice("breach_awareness"),
    q_open_influence: openText,
    q_stop_reasons: stopReasons,
    q_demo_gender: choice("demo_gender", { disabled: !demographicsOn }),
    q_demo_race: choice("demo_race", { disabled: !demographicsOn }),
    ms_consent_to_assent: guard(diff(m, "consent_shown", "assent")),
    ms_verification_to_initial_decision: guard(diff(m, "verification_shown", "initial_decision")),
    ms_simulation_duration: guard(diff(m, "simulation_start", "simulation_end")),
    ms_result_to_id_decision: guard(diff(m, "result_shown", "id_decision")),
    ms_questionnaire_duration: guard(submitted ? diff(m, "questionnaire_shown", "questionnaire_submit") : SPECIAL.NOT_REACHED),
    recruitment_code: recruitmentCode,
  };
  // Keep dictionary order.
  const ordered = {};
  for (const f of FIELDS) ordered[f.name] = record[f.name];
  return ordered;
}

// ---------------------------------------------------------------------------
// Persistence helpers (serialization only; the UI chooses where to keep it).

export function serializeSession(session) {
  return JSON.stringify(session);
}

export function restoreSession(json) {
  if (!json) return null;
  try {
    const s = JSON.parse(json);
    if (!s || s.schema !== 1 || typeof s.step !== "string") return null;
    if (!s.marks) s.marks = {};
    if (!s.submission) s.submission = { status: "not_started", error: null, attempts: 0 };
    // A reload while a save was in flight: treat as failed so the retry button appears.
    if (s.submission.status === "submitting") s.submission = { ...s.submission, status: "failed", error: "The page was reloaded before the submission finished." };
    return s;
  } catch {
    return null;
  }
}
