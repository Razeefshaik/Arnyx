package dev.arnyx.api;

import java.io.IOException;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
    public ResponseEntity<?> invalid(Exception e) {
        String message = e instanceof MethodArgumentNotValidException ? "Check the request fields and limits." : e.getMessage();
        return ResponseEntity.badRequest().body(Map.of("error", message == null ? "Invalid request." : message));
    }
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<?> conflict(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage() == null ? "Operation unavailable." : e.getMessage()));
    }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> status(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", e.getReason() == null ? "Request failed." : e.getReason()));
    }
    @ExceptionHandler(IOException.class)
    public ResponseEntity<?> io(IOException e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Could not write the skill files. Check destination permissions and available disk space."));
    }
}
