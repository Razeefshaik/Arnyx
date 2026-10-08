package dev.arnyx.discovery;

import dev.arnyx.store.StateStore;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class CatalogService {
    private final StateStore store;
    public CatalogService(StateStore store) { this.store = store; }
    public Map<String, Object> find(String id) {
        return store.list("catalog").stream().filter(item -> id.equals(item.get("id"))).findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Capability not found."));
    }
    public List<Map<String, Object>> all() {
        return store.list("catalog").stream().map(item -> {
            var copy = new LinkedHashMap<>(item);
            copy.put("score", score(item));
            return (Map<String, Object>) copy;
        }).toList();
    }
    public static Map<String, Integer> score(Map<String, Object> item) {
        boolean known = Set.of("anthropics", "vercel-labs", "openai", "microsoft", "github", "upstash").contains(String.valueOf(item.get("owner")));
        int publisher = known ? 30 : 10;
        int docs = item.get("url") != null ? 20 : 0;
        int adoption = item.get("stars") instanceof Number n ? Math.min(30, (int) Math.round(Math.log10(n.longValue() + 1) * 6)) : 0;
        int freshness = 0;
        try {
            long days = Duration.between(Instant.parse(String.valueOf(item.get("updatedAt"))), Instant.now()).toDays();
            freshness = days < 30 ? 20 : days < 180 ? 12 : days < 365 ? 6 : 0;
        } catch (DateTimeException ignored) {}
        return Map.of("total", publisher + docs + adoption + freshness, "publisher", publisher,
            "documentation", docs, "adoption", adoption, "freshness", freshness);
    }
    public static String category(String text) {
        text = text.toLowerCase(Locale.ROOT);
        if (text.matches("(?s).*(design|frontend|visual|\\bui\\b).*")) return "Design";
        if (text.matches("(?s).*(test|playwright|debug).*")) return "Testing";
        if (text.matches("(?s).*(agent|workflow|harness).*")) return "Agent workflows";
        if (text.matches("(?s).*(research|document|productivity|slack|notion).*")) return "Productivity";
        return "Development";
    }
    public static Map<String, Object> genericGuide(Map<String, Object> item) {
        boolean skill = "Skills".equals(item.get("kind"));
        return Map.of(
            "benefits", List.of("Explore the capability using its source documentation.", "Use a focused task to judge whether it improves your workflow."),
            "steps", List.of("Open the source and review instructions, license, and prerequisites.",
                "Check host compatibility and any credentials or services it needs.",
                skill ? "Review the files, then use Add to Codex for a project installation." : "Follow the publisher’s setup guide and verify the connection.",
                "Run a small example and inspect the result before using it in a larger workflow."),
            "example", "Explain how " + item.get("name") + " can help my coding workflow. State prerequisites and suggest a small verifiable example.",
            "caveat", "Discovered metadata is not independently audited. A discovery score ranks signals; it does not guarantee quality.");
    }
}
