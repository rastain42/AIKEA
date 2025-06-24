package com.ynov.Aikea.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ynov.Aikea.dto.UploadedImageDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@Service("customBucketService")
@RequiredArgsConstructor
@Slf4j
public class ImageUploadCustomBucketService implements ImageUploadService {

    @Value("${bucket.base-url}")
    private String baseUrl;

    @Value("${bucket.token}")
    private String jwtToken;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public UploadedImageDTO uploadImage(byte[] fileBytes) {
        // Cette méthode n'est plus utilisée - tout passe par le bucket externe
        throw new UnsupportedOperationException("Local storage is disabled. Use external bucket upload instead.");
    }    /**
     * Upload de fichier avec métadonnées et tags vers le bucket externe (version de compatibilité)
     */
    public UploadedImageDTO uploadFile(MultipartFile file, String idExterne, String tag1, String tag2, String tag3) {
        return uploadFile(file, idExterne, tag1, tag2, tag3, null);
    }

    /**
     * Upload de fichier avec métadonnées et tags vers le bucket externe
     */
    public UploadedImageDTO uploadFile(MultipartFile file, String idExterne, String tag1, String tag2, String tag3, String description) {        try {
            log.info("🚀 Uploading file to external bucket: {} (idExterne: {}, description: {})", file.getOriginalFilename(), idExterne, description);
            
            // Préparer les headers avec le token JWT
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            headers.setBearerAuth(jwtToken);
            
            // Préparer le body de la requête
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            });
            body.add("idExterne", idExterne);
            if (tag1 != null) body.add("tag1", tag1);
            if (tag2 != null) body.add("tag2", tag2);
            if (tag3 != null) body.add("tag3", tag3);
            if (description != null) body.add("description", description); // Ajouter le nom d'affichage
            
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
              // Faire l'appel vers le bucket externe
            String uploadUrl = baseUrl + "/student/upload";
            log.debug("Calling external bucket upload: {}", uploadUrl);
              @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.postForEntity(uploadUrl, requestEntity, 
                    (Class<Map<String, Object>>) (Class<?>) Map.class);
            
