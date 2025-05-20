package com.ynov.Aikea.dto;

public class ImageGenerationRequest {
    private String prompt;
    private String quality;

    // Getters et setters
    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getQuality() {
        return quality;
    }

    public void setQuality(String quality) {
        this.quality = quality;
    }
}
