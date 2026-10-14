// AgeCheck Study: researcher dashboard.
//
// Shows counts by condition and pathway, the records behind them, exports,
// the data dictionary, deletion by response code, demo-data tools, and the
// study configuration editor with the activation checks for research mode.
//
// Demo data and research data are separate stores with separate exports and
// are never shown together. This page carries no secret: in remote mode the
// server checks the admin token on every request.

import { FIELDS, PATHWAYS, PATHWAY_LABELS, CONDITIONS, CONDITION_LABELS } from "./data-dictionary.js";
import { activationProblems, mergeConfig, cloneConfig, DEFAULT_STUDY_CONFIG, findPlaceholders } from "./study-config.js";
import {
  resolveConfig,
  loadLocalConfig,
  saveLocalConfig,
  clearLocalConfig,
  demoStore,
  localResearchStore,
  RemoteRecordStore,
  getAdminToken,
  setAdminToken,
} from "./storage.js";
import { generateDemoRecords } from "./demo-data.js";
import { toCSV, toJSON, dictionaryToCSV, downloadText } from "./export.js";

const root = document.getElementById("app");

const state = {
  config: null, // the editable configuration (local copy)
  activeConfig: null, // what the participant app would actually use
  activeSource: "default",
  tab: "overview",
  source: "demo", // "demo" | "research"
  records: [],
  loadError: null,
  message: null,
  problems: null,
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pct(n, d) {
  if (!d) return "–";
  return `${((100 * n) / d).toFixed(1)}%`;
}

function researchAvailable() {
  const c = state.activeConfig;
  return c.mode === "research" && c.storage && c.storage.adapter !== "none";
}

function currentStore() {
  if (state.source === "demo") return demoStore();
  const c = state.activeConfig;
  if (c.storage.adapter === "remote-endpoint") {
    return new RemoteRecordStore({ endpointUrl: c.storage.endpointUrl, submitToken: "" });
  }
  return localResearchStore();
}

async function loadRecords() {
  state.loadError = null;
  try {
    const store = currentStore();
    if (store.kind === "remote") {
      const token = getAdminToken();
      if (!token) {
        state.records = [];
        state.loadError = "Enter the admin token to load records from the server.";
        return;
      }
      state.records = await store.list(token);
    } else {
      state.records = await store.list();
    }
  } catch (err) {
    state.records = [];
    state.loadError = err.message;
  }
}

// ---------------------------------------------------------------------------
// Tabs

const TABS = [
  ["overview", "Overview"],
  ["records", "Records"],
  ["export", "Export"],
  ["dictionary", "Data dictionary"],
  ["delete", "Delete by code"],
  ["demo", "Demo data"],
  ["config", "Configuration"],
];

function modeBanner() {
  const c = state.activeConfig;
  const srcText = {
    file: "study.config.json served next to the page (deployed configuration). Edits saved in this browser do not change it.",
    local: "the configuration saved in this browser. It applies to the participant app in this browser only.",
    default: "the built-in defaults. Nothing has been configured yet.",
  }[state.activeSource];
  const storageText =
    c.mode !== "research"
      ? "Preview mode. Participant runs are saved as clearly marked walkthrough records in the demo store. No research data is collected."
      : c.storage.adapter === "local-device"
        ? "Research mode with local-device storage. Records are kept in the participant browser's local storage on that device only. A participant on another device is NOT collected anywhere. Use this only for in-person sessions on a device you control, and export after each session."
        : c.storage.adapter === "remote-endpoint"
          ? `Research mode with a remote endpoint (${esc(c.storage.endpointUrl)}). Records are sent to that server, so collection works across devices while it is reachable. Check what the host logs (IP addresses, timestamps) before promising anonymity.`
          : "Research mode without storage. Collection is disabled.";
  return `
    <div class="notice-box ${c.mode === "research" ? "" : "warn"}">
      <p class="tight"><strong>${c.mode === "research" ? "Research mode" : "Preview mode"}</strong> · study version ${esc(c.studyVersion)} · active configuration comes from ${srcText}</p>
      <p class="tight small muted">${storageText}</p>
    </div>`;
}

function sourceSwitch() {
    const ra = researchAvailable();
  return `
    <div class="inline" role="group" aria-label="Data source">
      <span><strong>Viewing:</strong></span>
      <button type="button" class="btn ${state.source === "demo" ? "" : "btn-secondary"}" data-source="demo">Demo data (synthetic and walkthroughs)</button>
      <button type="button" class="btn ${state.source === "research" ? "" : "btn-secondary"}" data-source="research" ${ra ? "" : "disabled"}>Research data${ra ? "" : " (research mode not active)"}</button>
    </div>
    ${
      state.source === "research" && state.activeConfig.storage.adapter === "remote-endpoint"
        ? `<div class="inline" style="margin-top:10px">
            <label class="block" for="admin-token">Admin token (kept for this tab only)</label>
            <input type="password" id="admin-token" autocomplete="off" value="${esc(getAdminToken())}" />
            <button type="button" class="btn btn-secondary" id="admin-token-save">Use token</button>
          </div>`
        : ""
    }
    ${state.loadError ? `<p class="error" role="alert">${esc(state.loadError)}</p>` : ""}
    <p class="small muted">${state.records.length} ${state.source === "demo" ? "demo" : "research"} record(s) loaded. Demo and research records are never combined.</p>`;
}

// ---------------------------------------------------------------------------
// Overview

function summarize(records) {
  const byCond = {};
  for (const cond of CONDITIONS) {
    const rs = records.filter((r) => r.condition === cond);
    const n = rs.length;
    const withdrawn = rs.filter((r) => r.final_pathway === "withdrawn").length;
    const declined = rs.filter((r) => r.initial_decision === "decline").length;
    const started = rs.filter((r) => r.initial_decision === "start").length;
    const reachedId = rs.filter((r) => r.reached_id_prompt === "yes").length;
    const stopped = rs.filter((r) => r.id_decision === "stop").length;
    const cont = rs.filter((r) => r.id_decision === "continue").length;
    const missingQ = rs.filter((r) => r.questionnaire_status !== "submitted").length;
    const incomplete = rs.filter((r) => r.final_pathway === "incomplete_session").length;
    byCond[cond] = { n, withdrawn, declined, started, reachedId, stopped, cont, missingQ, incomplete };
  }
  return byCond;
}

function viewOverview() {
  const rs = state.records;
  const s = summarize(rs);
  const cell = (cond, key) => s[cond][key];
  const rows = [
    ["Assigned (all records)", "n"],
    ["Declined before the simulated check", "declined"],
    ["Started the simulated check", "started"],
    ["Reached the ID prompt", "reachedId"],
    ["Stopped at the ID request", "stopped"],
    ["Would continue with ID verification", "cont"],
    ["Incomplete session", "incomplete"],
    ["Withdrawn from study", "withdrawn"],
    ["Questionnaire missing", "missingQ"],
  ];
  const pathwayTable = `
    <div class="table-wrap"><table>
      <thead><tr><th>Final pathway</th>${CONDITIONS.map((c) => `<th>${esc(CONDITION_LABELS[c])}</th>`).join("")}<th>Total</th></tr></thead>
      <tbody>
        ${PATHWAYS.map((p) => {
          const counts = CONDITIONS.map((c) => rs.filter((r) => r.condition === c && r.final_pathway === p).length);
          return `<tr><td>${esc(PATHWAY_LABELS[p])}</td>${counts.map((n) => `<td>${n}</td>`).join("")}<td>${counts.reduce((a, b) => a + b, 0)}</td></tr>`;
        }).join("")}
        <tr><th>Total</th>${CONDITIONS.map((c) => `<th>${s[c].n}</th>`).join("")}<th>${rs.length}</th></tr>
      </tbody>
    </table></div>`;
  const stageTable = `
    <div class="table-wrap"><table>
      <thead><tr><th>Count</th>${CONDITIONS.map((c) => `<th>${esc(CONDITION_LABELS[c])}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(([label, key]) => `<tr><td>${esc(label)}</td>${CONDITIONS.map((c) => `<td>${cell(c, key)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
  const outcome = `
    <div class="table-wrap"><table>
      <thead><tr><th>Primary completion outcome: would continue with ID</th>${CONDITIONS.map((c) => `<th>${esc(CONDITION_LABELS[c])}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td>Among all assigned (withdrawn included in denominator)</td>${CONDITIONS.map((c) => `<td>${s[c].cont} / ${s[c].n} (${pct(s[c].cont, s[c].n)})</td>`).join("")}</tr>
        <tr><td>Among all assigned, excluding withdrawn</td>${CONDITIONS.map((c) => `<td>${s[c].cont} / ${s[c].n - s[c].withdrawn} (${pct(s[c].cont, s[c].n - s[c].withdrawn)})</td>`).join("")}</tr>
        <tr><td>Initial stage only: started the check among all assigned</td>${CONDITIONS.map((c) => `<td>${s[c].started} / ${s[c].n} (${pct(s[c].started, s[c].n)})</td>`).join("")}</tr>
        <tr><td>ID stage only: would continue among those who reached the prompt (descriptive; this subgroup is shaped by earlier choices and is not a fair between-condition comparison)</td>${CONDITIONS.map((c) => `<td>${s[c].cont} / ${s[c].reachedId} (${pct(s[c].cont, s[c].reachedId)})</td>`).join("")}</tr>
      </tbody>
    </table></div>`;
  return `
    <section class="card">
      <h2>Counts by condition and pathway</h2>
      ${state.source === "demo" ? '<p class="small muted">These are demo records (synthetic data and preview walkthroughs). They say nothing about real participants.</p>' : ""}
      ${pathwayTable}
      <h3 class="section">Stage counts</h3>
      ${stageTable}
      <h3 class="section">Completion outcome</h3>
      ${outcome}
      <p class="small muted">Counts and proportions only. The dashboard performs no significance tests and computes no combined scores. Risk, transparency, unexpectedness, and recall items are stored individually in the export. Which denominator to use for withdrawn participants follows the approved withdrawal policy.</p>
    </section>`;
}

// ---------------------------------------------------------------------------
// Records

function viewRecords() {
  const cols = ["response_code", "record_kind", "condition", "initial_decision", "id_decision", "final_pathway", "submission_status", "questionnaire_status", "q_recall_notice"];
  return `
    <section class="card">
      <h2>Records</h2>
      <div class="table-wrap"><table>
        <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
        <tbody>
          ${state.records.length === 0 ? `<tr><td colspan="${cols.length}">No records.</td></tr>` : ""}
          ${state.records.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table></div>
      <p class="small muted">Full fields are in the export. Free-text answers are not shown here; review them in the export before sharing.</p>
    </section>`;
}

// ---------------------------------------------------------------------------
// Export

function viewExport() {
  const label = state.source === "demo" ? "demo" : "research";
  return `
    <section class="card">
      <h2>Export ${label} data</h2>
      <p>Exports contain only the approved fields in the data dictionary, in dictionary order. The file name states whether it is demo or research data.</p>
      <div class="actions">
        <button type="button" class="btn" id="export-csv">Download CSV (${state.records.length} records)</button>
        <button type="button" class="btn btn-secondary" id="export-json">Download JSON</button>
        <button type="button" class="btn btn-secondary" id="export-dict">Download data dictionary (CSV)</button>
      </div>
      <p class="small muted">Store exports where the approved data-storage plan says. Do not commit them to a repository.</p>
    </section>`;
}

// ---------------------------------------------------------------------------
// Dictionary

function viewDictionary() {
  return `
    <section class="card">
      <h2>Data dictionary</h2>
      <p>Special codes: <code>not_reached</code> (the step or item was never shown), <code>skipped</code> (shown and left blank), <code>missing</code> (questionnaire never submitted), <code>not_applicable</code> (does not apply to the pathway), <code>disabled</code> (turned off in configuration), <code>not_collected</code> (field turned off), <code>withheld</code> (removed under the withdrawal policy).</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Field</th><th>Type</th><th>Values</th><th>Special codes</th><th>Measure</th><th>Meaning</th></tr></thead>
        <tbody>
          ${FIELDS.map(
            (f) => `<tr><td><code>${esc(f.name)}</code></td><td>${esc(f.type)}</td><td>${esc((f.values || []).join(", "))}</td><td>${esc((f.special || []).join(", "))}</td><td>${esc(f.measure || "")}</td><td>${esc(f.description)}</td></tr>`
          ).join("")}
        </tbody>
      </table></div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Delete

function viewDelete() {
  return `
    <section class="card">
      <h2>Delete a record by response code</h2>
      <p>Participants receive a response code at the debrief and can ask for deletion with it alone. Deletion applies to the data source selected above (${state.source}).</p>
      <form id="delete-form" class="inline" novalidate>
        <label class="block" for="delete-code">Response code</label>
        <input type="text" id="delete-code" autocomplete="off" placeholder="ABCD-EFGH" maxlength="9" />
        <button type="submit" class="btn">Delete</button>
      </form>
      ${state.message ? `<p class="notice-box" role="status">${esc(state.message)}</p>` : ""}
    </section>`;
}

// ---------------------------------------------------------------------------
// Demo data

function viewDemo() {
  return `
    <section class="card">
      <h2>Demo data</h2>
      <p>Generate synthetic records that cover both conditions and every exit pathway. They are marked <code>synthetic_demo</code>, kept in the demo store, and never mixed with research data. Runs of the participant app in preview mode also land here, marked <code>preview_walkthrough</code>.</p>
      <form id="demo-form" class="inline" novalidate>
        <label class="block" for="demo-count">How many</label>
        <input type="text" id="demo-count" inputmode="numeric" value="40" />
        <button type="submit" class="btn">Generate (replace demo set)</button>
        <button type="button" class="btn btn-secondary" id="demo-clear">Clear all demo records</button>
      </form>
      ${state.message ? `<p class="notice-box" role="status">${esc(state.message)}</p>` : ""}
    </section>`;
}

// ---------------------------------------------------------------------------
// Configuration

function textField(id, label, value, { rows = 3, help = "", disabled = false } = {}) {
  return `
    <div class="field-row">
      <label class="block" for="${id}">${esc(label)}</label>
      <textarea id="${id}" rows="${rows}" ${disabled ? "disabled" : ""}>${esc(value)}</textarea>
      ${help ? `<p class="help">${esc(help)}</p>` : ""}
    </div>`;
}

function inputField(id, label, value, { type = "text", help = "", disabled = false } = {}) {
  return `
    <div class="field-row">
      <label class="block" for="${id}">${esc(label)}</label>
      <input type="${type}" id="${id}" value="${esc(value)}" ${disabled ? "disabled" : ""} autocomplete="off" />
      ${help ? `<p class="help">${esc(help)}</p>` : ""}
    </div>`;
}

function viewConfig() {
  const c = state.config;
  const frozen = c.mode === "research";
  const d = frozen;
  const placeholders = findPlaceholders(c);
  return `
    <section class="card">
      <h2>Study configuration</h2>
      ${
        frozen
          ? `<div class="notice-box"><p class="tight"><strong>Frozen.</strong> Research mode was activated${c.activatedOn ? ` on ${esc(c.activatedOn)}` : ""} for study version ${esc(c.studyVersion)}. Condition wording, the scenario, and the questionnaire cannot change while collection runs. To change anything, return to preview mode, export existing data first, and activate a new version.</p></div>`
          : `<div class="notice-box warn"><p class="tight">Preview mode. Edit, save to this browser, then check the activation requirements. ${placeholders.length} placeholder field(s) still need wording.</p></div>`
      }
      <form id="config-form" novalidate>
        <h3>Version</h3>
        ${inputField("cfg-version", "Study version", c.studyVersion, { disabled: d, help: 'Set a non-draft value before activation, for example "1.0.0". Change it for any later revision.' })}

        <h3 class="section">Eligibility and recruitment</h3>
        <div class="grid grid-2">
          ${inputField("cfg-minAge", "Minimum approved age", c.eligibility.minAge, { type: "number", disabled: d })}
          ${inputField("cfg-maxAge", "Maximum approved age", c.eligibility.maxAge, { type: "number", disabled: d })}
        </div>
        ${textField("cfg-criteria", "Recruitment criteria statement (participant checks this box)", c.eligibility.recruitmentCriteriaText, { rows: 2, disabled: d })}
        <label class="choice"><input type="checkbox" id="cfg-rc-enabled" ${c.eligibility.recruitmentCode.enabled ? "checked" : ""} ${d ? "disabled" : ""} /> <span>Ask for an optional recruitment code (only if approved; codes must not contain names or student IDs)</span></label>

        <h3 class="section">Study information and assent wording</h3>
        <p class="small muted">Identical for both conditions. Replace every [PLACEHOLDER].</p>
        ${textField("cfg-researcher", "Researcher contact", c.consent.researcherContact, { rows: 2, disabled: d })}
        ${textField("cfg-supervisor", "Supervisor or teacher contact", c.consent.supervisorContact, { rows: 2, disabled: d })}
        ${textField("cfg-requirements", "Approved participation requirements", c.consent.participationRequirements, { rows: 3, disabled: d })}
        ${textField("cfg-data", "What the research app actually records", c.consent.dataCollected, { rows: 5, disabled: d, help: "Must match the data dictionary. State what the hosting service logs." })}
        ${textField("cfg-storage-text", "Data storage, access, and retention", c.consent.storageAndAccess, { rows: 4, disabled: d })}
        ${textField("cfg-withdrawal-text", "Withdrawal procedure", c.consent.withdrawal, { rows: 3, disabled: d, help: "Also shown at the debrief with the response code." })}
        ${textField("cfg-duration", "Expected duration", c.consent.duration, { rows: 1, disabled: d })}
        ${textField("cfg-parental", "Parental permission note", c.consent.parentalPermissionNote, { rows: 3, disabled: d })}

        <h3 class="section">Withdrawal policy</h3>
        <div class="field-row">
          <label class="block" for="cfg-retain">If a participant withdraws mid-session</label>
          <select id="cfg-retain" ${d ? "disabled" : ""}>
            <option value="false" ${!c.withdrawal.retainPartialResponses ? "selected" : ""}>Keep only the fact of withdrawal, the condition, and the step reached (responses withheld)</option>
            <option value="true" ${c.withdrawal.retainPartialResponses ? "selected" : ""}>Keep partial responses, marked withdrawn</option>
          </select>
        </div>

        <h3 class="section">Optional demographics</h3>
        <label class="choice"><input type="checkbox" id="cfg-demo-enabled" ${c.demographics.enabled ? "checked" : ""} ${d ? "disabled" : ""} /> <span>Ask optional gender and race/ethnicity questions (only if approved and justified by the research plan)</span></label>

        <h3 class="section">Storage</h3>
        <div class="field-row">
          <label class="block" for="cfg-adapter">Where research records go</label>
          <select id="cfg-adapter" ${d ? "disabled" : ""}>
            <option value="none" ${c.storage.adapter === "none" ? "selected" : ""}>Not configured (collection disabled)</option>
            <option value="local-device" ${c.storage.adapter === "local-device" ? "selected" : ""}>This device only (browser local storage; in-person sessions on a researcher-controlled device)</option>
            <option value="remote-endpoint" ${c.storage.adapter === "remote-endpoint" ? "selected" : ""}>Remote endpoint (the reference server in server/, works across devices)</option>
          </select>
        </div>
        ${inputField("cfg-endpoint", "Endpoint URL (remote only)", c.storage.endpointUrl, { disabled: d, help: "For example https://your-host.example. The app posts to <URL>/api/submit." })}
        ${inputField("cfg-token", "Submit token (remote only)", c.storage.submitToken, { type: "password", disabled: d, help: "Must match AGECHECK_SUBMIT_TOKEN on the server. It only allows submitting; it cannot read records." })}

        <div class="actions">
          <button type="submit" class="btn" ${d ? "disabled" : ""}>Save to this browser</button>
          <button type="button" class="btn btn-secondary" id="cfg-check">Check activation requirements</button>
          ${frozen ? `<button type="button" class="btn btn-secondary" id="cfg-deactivate">Return to preview mode</button>` : `<button type="button" class="btn" id="cfg-activate">Activate research mode</button>`}
        </div>
        ${
          state.problems
            ? state.problems.length
              ? `<div class="notice-box danger" role="alert"><p class="tight"><strong>Not ready for activation:</strong></p><ul>${state.problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>`
              : `<div class="notice-box" role="status"><p class="tight">All activation requirements are met.</p></div>`
            : ""
        }
        ${state.message ? `<p class="notice-box" role="status">${esc(state.message)}</p>` : ""}
      </form>

      <h3 class="section">Deploying the configuration</h3>
      <p class="small">The participant app uses, in order: a <code>study.config.json</code> file served next to it, then the configuration saved in its own browser, then the defaults. To deploy a frozen configuration, download it and place it next to <code>index.html</code>, or push it to the reference server, which serves it at that path.</p>
      <div class="actions">
        <button type="button" class="btn btn-secondary" id="cfg-download">Download study.config.json</button>
        <button type="button" class="btn btn-secondary" id="cfg-push" ${c.storage.adapter === "remote-endpoint" ? "" : "disabled"}>Push to server (admin token)</button>
        <button type="button" class="btn btn-secondary" id="cfg-reset" ${d ? "disabled" : ""}>Reset to defaults</button>
      </div>
      <div class="field-row section">
        <label class="block" for="cfg-import">Import a study.config.json by pasting its contents</label>
        <textarea id="cfg-import" rows="4" ${d ? "disabled" : ""}></textarea>
        <div class="actions"><button type="button" class="btn btn-secondary" id="cfg-import-btn" ${d ? "disabled" : ""}>Import</button></div>
      </div>
    </section>`;
}

function readConfigForm() {
  const c = cloneConfig(state.config);
  const v = (id) => root.querySelector(`#${id}`).value;
  c.studyVersion = v("cfg-version").trim();
  c.eligibility.minAge = parseInt(v("cfg-minAge"), 10);
  c.eligibility.maxAge = parseInt(v("cfg-maxAge"), 10);
  c.eligibility.recruitmentCriteriaText = v("cfg-criteria").trim();
  c.eligibility.recruitmentCode.enabled = root.querySelector("#cfg-rc-enabled").checked;
  c.consent.researcherContact = v("cfg-researcher").trim();
  c.consent.supervisorContact = v("cfg-supervisor").trim();
  c.consent.participationRequirements = v("cfg-requirements").trim();
  c.consent.dataCollected = v("cfg-data").trim();
  c.consent.storageAndAccess = v("cfg-storage-text").trim();
  c.consent.withdrawal = v("cfg-withdrawal-text").trim();
  c.consent.duration = v("cfg-duration").trim();
  c.consent.parentalPermissionNote = v("cfg-parental").trim();
  c.withdrawal.retainPartialResponses = v("cfg-retain") === "true";
  c.demographics.enabled = root.querySelector("#cfg-demo-enabled").checked;
  c.storage.adapter = v("cfg-adapter");
  c.storage.endpointUrl = v("cfg-endpoint").trim();
  c.storage.submitToken = v("cfg-token").trim();
  return c;
}

// ---------------------------------------------------------------------------
// Render

function render() {
  const views = {
    overview: viewOverview,
    records: viewRecords,
    export: viewExport,
    dictionary: viewDictionary,
    delete: viewDelete,
    demo: viewDemo,
    config: viewConfig,
  };
  root.innerHTML = `
    ${modeBanner()}
    <ul class="tabs" role="tablist">
      ${TABS.map(([id, label]) => `<li role="presentation"><button type="button" role="tab" aria-selected="${state.tab === id}" data-tab="${id}">${esc(label)}</button></li>`).join("")}
    </ul>
    ${state.tab === "config" || state.tab === "dictionary" ? "" : `<div class="card" style="margin-bottom:14px">${sourceSwitch()}</div>`}
    ${views[state.tab]()}`;
  wire();
}

function wire() {
  for (const b of root.querySelectorAll("[data-tab]")) {
    b.addEventListener("click", () => {
      state.tab = b.dataset.tab;
      state.message = null;
      state.problems = null;
      render();
    });
  }
  for (const b of root.querySelectorAll("[data-source]")) {
    b.addEventListener("click", async () => {
      state.source = b.dataset.source;
      state.message = null;
      await loadRecords();
      render();
    });
  }
  const tokenSave = root.querySelector("#admin-token-save");
  if (tokenSave) {
    tokenSave.addEventListener("click", async () => {
      setAdminToken(root.querySelector("#admin-token").value.trim());
      await loadRecords();
      render();
    });
  }

  const label = state.source === "demo" ? "demo" : "research";
  const stamp = state.activeConfig.studyVersion.replace(/[^A-Za-z0-9.-]/g, "_");
  const csv = root.querySelector("#export-csv");
  if (csv) csv.addEventListener("click", () => downloadText(`agecheck-${label}-v${stamp}.csv`, toCSV(state.records), "text/csv"));
  const json = root.querySelector("#export-json");
  if (json) {
    json.addEventListener("click", () =>
      downloadText(
        `agecheck-${label}-v${stamp}.json`,
        toJSON(state.records, { data_kind: label, study_version: state.activeConfig.studyVersion, mode: state.activeConfig.mode }),
        "application/json"
      )
    );
  }
  const dict = root.querySelector("#export-dict");
  if (dict) dict.addEventListener("click", () => downloadText("agecheck-data-dictionary.csv", dictionaryToCSV(), "text/csv"));

  const del = root.querySelector("#delete-form");
  if (del) {
    del.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const code = root.querySelector("#delete-code").value.trim().toUpperCase();
      if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) {
        state.message = "Enter a response code in the form ABCD-EFGH.";
        render();
        return;
      }
      try {
        const store = currentStore();
        const res = store.kind === "remote" ? await store.deleteByCode(code, getAdminToken()) : await store.deleteByCode(code);
        state.message = res.removed ? `Deleted ${res.removed} record(s) with code ${code}.` : `No record with code ${code} was found.`;
        await loadRecords();
      } catch (err) {
        state.message = `Deletion failed: ${err.message}`;
      }
      render();
    });
  }

  const demoForm = root.querySelector("#demo-form");
  if (demoForm) {
    demoForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const n = Math.max(10, Math.min(500, parseInt(root.querySelector("#demo-count").value, 10) || 40));
      const store = demoStore();
      await store.clear();
      for (const r of generateDemoRecords(state.activeConfig, n)) await store.save(r);
      state.source = "demo";
      state.message = `Generated ${n} synthetic demo records.`;
      await loadRecords();
      render();
    });
    root.querySelector("#demo-clear").addEventListener("click", async () => {
      await demoStore().clear();
      state.message = "Demo records cleared.";
      await loadRecords();
      render();
    });
  }

  const cfgForm = root.querySelector("#config-form");
  if (cfgForm) {
    cfgForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      state.config = readConfigForm();
      saveLocalConfig(state.config);
      state.message = "Saved to this browser. The participant app in this browser will use it unless a study.config.json file is served.";
      state.problems = null;
      refreshActive();
      render();
    });
    root.querySelector("#cfg-check").addEventListener("click", () => {
      const c = state.config.mode === "research" ? state.config : readConfigForm();
      state.problems = activationProblems(c);
      state.message = null;
      render();
    });
    const act = root.querySelector("#cfg-activate");
    if (act) {
      act.addEventListener("click", () => {
        const c = readConfigForm();
        const problems = activationProblems(c);
        state.problems = problems;
        if (problems.length) {
          state.message = null;
          render();
          return;
        }
        const ok = window.confirm(
          `Activate research mode for study version ${c.studyVersion}?\n\nThe configuration will be frozen. Collection starts only where this configuration is deployed (this browser, a served study.config.json, or the server).`
        );
        if (!ok) return;
        c.mode = "research";
        c.frozen = true;
        c.activatedOn = new Date().toISOString().slice(0, 10);
        state.config = c;
        saveLocalConfig(c);
        state.message = "Research mode activated and frozen in this browser. Deploy the configuration to where participants will use it.";
        refreshActive();
        render();
      });
    }
    const deact = root.querySelector("#cfg-deactivate");
    if (deact) {
      deact.addEventListener("click", () => {
        const ok = window.confirm("Return to preview mode? Export any research data first. Existing research records stay in their store until you delete them.");
        if (!ok) return;
        state.config.mode = "preview";
        state.config.frozen = false;
        saveLocalConfig(state.config);
        state.message = "Back in preview mode. Bump the study version before activating again.";
        state.problems = null;
        refreshActive();
        render();
      });
    }
    root.querySelector("#cfg-download").addEventListener("click", () => {
      const c = state.config.mode === "research" ? state.config : readConfigForm();
      downloadText("study.config.json", JSON.stringify(c, null, 2), "application/json");
    });
    const push = root.querySelector("#cfg-push");
    if (push && !push.disabled) {
      push.addEventListener("click", async () => {
        const c = state.config.mode === "research" ? state.config : readConfigForm();
        const token = getAdminToken() || window.prompt("Admin token for the server:");
        if (!token) return;
        setAdminToken(token);
        try {
          const store = new RemoteRecordStore({ endpointUrl: c.storage.endpointUrl, submitToken: "" });
          await store.putServerConfig(c, token);
          state.message = "Configuration pushed. The server now serves it as study.config.json.";
        } catch (err) {
          state.message = `Push failed: ${err.message}`;
        }
        render();
      });
    }
    root.querySelector("#cfg-reset").addEventListener("click", () => {
      if (!window.confirm("Reset the configuration in this browser to the defaults?")) return;
      clearLocalConfig();
      state.config = cloneConfig(DEFAULT_STUDY_CONFIG);
      state.message = "Reset to defaults.";
      state.problems = null;
      refreshActive();
      render();
    });
    root.querySelector("#cfg-import-btn").addEventListener("click", () => {
      try {
        const parsed = JSON.parse(root.querySelector("#cfg-import").value);
        if (!parsed || parsed.schemaVersion !== DEFAULT_STUDY_CONFIG.schemaVersion) throw new Error("Not a study.config.json for this schema.");
        state.config = mergeConfig(parsed);
        saveLocalConfig(state.config);
        state.message = "Imported and saved to this browser.";
        state.problems = null;
        refreshActive();
      } catch (err) {
        state.message = `Import failed: ${err.message}`;
      }
      render();
    });
  }
}

function refreshActive() {
  if (state.activeSource !== "file") {
    state.activeConfig = loadLocalConfig() || cloneConfig(DEFAULT_STUDY_CONFIG);
    state.activeSource = loadLocalConfig() ? "local" : "default";
  }
}

async function init() {
  const resolved = await resolveConfig();
  state.activeConfig = resolved.config;
  state.activeSource = resolved.source;
  state.config = loadLocalConfig() || (resolved.source === "file" ? cloneConfig(resolved.config) : cloneConfig(DEFAULT_STUDY_CONFIG));
  await loadRecords();
  render();
}

init().catch((err) => {
  root.innerHTML = `<section class="card"><h1>Something went wrong</h1><p>${esc(err.message || err)}</p></section>`;
});