            if (response.getStatusCode() == HttpStatus.OK) {
                Map<String, Object> responseBody = response.getBody();
                String url = (String) responseBody.get("url");
                String id = (String) responseBody.get("id");
                
                log.info("✅ File uploaded successfully to external bucket: {}", url);
                
                return UploadedImageDTO.builder()
                        .url(url)
                        .id(id != null ? id : file.getOriginalFilename())
                        .build();
            } else {
                throw new RuntimeException("Failed to upload to external bucket. Status: " + response.getStatusCode());
            }        } catch (Exception e) {
            log.error("❌ Error uploading file to external bucket", e);
            log.error("Error details - Base URL: {}, Token: {}...", 
                baseUrl, 
                jwtToken != null ? jwtToken.substring(0, Math.min(10, jwtToken.length())) : "null");
            throw new RuntimeException("Failed to upload file to external bucket: " + e.getMessage(), e);
        }
    }    @Override
    public void deleteImage(String fileName) {
        try {
            log.info("🗑️ Deleting file from external bucket: {}", fileName);
            
            // Essayer d'abord la méthode Java HTTP
            try {
                deleteWithHttpClient(fileName);
                log.info("✅ File deleted successfully via Java HTTP client");
                return;
            } catch (Exception httpError) {
                log.warn("⚠️ Java HTTP client failed for delete: {}", httpError.getMessage());
                
                // Si c'est une erreur 403, essayer curl
                if (httpError.getMessage().contains("403")) {
                    log.info("🔄 Trying delete via curl workaround...");
                    deleteViaCurl(fileName);
                    log.info("✅ File deleted successfully via curl workaround");
                    return;
                }
                
                // Pour les autres erreurs, re-lancer l'exception
                throw httpError;
            }
            
        } catch (Exception e) {
            log.error("❌ Error deleting file from external bucket: {}", fileName, e);
            throw new RuntimeException("Failed to delete file from external bucket: " + e.getMessage(), e);
        }
    }

    /**
     * Suppression via Java HTTP client
     */
    private void deleteWithHttpClient(String fileName) {
        // DELETE avec JSON vide comme body (comme pour les autres opérations)
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(jwtToken);
        
        // Body JSON vide pour le delete
        String emptyJsonBody = "{}";
        HttpEntity<String> requestEntity = new HttpEntity<>(emptyJsonBody, headers);
        
        String deleteUrl = baseUrl + "/student/upload/" + fileName;
        log.debug("Calling external bucket delete: {} (DELETE with JSON body)", deleteUrl);
        
        ResponseEntity<String> response = restTemplate.exchange(
            deleteUrl, 
            HttpMethod.DELETE, 
            requestEntity, 
            String.class
        );
        
        if (response.getStatusCode() != HttpStatus.OK) {
            throw new RuntimeException("Failed to delete from external bucket. Status: " + response.getStatusCode());
        }
    }

    /**
     * Suppression via curl direct (fallback)
     */    private void deleteViaCurl(String fileName) {
        try {
            log.info("🗑️ Deleting file via curl: {}", fileName);
            
            String deleteUrl = baseUrl + "/student/upload/" + fileName;
            
            // Construire la commande curl
            ProcessBuilder processBuilder = new ProcessBuilder();
            String os = System.getProperty("os.name").toLowerCase();
            
            if (os.contains("win")) {
                // Windows
                processBuilder.command(
                    "curl.exe",
                    "-X", "DELETE",
                    deleteUrl,
                    "-H", "Content-Type: application/json",
                    "-H", "Authorization: Bearer " + jwtToken,
                    "-d", "{}"
                );
            } else {
                // Linux/Mac
                processBuilder.command(
                    "curl",
                    "-X", "DELETE",
                    deleteUrl,
                    "-H", "Content-Type: application/json", 
                    "-H", "Authorization: Bearer " + jwtToken,
                    "-d", "{}"
                );
            }
            
            log.info("🚀 Executing curl DELETE command: {}", String.join(" ", processBuilder.command()));
            
            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();
            
            // Lire la sortie
            StringBuilder output = new StringBuilder();
            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(process.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }
            
            int exitCode = process.waitFor();
            String result = output.toString().trim();
            
            log.info("📡 Curl DELETE exit code: {}", exitCode);
            log.info("📄 Curl DELETE output: {}", result);
            
            if (exitCode != 0) {
                throw new RuntimeException("Curl DELETE failed with exit code " + exitCode + ": " + result);
            }
            
        } catch (Exception e) {
            log.error("❌ Error executing curl DELETE", e);
            throw new RuntimeException("Failed to execute curl DELETE: " + e.getMessage(), e);
        }
    }

    @Override
    public List<Map<String, String>> getAllImages() {
        try {
            log.info("📋 Fetching all files from external bucket");
            
            // GET avec JSON vide comme body
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(jwtToken);
            
            // Body JSON vide pour la recherche GET
            String emptyJsonBody = "{}";
            HttpEntity<String> requestEntity = new HttpEntity<>(emptyJsonBody, headers);
            
            String listUrl = baseUrl + "/student/upload/search";
            log.debug("Calling external bucket list: {} (GET with empty JSON body)", listUrl);
            
            @SuppressWarnings("unchecked")
            ResponseEntity<List<Map<String, String>>> response = restTemplate.exchange(
                listUrl, 
                HttpMethod.GET, 
                requestEntity, 
                (Class<List<Map<String, String>>>) (Class<?>) List.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK) {
                List<Map<String, String>> files = response.getBody();
                log.info("✅ Found {} files in external bucket", files != null ? files.size() : 0);
                return files != null ? files : new ArrayList<>();
            } else {
                throw new RuntimeException("Failed to list files from external bucket. Status: " + response.getStatusCode());
            }
            
        } catch (Exception e) {
            log.error("❌ Error listing files from external bucket", e);
            throw new RuntimeException("Failed to list files from external bucket: " + e.getMessage(), e);
        }
    }    /**
     * Recherche par tags dans le bucket externe
     */
    public List<Map<String, String>> searchByTags(String tag1, String tag2, String tag3) {
        try {
            log.info("🔍 Searching files by tags in external bucket: {}, {}, {}", tag1, tag2, tag3);
            
            // GET avec JSON contenant les tags
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(jwtToken);
            
            // Créer un JSON avec les tags
            Map<String, Object> jsonBody = new HashMap<>();
            if (tag1 != null && !tag1.trim().isEmpty()) jsonBody.put("tag1", tag1);
            if (tag2 != null && !tag2.trim().isEmpty()) jsonBody.put("tag2", tag2);
            if (tag3 != null && !tag3.trim().isEmpty()) jsonBody.put("tag3", tag3);
            
            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(jsonBody, headers);
            
            String searchUrl = baseUrl + "/student/upload/search";
            log.debug("Calling external bucket search: {} (GET with JSON body)", searchUrl);
            
            @SuppressWarnings("unchecked")
            ResponseEntity<List<Map<String, String>>> response = restTemplate.exchange(
                searchUrl, 
                HttpMethod.GET, 
                requestEntity, 
                (Class<List<Map<String, String>>>) (Class<?>) List.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK) {
                List<Map<String, String>> files = response.getBody();
                log.info("✅ Found {} files matching tags in external bucket", files != null ? files.size() : 0);
                return files != null ? files : new ArrayList<>();
            } else {
                throw new RuntimeException("Failed to search files by tags in external bucket. Status: " + response.getStatusCode());
            }
            
        } catch (Exception e) {
            log.error("❌ Error searching files by tags in external bucket", e);
            throw new RuntimeException("Failed to search files by tags in external bucket: " + e.getMessage(), e);
        }
    }    /**
     * Recherche par ID externe dans le bucket externe
     */
    public List<Map<String, String>> searchByExternalId(String externalId) {
        try {
            log.info("🔍 Searching files by external ID in external bucket: {}", externalId);
            
            // GET avec JSON contenant l'ID externe
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(jwtToken);
            
            // Créer un JSON avec l'ID externe
            Map<String, Object> jsonBody = new HashMap<>();
            if (externalId != null && !externalId.trim().isEmpty()) {
                jsonBody.put("idExterne", externalId);
            }
            
            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(jsonBody, headers);
            
            String searchUrl = baseUrl + "/student/upload/search";
            log.debug("Calling external bucket search by ID: {} (GET with JSON body)", searchUrl);
            
            @SuppressWarnings("unchecked")
            ResponseEntity<List<Map<String, String>>> response = restTemplate.exchange(
                searchUrl, 
                HttpMethod.GET, 
                requestEntity, 
                (Class<List<Map<String, String>>>) (Class<?>) List.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK) {
                List<Map<String, String>> files = response.getBody();
                log.info("✅ Found {} files for external ID {} in external bucket", files != null ? files.size() : 0, externalId);
                return files != null ? files : new ArrayList<>();
            } else {
                throw new RuntimeException("Failed to search files by external ID in external bucket. Status: " + response.getStatusCode());
            }
            
        } catch (Exception e) {
            log.error("❌ Error searching files by external ID in external bucket", e);
            throw new RuntimeException("Failed to search files by external ID in external bucket: " + e.getMessage(), e);
        }
    }

    /**
     * Obtenir les statistiques du bucket - DÉSACTIVÉ
     */
    public Map<String, Object> getBucketStats() {
        // Le stockage local est désactivé
        Map<String, Object> stats = new HashMap<>();
        stats.put("localStorageEnabled", false);
        stats.put("message", "Local storage is disabled. All operations go through external bucket.");
        stats.put("baseUrl", baseUrl);
        stats.put("hasJwtToken", jwtToken != null && !jwtToken.isEmpty());
        return stats;
    }

    /**
     * Rechercher un PDF par son nom de fichier exact - DÉSACTIVÉ
     */
    public Map<String, String> findPdfById(String fileName) {
        // Le stockage local est désactivé
        throw new UnsupportedOperationException("Local storage is disabled. Use external bucket search via /student/upload endpoints.");
    }

    /**
     * Rechercher des PDFs par ID externe - DÉSACTIVÉ
     */
    public List<Map<String, String>> findPdfsByExternalId(String externalId) {
        // Le stockage local est désactivé
        throw new UnsupportedOperationException("Local storage is disabled. Use external bucket search via /student/upload endpoints.");
    }    /**
     * Obtenir tous les PDFs du bucket externe     */    public List<Map<String, String>> getAllPdfs() {        try {
            log.info("📋 Fetching all PDF files from external bucket");
            
            // D'abord, tester la connectivité et identifier le problème
            boolean isIpFiltered = checkIfIpFiltered();
            
            if (isIpFiltered) {
                log.warn("🚫 IP filtering detected on external bucket - trying curl workaround");
                
                // Essayer curl comme workaround
                try {
                    List<Map<String, String>> curlResult = getAllPdfsViaCurl();
                    if (!curlResult.isEmpty()) {
                        log.info("✅ Curl workaround successful! Found {} files", curlResult.size());
                        return curlResult;
                    }
                } catch (Exception curlError) {
                    log.warn("❌ Curl workaround also failed: {}", curlError.getMessage());
                }
                
                // Si curl échoue aussi, retourner le message informatif
                log.warn("🔧 Returning IP filtered response as final fallback");
                return createIpFilteredResponse();
            }
            
            return getAllPdfsWithHttpURLConnectionDebug();
            
        } catch (Exception e) {
            log.error("❌ Error listing PDF files from external bucket", e);
            
            // Si c'est une erreur 403, vérifier si c'est du filtrage IP
            if (e.getMessage().contains("403")) {
                log.warn("🚫 403 error detected - likely IP filtering");
                return createIpFilteredResponse();
            }
            
            throw new RuntimeException("Failed to list PDF files from external bucket: " + e.getMessage(), e);
        }
    }

    /**
     * Vérifier si l'IP du backend est filtrée
     */
    private boolean checkIfIpFiltered() {
        try {
            // Test simple : appel sans auth qui devrait donner 401 (non autorisé) 
            // mais si on a 403, c'est probablement du filtrage IP
            String testUrl = baseUrl + "/student/upload/search";
            java.net.URL url = new java.net.URL(testUrl);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
            
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setRequestProperty("User-Agent", "AIKEA-Backend-Test");
            
            int responseCode = connection.getResponseCode();
            connection.disconnect();
            
            // 403 sans auth = filtrage IP probable
            // 401 sans auth = endpoint accessible, juste pas autorisé (normal)
            return responseCode == 403;
            
        } catch (Exception e) {
            log.warn("⚠️ Could not determine IP filtering status: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Créer une réponse explicative quand l'IP est filtrée
     */
    private List<Map<String, String>> createIpFilteredResponse() {
        List<Map<String, String>> response = new ArrayList<>();
        
        Map<String, String> infoMessage = new HashMap<>();
        infoMessage.put("id", "ip-filtered-info");
        infoMessage.put("name", "[INFO] External bucket access blocked");
        infoMessage.put("type", "info");
        infoMessage.put("message", "Backend IP is filtered by external bucket. Contact admin to whitelist server IP.");
        infoMessage.put("solution", "Add backend server IP to bucket whitelist or use proxy");
        infoMessage.put("status", "ip_filtered");
        
        response.add(infoMessage);
        return response;
    }

    /**
     * Version HttpURLConnection complète pour débugger - reproduit exactement curl
     */
    private List<Map<String, String>> getAllPdfsWithHttpURLConnectionDebug() {
        try {
            String listUrl = baseUrl + "/student/upload/search";
            log.info("🚀 HttpURLConnection debug call to: {}", listUrl);
            
            java.net.URL url = new java.net.URL(listUrl);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
            
            // Configuration exacte
            connection.setRequestMethod("GET");
            connection.setDoOutput(true);
            connection.setDoInput(true);
            connection.setUseCaches(false);
            connection.setInstanceFollowRedirects(true);
            
            // Headers exactement comme curl fonctionnel
            connection.setRequestProperty("Authorization", "Bearer " + jwtToken);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "*/*");
            connection.setRequestProperty("User-Agent", "curl/7.68.0");
            
            // Body JSON vide
            String jsonBody = "{}";
            byte[] bodyBytes = jsonBody.getBytes("UTF-8");
            connection.setRequestProperty("Content-Length", String.valueOf(bodyBytes.length));
            
            log.info("🔍 Request details:");
            log.info("  URL: {}", listUrl);
            log.info("  Method: GET");
            log.info("  Authorization: Bearer {}...{}", 
                jwtToken.substring(0, Math.min(20, jwtToken.length())), 
                jwtToken.length() > 20 ? jwtToken.substring(jwtToken.length() - 10) : "");
            log.info("  Content-Type: application/json");
            log.info("  Accept: */*");
            log.info("  User-Agent: curl/7.68.0");
            log.info("  Content-Length: {}", bodyBytes.length);
            log.info("  Body: '{}'", jsonBody);
            
            // Écrire le body
            try (java.io.OutputStream os = connection.getOutputStream()) {
                os.write(bodyBytes);
                os.flush();
            }
            
            // Obtenir la réponse
            int responseCode = connection.getResponseCode();
            String responseMessage = connection.getResponseMessage();
            log.info("📡 Response: {} {}", responseCode, responseMessage);
            
            // Lire les headers de réponse
            log.info("📋 Response headers:");
            connection.getHeaderFields().forEach((key, values) -> {
                if (key != null) {
                    log.info("  {}: {}", key, String.join(", ", values));
                } else {
                    log.info("  Status: {}", String.join(", ", values));
                }
            });
            
            if (responseCode >= 200 && responseCode < 300) {
                // Lire la réponse de succès
                StringBuilder response = new StringBuilder();
                try (java.io.BufferedReader br = new java.io.BufferedReader(
                        new java.io.InputStreamReader(connection.getInputStream(), "UTF-8"))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        response.append(line).append("\n");
                    }
                }
                
                String responseBody = response.toString().trim();
                log.info("✅ Response body (length: {}): {}", responseBody.length(), 
                    responseBody.length() > 500 ? responseBody.substring(0, 500) + "..." : responseBody);
                
                // TODO: Parser le JSON et retourner la liste réelle
                try {
                    // Pour l'instant, retourner une liste vide mais noter le succès
                    log.info("🎉 SUCCESS! External bucket responded with HTTP {}", responseCode);
                    return new ArrayList<>();
                } catch (Exception e) {
                    log.error("❌ Failed to parse JSON response", e);
                    return new ArrayList<>();
                }
                
            } else {
                // Lire l'erreur
                StringBuilder error = new StringBuilder();
                java.io.InputStream errorStream = connection.getErrorStream();
                if (errorStream != null) {
                    try (java.io.BufferedReader br = new java.io.BufferedReader(
                            new java.io.InputStreamReader(errorStream, "UTF-8"))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            error.append(line).append("\n");
                        }
                    }
                }
                
                String errorBody = error.toString().trim();
                log.error("❌ Error response (HTTP {}): {}", responseCode, errorBody.isEmpty() ? "(empty body)" : errorBody);
                
                // Analyser les erreurs communes
                if (responseCode == 403) {
                    log.error("🚫 403 Forbidden - Possible causes:");
                    log.error("   - JWT token invalid or expired");
                    log.error("   - Wrong permissions on bucket");
                    log.error("   - IP filtering on bucket");
                    log.error("   - Token format incorrect");
                }
                
                throw new RuntimeException("HTTP " + responseCode + " " + responseMessage + 
                    (errorBody.isEmpty() ? "" : ": " + errorBody));
            }
            
        } catch (Exception e) {
            log.error("❌ HttpURLConnection debug call failed: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to call external bucket: " + e.getMessage(), e);
        }
    }/**
     * Rechercher des PDFs par pattern dans le nom via le bucket externe
     */    public List<Map<String, String>> findPdfsByPattern(String pattern) {
        try {
            log.info("🔍 Searching PDFs by pattern in ext" +
                    "" +
                    "" +
                    "ernal buc" +
                    "" +
                    "ket: {}", pattern);
            
            // GET avec JSON contenant le pattern
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + jwtToken); // ← Uniformiser avec getAllPdfs()
            
            // Créer un JSON avec le pattern
            Map<String, Object> jsonBody = new HashMap<>();
            if (pattern != null && !pattern.trim().isEmpty()) {
                jsonBody.put("pattern", pattern);
            }
            
            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(jsonBody, headers);
            
            String searchUrl = baseUrl + "/student/upload/search";
            log.info("Calling external bucket PDF search: {} with token: {}", searchUrl, jwtToken.substring(0, 8) + "...");
            
            @SuppressWarnings("unchecked")
            ResponseEntity<List<Map<String, String>>> response = restTemplate.exchange(
                searchUrl, 
                HttpMethod.GET, 
                requestEntity, 
                (Class<List<Map<String, String>>>) (Class<?>) List.class
            );
              if (response.getStatusCode() == HttpStatus.OK) {
                List<Map<String, String>> files = response.getBody();
                log.info("✅ Found {} PDFs matching pattern '{}' in external bucket", files != null ? files.size() : 0, pattern);
                return files != null ? files : new ArrayList<>();
            } else {
                throw new RuntimeException("Failed to search PDFs by pattern in external bucket. Status: " + response.getStatusCode());
            }
            
        } catch (Exception e) {
            log.error("❌ Error searching PDFs by pattern in external bucket", e);
            throw new RuntimeException("Failed to search PDFs by pattern in external bucket: " + e.getMessage(), e);
        }
    }

    /**
     * Vérifier si le service est configuré correctement
     */
    public boolean isConfigured() {
        boolean hasToken = jwtToken != null && !jwtToken.isEmpty();
        boolean hasValidUrl = baseUrl != null && !baseUrl.isEmpty();

        log.info("Service configuration - Token: {}, URL: {}, Local Storage: DISABLED",
                hasToken ? "✓" : "✗", hasValidUrl ? "✓" : "✗");

        return hasToken && hasValidUrl;
    }    /**
     * Obtenir tous les PDFs du bucket externe avec un token spécifique
     */    public List<Map<String, String>> getAllPdfs(String userToken) {
        try {
            log.info("📋 Fetching all PDF files from external bucket with user token");
            
            // GET avec JSON vide comme body
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + (userToken != null ? userToken : jwtToken)); // ← Uniformiser
            
            // Body JSON vide pour la recherche GET
            String emptyJsonBody = "{}";
            HttpEntity<String> requestEntity = new HttpEntity<>(emptyJsonBody, headers);
              String listUrl = baseUrl + "/student/upload/search";
            log.info("Calling external bucket PDF list: {} with token: {}", listUrl, (userToken != null ? userToken : jwtToken).substring(0, 8) + "...");
            
            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                listUrl, 
                HttpMethod.GET, 
                requestEntity, 
                (Class<Map<String, Object>>) (Class<?>) Map.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK) {
                Map<String, Object> responseBody = response.getBody();
                if (responseBody != null && responseBody.containsKey("studentUploadReadingDTOS")) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> uploads = (List<Map<String, Object>>) responseBody.get("studentUploadReadingDTOS");
                    
                    // Convertir en format attendu
                    List<Map<String, String>> files = new ArrayList<>();
                    for (Map<String, Object> upload : uploads) {
                        Map<String, String> file = new HashMap<>();
                        file.put("id", String.valueOf(upload.get("idExterne")));
                        file.put("name", String.valueOf(upload.get("idExterne")));
                        file.put("url", String.valueOf(upload.get("url")));
                        file.put("tag1", String.valueOf(upload.get("tag1")));
                        file.put("tag2", String.valueOf(upload.get("tag2")));
                        file.put("tag3", String.valueOf(upload.get("tag3")));
                        files.add(file);
                    }
                    
                    log.info("✅ Found {} PDF files in external bucket", files.size());
                    return files;
                } else {
                    log.warn("⚠️ Unexpected response format from bucket - missing studentUploadReadingDTOS");
                    return new ArrayList<>();
                }
            } else {
                throw new RuntimeException("Failed to list PDF files from external bucket. Status: " + response.getStatusCode());
            }
            
        } catch (Exception e) {
            log.error("❌ Error listing PDF files from external bucket", e);
            throw new RuntimeException("Failed to list PDF files from external bucket: " + e.getMessage(), e);
        }
    }

    /**
     * Test avec HttpURLConnection - méthode temporaire de debug
     */
    public List<Map<String, String>> getAllPdfsWithHttpURLConnection() {
        try {
            log.info("📋 Testing with HttpURLConnection");
            
            String listUrl = baseUrl + "/student/upload/search";
            log.info("🚀 Calling: {}", listUrl);
            
            java.net.URL url = new java.net.URL(listUrl);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
            
            // Configurer exactement comme curl
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Authorization", "Bearer " + jwtToken);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "*/*");
            connection.setRequestProperty("User-Agent", "curl/8.13.0");
            connection.setDoOutput(true);
            
            // Envoyer le body "{}"
            try (java.io.OutputStream os = connection.getOutputStream()) {
                byte[] input = "{}".getBytes("utf-8");
                os.write(input, 0, input.length);
            }
            
            int responseCode = connection.getResponseCode();
            log.info("✅ Response status: {}", responseCode);
            
            if (responseCode == 200) {
                try (java.io.BufferedReader br = new java.io.BufferedReader(
                        new java.io.InputStreamReader(connection.getInputStream(), "utf-8"))) {
                    StringBuilder response = new StringBuilder();
                    String responseLine;
                    while ((responseLine = br.readLine()) != null) {
                        response.append(responseLine.trim());
                    }
                    log.info("📄 Raw response: {}", response.toString());
                    return new ArrayList<>();
                }
            } else {
                String errorMsg = "HTTP " + responseCode;
                if (connection.getErrorStream() != null) {
                    try (java.io.BufferedReader br = new java.io.BufferedReader(
                            new java.io.InputStreamReader(connection.getErrorStream(), "utf-8"))) {
                        StringBuilder errorResponse = new StringBuilder();
                        String responseLine;
                        while ((responseLine = br.readLine()) != null) {
                            errorResponse.append(responseLine.trim());
                        }
                        errorMsg += ": " + errorResponse.toString();
                    }
                }
                log.error("❌ Error: {}", errorMsg);
                throw new RuntimeException(errorMsg);
            }
            
        } catch (Exception e) {
            log.error("❌ HttpURLConnection failed: {}", e.getMessage());
            throw new RuntimeException("HttpURLConnection failed: " + e.getMessage(), e);
        }
    }

    /**
     * Test de connectivité réseau vers le bucket externe
     */
    public void testNetworkConnectivity() {
        try {
            log.info("🌐 Testing network connectivity to external bucket...");
            
            // Test ping/connect
            String host = baseUrl.replace("http://", "").replace("https://", "").split("/")[0];
            log.info("🎯 Target host: {}", host);
            
            // Test de base avec HttpURLConnection
            try {
                java.net.URL url = new java.net.URL(baseUrl);
                java.net.HttpURLConnection testConnection = (java.net.HttpURLConnection) url.openConnection();
                testConnection.setRequestMethod("GET");
                testConnection.setConnectTimeout(10000); // 10 seconds
                testConnection.setReadTimeout(10000);
                
                int responseCode = testConnection.getResponseCode();
                log.info("✅ Basic connectivity test: HTTP {}", responseCode);
                testConnection.disconnect();
                
            } catch (Exception e) {
                log.error("❌ Basic connectivity failed: {}", e.getMessage());
            }
            
            // Test d'accès direct à l'endpoint
            try {
                String testUrl = baseUrl + "/student/upload/search";
                java.net.URL url = new java.net.URL(testUrl);
                java.net.HttpURLConnection testConnection = (java.net.HttpURLConnection) url.openConnection();
                testConnection.setRequestMethod("GET");
                testConnection.setConnectTimeout(10000);
                testConnection.setReadTimeout(10000);
                
                // Pas d'auth pour ce test
                testConnection.setRequestProperty("User-Agent", "AIKEA-Backend-Test");
                
                int responseCode = testConnection.getResponseCode();
                log.info("📡 Endpoint accessibility test (no auth): HTTP {}", responseCode);
                
                if (responseCode == 401) {
                    log.info("🔒 Got 401 (expected without auth) - endpoint is accessible");
                } else if (responseCode == 403) {
                    log.warn("🚫 Got 403 even without auth - possible IP filtering");
                }
                
                testConnection.disconnect();
                
            } catch (Exception e) {
                log.error("❌ Endpoint accessibility test failed: {}", e.getMessage());
            }
            
        } catch (Exception e) {
            log.error("❌ Network connectivity test failed", e);
        }
    }
    
    /**
     * Exécuter curl directement pour contourner le filtrage Java
     */
    public List<Map<String, String>> getAllPdfsViaCurl() {
        try {
            log.info("🌐 Fetching PDFs via direct curl execution");
            
            String listUrl = baseUrl + "/student/upload/search";
            
            // Construire la commande curl exacte qui fonctionne
            ProcessBuilder processBuilder = new ProcessBuilder();
            
            // Détecter l'OS pour utiliser la bonne commande curl
            String os = System.getProperty("os.name").toLowerCase();
            if (os.contains("win")) {
                // Windows - utiliser curl.exe
                processBuilder.command(
                    "curl.exe",
                    "-X", "GET",
                    listUrl,
                    "-H", "Content-Type: application/json",
                    "-H", "Authorization: Bearer " + jwtToken,
                    "-d", "{}"
                );
            } else {
                // Linux/Mac - utiliser curl
                processBuilder.command(
                    "curl",
                    "-X", "GET",
                    listUrl,
                    "-H", "Content-Type: application/json", 
                    "-H", "Authorization: Bearer " + jwtToken,
                    "-d", "{}"
                );
            }
            
            log.info("🚀 Executing curl command: {}", String.join(" ", processBuilder.command()));
            
            // Configurer le processus
            processBuilder.redirectErrorStream(true);
            
            // Exécuter la commande
            Process process = processBuilder.start();
              // Lire la sortie
            StringBuilder output = new StringBuilder();
            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(process.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }
            
            // Attendre la fin du processus
            int exitCode = process.waitFor();
            String result = output.toString().trim();
            
            log.info("📡 Curl exit code: {}", exitCode);
            log.info("📄 Curl output (length: {}): {}", result.length(), 
                result.length() > 500 ? result.substring(0, 500) + "..." : result);
            
            if (exitCode == 0 && !result.isEmpty()) {
                // Succès - parser le JSON
                return parseCurlJsonResponse(result);
            } else {
                log.error("❌ Curl failed with exit code {} and output: {}", exitCode, result);
                throw new RuntimeException("Curl execution failed: " + result);
            }
            
        } catch (Exception e) {
            log.error("❌ Error executing curl", e);
            throw new RuntimeException("Failed to execute curl: " + e.getMessage(), e);
        }
    }    /**
     * Parser la réponse JSON de curl avec Jackson ET fallback regex
     */
    private List<Map<String, String>> parseCurlJsonResponse(String jsonResponse) {
        try {
            // Essayer d'abord Jackson (plus robuste)
            if (jsonResponse.contains("studentUploadReadingDTOS")) {
                log.info("✅ Found valid bucket response, trying Jackson parser");
                
                try {
                    ObjectMapper objectMapper = new ObjectMapper();
                    JsonNode rootNode = objectMapper.readTree(jsonResponse);
                    JsonNode uploadsNode = rootNode.get("studentUploadReadingDTOS");
                    
                    if (uploadsNode != null && uploadsNode.isArray()) {
                        List<Map<String, String>> files = new ArrayList<>();
                        
                        for (JsonNode uploadNode : uploadsNode) {
                            Map<String, String> file = new HashMap<>();
                            
                            // Extraire les champs avec Jackson
                            if (uploadNode.has("idExterne")) {
                                String idExterne = uploadNode.get("idExterne").asText();
                                file.put("id", idExterne);
                                file.put("name", idExterne);
                            }
                            
                            if (uploadNode.has("url")) {
                                String url = uploadNode.get("url").asText();
                                file.put("url", url);
                                file.put("downloadUrl", url);
                                file.put("viewUrl", url);
                            }
                            
                            if (uploadNode.has("tag1") && !uploadNode.get("tag1").asText().isEmpty()) {
                                file.put("tag1", uploadNode.get("tag1").asText());
                            }
                            
                            if (uploadNode.has("tag2") && !uploadNode.get("tag2").asText().isEmpty()) {
                                file.put("tag2", uploadNode.get("tag2").asText());
                            }
                            
                            if (uploadNode.has("tag3") && !uploadNode.get("tag3").asText().isEmpty()) {
                                file.put("tag3", uploadNode.get("tag3").asText());
                            }
                            
                            // Propriétés par défaut
                            file.put("type", "pdf");
                            file.put("mimeType", "application/pdf");
                            file.put("uploadedAt", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").format(new java.util.Date()));
                            file.put("size", "0");
                            
                            if (!file.isEmpty()) {
                                files.add(file);
                            }
                        }
                        
                        log.info("🎉 Jackson parser successful - {} files parsed", files.size());
                        return files;
                    }
                } catch (Exception jacksonError) {
                    log.warn("❌ Jackson parsing failed: {}, falling back to regex", jacksonError.getMessage());
                    // Fallback vers regex si Jackson échoue
                }
                
                // Fallback: Parser regex (l'ancien code qui fonctionnait)
                log.info("🔄 Using regex fallback parser");
                List<Map<String, String>> files = new ArrayList<>();
                String[] uploadBlocks = jsonResponse.split("\\{\"idExterne\":");
                
                for (int i = 1; i < uploadBlocks.length; i++) {
                    String block = uploadBlocks[i];
                    Map<String, String> file = new HashMap<>();
                    
                    // Extraire idExterne
                    java.util.regex.Pattern idPattern = java.util.regex.Pattern.compile("\"([^\"]+)\"");
                    java.util.regex.Matcher idMatcher = idPattern.matcher(block);
                    if (idMatcher.find()) {
                        String idExterne = idMatcher.group(1);
                        file.put("id", idExterne);
                        file.put("name", idExterne);
                    }
                    
                    // Extraire URL
                    java.util.regex.Pattern urlPattern = java.util.regex.Pattern.compile("\"url\":\"([^\"]+)\"");
                    java.util.regex.Matcher urlMatcher = urlPattern.matcher(block);
                    if (urlMatcher.find()) {
                        file.put("url", urlMatcher.group(1));
                        file.put("downloadUrl", urlMatcher.group(1));
                        file.put("viewUrl", urlMatcher.group(1));
                    }
                    
                    // Extraire tags
                    java.util.regex.Pattern tag1Pattern = java.util.regex.Pattern.compile("\"tag1\":\"([^\"]+)\"");
                    java.util.regex.Matcher tag1Matcher = tag1Pattern.matcher(block);
                    if (tag1Matcher.find() && !tag1Matcher.group(1).isEmpty()) {
                        file.put("tag1", tag1Matcher.group(1));
                    }
                    
                    java.util.regex.Pattern tag2Pattern = java.util.regex.Pattern.compile("\"tag2\":\"([^\"]+)\"");
                    java.util.regex.Matcher tag2Matcher = tag2Pattern.matcher(block);
                    if (tag2Matcher.find() && !tag2Matcher.group(1).isEmpty()) {
                        file.put("tag2", tag2Matcher.group(1));
                    }
                    
                    java.util.regex.Pattern tag3Pattern = java.util.regex.Pattern.compile("\"tag3\":\"([^\"]+)\"");
                    java.util.regex.Matcher tag3Matcher = tag3Pattern.matcher(block);
                    if (tag3Matcher.find() && !tag3Matcher.group(1).isEmpty()) {
                        file.put("tag3", tag3Matcher.group(1));
                    }
                    
                    // Propriétés par défaut
                    file.put("type", "pdf");
                    file.put("mimeType", "application/pdf");
                    file.put("uploadedAt", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").format(new java.util.Date()));
                    file.put("size", "0");
                    
                    if (!file.isEmpty()) {
                        files.add(file);
                    }
                }
                
                log.info("🎉 Regex parser successful - {} files parsed", files.size());
                return files;
            }
            
            log.warn("⚠️ Unexpected curl response format");
            return new ArrayList<>();
            
        } catch (Exception e) {
            log.error("❌ Error parsing curl JSON response", e);
            return new ArrayList<>();
        }
    }
}
