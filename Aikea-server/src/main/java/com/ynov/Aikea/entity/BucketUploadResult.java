package com.ynov.Aikea.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class BucketUploadResult {
    private Long id;
    private String url;
    private boolean success;
    private String errorMessage;
}