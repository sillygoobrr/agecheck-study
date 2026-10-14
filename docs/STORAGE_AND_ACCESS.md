# Storage and access-control limitations

Read this before choosing a storage configuration and before writing the "data storage" paragraph of the study information.

## The three modes

| Mode | Where records go | Works across devices? | Who can read them |
|---|---|---|---|
| Preview (default) | The demo store in the browser's local storage, marked `preview_walkthrough` or `synthetic_demo` | No | Anyone using that browser |
| Research, local-device | The research store in **that browser's** local storage | **No.** A participant on their own phone is not collected anywhere. | Anyone using that browser, including the next participant if the dashboard is opened on it |
| Research, remote-endpoint | The reference server's data directory (`server/data/records.json`) | Yes, while the server is reachable | Whoever holds the admin token, plus whoever can read the server's file system |

Demo and research records use different storage keys, different dashboard views, and different export file names. They are never combined.

## Local-device mode

Use only for in-person sessions on a device the researcher controls.

- Browser local storage is per browser profile. Clearing site data, using a private window, or switching browsers hides or removes the records.
- Export after every session and store the export where the approved plan says.
- The researcher dashboard on the same device shows research records without any password. Do not leave the device unattended with the dashboard open, and do not use a shared or school-managed device whose storage others can inspect.
- Nothing leaves the device, so there is no server log and no IP address recorded by this app. The device itself may still keep browser history.

## Remote-endpoint mode (the reference server)

`server/server.js` is a small Node server with no npm dependencies. It serves the static app and provides:

- `POST /api/submit`, which requires the shared **submit token** (`X-Study-Token` header). The token is shipped to participants inside the served configuration. It only allows writing a record. It cannot read, list, or delete anything.
- `GET /api/admin/records`, `DELETE /api/admin/records/<code>`, `GET|PUT /api/admin/config`, which require the **admin token** as a Bearer token. Enter it in the dashboard; it is kept in that tab's session storage only and never written into any page or file.
- Server-side validation of every record against the data dictionary. Unknown fields, bad values, demo records, and records for the wrong study version are refused.
- Upserts by `response_id`, so a resend or a double click never creates a second record, and a submitted record is never overwritten by a stale in-progress save.
- A body size limit (32 KB), a per-address request limit kept only in memory, and atomic file writes.
- Security headers on every response, including a `Permissions-Policy` that blocks camera and microphone, and a Content Security Policy that allows only same-origin scripts and connections.

The tokens come from environment variables (`AGECHECK_SUBMIT_TOKEN`, `AGECHECK_ADMIN_TOKEN`). They are never in the frontend code or the repository. `server/data/` is gitignored.

### Limitations you must disclose or fix before collection

- **Hosting logs.** This server logs only method, path, status, and duration. Your hosting provider, reverse proxy, or tunnel almost certainly logs IP addresses and timestamps for every request. Find out what it keeps and for how long, and say so in the study information. Do not promise anonymity until you have checked.
- **Transport.** Serve over HTTPS. Over plain HTTP the submit token and every record cross the network unencrypted.
- **One shared submit token.** Anyone who extracts it from the served configuration could post fabricated records. Mitigations: a long random token, HTTPS, the rate limit, and inspecting exports for implausible records. This is a limitation of any browser-only study instrument without accounts.
- **The dashboard page is public but powerless.** `researcher.html` contains no secret. In remote mode every data request is authenticated by the server. It is still better not to advertise the URL.
- **Backups.** `records.json` is a single file. Keep a copy per the approved retention plan and delete it per the approved schedule.
- **No encryption at rest** beyond the operating system's. If the host is shared, treat the data directory accordingly.
- **Free text.** `q_open_influence` can contain whatever a participant typed. Review it before sharing an export.

## Configuration deployment

The participant app looks for its configuration in this order:

1. `study.config.json` served next to `index.html` (a file you place there, or the reference server serving the configuration pushed through the dashboard).
2. The configuration saved in that browser by the researcher dashboard.
3. The built-in defaults (preview mode).

Participants on their own devices only ever hit option 1 or 3, so a deployed site cannot slip into research mode without a deployed file. The served configuration includes the submit token on purpose, since participants' browsers need it to submit.

Once research records exist on the server, `PUT /api/admin/config` is refused. To revise the study, export and remove the data, or start a new data directory with a new study version.

## What is never stored

Names, email addresses, birth dates, addresses, student IDs, government IDs, images, device identifiers, absolute timestamps, and the answers of anyone who was ineligible or did not agree to take part. The app never requests camera, microphone, or location access and has no file-upload field.
