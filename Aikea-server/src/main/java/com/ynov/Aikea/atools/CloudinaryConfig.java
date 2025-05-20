package com.ynov.Aikea.atools;

import com.cloudinary.Cloudinary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class CloudinaryConfig {

    @Value("${cloudinary.cloud-name:dummy-name}")
    private String cloudName;

    @Value("${cloudinary.api-key:dummy-key}")
    private String apiKey;

    @Value("${cloudinary.api-secret:dummy-secret}")
    private String apiSecret;
    @Bean
    public Cloudinary cloudinary() {
        Map<String, String> config = new HashMap<>();
        System.out.println("Cloudinary config: " + config);
        config.put("cloud_name", cloudName);
        config.put("api_key", apiKey);
        config.put("api_secret", apiSecret);
        config.put("secure", "true");
        return new Cloudinary(config);
    }

    @Bean
    public WebClient webClient() {
        return WebClient.builder().build();
    }

}