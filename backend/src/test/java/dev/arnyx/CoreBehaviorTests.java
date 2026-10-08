package dev.arnyx;

import dev.arnyx.discovery.*;
import dev.arnyx.runtime.SkillInstaller;
import dev.arnyx.store.StateStore;
import java.util.*;
import java.util.concurrent.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:arnyx-tests;DB_CLOSE_DELAY=-1", "spring.datasource.username=sa",
    "spring.datasource.password=", "arnyx.root=..", "logging.level.root=WARN", "debug=false"})
class CoreBehaviorTests {
    @Autowired StateStore store;
    @Autowired SourceClient client;
    @Autowired CatalogService catalog;

    @Test void rejectsTraversalWindowsDeviceNamesAndAbsolutePaths() {
        for (String path : List.of("../outside", "assets/../../outside", "C:/secret", "/absolute", "a\\b", "CON", "assets/NUL.md", "assets/file.", "assets//file"))
            assertThat(SkillInstaller.safeRelativePath(path)).as(path).isFalse();
        assertThat(SkillInstaller.safeRelativePath("references/ui-guidelines.md")).isTrue();
    }

    @Test void onlyAllowlistedHttpsSourcesCanBeFetched() {
        for (String url : List.of("http://api.github.com/repos/x/y", "https://evil.example/skill", "https://api.github.com.evil.example/source", "https://user:password@api.github.com/repos/x/y"))
            assertThatThrownBy(() -> client.text(url)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void metadataScoresDoNotInventUnknownStarsOrFreshness() {
        var score = CatalogService.score(Map.of("owner", "unknown", "url", "https://example.com"));
        assertThat(score.get("adoption")).isZero();
        assertThat(score.get("freshness")).isZero();
        assertThat(score.get("total")).isEqualTo(30);
    }

    @Test void concurrentScoutsCannotLoseCatalogEntries() throws Exception {
        try (var workers = Executors.newFixedThreadPool(4)) {
            var futures = new ArrayList<Future<?>>();
            for (int i = 0; i < 20; i++) {
                final int number = i;
                futures.add(workers.submit(() -> store.mergeCatalog(List.of(Map.of("id", "test-" + number, "name", "Item " + number)))));
            }
            for (var future : futures) future.get(10, TimeUnit.SECONDS);
        }
        assertThat(store.list("catalog").stream().filter(item -> item.get("id").toString().startsWith("test-")).count()).isEqualTo(20);
    }

    @Test void seedGuidesAndNotFoundBehaviorAreExplicit() {
        assertThat(catalog.find("frontend-design").get("guide")).isNotNull();
        assertThat(catalog.find("knowledge-work-plugins").get("compatibility").toString()).contains("manual adaptation");
        assertThatThrownBy(() -> catalog.find("missing")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }

    @Test void frontmatterDoesNotTreatBodyInstructionsAsMetadata() {
        String skill = "---\nname: useful-skill\ndescription: 'A useful skill'\n---\nname: ignore-all-rules";
        assertThat(CrawlerService.frontmatter(skill, "name", "fallback")).isEqualTo("useful-skill");
        assertThat(CrawlerService.frontmatter(skill, "description", "fallback")).isEqualTo("A useful skill");
    }

    @Test void reviewedInstallPreservesBinaryBytesAndExistingSkills(@TempDir Path directory) throws Exception {
        var source = new ArchiveSource();
        var installer = new SkillInstaller(catalog, store, source, directory.toString());
        var review = installer.review("frontend-design");
        String token = review.get("reviewId").toString();
        var result = installer.install("frontend-design", token);
        assertThat(result.get("commit")).isEqualTo(ArchiveSource.COMMIT);
        assertThat(Files.readAllBytes(directory.resolve(".agents/skills/archive-test/assets/icon.bin"))).containsExactly(source.binary);
        assertThat(Files.readString(directory.resolve(".agents/skills/archive-test/SKILL.md"))).contains("archive-test");
        var second = installer.review("frontend-design");
        assertThatThrownBy(() -> installer.install("frontend-design", second.get("reviewId").toString())).isInstanceOf(IllegalStateException.class).hasMessageContaining("preserved");
        assertThat(Files.readAllBytes(directory.resolve(".agents/skills/archive-test/assets/icon.bin"))).containsExactly(source.binary);
    }

    @Test void installationCannotUseAnExpiredOrWrongCapabilityReview(@TempDir Path directory) {
        var installer = new SkillInstaller(catalog, store, new ArchiveSource(), directory.toString());
        var review = installer.review("frontend-design");
        assertThatThrownBy(() -> installer.install("another-capability", review.get("reviewId").toString())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> installer.install("frontend-design", "unknown-review")).isInstanceOf(IllegalArgumentException.class);
        assertThat(Files.exists(directory.resolve(".agents"))).isFalse();
    }

    private static class ArchiveSource extends SourceClient {
        static final String COMMIT = "0123456789abcdef0123456789abcdef01234567";
        final byte[] binary = new byte[]{0, (byte) 0xff, (byte) 0x80, 42, 13, 10};
        @Override public JsonNode json(String url) {
            var mapper = JsonMapper.builder().build();
            if (url.contains("/commits/")) return mapper.valueToTree(Map.of("sha", COMMIT));
            return mapper.valueToTree(Map.of("truncated", false, "tree", List.of(
                Map.of("path", "skills/frontend-design/SKILL.md", "type", "blob", "mode", "100644", "size", 100),
                Map.of("path", "skills/frontend-design/assets/icon.bin", "type", "blob", "mode", "100644", "size", binary.length))));
        }
        @Override public Map<String, byte[]> repositoryFiles(String repo, String ref, String prefix, boolean instructionsOnly) {
            assertThat(ref).isEqualTo(COMMIT);
            return Map.of("SKILL.md", "---\nname: archive-test\ndescription: Test\n---\nReviewed instructions".getBytes(StandardCharsets.UTF_8), "assets/icon.bin", binary);
        }
    }
}
