package com.ynov.Aikea.controller;

import com.ynov.Aikea.dto.GeneratedTextDTO;
import com.ynov.Aikea.dto.TextFromImageRequestDTO;
import com.ynov.Aikea.dto.TextFromLocalImageRequestDTO;
import com.ynov.Aikea.service.TextGenerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/generate-text")
@RequiredArgsConstructor
public class TextGenerationController {

    private final TextGenerationService textGenerationService;

    @PostMapping("/generate")
    public ResponseEntity<GeneratedTextDTO> generateText(@RequestBody String prompt) {
        GeneratedTextDTO generatedTextDTO = textGenerationService.generateText(prompt);
        return ResponseEntity.ok(generatedTextDTO);
    }

    @PostMapping("/generate-from-image-url")
    public ResponseEntity<GeneratedTextDTO> generateTextFromImageUrl(@RequestBody TextFromImageRequestDTO request) {
        GeneratedTextDTO generatedTextDTO = textGenerationService.generateTextFromImageUrl(request.getImageUrl());
        return ResponseEntity.ok(generatedTextDTO);
    }

    @PostMapping("/generate-from-image-path")
    public ResponseEntity<GeneratedTextDTO> generateTextFromLocalImage(@RequestBody TextFromLocalImageRequestDTO request) {
        GeneratedTextDTO generatedTextDTO = textGenerationService.generateTextFromLocalImage(request.getImagePath());
        return ResponseEntity.ok(generatedTextDTO);
    }

}
