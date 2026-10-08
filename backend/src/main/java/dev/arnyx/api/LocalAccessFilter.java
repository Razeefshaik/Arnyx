package dev.arnyx.api;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.net.URI;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Loopback binding plus host/origin validation protects the local CLI bridge. */
@Component
public class LocalAccessFilter extends OncePerRequestFilter {
    private static final Set<String> HOSTS = Set.of("localhost", "127.0.0.1", "[::1]", "::1");
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        if (!request.getRequestURI().startsWith("/api/")) { chain.doFilter(request, response); return; }
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        String origin = request.getHeader("Origin");
        String host = request.getServerName();
        boolean allowed = HOSTS.contains(host) && ("GET".equals(request.getMethod()) || request.getContentType() != null && request.getContentType().startsWith("application/json"));
        if (origin != null) {
            try {
                URI uri = URI.create(origin);
                allowed &= HOSTS.contains(uri.getHost()) && "http".equals(uri.getScheme())
                    && (uri.getPort() == 5173 || uri.getPort() == request.getServerPort());
            } catch (Exception e) { allowed = false; }
        }
        if ("cross-site".equals(request.getHeader("Sec-Fetch-Site"))) allowed = false;
        if (!allowed) {
            response.setStatus(403); response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"This API accepts requests from the local Arnyx interface only.\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
