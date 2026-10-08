package dev.arnyx;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ArnyxApplication {
    public static void main(String[] args) {
        SpringApplication.run(ArnyxApplication.class, args);
    }
}
