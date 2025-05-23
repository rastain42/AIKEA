package com.ynov.Aikea.dto;

import lombok.Builder;
import lombok.Data;

@Builder()
@Data
public class GeneratedImageDTO {

    private byte[] image;
    private int internalID;
    private String externalID;
    private String storageURL;
    private String url;
}
