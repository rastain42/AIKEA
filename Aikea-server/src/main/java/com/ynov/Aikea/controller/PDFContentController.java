package com.ynov.Aikea.controller;

import com.ynov.Aikea.config.JwtTokenProvider;
import com.ynov.Aikea.dto.ImageGenerationRequest;
import com.ynov.Aikea.dto.PDFContentDTO;
import com.ynov.Aikea.service.PDFContentService;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

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
    private static final Logger logger = LogManager.getLogger(JwtTokenProvider.class);

    @PostMapping("/create")
    public ResponseEntity<Resource> createPDF(@RequestBody ImageGenerationRequest imageGenerationRequest) {
        try {
            PDFContentDTO pdfContent = pdfContentService.generatePDFContent(imageGenerationRequest);
            MultipartFile pdf = pdfContentService.createPDF(pdfContent);
            // Convertir MultipartFile en Resource
            Resource resource = new ByteArrayResource(pdf.getBytes());

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, "application/pdf")
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"generated.pdf\"")
                    .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(pdf.getSize()))
                    .body(resource);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
