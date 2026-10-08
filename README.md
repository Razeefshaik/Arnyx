# Arnyx

A personal observatory for your AI tools. Discover skills, MCP connectors,
plugins, and agent harnesses; understand their advantages; follow a walkthrough;
and assemble a stack that fits your work.

Arnyx uses **Spring Boot for the backend**, **React + TypeScript for the frontend**,
and **your installed Codex CLI for all LLM calls**. You do not need to supply an
OpenAI API key to Arnyx.

## Start

Requirements: Java 21 or newer, Node.js 22.13 or newer, and Codex CLI.
The Maven wrapper downloads Maven when needed.

~~~powershell
npm install
codex login
npm run dev
~~~

Open **http://127.0.0.1:5175**. Spring Boot runs on **127.0.0.1:4318**.
Port 5175 deliberately avoids the existing development server on this computer.

Your existing Codex account, provider configuration, and usage limits apply.
Arnyx locates the npm CLI entrypoint on Windows rather than trying to execute a
PowerShell or CMD shim as a native program.

## Your first walkthrough

1. Open Discover and click **Run discovery**.
2. Four independent scouts read their sources. Inspect completion, partial
   results, and errors in Crawlers; there are no simulated activity counters.
3. Filter by capability type or category, or search with the top search box.
4. Open **Frontend Design**, then **Walkthrough**. Read the advantages, follow the
   steps, and copy the example prompt.
5. Save interesting tools using the bookmark button. **My stack** persists these
   choices independently of whether a tool has been installed.
6. For a repository skill, open **Setup → Review & add to Codex**. Inspect
   SKILL.md, bundled filenames, commit, and destination. Click
   **Add reviewed skill to Codex** to install that exact source into this
   project's .agents/skills folder. It becomes available on your next Codex turn.
7. Connector setup commands are copyable. Authentication and connection testing
   follow the provider's documentation. Provider-specific plugins are marked
   for manual adaptation.
8. Ask the coordinator: **“Build me a frontend stack”** or
   **“What are my scouts finding?”**

The Anthropic frontend-design skill was installed globally during project setup
and used to design Arnyx. Existing skills are detected in the user and project
skill folders; the app never overwrites a skill.

## What works

- Searchable capability catalog with filters and transparent sorting.
- Four concurrent source scouts with visible health, timestamps, warnings, and
  durable activity.
- Scheduled discovery at 15-minute, hourly, six-hourly, or daily intervals while
  the backend is running. Scheduling is off until enabled.
- Curated walkthroughs and starter prompts, plus clearly generic guidance for
  newly discovered tools.
- Persistent bookmarks, conversation history, source state, and settings in H2.
- Comparison of up to three capabilities, including compatibility and advantages.
- Project skill installation at a reviewed, pinned GitHub commit. Downloads are
  bounded, path-checked, and preserve binary files. Scripts are not run.
- A central coordinator using bounded, cancellable codex exec jobs. Context
  includes the catalog, saved choices, source health, activity, installed skill
  names, and sanitized MCP configuration.
- CLI availability and sign-in checks. MCP enabled/auth status is reported as
  configuration, not proof of a successfully tested live connection.
- Dark and light themes, responsive layouts, keyboard navigation, native
  accessible dialogs, reduced motion, locally served fonts, and interactive SVG
  capability diagrams.

## Sources and ranking

The skill scout currently checks Anthropic, Vercel, and OpenAI's curated skill
repositories, capped at 30 skills per repository. It reads bounded GitHub source
archives, avoiding a separate network request for every instruction file and
remaining usable when the raw-file host is unavailable. Source requests have
25-second timeouts, and the skill scout has a three-minute overall budget.

The connector scout searches the official MCP Registry for GitHub, Context7,
Playwright, search, and Notion listings. The plugin scout watches Anthropic's
knowledge-work and official plugin repositories. The harness scout watches
Codex, LangGraph, and AutoGen repositories and their latest published release,
when a release is available.

