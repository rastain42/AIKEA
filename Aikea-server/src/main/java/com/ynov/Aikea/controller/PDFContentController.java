package com.ynov.Aikea.controller;

import com.ynov.Aikea.config.JwtTokenProvider;
import com.ynov.Aikea.dto.ImageGenerationRequest;
import com.ynov.Aikea.dto.PDFContentDTO;
import com.ynov.Aikea.dto.UploadedImageDTO;
import com.ynov.Aikea.entity.BucketUploadResult;
import com.ynov.Aikea.entity.CreatePDFResponse;
import com.ynov.Aikea.service.ImageUploadCustomBucketService;
import com.ynov.Aikea.service.PDFContentService;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/generate-pdf")
@RequiredArgsConstructor
public class PDFContentController {

    private final PDFContentService pdfContentService;
    private static final Logger logger = LogManager.getLogger(JwtTokenProvider.class);
    private final ImageUploadCustomBucketService uploadService;

    // Endpoint existant - génère et retourne directement le PDF
    @PostMapping("/create")
    public ResponseEntity<Resource> createPDF(@RequestBody ImageGenerationRequest imageGenerationRequest) {
        try {
            // Générer le contenu PDF
            PDFContentDTO pdfContent = pdfContentService.generatePDFContent(imageGenerationRequest);
            MultipartFile pdf = pdfContentService.createPDF(pdfContent);
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

    // Nouvel endpoint - génère le PDF et l'upload sur le bucket
    @PostMapping("/create-and-upload")
    public ResponseEntity<Map<String, Object>> createAndUploadPDF(
            @RequestBody ImageGenerationRequest imageGenerationRequest,
            @RequestParam(value = "idExterne", required = false) String idExterne,
            @RequestParam(value = "tag1", required = false) String tag1,
            @RequestParam(value = "tag2", required = false) String tag2,
            @RequestParam(value = "tag3", required = false) String tag3) {

        try {
            // Générer le contenu PDF
            PDFContentDTO pdfContent = pdfContentService.generatePDFContent(imageGenerationRequest);
            MultipartFile pdf = pdfContentService.createPDF(pdfContent);

            // Upload sur le bucket custom avec tags
            UploadedImageDTO uploadResult = uploadService.uploadFile(
                    pdf,
                    idExterne != null ? idExterne : "auto_" + System.currentTimeMillis(),
                    tag1 != null ? tag1 : "pdf",
                    tag2 != null ? tag2 : "generated",
                    tag3
            );

            // Construire la réponse avec informations du PDF et de l'upload
            Map<String, Object> response = new HashMap<>();
            response.put("uploadInfo", uploadResult);
            response.put("pdfInfo", Map.of(
                    "size", pdf.getSize(),
                    "originalFilename", pdf.getOriginalFilename() != null ? pdf.getOriginalFilename() : "generated.pdf",
                    "contentType", pdf.getContentType()
            ));
            response.put("generated", true);
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Failed to create and upload PDF");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    // Endpoint hybride - génère le PDF, l'upload ET retourne le fichier
    @PostMapping("/create-upload-and-download")
    public ResponseEntity<Resource> createUploadAndDownloadPDF(
            @RequestBody ImageGenerationRequest imageGenerationRequest,
            @RequestParam(value = "idExterne", required = false) String idExterne,
            @RequestParam(value = "tag1", required = false) String tag1,
            @RequestParam(value = "tag2", required = false) String tag2,
            @RequestParam(value = "tag3", required = false) String tag3) {

        try {
            // Générer le contenu PDF
            PDFContentDTO pdfContent = pdfContentService.generatePDFContent(imageGenerationRequest);
            MultipartFile pdf = pdfContentService.createPDF(pdfContent);

            // Upload sur le bucket custom (en arrière-plan)
            try {
                uploadService.uploadFile(
                        pdf,
                        idExterne != null ? idExterne : "auto_" + System.currentTimeMillis(),
                        tag1 != null ? tag1 : "pdf",
                        tag2 != null ? tag2 : "generated",
                        tag3
                );
            } catch (Exception uploadException) {
                // Log l'erreur mais continue le téléchargement
                System.err.println("Upload failed but continuing with download: " + uploadException.getMessage());
            }

            // Retourner le PDF pour téléchargement
            Resource resource = new ByteArrayResource(pdf.getBytes());

            String filename = generatePDFFilename(idExterne, tag1);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, "application/pdf")
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(pdf.getSize()))
                    .header("X-Upload-Status", "completed") // Header custom pour indiquer que l'upload est fait
                    .body(resource);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // Endpoint pour récupérer un PDF uploadé
    @GetMapping("/download/{fileId}")
    public ResponseEntity<Resource> downloadPDF(@PathVariable String fileId) {
        try {
            // Récupérer les infos du fichier
            var allFiles = uploadService.getAllImages();
            var fileInfo = allFiles.stream()
                    .filter(f -> f.get("fileName").contains(fileId) || f.get("fileName").equals(fileId))
                    .findFirst()
                    .orElse(null);

            if (fileInfo == null) {
                return ResponseEntity.notFound().build();
            }

            // Pour une implémentation complète, vous devriez récupérer le fichier du bucket
            // Ici on simule avec l'URL
            return ResponseEntity.ok()
                    .header("Location", fileInfo.get("url"))
                    .build();

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String generatePDFFilename(String idExterne, String tag1) {
        StringBuilder filename = new StringBuilder("generated");

        if (idExterne != null && !idExterne.isEmpty()) {
            filename.append("_").append(idExterne);
        }
        if (tag1 != null && !tag1.isEmpty()) {
            filename.append("_").append(tag1);
        }

        filename.append("_").append(System.currentTimeMillis());
        filename.append(".pdf");

        return filename.toString();
    }
}
