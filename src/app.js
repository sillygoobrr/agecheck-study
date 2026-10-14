// AgeCheck Study: participant interface.
//
// Renders one step at a time from the session state (src/engine.js) and
// persists the session in sessionStorage so a refresh or back navigation
// returns to the same step with the same condition. Records are written
// through the store chosen by the active configuration (src/storage.js).
//
// This file never requests camera or microphone access, never creates an
// upload field, and never reads anything from the device beyond its own
// browser storage.

import * as E from "./engine.js";
import { ageCategories } from "./study-config.js";
import { resolveConfig, participantStore, loadSessionJson, saveSessionJson, clearSession } from "./storage.js";

const root = document.getElementById("app");
const headerRight = document.getElementById("header-right");

let config = null;
let configSource = "default";
let store = null;
let session = null;
let ui = { confirmingWithdraw: false, error: null };
let simulationTimer = null;
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------------------
// Helpers

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphs(text) {
  return String(text ?? "")
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function persist() {
  saveSessionJson(E.serializeSession(session));
}

function isPreview() {
  return config.mode !== "research";
}

function forcedConditionFromUrl() {
  if (!isPreview()) return null;
  const v = (params.get("condition") || "").toLowerCase();
  if (v === "advance" || v === "advance_notice") return E.CONDITION.ADVANCE;
  if (v === "later" || v === "later_notice") return E.CONDITION.LATER;
  return null;
}

/** Save the current record quietly at milestones. Errors here are not fatal; the final submission reports errors. */
async function saveProgress() {
  if (!store || !E.hasRecord(session)) return;
  try {
    await store.save(E.buildRecord(session, config));
  } catch {
    /* reported at submission time */
  }
}

function focusHeading() {
  const h = root.querySelector("h1, h2");
  if (h) {
    h.setAttribute("tabindex", "-1");
    h.focus({ preventScroll: false });
  }
  window.scrollTo({ top: 0 });
}

function keepHistoryOnPage() {
  // After assent, keep the browser's Back button from leaving the study. The
  // step and condition live in the session, so Back cannot change either.
  if (E.hasRecord(session) && !(history.state && history.state.agecheck)) {
    history.pushState({ agecheck: true }, "");
  }
}

// ---------------------------------------------------------------------------
// Header

function renderHeader() {
  const parts = [];
  if (isPreview()) {
    parts.push(`<span class="badge badge-preview">Preview mode: no research data is collected</span>`);
  } else {
    parts.push(`<span class="badge badge-research">Research mode</span>`);
  }
  if (E.canWithdraw(session)) {
    parts.push(`<button type="button" class="link-btn" id="withdraw-link">${esc(config.withdrawal.linkLabel)}</button>`);
  }
  headerRight.innerHTML = parts.join("");
  const w = headerRight.querySelector("#withdraw-link");
  if (w) {
    w.addEventListener("click", () => {
      ui.confirmingWithdraw = true;
      render();
    });
  }
}

// ---------------------------------------------------------------------------
// Views

function viewIntro() {
  const c = config.intro;
  return `
    <section class="card">
      <h1>${esc(c.heading)}</h1>
      ${paragraphs(c.body)}
      <p class="muted small">This app does not use your camera or microphone and has no way to upload files.</p>
      <div class="actions"><button type="button" class="btn" id="intro-continue">${esc(c.continueLabel)}</button></div>
    </section>`;
}

function viewEligibility() {
  const cats = ageCategories(config);
  const rc = config.eligibility.recruitmentCode;
  return `
    <section class="card">
      <h1>Before you begin</h1>
      <p class="muted">These questions check whether you meet the study's approved eligibility requirements. They do not ask for your birth date or address.</p>
      <form id="eligibility-form" novalidate>
        <fieldset>
          <legend>Which age group are you in?</legend>
          <div class="choice-list">
            ${cats
              .map(
                (c) => `<label class="choice"><input type="radio" name="ageCategory" value="${esc(c.value)}" /> <span>${esc(c.label)}</span></label>`
              )
              .join("")}
          </div>
        </fieldset>
        <fieldset>
          <legend>Recruitment</legend>
          <label class="choice"><input type="checkbox" name="meetsCriteria" value="yes" /> <span>${esc(config.eligibility.recruitmentCriteriaText)}</span></label>
        </fieldset>
        ${
          rc && rc.enabled
            ? `<div class="field-row">
                <label class="block" for="recruitmentCode">${esc(rc.label)}</label>
                <input type="text" id="recruitmentCode" name="recruitmentCode" autocomplete="off" maxlength="16" />
                <p class="help">${esc(rc.help)}</p>
              </div>`
            : ""
        }
        <p class="error" id="eligibility-error" role="alert" hidden></p>
        <div class="actions"><button type="submit" class="btn">Continue</button></div>
      </form>
    </section>`;
}

function viewIneligible() {
  return `
    <section class="card">
      <h1>Thank you</h1>
      ${paragraphs(config.eligibility.ineligibleMessage)}
    </section>`;
}

function viewConsent() {
  const c = config.consent;
  const block = (title, text) => `<div class="section"><h3>${esc(title)}</h3>${paragraphs(text)}</div>`;
  return `
    <section class="card">
      <h1>${esc(c.heading)}</h1>
      <p class="muted small">Read this information before deciding. It is the same for everyone in the study.</p>
      ${block("What you will do", config.intro.body)}
      ${block("Who is doing this research", `${c.researcherContact}\n\n${c.supervisorContact}`)}
      ${block("Who can take part", c.participationRequirements)}
      ${block("What the research app records", c.dataCollected)}
      ${block("How the information is stored and who can see it", c.storageAndAccess)}
      ${block("Leaving the study", c.withdrawal)}
      ${block("How long it takes", c.duration)}
      ${block("Parental permission", c.parentalPermissionNote)}
      <div class="notice-box">
        <p class="small muted tight">The fictional platform inside the study will ask you to make choices about an age check. Those choices are part of the simulation. Only the research app collects anything, and only what is listed above.</p>
      </div>
      <form id="consent-form" novalidate>
        <label class="choice"><input type="checkbox" name="assent" value="yes" /> <span>${esc(c.assentStatement)}</span></label>
        <p class="error" id="consent-error" role="alert" hidden></p>
        <div class="actions">
          <button type="submit" class="btn">${esc(c.agreeLabel)}</button>
          <button type="button" class="btn btn-secondary" id="consent-decline">${esc(c.declineLabel)}</button>
        </div>
      </form>
    </section>`;
}

function viewNotParticipating() {
  return `
    <section class="card">
      <h1>Thank you</h1>
      ${paragraphs(config.consent.declinedMessage)}
    </section>`;
}

function platformFrame(inner, { title = config.platformName } = {}) {
  return `
    <div class="platform" aria-label="Fictional platform screen">
      <div class="platform-bar"><span>${esc(title)}</span><span class="platform-tag">Fictional platform · simulation</span></div>
      <div class="platform-body">${inner}</div>
    </div>`;
}

function viewScenario() {
  const c = config.scenario;
  return `
    <section class="card">
      <h1>${esc(c.heading)}</h1>
      ${paragraphs(c.body)}
      <div class="actions"><button type="button" class="btn" id="scenario-continue">${esc(c.continueLabel)}</button></div>
    </section>`;
}

function viewVerification() {
  const v = config.verification;
  const advance = session.condition === E.CONDITION.ADVANCE;
  const notice = advance ? `<p id="notice-sentence">${esc(v.advanceNoticeSentence)}</p>` : "";
  return `
    <section class="card">
      ${platformFrame(`
        <h2>${esc(v.heading)}</h2>
        <p>${esc(v.body)}</p>
        <div class="notice-slot" data-condition="${esc(session.condition)}">${notice}</div>
        <div class="actions-equal">
          <button type="button" class="btn btn-choice" id="verify-start">${esc(v.startLabel)}</button>
          <button type="button" class="btn btn-choice" id="verify-decline">${esc(v.declineLabel)}</button>
        </div>
      `)}
      <p class="study-note">Study note: this is a simulation. Choose as you would on a real platform. Declining the platform's verification is not the same as withdrawing from the study.</p>
    </section>`;
}

function faceSvg() {
  return `
    <svg viewBox="0 0 160 160" role="img" aria-label="Abstract face outline placeholder" focusable="false">
      <rect x="8" y="8" width="144" height="144" rx="18" fill="none" stroke="#c7cfda" stroke-width="3" stroke-dasharray="8 6" />
      <ellipse cx="80" cy="78" rx="38" ry="46" fill="none" stroke="#3a4a63" stroke-width="3" />
      <circle cx="66" cy="70" r="3.5" fill="#3a4a63" />
      <circle cx="94" cy="70" r="3.5" fill="#3a4a63" />
      <path d="M68 98 Q80 108 92 98" fill="none" stroke="#3a4a63" stroke-width="3" stroke-linecap="round" />
      <path d="M28 40 V22 H46 M114 22 H132 V40 M28 120 V138 H46 M114 138 H132 V120" fill="none" stroke="#3a4a63" stroke-width="3" stroke-linecap="round" />
    </svg>`;
}

function viewSimulation() {
  const s = config.simulation;
  return `
    <section class="card">
      ${platformFrame(`
        <span class="sim-label">${esc(s.label)}</span>
        <div class="sim-figure">${faceSvg()}</div>
        <div class="progress" role="progressbar" aria-label="${esc(s.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="sim-progress">
          <div class="progress-fill" id="sim-fill"></div>
        </div>
        <p class="sim-status" id="sim-status" aria-live="polite">${esc(s.status)}</p>
      `)}
      <p class="muted small">No camera is used. This screen is a fixed animation.</p>
    </section>`;
}

function viewResult() {
  const r = config.result;
  return `
    <section class="card">
      ${platformFrame(`
        <h2>${esc(r.line1)}</h2>
        <p>${esc(r.line2)}</p>
        <p><strong>${esc(r.line3)}</strong></p>
        <div class="actions-equal">
          <button type="button" class="btn btn-choice" id="id-continue">${esc(r.continueLabel)}</button>
          <button type="button" class="btn btn-choice" id="id-stop">${esc(r.stopLabel)}</button>
        </div>
      `)}
    </section>`;
}

function viewConfirmation() {
  let text;
  if (session.idDecision === E.ID.CONTINUE) text = config.result.continueConfirmation;
  else if (session.idDecision === E.ID.STOP) text = config.result.stopConfirmation;
  else text = config.verification.declinedMessage;
  return `
    <section class="card">
      ${platformFrame(`<h2>${esc(text)}</h2>`)}
      <p class="muted">The simulation is over. The next screen has a short questionnaire from the research app.</p>
      <div class="actions"><button type="button" class="btn" id="to-questionnaire">${esc(config.result.nextLabel)}</button></div>
    </section>`;
}

function likertItem(item, scale) {
  return `
    <fieldset class="likert" data-item="${esc(item.id)}">
      <legend>${esc(item.text)}</legend>
      <div class="likert-options">
        ${scale
          .map(
            (s) => `<label class="choice"><input type="radio" name="${esc(item.id)}" value="${s.value}" /> <span>${s.value} · ${esc(s.label)}</span></label>`
          )
          .join("")}
      </div>
    </fieldset>`;
}

function choiceItem(item, { multiple = false } = {}) {
  const type = multiple ? "checkbox" : "radio";
  return `
    <fieldset data-item="${esc(item.id)}">
      <legend>${esc(item.text)}</legend>
      <div class="choice-list">
        ${item.options
          .map((o) => `<label class="choice"><input type="${type}" name="${esc(item.id)}" value="${esc(o.value)}" /> <span>${esc(o.label)}</span></label>`)
          .join("")}
      </div>
    </fieldset>`;
}

function viewQuestionnaire() {
  const q = config.questionnaire;
  const reachedId = session.reachedResult === true;
  const pathway = E.finalPathway(session);
  const declinedOrStopped = pathway === "declined_before_check" || pathway === "stopped_at_id_request";
  const items = q.items.filter((it) => !it.onlyIfReachedIdPrompt || reachedId);
  const sub = session.submission;
  const submitting = sub.status === "submitting";
  const failed = sub.status === "failed";
  return `
    <section class="card">
      <h1>${esc(q.heading)}</h1>
      <p>${esc(q.instruction)}</p>
      <form id="questionnaire-form" novalidate>
        <p class="scale-key">${q.scale.map((s) => `${s.value} = ${esc(s.label)}`).join(" · ")}</p>
        ${items.map((it) => likertItem(it, q.scale)).join("")}
        <div class="section"></div>
        ${choiceItem(q.recall)}
        ${choiceItem(q.priorExperience)}
        ${choiceItem(q.idAvailability)}
        ${choiceItem(q.breachAwareness)}
        <div class="field-row">
          <label class="block" for="open_influence">${esc(q.openEnded.text)}</label>
          <textarea id="open_influence" name="open_influence" maxlength="${q.openEnded.maxLength}"></textarea>
          <p class="help">Optional. Do not include your name or other personal details.</p>
        </div>
        ${declinedOrStopped ? choiceItem(q.stopReasons, { multiple: true }) : ""}
        ${config.demographics.enabled ? config.demographics.items.map((it) => choiceItem(it)).join("") : ""}
        ${
          failed
            ? `<div class="notice-box danger" role="alert">
                <p><strong>Your answers were not submitted.</strong> ${esc(sub.error)}</p>
                <p class="small tight">Your answers are still on this page. You can try again. Nothing is lost by retrying, and retrying will not create a duplicate record.</p>
              </div>`
            : ""
        }
        <div class="actions">
          <button type="submit" class="btn" id="submit-btn" ${submitting ? 'disabled aria-disabled="true"' : ""}>
            ${submitting ? "Submitting…" : failed ? "Try again" : esc(q.submitLabel)}
          </button>
        </div>
        <p class="help">You can leave any question blank.</p>
      </form>
    </section>`;
}

function viewDebrief() {
  const d = config.debrief;
  return `
    <section class="card">
      <h1>${esc(d.heading)}</h1>
      ${paragraphs(d.body)}
      ${paragraphs(d.scope)}
      <div class="section">
        <h3>If you want your answers removed</h3>
        ${paragraphs(config.consent.withdrawal)}
        <p>${esc(d.responseCodeIntro)}</p>
        <div class="code" id="response-code">${esc(session.responseCode)}</div>
      </div>
      <div class="actions"><button type="button" class="btn" id="finish-btn">${esc(d.finishLabel)}</button></div>
    </section>`;
}

function viewFinished() {
  return `
    <section class="card">
      <h1>Thank you</h1>
      ${paragraphs(config.debrief.finishedMessage)}
      <p class="muted small">Your response code: <strong>${esc(session.responseCode)}</strong></p>
      <div class="actions"><button type="button" class="btn btn-secondary" id="new-session">Start a new session on this device</button></div>
    </section>`;
}

function viewWithdrawn() {
  return `
    <section class="card">
      <h1>Withdrawn</h1>
      ${paragraphs(config.withdrawal.withdrawnMessage)}
      <p class="muted small">Response code for any later request about this session: <strong>${esc(session.responseCode)}</strong></p>
      <div class="actions"><button type="button" class="btn btn-secondary" id="new-session">Start a new session on this device</button></div>
    </section>`;
}

function viewCollectionDisabled() {
  return `
    <section class="card">
      <h1>Collection is not configured</h1>
      <p>This app is in research mode, but no storage configuration is active, so it cannot run participants. The researcher must complete the configuration in the dashboard before collection.</p>
    </section>`;
}

function withdrawDialog() {
  const w = config.withdrawal;
  return `
    <div class="overlay" id="withdraw-overlay">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="withdraw-title">
        <h2 id="withdraw-title">${esc(w.heading)}</h2>
        ${paragraphs(w.body)}
        <div class="actions">
          <button type="button" class="btn btn-secondary" id="withdraw-cancel">${esc(w.cancelLabel)}</button>
          <button type="button" class="btn" id="withdraw-confirm">${esc(w.confirmLabel)}</button>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Render and wire

function render() {
  if (simulationTimer) {
    clearTimeout(simulationTimer);
    simulationTimer = null;
  }
  renderHeader();
  keepHistoryOnPage();

  if (!isPreview() && !store) {
    root.innerHTML = viewCollectionDisabled();
    return;
  }

  const views = {
    intro: viewIntro,
    eligibility: viewEligibility,
    ineligible: viewIneligible,
    consent: viewConsent,
    not_participating: viewNotParticipating,
    scenario: viewScenario,
    verification: viewVerification,
    simulation: viewSimulation,
    result: viewResult,
    confirmation: viewConfirmation,
    questionnaire: viewQuestionnaire,
    debrief: viewDebrief,
    finished: viewFinished,
    withdrawn: viewWithdrawn,
  };
  const view = views[session.step] || viewIntro;
  root.innerHTML = view() + (ui.confirmingWithdraw ? withdrawDialog() : "");
  root.dataset.step = session.step;
  renderedAt = performance.now();
  wire();
  if (ui.confirmingWithdraw) {
    root.querySelector("#withdraw-cancel").focus();
  } else {
    focusHeading();
  }
}

let renderedAt = 0;
const SETTLE_MS = 350;

function on(id, event, handler) {
  const el = root.querySelector(`#${id}`);
  if (!el) return;
  if (event === "click") {
    // The second half of a double click (detail >= 2) that lands within a
    // few hundred milliseconds of a new screen appearing was meant for the
    // previous screen. Ignore it so no screen is skipped by accident.
    el.addEventListener(event, (ev) => {
      if (ev.detail >= 2 && performance.now() - renderedAt < SETTLE_MS) return;
      handler(ev);
    });
  } else {
    el.addEventListener(event, handler);
  }
}

function wire() {
  on("intro-continue", "click", () => {
    E.begin(session);
    persist();
    render();
  });

  on("eligibility-form", "submit", (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const age = form.querySelector('input[name="ageCategory"]:checked');
    const err = form.querySelector("#eligibility-error");
    if (!age) {
      err.textContent = "Choose an age group to continue.";
      err.hidden = false;
      form.querySelector('input[name="ageCategory"]').focus();
      return;
    }
    const codeEl = form.querySelector('input[name="recruitmentCode"]');
    E.submitEligibility(session, config, {
      ageCategory: age.value,
      meetsCriteria: form.querySelector('input[name="meetsCriteria"]').checked,
      recruitmentCode: codeEl ? codeEl.value : null,
    });
    persist();
    render();
  });

  on("consent-form", "submit", async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const err = form.querySelector("#consent-error");
    if (!form.querySelector('input[name="assent"]').checked) {
      err.textContent = "Check the box to agree, or choose the other option.";
      err.hidden = false;
      form.querySelector('input[name="assent"]').focus();
      return;
    }
    E.giveAssent(session, config, { forcedCondition: forcedConditionFromUrl() });
    persist();
    render();
    await saveProgress();
  });

  on("consent-decline", "click", () => {
    E.declineAssent(session);
    persist();
    render();
  });

  on("scenario-continue", "click", () => {
    E.continueScenario(session);
    persist();
    render();
  });

  if (session.step === "verification") {
    // The card for the assigned condition is now in the DOM.
    E.confirmVerificationDisplayed(session);
    persist();
    on("verify-start", "click", async () => {
      E.initialDecision(session, E.INITIAL.START);
      persist();
      render();
      await saveProgress();
    });
    on("verify-decline", "click", async () => {
      E.initialDecision(session, E.INITIAL.DECLINE);
      persist();
      render();
      await saveProgress();
    });
  }

  if (session.step === "simulation") runSimulation();

  on("id-continue", "click", async () => {
    E.idDecision(session, E.ID.CONTINUE);
    persist();
    render();
    await saveProgress();
  });
  on("id-stop", "click", async () => {
    E.idDecision(session, E.ID.STOP);
    persist();
    render();
    await saveProgress();
  });

  on("to-questionnaire", "click", () => {
    E.beginQuestionnaire(session);
    persist();
    render();
  });

  if (session.step === "questionnaire") {
    restoreAnswers();
    on("questionnaire-form", "submit", (ev) => {
      ev.preventDefault();
      submitAnswers(readAnswers(ev.currentTarget));
    });
  }

  on("finish-btn", "click", () => {
    E.finish(session);
    persist();
    render();
  });

  on("new-session", "click", () => {
    clearSession();
    session = E.createSession();
    ui = { confirmingWithdraw: false, error: null };
    render();
  });

  on("withdraw-cancel", "click", () => {
    ui.confirmingWithdraw = false;
    render();
  });
  on("withdraw-confirm", "click", async () => {
    ui.confirmingWithdraw = false;
    E.withdraw(session);
    persist();
    render();
    await saveProgress();
  });
  if (ui.confirmingWithdraw) {
    root.querySelector("#withdraw-overlay").addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ui.confirmingWithdraw = false;
        render();
      }
    });
  }
}

