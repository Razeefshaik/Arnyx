package dev.arnyx.runtime;

import dev.arnyx.discovery.*;
import dev.arnyx.store.StateStore;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** Downloads reviewed files at a pinned commit. Never executes package scripts. */
@Service
public class SkillInstaller {
    private final CatalogService catalog;
    private final StateStore store;
    private final SourceClient client;
    private final Path root;
    private final Map<String, Review> reviews = new ConcurrentHashMap<>();
    public SkillInstaller(CatalogService catalog, StateStore store, SourceClient client, @Value("${arnyx.root}") String root) {
        this.catalog = catalog; this.store = store; this.client = client;
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    public Map<String, Object> review(String id) {
        var item = catalog.find(id);
        if (!"Skills".equals(item.get("kind")) || item.get("path") == null)
            throw new IllegalArgumentException("Only repository skills support installation. Follow the publisher setup guide for this capability.");
        String repo = String.valueOf(item.get("repo"));
        String skillPath = String.valueOf(item.get("path"));
        if (!repo.matches("[\\w.-]+/[\\w.-]+") || !safeRelativePath(skillPath)) throw new IllegalArgumentException("Invalid source path.");
        String branch = String.valueOf(item.getOrDefault("branch", "main"));
        JsonNode commit = client.json("https://api.github.com/repos/" + repo + "/commits/" + URLEncoder.encode(branch, StandardCharsets.UTF_8));
        String sha = commit.path("sha").asText();
        if (!sha.matches("[a-f0-9]{40}")) throw new IllegalStateException("Source commit could not be verified.");
        JsonNode tree = client.json("https://api.github.com/repos/" + repo + "/git/trees/" + sha + "?recursive=1");
        if (tree.path("truncated").asBoolean()) throw new IllegalStateException("Repository listing is incomplete; use the publisher’s manual setup.");
        var files = new ArrayList<String>();
        long total = 0;
        for (JsonNode entry : tree.path("tree")) {
            String path = entry.path("path").asText();
            if (!path.startsWith(skillPath + "/") || !"blob".equals(entry.path("type").asText())) continue;
            if ("120000".equals(entry.path("mode").asText())) throw new IllegalStateException("Skill contains a symbolic link; use manual review.");
            String relative = path.substring(skillPath.length() + 1);
            if (!safeRelativePath(relative)) throw new IllegalStateException("Skill contains an unsupported path.");
            total += entry.path("size").asLong();
            files.add(relative);
        }
        if (files.isEmpty() || !files.contains("SKILL.md")) throw new IllegalStateException("No SKILL.md found.");
        if (files.size() > 100 || total > 2_000_000) throw new IllegalStateException("Skill exceeds the reviewed download limit (100 files / 2 MB). Use manual setup.");
        String instructions = client.text("https://raw.githubusercontent.com/" + repo + "/" + sha + "/" + skillPath + "/SKILL.md");
        String folder = CrawlerService.frontmatter(instructions, "name", Path.of(skillPath).getFileName().toString());
        if (!folder.matches("[A-Za-z0-9][A-Za-z0-9_-]{0,100}")) folder = Path.of(skillPath).getFileName().toString();
        String reviewId = UUID.randomUUID().toString();
        reviews.entrySet().removeIf(entry -> entry.getValue().expires.isBefore(Instant.now()));
        if (reviews.size() > 20) throw new IllegalStateException("Too many pending reviews. Wait a few minutes.");
        reviews.put(reviewId, new Review(id, repo, skillPath, sha, folder, List.copyOf(files), Instant.now().plusSeconds(900)));
        return Map.of("reviewId", reviewId, "commit", sha, "files", files, "instructions", instructions,
            "folder", folder, "bytes", total, "destination", ".agents/skills/" + folder,
            "notice", "Review instructions and bundled scripts. Installation downloads files without running scripts. Codex can follow the skill on your next turn.");
    }

    public synchronized Map<String, Object> install(String id, String reviewId) throws IOException {
        Review review = reviews.get(reviewId);
        if (review == null || !review.id.equals(id) || review.expires.isBefore(Instant.now()))
            throw new IllegalArgumentException("Review expired. Review the current source again.");
        Path skills = root.resolve(".agents/skills");
        ensureDirectories(skills);
        Path destination = skills.resolve(review.folder).normalize();
        if (!destination.startsWith(skills) || Files.exists(destination, LinkOption.NOFOLLOW_LINKS))
            throw new IllegalStateException("This project already has that skill. Existing files were preserved.");
        Path staging = root.resolve(".arnyx/staging/" + UUID.randomUUID()).normalize();
        ensureDirectories(staging);
        try {
            long total = 0;
            for (String relative : review.files) {
                byte[] content = client.text("https://raw.githubusercontent.com/" + review.repo + "/" + review.sha + "/" + review.path + "/" + relative).getBytes(StandardCharsets.UTF_8);
                total += content.length;
                if (total > 2_000_000) throw new IllegalStateException("Download exceeded the reviewed size limit.");
                Path target = staging.resolve(relative).normalize();
                if (!target.startsWith(staging)) throw new IllegalStateException("Invalid download path.");
                ensureDirectories(target.getParent());
                Files.write(target, content, StandardOpenOption.CREATE_NEW);
            }
            Files.writeString(staging.resolve(".arnyx-source.json"),
                tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(Map.of("repo", review.repo, "commit", review.sha, "installedAt", Instant.now().toString())));
            Files.move(staging, destination, StandardCopyOption.ATOMIC_MOVE);
            reviews.remove(reviewId);
            store.log("install", "Installed " + review.folder + " into this project at commit " + review.sha.substring(0, 8) + ".");
            return Map.of("installed", true, "folder", review.folder, "commit", review.sha, "destination", ".agents/skills/" + review.folder);
        } finally {
            // Cleanup is restricted to our newly generated staging directory.
            if (Files.exists(staging) && staging.startsWith(root.resolve(".arnyx/staging"))) {
                try (var paths = Files.walk(staging)) {
                    for (Path file : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
                }
            }
        }
    }

    private void ensureDirectories(Path directory) throws IOException {
        Path relative = root.relativize(directory);
        Path current = root;
        for (Path segment : relative) {
            current = current.resolve(segment);
            if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)) {
                if (!Files.isDirectory(current, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(current)
                    || !current.toRealPath().startsWith(root.toRealPath()))
                    throw new IllegalStateException("Installation destination contains a link or unsupported directory.");
            } else Files.createDirectory(current);
        }
    }

    public static boolean safeRelativePath(String path) {
        if (path == null || path.isBlank() || path.startsWith("/") || path.contains("\\") || path.contains(":")) return false;
        return Arrays.stream(path.split("/", -1)).allMatch(part -> !part.isBlank() && !part.equals(".") && !part.equals("..")
            && !part.matches("(?i)(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\\..*)?")
            && !part.endsWith(".") && !part.endsWith(" ") && !part.matches(".*[<>\"|?*\\x00-\\x1f].*"));
    }
    private record Review(String id, String repo, String path, String sha, String folder, List<String> files, Instant expires) {}
}
