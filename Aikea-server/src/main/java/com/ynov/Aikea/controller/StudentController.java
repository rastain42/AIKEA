package com.ynov.Aikea.controller;

import com.ynov.Aikea.dto.UploadedImageDTO;
import com.ynov.Aikea.service.ImageUploadCustomBucketService;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/student")
@RequiredArgsConstructor
public class StudentController {

    private final ImageUploadCustomBucketService bucketService;
    private static final Logger logger = LogManager.getLogger(StudentController.class);    /**
     * POST /student/upload - Upload d'un fichier vers le bucket externe
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("idExterne") String idExterne,
            @RequestParam(value = "tag1", required = false) String tag1,
            @RequestParam(value = "tag2", required = false) String tag2,
            @RequestParam(value = "tag3", required = false) String tag3,
            @RequestParam(value = "description", required = false) String description) {
          try {            logger.info("📤 Upload file via student endpoint: {} (idExterne: {}, description: {})", file.getOriginalFilename(), idExterne, description);
            
            // Upload vers le bucket externe avec description
            UploadedImageDTO result = bucketService.uploadFile(
                file, 
                idExterne, 
                tag1 != null ? tag1 : "pdf",
                tag2 != null ? tag2 : "student", 
                tag3 != null ? tag3 : "upload",
                description // Nouveau paramètre pour le nom d'affichage
            );            Map<String, Object> response = new HashMap<>();
            response.put("idExterne", idExterne);
            response.put("url", result.getUrl());
            response.put("id", result.getId());
            response.put("tag1", tag1 != null ? tag1 : "pdf");
            response.put("tag2", tag2 != null ? tag2 : "student");
            response.put("tag3", tag3 != null ? tag3 : "upload");
            response.put("description", description); // Inclure la description dans la réponse
            response.put("success", true);

            logger.info("✅ File uploaded successfully: {}", result.getUrl());
            return ResponseEntity.ok(response);
              } catch (Exception e) {
            logger.error("❌ Error uploading file: {} - {}", e.getClass().getSimpleName(), e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            errorResponse.put("errorType", e.getClass().getSimpleName());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }    
    /**
     * GET /student/upload/search - Recherche et liste de tous les PDFs
     * Accepte un body JSON pour être compatible avec le frontend
     */
    @GetMapping("/upload/search")
    public ResponseEntity<List<Map<String, String>>> searchPdfs(
            @RequestParam(value = "pattern", required = false) String pattern,
            @RequestBody(required = false) Map<String, Object> body) {
        
        try {
            logger.info("🔍 Search PDFs via student endpoint (pattern: {}, body: {})", pattern, body);            List<Map<String, String>> pdfs;
            if (pattern != null && !pattern.trim().isEmpty()) {
                pdfs = bucketService.findPdfsByPattern(pattern);
            } else {
                // Utiliser la méthode principale avec détection IP filtering
                pdfs = bucketService.getAllPdfs();
            }
            
            logger.info("✅ Found {} PDFs", pdfs.size());
            return ResponseEntity.ok(pdfs);
            
        } catch (Exception e) {
            logger.error("❌ Error searching PDFs", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }    /**
     * GET /student/upload/{id} - Récupérer un PDF par ID
     */
    @GetMapping("/upload/{id}")
    public ResponseEntity<Map<String, String>> getPdfById(@PathVariable String id) {
        try {
            logger.info("📄 Get PDF by ID via student endpoint: {}", id);
            
            // Rechercher le PDF par ID externe dans la liste complète
            List<Map<String, String>> allPdfs = bucketService.getAllPdfs();
            Map<String, String> pdf = allPdfs.stream()
                .filter(p -> id.equals(p.get("id")))
                .findFirst()
                .orElse(null);
            
            if (pdf != null) {
                logger.info("✅ PDF found: {}", pdf.get("name"));
                return ResponseEntity.ok(pdf);
            }
            
            logger.warn("⚠️ PDF not found: {}", id);
            return ResponseEntity.notFound().build();
            
        } catch (Exception e) {
            logger.error("❌ Error getting PDF by ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }/**
     * DELETE /student/upload/{id} - Supprimer un PDF
     * Accepte un body JSON pour être compatible avec le frontend
     */
    @DeleteMapping("/upload/{id}")
    public ResponseEntity<Map<String, Object>> deletePdf(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> body) {
        try {            
            logger.info("🗑️ Delete PDF via student endpoint: {} (body: {})", id, body);
            
            // Utiliser la méthode deleteImage existante
            bucketService.deleteImage(id);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "PDF supprimé avec succès");
            
            logger.info("✅ PDF deleted successfully: {}", id);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("❌ Error deleting PDF: {}", id, e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
    /**
     * GET /student/config - Vérifier la configuration du service (debug)
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getServiceConfig() {
        try {
            logger.info("🔧 Checking service configuration");
            
            Map<String, Object> config = bucketService.getBucketStats();
            boolean isConfigured = bucketService.isConfigured();
            
            config.put("isConfigured", isConfigured);
            
            logger.info("✅ Service configuration: {}", config);
            return ResponseEntity.ok(config);
            
        } catch (Exception e) {
            logger.error("❌ Error checking service configuration", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
    /**
     * GET /student/test-network - Test de connectivité réseau
     */
    @GetMapping("/test-network")
    public ResponseEntity<Map<String, Object>> testNetworkConnectivity() {
        try {
            logger.info("🌐 Network connectivity test requested");
            
            bucketService.testNetworkConnectivity();
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Network connectivity test completed - check logs for details");
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("❌ Network test failed", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("error", "Network test failed: " + e.getMessage());
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    /**
     * GET /student/debug-status - Comprehensive debugging status
     */
    @GetMapping("/debug-status")
    public ResponseEntity<Map<String, Object>> getDebugStatus() {
        try {
            logger.info("🔍 Comprehensive debug status requested");
            
            Map<String, Object> response = new HashMap<>();
            response.put("timestamp", System.currentTimeMillis());
            
            // Configuration status
            Map<String, Object> config = bucketService.getBucketStats();
            response.put("configuration", config);
            
            // Network connectivity
            try {
                bucketService.testNetworkConnectivity();
                response.put("networkTest", "completed - check logs");
            } catch (Exception e) {
                response.put("networkTest", "failed: " + e.getMessage());
            }
            
            // IP filtering detection
            try {
                List<Map<String, String>> testResult = bucketService.getAllPdfs();
                if (testResult.size() > 0 && "ip_filtered".equals(testResult.get(0).get("status"))) {
                    Map<String, String> ipInfo = testResult.get(0);
                    response.put("ipFiltering", Map.of(
                        "detected", true,
                        "message", ipInfo.get("message"),
                        "solution", ipInfo.get("solution")
                    ));
                } else {
                    response.put("ipFiltering", Map.of(
                        "detected", false,
                        "message", "External bucket is accessible"
                    ));
                }
            } catch (Exception e) {
                response.put("ipFiltering", Map.of(
                    "detected", "unknown",
                    "error", e.getMessage()
                ));
            }
            
            // Summary
            response.put("summary", Map.of(
                "status", "IP filtering detected - backend cannot access external bucket",
                "recommendation", "Contact admin to whitelist backend server IP or use proxy",
                "workaround", "Frontend can work with local storage, upload may still work if different endpoint"
            ));
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("❌ Debug status failed", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("error", "Debug status failed: " + e.getMessage());
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    /**
     * GET /student/ip-info - Informations sur les IPs utilisées
     */
    @GetMapping("/ip-info")
    public ResponseEntity<Map<String, Object>> getIpInfo() {
        try {
            logger.info("🌐 IP information requested");
            
            Map<String, Object> response = new HashMap<>();
            response.put("timestamp", System.currentTimeMillis());
            
            // IP locale du serveur
            try {
                java.net.InetAddress localHost = java.net.InetAddress.getLocalHost();
                response.put("serverLocalIP", localHost.getHostAddress());
                response.put("serverHostname", localHost.getHostName());
            } catch (Exception e) {
                response.put("serverLocalIP", "Unable to determine: " + e.getMessage());
            }
            
            // Tester quelle IP voit le bucket externe
            try {
                // Appeler un service qui retourne notre IP publique
                String whatIsMyIpUrl = "https://httpbin.org/ip";
                java.net.URL url = new java.net.URL(whatIsMyIpUrl);
                java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                
                if (connection.getResponseCode() == 200) {
                    try (java.io.BufferedReader br = new java.io.BufferedReader(
                            new java.io.InputStreamReader(connection.getInputStream()))) {
                        StringBuilder result = new StringBuilder();
                        String line;
                        while ((line = br.readLine()) != null) {
                            result.append(line);
                        }
                        response.put("serverPublicIPResponse", result.toString());
                    }
                } else {
                    response.put("serverPublicIPResponse", "HTTP " + connection.getResponseCode());
                }
                connection.disconnect();
                
            } catch (Exception e) {
                response.put("serverPublicIPResponse", "Unable to determine: " + e.getMessage());
            }
            
            // Configuration réseau détaillée
            try {
                java.util.List<String> networkInterfaces = new java.util.ArrayList<>();
                java.util.Enumeration<java.net.NetworkInterface> interfaces = 
                    java.net.NetworkInterface.getNetworkInterfaces();
                
                while (interfaces.hasMoreElements()) {
                    java.net.NetworkInterface networkInterface = interfaces.nextElement();
                    if (networkInterface.isUp() && !networkInterface.isLoopback()) {
                        java.util.Enumeration<java.net.InetAddress> addresses = 
                            networkInterface.getInetAddresses();
                        
                        while (addresses.hasMoreElements()) {
                            java.net.InetAddress address = addresses.nextElement();
                            if (address instanceof java.net.Inet4Address) {
                                networkInterfaces.add(networkInterface.getName() + ": " + address.getHostAddress());
                            }
                        }
                    }
                }
                response.put("networkInterfaces", networkInterfaces);
                
            } catch (Exception e) {
                response.put("networkInterfaces", "Unable to enumerate: " + e.getMessage());
            }
            
            // Instructions pour vérifier l'IP locale
            response.put("instructions", Map.of(
                "checkLocalIP", "Dans PowerShell: curl.exe https://httpbin.org/ip",
                "checkServerIP", "Le serveur utilise l'IP publique ci-dessus",
                "solution", "Si les IPs diffèrent, demander au bucket d'autoriser l'IP du serveur"
            ));
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("❌ IP info failed", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("error", "IP info failed: " + e.getMessage());
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    /**
     * GET /student/test-curl - Test direct curl execution
     */
    @GetMapping("/test-curl")
    public ResponseEntity<Map<String, Object>> testCurlExecution() {
        try {
            logger.info("🧪 Testing direct curl execution");
            
            List<Map<String, String>> result = bucketService.getAllPdfsViaCurl();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Curl execution completed successfully");
            response.put("filesFound", result.size());
            response.put("files", result);
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("❌ Curl test failed", e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", "Curl test failed: " + e.getMessage());
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

}
