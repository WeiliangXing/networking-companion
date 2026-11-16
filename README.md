# Networking Companion

Networking Companion is a browser-based voice assistant for in-person networking events. Guests can talk to a 3D avatar, hear a team introduction, explore a business demo, and leave their contact details. After the event, the host can review notes and draft follow-up emails.

## Run locally on a Mac

1. Install Node.js 24 and npm. Clone the repository, install dependencies, and create your local configuration file.

   ```sh
   git clone https://github.com/WeiliangXing/networking-companion.git
   cd networking-companion
   node --version
   npm ci
   cp .dev.vars.example .dev.vars
   ```

2. Open `.dev.vars` and set the following values. Keep the double quotes around each value.

   | Setting | What to enter |
   | --- | --- |
   | `OWNER_CODE` | Choose a passcode to unlock the workspace. |
   | `SESSION_SECRET` | Run `openssl rand -hex 32` and paste the generated value. |
   | `OPENAI_API_KEY` | Enter your OpenAI API key to enable voice and web research. You can leave it empty to test sign-in and contact capture. |

   Model names are configured in `wrangler.jsonc`. Email sending is disabled by default.

3. Initialize the local database and start the server. Run the migration command again after pulling updates.

   ```sh
   npx wrangler d1 migrations apply networking-companion --local
   npm run dev
   ```

4. Open [the local app](http://localhost:5203/) and enter your passcode. Click **Start**, allow microphone access, and try saying “Tell me about your team.” Click **Stop** to end the conversation. You can also open the [business demo](http://localhost:5203/business/) directly.

Keep the terminal open while using the app. Press Ctrl+C to stop the server. Next time, run `npm run dev` from the project directory. Local data is stored in `.wrangler/state/`.

## Verify the setup

With the server running, open a second terminal in the same project directory. Use Node.js 24 and leave email sending disabled.

```sh
npm test
node test/local-flow.mjs
```

The first command runs the unit tests. The second uses a synthetic contact to verify sign-in, guest handoff, contact capture, and session closure against the local database. Both checks work without an OpenAI API key. If the server is listening on a different port, set `LOCAL_TEST_PORT` when running the second command. The default is 5203.

## Customize the introduction

Edit [the assistant profile](src/profile.js), [the professional background](src/joanna-background.js), and [the team introduction](src/professional-introduction.js) to change how the assistant introduces your team.

## Deploy to Cloudflare (optional)

Run `npx wrangler login`, then `npx wrangler d1 create networking-companion`. Copy the returned database ID into `database_id` in `wrangler.jsonc`. Keep the binding name `DB` and set the Worker's `name` to your chosen service name.

```sh
npx wrangler d1 migrations apply networking-companion --remote
npm run deploy
npx wrangler secret put OWNER_CODE
npx wrangler secret put SESSION_SECRET
npx wrangler secret put OPENAI_API_KEY
```

Enter each production secret when prompted. Open the HTTPS address printed by the deployment command and sign in with your production passcode. The hosted app uses its own database. To test voice, use an API account with access to the configured models and try a conversation on the device and in the environment you plan to use at the event.
