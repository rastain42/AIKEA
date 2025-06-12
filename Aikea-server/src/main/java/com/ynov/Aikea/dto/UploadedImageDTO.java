package com.ynov.Aikea.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UploadedImageDTO {
    private String url;
    private String id;
    private String idExterne;

}
