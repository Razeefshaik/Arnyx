package dev.arnyx.api;

import dev.arnyx.discovery.*;
import dev.arnyx.runtime.*;
import dev.arnyx.store.StateStore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.io.IOException;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final StateStore store;
    private final CatalogService catalog;
    private final CrawlerService crawlers;
    private final CodexService codex;
    private final SkillInstaller installer;
    public ApiController(StateStore store, CatalogService catalog, CrawlerService crawlers, CodexService codex, SkillInstaller installer) {
        this.store = store; this.catalog = catalog; this.crawlers = crawlers; this.codex = codex; this.installer = installer;
    }
    @GetMapping("/state")
    public Map<String, Object> state() {
        return Map.of("catalog", catalog.all(), "sources", store.list("sources"), "saved", store.get("saved", List.of()),
            "events", store.list("events"), "messages", store.list("messages"), "settings", store.map("settings"),
            "crawling", crawlers.isRunning(), "activeJob", codex.activeJob());
    }
    @GetMapping("/runtime") public Map<String, Object> runtime() { return codex.runtime(); }
    @PostMapping("/runtime/refresh") public Map<String, Object> refreshRuntime() { codex.invalidateRuntime(); return codex.runtime(); }
    @PostMapping("/crawl") public Map<String, Object> crawl() { return Map.of("started", crawlers.start(), "running", true); }
    @PostMapping("/saved")
    public synchronized Map<String, Object> save(@RequestBody @Valid SavedRequest body) {
        catalog.find(body.id);
        @SuppressWarnings("unchecked") var ids = new LinkedHashSet<>((List<String>) store.get("saved", List.of()));
        if (body.saved) ids.add(body.id); else ids.remove(body.id);
        store.put("saved", ids);
        store.log("stack", (body.saved ? "Saved " : "Removed ") + catalog.find(body.id).get("name") + (body.saved ? " to your stack." : " from your stack."));
        return Map.of("saved", ids);
    }
    @PostMapping("/settings")
    public Map<String, Object> settings(@RequestBody @Valid SettingsRequest body) {
        var settings = Map.of("scheduled", body.scheduled, "intervalMinutes", body.intervalMinutes);
        store.put("settings", settings);
        store.log("settings", body.scheduled ? "Scheduled discovery enabled every " + body.intervalMinutes + " minutes while Arnyx is running." : "Scheduled discovery paused.");
        return settings;
    }
    @GetMapping("/capabilities/{id}/review") public Map<String, Object> review(@PathVariable String id) { return installer.review(id); }
    @PostMapping("/capabilities/{id}/install")
    public Map<String, Object> install(@PathVariable String id, @RequestBody @Valid InstallRequest body) throws IOException {
        var result = installer.install(id, body.reviewId); codex.invalidateRuntime(); return result;
    }
    @PostMapping("/coordinator")
    public Map<String, Object> chat(@RequestBody @Valid ChatRequest body) { return codex.start(body.message); }
    @GetMapping("/coordinator/{id}") public Map<String, Object> job(@PathVariable String id) { return codex.job(id); }
    @PostMapping("/coordinator/{id}/cancel") public Map<String, Object> cancel(@PathVariable String id) { codex.cancel(id); return Map.of("cancelled", true); }
    @DeleteMapping("/messages")
    public Map<String, Object> clearMessages() {
        if (!codex.activeJob().isEmpty()) throw new IllegalStateException("Stop the coordinator before clearing the conversation.");
        store.put("messages", List.of()); return Map.of("cleared", true);
    }
    public record SavedRequest(@NotBlank @Size(max = 300) String id, boolean saved) {}
    public record SettingsRequest(boolean scheduled, @Min(15) @Max(1440) int intervalMinutes) {}
    public record InstallRequest(@NotBlank @Size(max = 80) String reviewId) {}
    public record ChatRequest(@NotBlank @Size(max = 4000) String message) {}
}
