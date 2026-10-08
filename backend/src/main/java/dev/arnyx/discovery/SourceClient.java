package dev.arnyx.discovery;

import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.zip.ZipInputStream;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class SourceClient {
    private static final Set<String> HOSTS = Set.of("api.github.com", "raw.githubusercontent.com", "codeload.github.com", "registry.modelcontextprotocol.io");
    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build();
    private final JsonMapper json = JsonMapper.builder().build();
    public JsonNode json(String url) { return json.readTree(text(url)); }
    public String text(String url) { return new String(bytes(url), java.nio.charset.StandardCharsets.UTF_8); }
    public byte[] bytes(String url) {
        URI uri = URI.create(url);
        if (!"https".equals(uri.getScheme()) || !HOSTS.contains(uri.getHost()) || uri.getUserInfo() != null)
            throw new IllegalArgumentException("Source host is not allowed.");
        var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(25))
            .header("User-Agent", "Arnyx/0.1 (personal capability discovery)").header("Accept", "application/json").GET().build();
        try {
            var response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (var input = response.body()) {
                if (response.statusCode() != 200) {
                    if ("0".equals(response.headers().firstValue("x-ratelimit-remaining").orElse("")))
                        throw new IllegalStateException("GitHub public API limit reached. Wait for its reset before trying again.");
                    throw new IllegalStateException("Source returned HTTP " + response.statusCode());
                }
                int limit = "codeload.github.com".equals(uri.getHost()) ? 40_000_000 : 3_000_000;
                byte[] bytes = input.readNBytes(limit + 1);
                if (bytes.length > limit) throw new IllegalStateException("Source response exceeded size limit.");
                return bytes;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Source request interrupted.");
        } catch (IOException e) {
            throw new IllegalStateException("Cannot reach source: " + e.getClass().getSimpleName());
        }
    }

    /** Read a GitHub archive in memory, without ever extracting untrusted paths. */
    public Map<String, byte[]> repositoryFiles(String repo, String ref, String prefix, boolean instructionsOnly) {
        if (!repo.matches("[\\w.-]+/[\\w.-]+") || !ref.matches("[\\w./-]+") || prefix.contains(".."))
            throw new IllegalArgumentException("Invalid repository archive reference.");
        String url = "https://codeload.github.com/" + repo + "/zip/" + java.net.URLEncoder.encode(ref, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
        byte[] archive = bytes(url);
        var files = new LinkedHashMap<String, byte[]>();
        long expanded = 0, selected = 0;
        int entries = 0;
        try (var zip = new ZipInputStream(new java.io.ByteArrayInputStream(archive))) {
            java.util.zip.ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > 15000) throw new IllegalStateException("Repository archive has too many entries.");
                String archivePath = entry.getName();
                int separator = archivePath.indexOf('/');
                if (separator < 0 || entry.isDirectory()) continue;
                String path = archivePath.substring(separator + 1);
                boolean wanted = path.startsWith(prefix + "/") && (!instructionsOnly || path.endsWith("/SKILL.md"));
                var output = wanted ? new java.io.ByteArrayOutputStream() : null;
                int count;
                while ((count = zip.read(buffer)) != -1) {
                    expanded += count;
                    if (expanded > 100_000_000) throw new IllegalStateException("Repository archive exceeds the expanded size limit.");
                    if (wanted) {
                        selected += count;
                        if (selected > 8_000_000) throw new IllegalStateException("Selected repository files exceed the size limit.");
                        output.write(buffer, 0, count);
                    }
                }
                if (wanted) files.put(path.substring(prefix.length() + 1), output.toByteArray());
            }
            return files;
        } catch (IOException e) { throw new IllegalStateException("Repository archive could not be read."); }
    }
}
