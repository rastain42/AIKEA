package com.ynov.Aikea.controller;

import com.ynov.Aikea.dto.ImageGenerationRequest;
import com.ynov.Aikea.dto.PDFContentDTO;
import com.ynov.Aikea.service.PDFContentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/generate-pdf")
@RequiredArgsConstructor
public class PDFContentController {

    private final PDFContentService pdfContentService;

    @PostMapping("/content")
    public ResponseEntity<PDFContentDTO> generatePDFContent(@RequestBody ImageGenerationRequest imageGenerationRequest) {
        try {
            PDFContentDTO pdfContent = pdfContentService.generatePDFContent(imageGenerationRequest);
            return ResponseEntity.ok(pdfContent);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(null);
        }
    }

    @PostMapping("/create")
    public ResponseEntity<String> createPDF(@RequestBody ImageGenerationRequest imageGenerationRequest) {
        try {
            PDFContentDTO pdfContent = pdfContentService.generatePDFContent(imageGenerationRequest);
            String pdfPath = pdfContentService.createPDF(pdfContent);
            return ResponseEntity.ok(pdfPath);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(null);
        }
    }
}
