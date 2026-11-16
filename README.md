# Networking Companion

**A voice-first AI host for in-person networking events.**

Networking Companion runs in the browser on a laptop or tablet you bring to an event. A 3D avatar greets guests, introduces your team in a sentence or two, answers questions about what you do, and — if the conversation goes somewhere — invites them to leave their contact details. After the event, you get the notes, the contacts, and a draft follow-up email for each person, ready to review.

It runs on Cloudflare Workers with a D1 database and uses OpenAI's Realtime API for voice.

---

## Contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Quick start (macOS)](#quick-start-macos)
- [Verify the setup](#verify-the-setup)
- [Configuration](#configuration)
- [Customize it for your team](#customize-it-for-your-team)
- [Deploy to Cloudflare](#deploy-to-cloudflare-optional)
- [Privacy and safeguards](#privacy-and-safeguards)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## What it does

The app has two modes.

**Guest mode (networking)** — handed to a guest at the event:

- Short, spoken conversation with a 3D avatar, designed for a relaxed 1–2 minute exchange
- A brief team introduction, with more detail only when the guest asks
- Opens your business demo page or other websites in a side panel
- Light web research (for example, a guest's company or a nearby restaurant), capped per conversation
- A contact card the guest can fill in by typing or by voice, confirmed before saving
- A temporary follow-up email draft created as soon as contact details are saved

**Owner mode (your private workspace)** — unlocked with your passcode:

- Start a new guest session for a named event and take the device back when it ends
- Review every guest's profile, summary, research, and follow-up drafts
- Set a next action and due date for each contact, or delete a contact
- Keep private notes and chat with an assistant that can search the web
- Send follow-up emails through Gmail or Resend, if you enable email sending

A static **business demo** at `/business/` shows sample AI drafts for small-business tasks (customer replies, quote follow-ups, staff checklists) and lets a visitor prepare an email to you.

## How it works

```
Browser (public/)                    Cloudflare Worker (src/worker.js)          External
───────────────────                  ─────────────────────────────────          ────────
3D avatar (three.js)  ── WebRTC ───────────────────────────────────────────▶  OpenAI Realtime (voice)
Panels: web, contact,  ── /api/* ──▶  Auth (owner cookie, guest token)
  email, analysis                     Tool calls: save guest, research,  ───▶  OpenAI Responses + web search
                                        contact, follow-up draft
                                      Email sending (opt-in)             ───▶  Gmail SMTP / Gmail API / Resend
                                      D1 database: guests, drafts,
                                        notes, workspace items, limits
```

- The browser negotiates a WebRTC voice session through the Worker, so your OpenAI key never reaches the client.
- The assistant acts by calling tools (save a guest, open a page, fill the contact card). The Worker validates each call and enforces limits.
- All data lives in your own D1 database: local during development, remote once deployed.

## Quick start (macOS)

**Requirements:** Node.js 24 and npm. An OpenAI API key is needed for voice and research, but not for sign-in, contact capture, or the tests.

1. **Clone and install.**

   ```sh
   git clone https://github.com/WeiliangXing/networking-companion.git
   cd networking-companion
   node --version   # should print v24.x
   npm ci
   cp .dev.vars.example .dev.vars
   ```

2. **Fill in `.dev.vars`.** Keep the double quotes around each value.

   | Setting | What to enter |
   | --- | --- |
   | `OWNER_CODE` | A passcode you'll use to unlock owner mode. |
   | `SESSION_SECRET` | The output of `openssl rand -hex 32`. |
   | `OPENAI_API_KEY` | Your OpenAI API key. Leave it empty to try sign-in and contact capture without voice. |
   | `EMAIL_SENDING_ENABLED` | Leave as `"false"` for now. See [Email](#email-optional). |

3. **Create the local database and start the server.** Re-run the migration command whenever you pull updates.

   ```sh
   npx wrangler d1 migrations apply networking-companion --local
   npm run dev
   ```

4. **Try it.** Open <http://localhost:5203/> and enter your passcode. Click **Start**, allow microphone access, and say *"Tell me about your team."* Click **Stop** to end. The business demo is at <http://localhost:5203/business/>.

Keep the terminal open while you use the app, and press `Ctrl+C` to stop the server. Next time, just run `npm run dev` from the project folder. Local data is stored in `.wrangler/state/`.

## Verify the setup

With the server running, open a second terminal in the project folder:

```sh
npm test                    # unit tests
node test/local-flow.mjs    # end-to-end check against the local database
```

The end-to-end check uses a synthetic contact to test sign-in, guest handoff, contact capture, and ending the session. Neither command needs an OpenAI key. Keep email sending disabled while running them. If your server uses a port other than 5203, set `LOCAL_TEST_PORT`:

```sh
LOCAL_TEST_PORT=8787 node test/local-flow.mjs
```

## Configuration

Secrets go in `.dev.vars` locally and in `wrangler secret put` once deployed. Non-secret settings live under `vars` in `wrangler.jsonc`.

### Core

| Variable | Where | Required | Purpose |
| --- | --- | --- | --- |
| `OWNER_CODE` | secret | Yes (unless `PUBLIC_DEMO`) | Passcode for owner mode |
| `SESSION_SECRET` | secret | Yes | Signs owner, guest, and email-device tokens |
| `OPENAI_API_KEY` | secret | For voice and research | Server-side OpenAI access |
| `REALTIME_MODEL` | `wrangler.jsonc` | No | Voice model (default `gpt-realtime-2.1`) |
| `SEARCH_MODEL` | `wrangler.jsonc` | No | Research and owner-chat model (default `gpt-5.4`) |
| `PUBLIC_DEMO` | `wrangler.jsonc` | No | `"true"` skips the owner passcode. Use it only for a throwaway demo deployment. |

### Email (optional)

Email sending is off by default. To turn it on, set `EMAIL_SENDING_ENABLED="true"` and `EMAIL_FROM` (your sender address), then configure **one** provider. If more than one is set, the first match in this list is used:

| Provider | Variables |
| --- | --- |
| Gmail SMTP | `GMAIL_APP_PASSWORD` (a Google app password for `EMAIL_FROM`) |
| Gmail API | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` |
| Resend | `RESEND_API_KEY` |

As an extra safeguard, sending only works on a device that has been activated with `EMAIL_DEVICE_KEY`. The owner workspace shows whether email is ready and which address it will send from.

## Customize it for your team

Everything the assistant says about you lives in a few files in `src/`:

| File | What it controls |
| --- | --- |
| [`src/profile.js`](src/profile.js) | Assistant name and persona, company facts, event context, conversation style, and guardrails |
| [`src/joanna-background.js`](src/joanna-background.js) | Professional background for a team member |
| [`src/professional-introduction.js`](src/professional-introduction.js) | How the team is introduced |
| [`src/customer-questions.js`](src/customer-questions.js) | Answers to common customer questions |
| [`src/email-templates.js`](src/email-templates.js) | Guidance for follow-up email drafts |
| [`public/business/`](public/business/) | The business demo page |

Tips:

- Update `eventContext` in `src/profile.js` before each event.
- Keep company facts strictly to what's true. The assistant is told not to invent prices, clients, or commitments, and it can only stick to that if the facts you give it are accurate.

## Deploy to Cloudflare (optional)

1. Sign in and create a database:

   ```sh
   npx wrangler login
   npx wrangler d1 create networking-companion
   ```

2. In `wrangler.jsonc`, paste the returned ID into `database_id`, keep the binding name `DB`, and set `name` to your Worker's service name.

3. Apply migrations, deploy, and add your secrets:

   ```sh
   npx wrangler d1 migrations apply networking-companion --remote
   npm run deploy
   npx wrangler secret put OWNER_CODE
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put OPENAI_API_KEY
   ```

4. Open the HTTPS address printed by the deploy command and sign in with your production passcode. The hosted app uses its own database, separate from your local one.

**Before the event:** make sure your OpenAI account has access to the configured models, then run a full conversation on the device, browser, and Wi-Fi you'll actually use. Noisy rooms and venue networks behave differently than your desk.

## Privacy and safeguards

Built for conversations with people who didn't sign up for an app:

- **Honest identity.** The assistant introduces itself as an AI and answers data-processing questions truthfully.
- **Contact details only with consent.** The contact form opens only after the guest agrees, and details are read back before saving.
- **Guests can opt out.** A guest asking not to have information kept overrides note-taking.
- **Nothing is sent automatically.** Follow-up emails are drafts until you review and send them yourself.
- **Usage limits.** Each guest session allows up to 3 voice connections and 4 research lookups. Owner sign-in is rate-limited to 8 attempts per 15 minutes.
- **Scoped access.** Guest tokens expire after 30 minutes and can't reach owner data. Ending a session takes the device back to owner mode.
- **Your infrastructure.** Data is stored in your own Cloudflare D1 database. Voice and research are processed by OpenAI.

## Project structure

```
src/                 Cloudflare Worker: API, auth, AI prompts, email
  worker.js          Routes, auth, rate limits, tool handling
  profile.js         Assistant instructions and company facts
  email.js, smtp.js  Email providers
  guest-research.js  Web research for guests
  memory.js          Owner notes and recall
  workspace.js       Owner workspace items
public/              Browser app (served as static assets)
  app.js             Main client: voice session, modes, panels
  avatar-3d.js       3D avatar (three.js in vendor/)
  business/          Business demo page
migrations/          D1 schema (apply in order with wrangler)
test/                Unit tests (*.test.js) and local smoke and flow scripts
```

## Troubleshooting

| Symptom | Likely fix |
| --- | --- |
| "Owner access has not been configured" | `OWNER_CODE` or `SESSION_SECRET` is missing. Check `.dev.vars`, or your Worker secrets once deployed. |
| "Voice and AI are not configured yet" | Set `OPENAI_API_KEY`. |
| "AI usage credits or quota are exhausted" | Check billing on your OpenAI account. |
| No microphone prompt or no audio | Use `localhost` or HTTPS, and check the browser's site permissions. The mic settings panel lets you pick an input and test levels. |
| A website won't load in the side panel | Many sites block embedding. Use the **Open in browser** link instead. |
| Database errors after pulling updates | Re-run `npx wrangler d1 migrations apply networking-companion --local` (or `--remote`). |

---

Three.js is included under `public/vendor/` under its own license ([`LICENSE-three`](public/vendor/LICENSE-three)).
