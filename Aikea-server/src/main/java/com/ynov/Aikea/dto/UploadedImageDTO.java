package com.ynov.Aikea.dto;

import lombok.Builder;

@Builder
public record UploadedImageDTO(String url, String id) {
}
