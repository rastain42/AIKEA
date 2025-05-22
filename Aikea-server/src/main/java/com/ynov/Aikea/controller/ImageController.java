package com.ynov.Aikea.controller;


import com.ynov.Aikea.atools.ImageProviderEnum;
import com.ynov.Aikea.atools.QualityEnum;
import com.ynov.Aikea.dto.GeneratedImageDTO;
import com.ynov.Aikea.dto.ImageGenerationRequest;
import com.ynov.Aikea.service.ImageGenerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/generate-image")
@RequiredArgsConstructor
public class ImageController {

    private final ImageGenerationService imageGenerationService ;

    @PostMapping(value = "/justImage", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> generateImageAndSend(@RequestBody ImageGenerationRequest request) {
        String prompt = request.getPrompt();
        String quality = request.getQuality() != null ? request.getQuality() : "Low";

        QualityEnum qualityEnum;
        GeneratedImageDTO dto;

        qualityEnum = switch (quality) {
            case "Medium" -> QualityEnum.MEDIUM;
            case "High" -> QualityEnum.HIGH;
            default -> QualityEnum.LOW;
        };

        try {
            // Assurez-vous que le prompt est propre pour éviter les problèmes de noms de fichiers
            prompt = prompt.replace("\"", "").trim();

            dto = imageGenerationService.generateAndSaveImage(prompt, qualityEnum);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.IMAGE_PNG);
            return ResponseEntity.ok().headers(headers).body(dto.getImage());

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(null);
        }
    }


    @GetMapping(value = "/fullDTO", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<GeneratedImageDTO> generateImage(
            @RequestParam String prompt,
            @RequestParam ImageProviderEnum provider,
            @RequestParam(defaultValue = "Low") QualityEnum quality) {

        GeneratedImageDTO dto ;

        try {
            dto = imageGenerationService.generateAndSaveImage(prompt, quality) ;
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(null);
        }

        return ResponseEntity
                .ok(dto);
    }

}