This is a focused, useful starting set of sources, not an exhaustive crawl of
the internet. GitHub's unauthenticated API limits and source outages can produce
partial runs. Successfully observed metadata is kept; failed sources are
reported with their actual error.

Discovery priority is a heuristic out of 100:

| Signal | Maximum | Meaning |
|---|---:|---|
| Publisher | 30 | Known source publisher |
| Source documentation | 20 | Source URL available |
| Repository adoption | 30 | Log-scaled GitHub repository stars |
| Source freshness | 20 | Recent repository push or published release |

Stars belong to the repository, not an individual skill, and are not install
counts. Repository push dates are not skill release dates. Neither registry
presence nor this score constitutes a security audit or a guarantee of quality.
Curated starter entries begin without observed metadata.

## Codex coordinator

The backend launches the CLI using an argument list and sends the assembled
prompt over stdin. User text is never interpolated into a shell command.

Invocation:

~~~text
codex exec --json --ephemeral --skip-git-repo-check --sandbox read-only --color never -
~~~

The coordinator is instructed to answer from the supplied app snapshot without
using tools or making changes. Read-only mode is enforced by the CLI; configured
CLI tools and provider behavior are still governed by your CLI configuration.
Arnyx's installation and settings changes happen through their explicit UI
controls.

Only one coordinator job runs at a time. Jobs time out after 210 seconds and can
be cancelled. CLI stderr is not returned to the browser or stored in the
database. Arnyx inspects sign-in using codex login status; it does not read or
copy your authentication file. MCP environment variables and headers are omitted
from the browser's runtime data.

If the CLI is installed somewhere unusual, set CODEX_BIN to its native
executable or its npm bin/codex.js entrypoint before starting the backend.

~~~powershell
$env:CODEX_BIN = 'C:\path\to\node_modules\@openai\codex\bin\codex.js'
npm run dev
~~~

## Build and check

~~~powershell
npm run build
npm test
npm run build:backend
~~~

With the application running and Google Chrome installed:

~~~powershell
npm run test:e2e
node scripts/visual-check.mjs
~~~

Backend tests cover path traversal and Windows device names, source host
restrictions, concurrent catalog updates, missing-source score behavior, and
walkthrough metadata. Browser tests cover filters, walkthroughs, keyboard
dialogs, persistent saved stacks, comparison, mobile overflow, and reduced
motion.

For one-server local use, build the frontend and start the backend:

~~~powershell
npm run build
npm start
~~~

Open **http://127.0.0.1:4318**. Spring Boot serves the built frontend from dist.
To launch the packaged backend, run java -jar target/arnyx-backend-0.1.0.jar
--debug=false from the backend directory.

## Project map

| Path | Responsibility |
|---|---|
| src/App.tsx | Workspace views, catalog controls, walkthrough and installation flows |
| src/components.tsx | Capability diagrams, cards, native dialogs, coordinator chat |
| src/styles.css | Theme tokens, responsive layout, interaction and reduced-motion styles |
| backend/.../discovery | Catalog ranking, allowlisted HTTP client, crawler coordination |
| backend/.../runtime | Codex CLI bridge and reviewed skill downloads |
| backend/.../store | Synchronized durable H2 snapshots |
| backend/.../api | Validated REST API and local host/origin checks |
| backend/src/main/resources/catalog.json | Curated starter catalog and authored walkthroughs |
| docs/DESIGN.md | Design direction, skill choice, and source references |
| docs/ARCHITECTURE.md | Data flow, extension points, and operational boundaries |

Local data is under .arnyx; downloaded project skills are under .agents/skills.
Both the data directory and build outputs are excluded from Git.

## Primary references

- [Frontend design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
- [Agent skills directory](https://skills.sh/)
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Spring Boot requirements](https://docs.spring.io/spring-boot/system-requirements.html)
- [Official MCP Registry](https://registry.modelcontextprotocol.io)
- [Motion for React](https://motion.dev/docs/react)