function runSimulation() {
  // A refresh during the simulation restarts the fixed animation.
  E.restartSimulation(session);
  persist();
  const fill = root.querySelector("#sim-fill");
  const bar = root.querySelector("#sim-progress");
  const duration = config.simulation.durationMs;
  const started = performance.now();
  requestAnimationFrame(() => {
    if (fill) fill.classList.add("running");
  });
  const tick = () => {
    const pct = Math.min(100, Math.round(((performance.now() - started) / duration) * 100));
    if (bar) bar.setAttribute("aria-valuenow", String(pct));
    if (pct < 100 && session.step === "simulation") requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  simulationTimer = setTimeout(() => {
    simulationTimer = null;
    if (session.step !== "simulation") return;
    E.simulationComplete(session);
    persist();
    render();
  }, duration);
}

function readAnswers(form) {
  const data = new FormData(form);
  const answers = {};
  for (const [key, value] of data.entries()) {
    if (key === "stop_reasons") {
      (answers.stop_reasons ||= []).push(String(value));
    } else {
      answers[key] = String(value);
    }
  }
  return answers;
}

function restoreAnswers() {
  const prev = session.questionnaire;
  if (!prev) return;
  const form = root.querySelector("#questionnaire-form");
  for (const [key, value] of Object.entries(prev)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        const box = form.querySelector(`input[name="${key}"][value="${CSS.escape(v)}"]`);
        if (box) box.checked = true;
      }
    } else {
      const radio = form.querySelector(`input[name="${key}"][value="${CSS.escape(value)}"]`);
      if (radio) radio.checked = true;
      const ta = form.querySelector(`textarea[name="${key}"]`);
      if (ta) ta.value = value;
    }
  }
}

