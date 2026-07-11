---
name: ngrok-tunnel
description: Start, inspect, verify, and stop an ngrok tunnel for a local development server. Use when Codex is asked to expose a local app, launch or relaunch ngrok, provide an ngrok URL, diagnose an ngrok or Vite blocked-host response, verify that a public tunnel reaches localhost, or stop a tunnel it started.
---

# ngrok Tunnel

Expose the current repository's development server through ngrok and return a public URL that has been checked end to end.

## Workflow

1. Inspect before starting anything.
   - Confirm the repository root and read its package scripts and development-server configuration.
   - Run `command -v ngrok` and `ngrok config check`. Never print or read the auth token itself.
   - Query an existing tunnel with `node .codex/skills/ngrok-tunnel/scripts/check-tunnel.mjs --verify`. Reuse it when it already targets the requested local server and passes verification.
2. Make the development server safe for tunneling.
   - Bind the local server to `127.0.0.1`; ngrok does not require a LAN-visible `0.0.0.0` binding.
   - For this Vite repository, put only the exact approved tunnel hostname in `DEV_ALLOWED_HOSTS`. Never use a wildcard or `allowedHosts: true`.
   - Restart Vite after changing its configuration.
3. Start the local server in a long-lived terminal session.
   - Use the repository package manager and existing `dev` script.
   - For this repository, prefer `pnpm dev -- --host 127.0.0.1 --port 5173 --strictPort`.
   - Wait for the ready message, then verify `http://127.0.0.1:5173` locally before launching ngrok.
4. Start ngrok in a second long-lived terminal session.
   - Run `ngrok http http://127.0.0.1:5173 --log=stdout`.
   - Keep the session alive after the command yields; record both session identifiers so they can be polled or stopped precisely.
5. Discover and verify the public URL.
   - Run `node .codex/skills/ngrok-tunnel/scripts/check-tunnel.mjs --wait 20 --verify` from the repository root.
   - Treat the tunnel as ready only when the helper reports a public URL and a successful HTTP status.
   - If verification returns a Vite blocked-host response, fix `server.allowedHosts`, restart Vite, and verify again.
6. Report the result.
   - Return the clickable HTTPS ngrok URL, the local target, and whether end-to-end verification passed.
   - State that the URL remains available only while both long-lived sessions are running.

## Lifecycle and safety

- Reuse healthy processes instead of opening duplicate Vite or ngrok sessions.
- Stop only the exact terminal sessions or PIDs started during the task. Do not use broad commands such as `pkill ngrok`, because unrelated tunnels may be active.
- Do not commit ngrok credentials, tunnel state, logs, or temporary PID files.
- Do not expose a server containing secrets or privileged development controls without warning the user.
- When ngrok is missing or unauthenticated, report the failing prerequisite and the minimal setup command. Do not ask the user to paste a token into chat.
- If the public request cannot be tested because network access is sandboxed, retry the verification with the required network permission before claiming success.

## Helper

Use `scripts/check-tunnel.mjs` to query ngrok's local API, choose the HTTPS tunnel, and optionally test the public endpoint. It prints stable `key=value` lines suitable for both humans and automation.

```bash
node .codex/skills/ngrok-tunnel/scripts/check-tunnel.mjs --wait 20 --verify
```

Override the local API only when ngrok was deliberately configured on another address:

```bash
node .codex/skills/ngrok-tunnel/scripts/check-tunnel.mjs \
  --api http://127.0.0.1:4041/api/tunnels --verify
```
