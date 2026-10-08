package dev.arnyx.discovery;

import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.Set;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class SourceClient {
    private static final Set<String> HOSTS = Set.of("api.github.com", "raw.githubusercontent.com", "registry.modelcontextprotocol.io");
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build();
    private final JsonMapper json = JsonMapper.builder().build();
    public JsonNode json(String url) { return json.readTree(text(url)); }
    public String text(String url) {
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
                byte[] bytes = input.readNBytes(3_000_001);
                if (bytes.length > 3_000_000) throw new IllegalStateException("Source response exceeded size limit.");
                return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Source request interrupted.");
        } catch (IOException e) {
            throw new IllegalStateException("Cannot reach source: " + e.getClass().getSimpleName());
        }
    }
}
