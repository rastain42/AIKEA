package com.ynov.Aikea.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.core.io.Resource;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CreatePDFResponse {
    private Resource pdfResource;
    private Long bucketUploadId;
    private String bucketUploadUrl;
    private boolean uploadSuccess;
    private String errorMessage;
}
