package dev.arnyx.discovery;

import dev.arnyx.store.StateStore;
import jakarta.annotation.PreDestroy;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class CrawlerService {
    private final StateStore store;
    private final SourceClient client;
    private final ExecutorService workers = Executors.newFixedThreadPool(4);
    private final AtomicBoolean running = new AtomicBoolean();
    private volatile Instant lastStart = Instant.EPOCH;
    public CrawlerService(StateStore store, SourceClient client) { this.store = store; this.client = client; }
    public boolean isRunning() { return running.get(); }

    public boolean start() {
        if (!running.compareAndSet(false, true)) return false;
        lastStart = Instant.now();
        store.log("crawl", "Discovery started across four source scouts.");
        var tasks = List.of(
            CompletableFuture.runAsync(() -> scan("skills", this::skills), workers),
            CompletableFuture.runAsync(() -> scan("connectors", this::connectors), workers),
            CompletableFuture.runAsync(() -> scan("plugins", () -> repositories("Plugins", "plugins",
                List.of("anthropics/knowledge-work-plugins", "anthropics/claude-plugins-official"))), workers),
            CompletableFuture.runAsync(() -> scan("harnesses", () -> repositories("Harnesses", "harnesses",
                List.of("openai/codex", "langchain-ai/langgraph", "microsoft/autogen"))), workers));
        CompletableFuture.allOf(tasks.toArray(CompletableFuture[]::new)).whenComplete((result, error) -> {
            running.set(false);
            store.log("crawl", "Discovery finished. Source status includes any partial results or errors.");
        });
        return true;
    }

    @Scheduled(fixedDelay = 60000)
    public void scheduled() {
        var settings = store.map("settings");
        if (Boolean.TRUE.equals(settings.get("scheduled"))) {
            long minutes = ((Number) settings.getOrDefault("intervalMinutes", 60)).longValue();
            if (Duration.between(lastStart, Instant.now()).toMinutes() >= minutes) start();
        }
    }

    private void scan(String id, Callable<Scan> action) {
        store.updateSource(id, Map.of("status", "running", "error", ""));
        try {
            Scan result = action.call();
            store.mergeCatalog(result.items);
            store.updateSource(id, Map.of("status", result.warnings.isEmpty() ? "complete" : "partial",
                "lastRun", Instant.now().toString(), "found", result.items.size(), "error", String.join(" · ", result.warnings)));
            store.log("crawl", id + " scout checked " + result.items.size() + " capabilities."
                + (result.warnings.isEmpty() ? "" : " Some sources could not be checked."));
        } catch (Exception e) {
            store.updateSource(id, Map.of("status", "error", "lastRun", Instant.now().toString(), "error", safeError(e)));
            store.log("error", id + " scout: " + safeError(e));
        }
    }

    private Scan skills() {
        var items = new ArrayList<Map<String, Object>>();
        var warnings = new ArrayList<String>();
        for (var target : List.of(new String[]{"anthropics/skills", "skills"}, new String[]{"vercel-labs/agent-skills", "skills"}, new String[]{"openai/skills", "skills/.curated"})) {
            String repo = target[0], root = target[1];
            try {
                JsonNode metadata = client.json("https://api.github.com/repos/" + repo);
                JsonNode entries = client.json("https://api.github.com/repos/" + repo + "/contents/" + root);
                int inspected = 0;
                for (JsonNode entry : entries) {
                    if (!"dir".equals(entry.path("type").asText()) || inspected++ >= 30) continue;
                    String path = entry.path("path").asText();
                    try {
                        String instructions = client.text("https://raw.githubusercontent.com/" + repo + "/" + metadata.path("default_branch").asText() + "/" + path + "/SKILL.md");
                        String name = frontmatter(instructions, "name", entry.path("name").asText());
                        String description = frontmatter(instructions, "description", "A reusable capability from " + repo + ". Review its source instructions.");
                        var item = base(repo.replace("/", "--") + "--" + entry.path("name").asText(), pretty(name), "Skills", repo);
                        item.putAll(Map.of("path", path, "branch", metadata.path("default_branch").asText(), "skillName", name,
                            "description", description, "category", CatalogService.category(name + " " + description),
                            "url", "https://github.com/" + repo + "/tree/" + metadata.path("default_branch").asText() + "/" + path,
                            "compatibility", "Codex skill · review instructions",
                            "install", "npx skills add " + repo + " --skill " + name + " --agent codex"));
                        item.put("stars", metadata.path("stargazers_count").asLong());
                        item.put("updatedAt", metadata.path("pushed_at").asText());
                        item.put("sourceId", "skills");
                        items.add(normalize(item));
                    } catch (Exception e) {
                        // Skip folders that are not skills; keep visible warnings for network failures.
                        if (!safeError(e).contains("HTTP 404")) warnings.add(repo + "/" + entry.path("name").asText() + ": " + safeError(e));
                    }
                }
            } catch (Exception e) { warnings.add(repo + ": " + safeError(e)); }
        }
        if (items.isEmpty()) throw new IllegalStateException(String.join(" · ", warnings));
        return new Scan(items, warnings);
    }

    private Scan connectors() {
        var items = new LinkedHashMap<String, Map<String, Object>>();
        var warnings = new ArrayList<String>();
        for (String search : List.of("github", "context7", "playwright", "search", "notion")) {
            try {
                JsonNode data = client.json("https://registry.modelcontextprotocol.io/v0.1/servers?version=latest&limit=20&search=" + search);
                for (JsonNode entry : data.path("servers")) {
                    JsonNode official = entry.path("_meta").path("io.modelcontextprotocol.registry/official");
                    if (!"active".equals(official.path("status").asText())) continue;
                    JsonNode server = entry.path("server");
                    String repoUrl = server.path("repository").path("url").asText();
                    Matcher match = Pattern.compile("^https://github\\.com/([\\w.-]+/[\\w.-]+?)(?:\\.git)?/?$").matcher(repoUrl);
                    String repo = match.matches() ? match.group(1) : "";
                    String registryName = server.path("name").asText();
                    var item = base("mcp--" + registryName, server.path("title").asText(registryName), "Connectors", repo);
                    item.putAll(Map.of("description", server.path("description").asText(), "registryName", registryName,
                        "category", CatalogService.category(server.path("description").asText()),
                        "url", repo.isEmpty() ? "https://registry.modelcontextprotocol.io" : "https://github.com/" + repo,
                        "compatibility", "MCP · check provider setup", "version", server.path("version").asText(),
                        "updatedAt", official.path("updatedAt").asText(), "sourceId", "connectors"));
                    item = normalize(item);
                    items.put(item.get("id").toString(), item);
                }
            } catch (Exception e) { warnings.add(search + ": " + safeError(e)); }
        }
        if (items.isEmpty()) throw new IllegalStateException(warnings.isEmpty() ? "Registry returned no active matching servers." : String.join(" · ", warnings));
        return new Scan(new ArrayList<>(items.values()), warnings);
    }

    private Scan repositories(String kind, String sourceId, List<String> repos) {
        var items = new ArrayList<Map<String, Object>>();
        var warnings = new ArrayList<String>();
        for (String repo : repos) {
            try {
                JsonNode metadata = client.json("https://api.github.com/repos/" + repo);
                var item = base(repo.equals("openai/codex") ? "codex-cli" : repo.split("/")[1], pretty(metadata.path("name").asText()), kind, repo);
                item.putAll(Map.of("description", metadata.path("description").asText("Explore the publisher’s setup guide."),
                    "category", kind.equals("Harnesses") ? "Agent workflows" : "Productivity", "url", metadata.path("html_url").asText(),
                    "compatibility", "Manual setup · follow publisher documentation", "stars", metadata.path("stargazers_count").asLong(),
                    "updatedAt", metadata.path("pushed_at").asText(), "sourceId", sourceId));
                try {
                    JsonNode release = client.json("https://api.github.com/repos/" + repo + "/releases/latest");
                    item.put("version", release.path("tag_name").asText());
                    item.put("updatedAt", release.path("published_at").asText());
                } catch (Exception e) { if (!safeError(e).contains("HTTP 404")) warnings.add(repo + " release: " + safeError(e)); }
                items.add(normalize(item));
            } catch (Exception e) { warnings.add(repo + ": " + safeError(e)); }
        }
        if (items.isEmpty()) throw new IllegalStateException(String.join(" · ", warnings));
        return new Scan(items, warnings);
    }

    private Map<String, Object> normalize(Map<String, Object> input) {
        var existing = store.list("catalog").stream().filter(item ->
            input.get("id").equals(item.get("id")) || (!String.valueOf(input.get("repo")).isBlank()
                && input.get("repo").equals(item.get("repo")) && Objects.equals(input.get("path"), item.get("path")))).findFirst();
        existing.ifPresent(item -> {
            // Preserve deliberately written guides and identity, update observed facts.
            for (String field : List.of("id", "name", "description", "accent", "icon", "featured", "tags", "guide", "compatibility", "install", "category"))
                if (item.containsKey(field)) input.put(field, item.get(field));
        });
        input.put("observedAt", Instant.now().toString());
        input.putIfAbsent("guide", CatalogService.genericGuide(input));
        return input;
    }

    private static Map<String, Object> base(String id, String name, String kind, String repo) {
        var map = new LinkedHashMap<String, Object>();
        map.putAll(Map.of("id", id, "name", name, "kind", kind, "repo", repo,
            "owner", repo.isBlank() ? "Registry publisher" : repo.split("/")[0],
            "accent", kind.equals("Connectors") ? "mint" : kind.equals("Plugins") ? "rose" : "lavender",
            "icon", kind.equals("Connectors") ? "plug" : kind.equals("Harnesses") ? "terminal" : "layers",
            "tags", List.of(kind, "Source available")));
        return map;
    }

    public static String frontmatter(String text, String key, String fallback) {
        Matcher block = Pattern.compile("^---\\r?\\n([\\s\\S]*?)\\r?\\n---").matcher(text);
        if (!block.find()) return fallback;
        Matcher field = Pattern.compile("(?m)^" + Pattern.quote(key) + ":\\s*(.+)$").matcher(block.group(1));
        if (!field.find()) return fallback;
        String value = field.group(1).trim().replaceAll("^[\"']|[\"']$", "");
        return value.matches("^[>|].*") ? fallback : value;
    }
    private static String pretty(String value) {
        return Arrays.stream(value.replace('-', ' ').replace('_', ' ').split(" ")).filter(s -> !s.isBlank())
            .map(s -> s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1)).reduce((a, b) -> a + " " + b).orElse(value);
    }
    private static String safeError(Exception e) { return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage().substring(0, Math.min(500, e.getMessage().length())); }
    private record Scan(List<Map<String, Object>> items, List<String> warnings) {}
    @PreDestroy public void shutdown() { workers.shutdownNow(); }
}
