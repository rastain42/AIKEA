package com.ynov.Aikea.dto;

import lombok.Builder;

@Builder
public record UploadedImageDTO(String URL, String ID) {
}
