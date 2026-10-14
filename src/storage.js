// Storage for AgeCheck Study.
//
// Three kinds of record store, chosen from the study configuration:
//   demo            preview mode. Synthetic records and walkthrough runs,
//                   kept in this browser's localStorage under a demo key.
//   local-device    research mode. Records kept in this browser's
//                   localStorage on this device only. Participants on other
//                   devices are NOT collected. Use for in-person sessions on
//                   a researcher-controlled device, and export regularly.
//   remote-endpoint research mode. Records are POSTed to the reference
//                   server in server/ (or a compatible service), which
//                   validates them and keeps them outside the frontend.
//
// Demo and research records never share a key, a store, or an export.

import { mergeConfig, DEFAULT_STUDY_CONFIG } from "./study-config.js";

export const KEYS = {
  config: "agecheck.config.v1",
  demoRecords: "agecheck.demo.records.v1",
  researchRecords: "agecheck.research.records.v1",
  session: "agecheck.session.v1",
  adminToken: "agecheck.admin.token.v1",
};

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Configuration

export function loadLocalConfig() {
  const raw = safeGet(globalThis.localStorage, KEYS.config);
  if (!raw) return null;
  try {
    return mergeConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocalConfig(config) {
  return safeSet(globalThis.localStorage, KEYS.config, JSON.stringify(config));
}

export function clearLocalConfig() {
  safeRemove(globalThis.localStorage, KEYS.config);
}

/**
 * Resolve the active configuration.
 *   1. study.config.json next to the page (a deployed, frozen configuration,
 *      or one served by the reference server)
 *   2. this browser's saved configuration (set in the researcher dashboard)
 *   3. the built-in defaults (preview mode)
 */
export async function resolveConfig({ fetchImpl = globalThis.fetch } = {}) {
  if (fetchImpl) {
    try {
      const res = await fetchImpl("./study.config.json", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json === "object" && json.schemaVersion === DEFAULT_STUDY_CONFIG.schemaVersion) {
          return { config: mergeConfig(json), source: "file" };
        }
      }
    } catch {
      /* no file; fall through */
    }
  }
  const local = loadLocalConfig();
  if (local) return { config: local, source: "local" };
  return { config: mergeConfig(null), source: "default" };
}

// ---------------------------------------------------------------------------
// Participant session (per tab, cleared when the tab closes)

export function loadSessionJson() {
  return safeGet(globalThis.sessionStorage, KEYS.session);
}

export function saveSessionJson(json) {
  return safeSet(globalThis.sessionStorage, KEYS.session, json);
}

export function clearSession() {
  safeRemove(globalThis.sessionStorage, KEYS.session);
}

// ---------------------------------------------------------------------------
// Record stores

export class LocalRecordStore {
  constructor(key, label) {
    this.key = key;
    this.label = label;
    this.kind = "local";
  }

  describe() {
    return `${this.label}: records are kept in this browser's local storage on this device only. They are not shared across devices or browsers, and clearing site data removes them. Export regularly.`;
  }

  _read() {
    const raw = safeGet(globalThis.localStorage, this.key);
    if (!raw) return {};
    try {
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  }

  _write(map) {
    if (!safeSet(globalThis.localStorage, this.key, JSON.stringify(map))) {
      throw new Error("This browser refused to store the record (storage may be full or disabled).");
    }
  }

  async list() {
    return Object.values(this._read());
  }

  /** Upsert by response_id, so repeated saves never create duplicates. */
  async save(record) {
    const map = this._read();
    const existing = map[record.response_id];
    if (existing && existing.submission_status === "submitted" && record.submission_status !== "submitted") {
      // Never downgrade a submitted record.
      return { ok: true, duplicate: true };
    }
    map[record.response_id] = record;
    this._write(map);
    return { ok: true, duplicate: Boolean(existing) };
  }

  async deleteByCode(code) {
    const map = this._read();
    const wanted = String(code || "").trim().toUpperCase();
    let removed = 0;
    for (const [id, rec] of Object.entries(map)) {
      if (rec.response_code === wanted) {
        delete map[id];
        removed += 1;
      }
    }
    this._write(map);
    return { removed };
  }

  async clear() {
    safeRemove(globalThis.localStorage, this.key);
  }
}

export class RemoteRecordStore {
  constructor({ endpointUrl, submitToken, fetchImpl = globalThis.fetch }) {
    this.base = String(endpointUrl || "").replace(/\/+$/, "");
    this.submitToken = submitToken || "";
    this.fetchImpl = fetchImpl;
    this.kind = "remote";
  }

  describe() {
    return `Remote endpoint: records are sent to ${this.base}/api/submit and stored by that server. Collection works across devices as long as the server is reachable. The server operator controls access, retention, and what the hosting provider logs (including IP addresses).`;
  }

  async _request(path, { method = "GET", body, adminToken } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.submitToken && path === "/api/submit") headers["X-Study-Token"] = this.submitToken;
    if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
    let res;
    try {
      res = await this.fetchImpl(this.base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      throw new Error("The server could not be reached. Check your connection and try again.");
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg = data && data.error ? data.error : `The server responded with status ${res.status}.`;
      throw new Error(msg);
    }
    return data || {};
  }

  async save(record) {
    const data = await this._request("/api/submit", { method: "POST", body: record });
    return { ok: true, duplicate: Boolean(data.duplicate) };
  }

  async list(adminToken) {
    const data = await this._request("/api/admin/records", { adminToken });
    return Array.isArray(data.records) ? data.records : [];
  }

  async deleteByCode(code, adminToken) {
    const wanted = encodeURIComponent(String(code || "").trim().toUpperCase());
    return this._request(`/api/admin/records/${wanted}`, { method: "DELETE", adminToken });
  }

  async getServerConfig(adminToken) {
    return this._request("/api/admin/config", { adminToken });
  }

  async putServerConfig(config, adminToken) {
    return this._request("/api/admin/config", { method: "PUT", body: config, adminToken });
  }
}

/** The store the participant app writes to for the active configuration. */
export function participantStore(config, { fetchImpl } = {}) {
  if (config.mode !== "research") {
    return new LocalRecordStore(KEYS.demoRecords, "Preview (demo) storage");
  }
  const s = config.storage || {};
  if (s.adapter === "remote-endpoint") {
    return new RemoteRecordStore({ endpointUrl: s.endpointUrl, submitToken: s.submitToken, fetchImpl });
  }
  if (s.adapter === "local-device") {
    return new LocalRecordStore(KEYS.researchRecords, "Local-device research storage");
  }
  return null; // research mode without storage: collection is disabled
}

export const demoStore = () => new LocalRecordStore(KEYS.demoRecords, "Preview (demo) storage");
export const localResearchStore = () => new LocalRecordStore(KEYS.researchRecords, "Local-device research storage");

// ---------------------------------------------------------------------------
// Admin token for the dashboard (session only, never written to the page)

export function getAdminToken() {
  return safeGet(globalThis.sessionStorage, KEYS.adminToken) || "";
}

export function setAdminToken(token) {
  if (!token) safeRemove(globalThis.sessionStorage, KEYS.adminToken);
  else safeSet(globalThis.sessionStorage, KEYS.adminToken, token);
}
