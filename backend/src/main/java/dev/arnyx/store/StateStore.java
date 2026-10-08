package dev.arnyx.store;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Durable snapshots; synchronized mutations prevent parallel scouts losing data. */
@Repository
public class StateStore {
    private final JdbcTemplate jdbc;
    private final JsonMapper json = JsonMapper.builder().build();
    private static final TypeReference<Object> VALUE = new TypeReference<>() {};

    public StateStore(JdbcTemplate jdbc) throws IOException {
        this.jdbc = jdbc;
        jdbc.execute("CREATE TABLE IF NOT EXISTS app_state (state_key VARCHAR(80) PRIMARY KEY, payload CLOB NOT NULL)");
        String seed = new ClassPathResource("catalog.json").getContentAsString(StandardCharsets.UTF_8);
        List<Map<String, Object>> authored = json.readValue(seed, new TypeReference<>() {});
        if (!exists("catalog")) put("catalog", authored);
        else {
            var entries = new LinkedHashMap<String, Map<String, Object>>();
            list("catalog").forEach(item -> entries.put(item.get("id").toString(), item));
            Set<String> observedFields = Set.of("stars", "observedAt", "updatedAt", "version", "sourceId", "branch", "skillName", "registryName");
            for (var item : authored) {
                var current = entries.computeIfAbsent(item.get("id").toString(), key -> new LinkedHashMap<>());
                item.forEach((key, value) -> { if (!observedFields.contains(key) || !current.containsKey(key)) current.put(key, value); });
            }
            put("catalog", entries.values());
        }
        if (!exists("sources")) {
            put("sources", List.of(
                source("skills", "Skill scout", "Anthropic, Vercel & OpenAI", "https://github.com/anthropics/skills", "Skills"),
                source("connectors", "Connector scout", "Official MCP Registry", "https://registry.modelcontextprotocol.io", "Connectors"),
                source("plugins", "Plugin scout", "Published plugin repositories", "https://github.com/anthropics/knowledge-work-plugins", "Plugins"),
                source("harnesses", "Harness scout", "Codex, LangGraph & AutoGen", "https://github.com/openai/codex", "Harnesses")));
        }
        List<Map<String, Object>> scouts = list("sources");
        scouts.forEach(source -> { if ("running".equals(source.get("status"))) source.put("status", "idle"); });
        put("sources", scouts);
        if (!exists("settings")) put("settings", Map.of("scheduled", false, "intervalMinutes", 60));
        if (!exists("saved")) put("saved", List.of());
        if (!exists("messages")) put("messages", List.of());
    }

    private static Map<String, Object> source(String id, String name, String subtitle, String url, String kind) {
        return new LinkedHashMap<>(Map.of("id", id, "name", name, "subtitle", subtitle, "url", url,
            "kind", kind, "status", "idle", "found", 0));
    }
    private boolean exists(String key) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM app_state WHERE state_key = ?", Integer.class, key) > 0;
    }
    public synchronized Object get(String key, Object fallback) {
        List<String> rows = jdbc.query("SELECT payload FROM app_state WHERE state_key = ?", (rs, n) -> rs.getString(1), key);
        return rows.isEmpty() ? fallback : json.readValue(rows.getFirst(), VALUE);
    }
    @SuppressWarnings("unchecked")
    public synchronized List<Map<String, Object>> list(String key) {
        return (List<Map<String, Object>>) get(key, new ArrayList<>());
    }
    @SuppressWarnings("unchecked")
    public synchronized Map<String, Object> map(String key) {
        return (Map<String, Object>) get(key, new LinkedHashMap<>());
    }
    public synchronized void put(String key, Object value) {
        jdbc.update("MERGE INTO app_state (state_key, payload) KEY(state_key) VALUES (?, ?)", key, json.writeValueAsString(value));
    }
    public synchronized void log(String type, String message) {
        var events = new ArrayList<>(list("events"));
        events.addFirst(new LinkedHashMap<>(Map.of("id", UUID.randomUUID().toString(), "at", Instant.now().toString(), "type", type, "message", message)));
        put("events", events.subList(0, Math.min(150, events.size())));
    }
    public synchronized void mergeCatalog(List<Map<String, Object>> discovered) {
        var catalog = new LinkedHashMap<String, Map<String, Object>>();
        list("catalog").forEach(item -> catalog.put(item.get("id").toString(), item));
        discovered.forEach(item -> {
            var merged = new LinkedHashMap<>(catalog.getOrDefault(item.get("id").toString(), Map.of()));
            merged.putAll(item);
            catalog.put(item.get("id").toString(), merged);
        });
        put("catalog", catalog.values());
    }
    public synchronized void updateSource(String id, Map<String, Object> patch) {
        var sources = list("sources");
        sources.stream().filter(source -> id.equals(source.get("id"))).forEach(source -> source.putAll(patch));
        put("sources", sources);
    }
    public synchronized void appendMessage(String role, String content) {
        var messages = new ArrayList<>(list("messages"));
        messages.add(new LinkedHashMap<>(Map.of("id", UUID.randomUUID().toString(), "role", role, "content", content, "at", Instant.now().toString())));
        put("messages", messages.subList(Math.max(0, messages.size() - 40), messages.size()));
    }
}
