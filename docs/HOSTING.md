# Hosting

Two very different situations. Decide which one you are in first.

| You want to | Host with |
|---|---|
| Show the app to people, test it, or run in-person sessions on your own laptop | GitHub Pages (static) |
| Let participants use their own phones or laptops and collect their responses | The reference server, on a host that runs Node (see below) |

GitHub Pages serves files only. It cannot run `server/server.js`, so a Pages site on its own can never collect responses from other devices.

## GitHub Pages

### Requirements

- GitHub Pages on a free personal account works only for **public** repositories. A private repository needs GitHub Pro, Team, or Enterprise.
- Changing Pages settings needs **admin** access to the repository. A collaborator with write access cannot turn Pages on. Either the owner turns it on, or you copy the code into a repository you own.
- Everything in the repository becomes public web content, including the docs and tests. That is fine: the repository holds no participant data and no secrets. `server/data/` is gitignored and tokens live in environment variables. Never commit records or exports.

### Turning it on

1. On GitHub, open the repository, then **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **main** and folder **/ (root)**, then **Save**.
4. Wait a minute or two. The site appears at `https://<owner>.github.io/agecheck-study/` (the participant app) and `https://<owner>.github.io/agecheck-study/researcher.html` (the dashboard).

Every push to `main` redeploys. The `.nojekyll` file at the root tells Pages to publish the files as they are. All paths in the app are relative, so it works in a subfolder like `/agecheck-study/`.

### What works on Pages

- The whole participant flow in preview mode, and the dashboard with demo data.
- **Local-device research mode on your own laptop:** open the dashboard at the Pages URL in the browser you will use, fill in the configuration, choose "This device only", activate, then run participants in that same browser. Records stay in that browser. Export after every session.
- A committed `study.config.json` at the repository root. The app loads it before anything else, so this is how you deploy a frozen configuration for everyone who opens the link. It is public, like the rest of the site. If it uses the remote endpoint, it includes the submit token on purpose: participants' browsers need it, and it only allows submitting.

### What does not work on Pages

- Collecting from participants' own devices. If a committed configuration says "local device", each participant's phone would store its own record where nobody can read it. For other devices you need the reference server and a configuration with the remote endpoint.
- Custom response headers. Pages does not send the `Permissions-Policy` header the reference server sends. The app never requests the camera or microphone anyway.

### Disclosure

GitHub keeps logs of visitors to Pages sites, including IP addresses, as described in GitHub's privacy statement. Say so in the "what is recorded" section of the study information. The app itself records none of it.

## The reference server (cross-device collection)

`server/server.js` needs a host that runs a Node process and keeps files between restarts. Many free tiers have an ephemeral disk that is wiped on every restart or deploy; `server/data/records.json` would be lost with it. Use a host with persistent storage, or a small virtual private server, and back up the data directory per the approved retention plan.

Set these environment variables on the host:

```
AGECHECK_SUBMIT_TOKEN=<long random string, 32+ characters>
AGECHECK_ADMIN_TOKEN=<a different long random string>
AGECHECK_DATA_DIR=<a persistent directory>
HOST=0.0.0.0
PORT=<whatever the host expects>
```

Serve it over HTTPS. Then there are two layouts:

**One origin (simplest).** The server hosts everything. Participants open `https://your-host/`, the dashboard is `https://your-host/researcher.html`, and no CORS setup is needed. In the dashboard set the endpoint URL to `https://your-host`, paste the submit token, activate, and use **Push to server** with the admin token. The server then serves the frozen configuration as `study.config.json` and refuses further changes once records exist.

**Split (app on Pages, server elsewhere).** Also set `AGECHECK_ALLOWED_ORIGIN=https://<owner>.github.io` on the server (the origin only, no path). In the dashboard set the endpoint URL to the server's `https://` address, activate, download `study.config.json`, and commit it to the repository root so the Pages site loads it. Push the same configuration to the server as well so it enforces the study version on every submission.

Either way, open the participant link on a device that is not yours, confirm the header shows "Research mode", check that the record appears under research data in the dashboard, then delete it by its response code before the first real participant.
