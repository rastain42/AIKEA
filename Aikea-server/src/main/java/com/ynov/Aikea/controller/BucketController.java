package com.ynov.Aikea.controller;

import com.ynov.Aikea.config.JwtTokenProvider;
import com.ynov.Aikea.service.ImageUploadCustomBucketService;
import groovy.util.logging.Slf4j;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bucket")
@RequiredArgsConstructor
@Slf4j
public class BucketController {

    private final ImageUploadCustomBucketService bucketService;
    private static final Logger logger = LogManager.getLogger(BucketController.class);


    /**
     * GET /api/bucket/pdfs - Tous les PDFs
     */
    @GetMapping("/pdfs")
    public ResponseEntity<List<Map<String, String>>> getAllPdfs() {
        try {
            List<Map<String, String>> pdfs = bucketService.getAllPdfs();
            return ResponseEntity.ok(pdfs);
        } catch (Exception e) {
            logger.error("Error getting all PDFs", e);
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * GET /api/bucket/pdf/{fileName} - PDF par nom exact
     */
    @GetMapping("/pdf/{fileName}")
    public ResponseEntity<Map<String, String>> getPdfById(@PathVariable String fileName) {
        try {
            Map<String, String> pdf = bucketService.findPdfById(fileName);
            if (pdf != null) {
                return ResponseEntity.ok(pdf);
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("Error getting PDF by ID: {}", fileName, e);
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * GET /api/bucket/pdfs/external/{externalId} - PDFs par ID externe
     */
    @GetMapping("/pdfs/external/{externalId}")
    public ResponseEntity<List<Map<String, String>>> getPdfsByExternalId(@PathVariable String externalId) {
        try {
            List<Map<String, String>> pdfs = bucketService.findPdfsByExternalId(externalId);
            return ResponseEntity.ok(pdfs);
        } catch (Exception e) {
            logger.error("Error getting PDFs by external ID: {}", externalId, e);
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * GET /api/bucket/pdfs/search?pattern=xxx - Recherche par pattern
     */
    @GetMapping("/pdfs/search")
    public ResponseEntity<List<Map<String, String>>> searchPdfs(@RequestParam String pattern) {
        try {
            List<Map<String, String>> pdfs = bucketService.findPdfsByPattern(pattern);
            return ResponseEntity.ok(pdfs);
        } catch (Exception e) {
            logger.error("Error searching PDFs by pattern: {}", pattern, e);
            return ResponseEntity.status(500).build();
        }
    }
}