async function submitAnswers(answers) {
  const before = session.submission.status;
  if (before === "submitting" || before === "submitted") return;
  if (before === "failed") E.retrySubmit(session);
  else E.submitQuestionnaire(session, answers);
  if (before === "failed") session.questionnaire = E.sanitizeAnswers(answers);
  persist();
  render();
  try {
    if (isPreview() && params.get("failSubmit") === "1" && session.submission.attempts === 1) {
      throw new Error("Simulated submission failure (preview test hook).");
    }
    await store.save(E.buildRecord(session, config));
    E.markSubmitted(session);
  } catch (err) {
    E.markSubmitFailed(session, err && err.message ? err.message : "Submission failed.");
  }
  persist();
  render();
}

// ---------------------------------------------------------------------------
// Boot

async function init() {
  const resolved = await resolveConfig();
  config = resolved.config;
  configSource = resolved.source;
  store = participantStore(config);
  document.title = config.appName;

  if (params.get("reset") === "1") {
    clearSession();
    params.delete("reset");
    const qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : ""));
  }
  session = E.restoreSession(loadSessionJson()) || E.createSession();

  // Diagnostics for the researcher, nothing personal.
  root.dataset.mode = config.mode;
  root.dataset.configSource = configSource;
  root.dataset.studyVersion = config.studyVersion;

  window.addEventListener("popstate", () => {
    if (E.hasRecord(session)) history.pushState({ agecheck: true }, "");
    render();
  });
  render();
}

init().catch((err) => {
  root.innerHTML = `<section class="card"><h1>Something went wrong</h1><p>${esc(err && err.message ? err.message : String(err))}</p></section>`;
});
