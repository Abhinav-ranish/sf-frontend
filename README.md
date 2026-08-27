# sf-frontend

Next.js contact-management UI for the SF contacts challenge. It talks to the
FastAPI backend from server components and server actions, so `API_BASE_URL`
stays server-side and the browser does not need direct CORS access to the API.

## Features

- Contacts list with search, sort, pagination, and API health badge.
- Create, edit, detail, and delete flows.
- Contact photo upload with preview and circular avatar display.
- Initials avatar fallback when a contact has no photo.
- Multiple typed addresses per contact with `Home`, `Work`, and `Other` labels.
- Client-side Zod validation that mirrors the backend's Pydantic rules.

## Quick Start

Start the backend first:

```bash
cd ../sf-backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.main
```

Then run the frontend:

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Make sure `.env.local` contains:

```env
API_BASE_URL=http://127.0.0.1:8000
```

Open <http://localhost:3000>. The header should show a green `api ok` badge when
the backend is reachable. If it shows `api unreachable`, check that the backend
is running on `http://127.0.0.1:8000` and that `.env.local` has the correct
`API_BASE_URL`.

Do not run `npx playwright install` for normal setup. The app, unit tests,
linting, typecheck, and production build do not need Playwright browser
downloads.

## Contact Form

The form submits through Next server actions and stores the same shape the
backend returns.

Required fields:

- `first_name`
- `last_name`
- `email`

Optional fields:

- `phone`
- `photo`
- `company`
- `job_title`
- `addresses`
- `notes`

Photos:

- Accepted file types: JPEG, PNG, and WebP.
- Maximum decoded image size: 512 KB.
- Existing photos are preserved while editing unless the user removes them.
- Saved photos render as circular avatars; contacts without photos show initials.

Addresses:

- A contact can have up to 10 addresses.
- Each address has a `type` of `Home`, `Work`, or `Other`.
- Empty address rows are ignored.
- Non-empty address rows must include at least one postal field.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/contacts` |
| `/contacts` | List, search, sort, and paginate contacts |
| `/contacts/new` | Create a contact |
| `/contacts/[id]` | Contact detail view |
| `/contacts/[id]/edit` | Edit a contact |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the local Next.js dev server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run Jest tests |
| `npm test -- --runInBand` | Run Jest serially |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run test:coverage` | Run Jest with coverage |
| `npm run test:e2e` | Run Playwright e2e tests if browsers are already installed |

## Architecture

```text
src/app/contacts/         Contacts routes and server actions
src/components/contacts/  Contact table, toolbar, form, avatar, and detail UI
src/components/ui/        Shared Button and Field primitives
src/lib/contacts/         Types, validation schema, API calls, and URL query parsing
src/lib/apiClient.ts      Fetch wrapper and typed API errors
src/__tests__/            Jest tests with MSW handlers
e2e/                      Playwright specs for real browser flows
```

API access is centralized in `src/lib/contacts/api.ts`. Forms use
`src/lib/contacts/schema.ts` as the shared validation layer before calling the
backend. FastAPI validation errors are mapped back into form field errors in the
server actions.

## Verification

Useful checks before opening or updating a PR:

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build
```

`npm run test:e2e` requires Playwright browser binaries. Skip it unless those
browsers are already installed in the environment.

## Deployment

Build and run as a standard Node-hosted Next.js app:

```bash
npm run build
npm start
```

Set `API_BASE_URL` in the server environment to the deployed backend URL.
