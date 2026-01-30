# Socket.IO Playground

A full-featured Socket.IO playground with a UI to connect, join rooms, emit events, and watch the event log in real time.

## Quick start (local)

```bash
npm install
npm start
```

Enter **http://localhost:3000** in the playground URL field and click **Connect**.

## Deploy to GitHub Pages

GitHub Pages serves **only the static UI**. Users open your deployed page and type their own Socket.IO server URL to connect (e.g. a server they run or host elsewhere).

1. **Build the static site**
   ```bash
   npm run copy-docs
   ```
   This copies `public/` into `docs/`.

2. **Commit and push** (including the `docs/` folder).

3. **Enable GitHub Pages**
   - Repo → **Settings** → **Pages**
   - **Source**: Deploy from a branch
   - **Branch**: `main` (or your default branch), folder **/docs**
   - Save

Your playground will be at `https://<username>.github.io/<repo>/` (or your custom domain). Users must enter a Socket.IO server URL before connecting.

## Features

- **Connection** – URL required; optional Auth (JSON), Query, Namespace, Transport, Reconnect (in Options).
- **Rooms** – Join/leave rooms; see room list and counts.
- **Emit events** – Custom event name + JSON payload; target Broadcast or Room.
- **Event log** – Live incoming/outgoing events; Pause and Clear.
- **Socket ID** – Shown when connected.

## Project structure

```
socket-io-playground/
├── server/          # Express + Socket.IO (run locally or host elsewhere)
├── public/          # Playground UI (static)
├── docs/            # Generated for GitHub Pages (from public/)
├── scripts/
│   └── copy-docs.js
└── package.json
```
