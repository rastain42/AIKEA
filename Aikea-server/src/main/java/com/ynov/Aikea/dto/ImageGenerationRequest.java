package com.ynov.Aikea.dto;

import lombok.Data;
import lombok.Setter;

@Data
public class ImageGenerationRequest {
    @Setter
    private String prompt;
    private String quality;
}
