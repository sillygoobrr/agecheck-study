# Tests

Two layers. Both run from the project root after `npm install` (which installs only the Playwright test runner).

```
npm test          # engine, dictionary, demo data, export, and server tests (node --test)
npm run test:e2e  # end-to-end tests in the real app with Playwright and Microsoft Edge
npm run test:all  # both
```

The end-to-end suite starts the reference server itself on port 4173 with a throwaway data directory (`.e2e-data`, gitignored). It uses the Edge that is already installed on Windows and macOS (`channel: "msedge"` in `playwright.config.js`). To use Chromium instead, run `npx playwright install chromium` and change the channel.

## Unit and server tests (`tests/engine.test.js`, `tests/server.test.js`)

48 tests. They cover:

- Age categories derived from the approved range; ineligible and non-consenting visitors leave no record.
- Random assignment at about 1:1 from an injected source; the condition survives serialization; forced conditions work only in preview mode.
- All six condition-by-pathway flows, with every field of the resulting record checked against the data dictionary.
- Coding of `skipped`, `missing`, `not_reached`, `not_applicable`, `disabled`, `not_collected`, and `withheld`, including that an abandoned session is `incomplete_session` and never a refusal.
- Withdrawal as its own pathway with the two retention policies.
- Double submits, failed saves with retry, and a reload during a save.
- Relative timings with no absolute timestamp in the record.
- Activation checks: placeholders, draft version, missing storage, bad tokens.
- Synthetic demo data covering all ten condition-by-pathway combinations and validating against the dictionary.
- CSV quoting, dictionary order, and formula neutralization.
- Server: security headers, allow-listed static files, token checks, dictionary validation, duplicate handling, no downgrade of submitted records, oversized bodies, deletion by code, placeholder refusal, version mismatch, and configuration freezing once records exist.

## End-to-end tests (`tests/e2e.spec.js`)

18 tests against the running app:

1. Advance notice: decline initial check, questionnaire, debrief.
2. Advance notice: start, stop at ID prompt, questionnaire, debrief.
3. Advance notice: start, continue with simulated ID, questionnaire, debrief.
4. Later notice: decline initial check, questionnaire, debrief.
5. Later notice: start, stop at ID prompt, questionnaire, debrief.
6. Later notice: start, continue with simulated ID, questionnaire, debrief.
   Each of these checks the stored record field by field, that the notice sentence appears only in the advance condition, that the ID-specific items appear only after reaching the prompt, that the stop-reasons item appears only after declining or stopping, that no choice is preselected, and that the two decision buttons have the same size.
7. The verification card has identical button and notice-slot positions in both conditions.
8. Refresh (three times), Back, and a reload during the simulation keep the same condition and step; a reload after submission shows the same response code and leaves one record.
9. Double clicks on every decision button and on Submit produce exactly one record.
10. Withdrawal is recorded as `withdrawn` with `initial_decision = withheld`, never as a decline; the withdraw control is absent before assent; ineligible and non-consenting visitors leave no record.
11. A simulated submission failure (`?failSubmit=1`, preview mode only) shows a clear recovery message, keeps the answers on the page, and a retry succeeds with one record.
12. A full pathway using only the keyboard (Tab, Space, Enter, arrow keys).
13. A 360 by 640 phone viewport with touch: no horizontal scrolling on any screen, and both decision buttons in view.
14. No camera, microphone, or permission API is ever called (the APIs are instrumented before the page loads), there is no file input, no `video` or `canvas` element, every network request stays on the app's origin, and the source files never reference the device APIs.
15. The researcher dashboard: generates 30 synthetic records (all marked `synthetic_demo`, none in the research store), shows counts, lists records, downloads CSV and JSON with `demo` in the file name, renders the data dictionary, and deletes a record by its code.
16. Research mode without storage shows "Collection is not configured".
17. Research mode with local-device storage writes a `research` record to the research store, ignores a forced condition, leaves the demo store empty, and the dashboard lists it under research data.

## Last run

All 48 unit and server tests and all 18 end-to-end tests passed on Windows 11 with Node 24 and Microsoft Edge.

## Not covered automatically

- Screen-reader output (headings receive focus on each screen and errors use `role="alert"`, but no assistive-technology run was scripted).
- The remote-endpoint path from a browser on a second device. The server's API is tested directly; the dashboard's remote listing and deletion use the same endpoints.
- Real-world hosting logs. See `docs/STORAGE_AND_ACCESS.md`.
