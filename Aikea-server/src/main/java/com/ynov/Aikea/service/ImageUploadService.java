package com.ynov.Aikea.service;

import com.ynov.Aikea.dto.UploadedImageDTO;

import com.ynov.Aikea.dto.UploadedImageDTO;
import java.util.List;
import java.util.Map;

public interface ImageUploadService {
    UploadedImageDTO uploadImage(byte[] image);
    void deleteImage(String imageId);
    List<Map<String, String>> getAllImages();
}
