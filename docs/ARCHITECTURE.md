# Arnyx architecture

Arnyx is a single-user, local application. The React UI makes same-origin
requests to Spring Boot, through Vite's development proxy or directly when
Spring Boot serves the production frontend.

~~~mermaid
flowchart LR
    UI[React workspace] --> API[Spring Boot REST API]
    API --> Store[(Local H2 state)]
    API --> Scouts[Crawler coordinator]
    Scouts --> Skills[Skill repositories]
    Scouts --> Registry[MCP Registry]
    Scouts --> Plugins[Plugin repositories]
    Scouts --> Harnesses[Harness releases]
    API --> Installer[Reviewed skill installer]
    Installer --> Project[Project .agents/skills]
    API --> Coordinator[Codex process bridge]
    Store --> Coordinator
    Coordinator --> CLI[Existing Codex CLI sign-in]
~~~

## Backend modules

CatalogService applies discovery priority and returns explicit missing metadata.
SourceClient accepts only HTTPS requests to approved primary-source hosts,
rejects redirects, and bounds time and response size. GitHub source archives are
read in memory with compressed-size, expanded-size, and entry-count limits.

CrawlerService runs four independent scouts on a bounded worker pool. Source
results merge by identity, while authored guides are retained. Skill instructions
are read from bounded GitHub archives without extracting their paths to disk.
The skill scout observes an overall time budget. Each source records complete,
partial, error, running, or idle state.
The scheduler reuses the same coordinator, so runs cannot overlap.

StateStore serializes catalog, source, bookmark, settings, conversation, and
activity snapshots to H2. Individual updates are durable database writes.
Synchronized read/modify/write methods prevent parallel scout updates from
overwriting one another. Snapshots are appropriate for a personal catalog of
hundreds of items; a large shared service would require normalized tables and
database-level job coordination.
Authored starter guides refresh at startup while observed stars, timestamps, and
release metadata are retained. Bookmarks and conversations are separate state.

SkillInstaller obtains a commit, previews the exact subtree, and stores a
short-lived review token. Installation accepts that token, downloads at the
pinned commit into a new staging directory, then moves the completed directory
into the project skill folder. It rejects path traversal, symbolic links,
Windows reserved filenames, existing destinations, excessive file count, and
excessive bytes. Binary files retain their bytes. No repository script runs.

CodexService discovers the local CLI, reports sanitized runtime configuration,
and manages one CLI process at a time. It sends structured app context via stdin
and reads the CLI's JSONL output. Jobs are bounded, cancellable, and preserve
conversation history only after a completed response. Ephemeral CLI sessions
avoid writing additional rollout files; Arnyx keeps its own bounded conversation
history in H2. Named capabilities and curated picks are prioritized in a bounded
120-item context, accompanied by an index of up to 500 capability names. The
coordinator is instructed to disclose missing details.

LocalAccessFilter checks host, origin, and JSON content type. The backend binds
to loopback; no third-party web origin is accepted for API actions.

## REST surface

| Method | Endpoint | Behavior |
|---|---|---|
| GET | /api/state | Catalog, source health, bookmarks, activity, messages, settings |
| GET | /api/runtime | Cached CLI, skill-folder, and sanitized MCP configuration checks |
| POST | /api/runtime/refresh | Refresh runtime checks |
| POST | /api/crawl | Start the four scouts if no run is active |
| POST | /api/saved | Save or remove an existing capability |
| POST | /api/settings | Enable or pause bounded scheduled discovery |
| GET | /api/capabilities/{id}/review | Preview files and pinned commit for a repository skill |
| POST | /api/capabilities/{id}/install | Install the reviewed version into this project |
| POST | /api/coordinator | Start a Codex answer using current app context |
| GET | /api/coordinator/{id} | Read actual CLI job progress and final answer |
| POST | /api/coordinator/{id}/cancel | Stop the CLI process and its descendants |
| DELETE | /api/messages | Clear Arnyx conversation history when no job is active |
| GET | /actuator/health | Spring Boot health |

## Extending discovery

Add a reviewed source adapter in CrawlerService, returning normalized capability
metadata and source warnings. Add its source definition in StateStore for a new
database; existing databases need an explicit source migration. Keep source
failures visible, preserve the distinction between observed facts and authored
guidance, and do not treat repository descriptions as executable instructions.

For richer walkthroughs, add an authored entry to catalog.json or build a
separate explicit Codex enrichment workflow with source citations and a
reviewable output. This version's dynamically discovered tools receive generic
guidance. It does not claim to have tested every tool or generated a bespoke
tutorial for every registry listing.

## Operational boundaries

Discovery is a scoped registry/repository scan; it does not automatically follow
arbitrary websites. Scheduled discovery only runs while Spring Boot is alive.
Connector sign-in and provider-specific plugin setup remain explicit manual
flows. ChatGPT/Codex account limits and required local MCP server startup affect
coordinator availability and latency.

Changing the frontend's port also requires changing the local-origin allowlist
and browser test configuration. The production UI uses the same port as Spring
Boot. Arnyx does not expose a remote multi-user deployment or run installers
from coordinator messages.
