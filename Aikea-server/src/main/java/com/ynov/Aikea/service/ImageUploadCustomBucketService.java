package com.ynov.Aikea.service;

import com.ynov.Aikea.dto.UploadedImageDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.stream.Collectors;

@Service("customBucketService")
@RequiredArgsConstructor
@Slf4j
public class ImageUploadCustomBucketService implements ImageUploadService {

    @Value("${bucket.path:/uploads}")
    private String bucketPath;

    @Value("${bucket.base-url:http://localhost:8080}")
    private String baseUrl;

    @Value("${bucket.token}")
    private String jwtToken;

    private static final List<String> ALLOWED_EXTENSIONS = Arrays.asList(
            "jpg", "jpeg", "png", "gif", "pdf", "doc", "docx"
    );

    @Override
    public UploadedImageDTO uploadImage(byte[] fileBytes) {
        try {
            // Log du token pour vérification (masqué pour sécurité)
            log.debug("Using JWT token: {}****", jwtToken != null ? jwtToken.substring(0, Math.min(jwtToken.length(), 10)) : "null");

            // Créer le dossier s'il n'existe pas
            Path uploadPath = Paths.get(bucketPath);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // Générer un nom de fichier unique
            String fileName = generateUniqueFileName() + ".png";
            Path filePath = uploadPath.resolve(fileName);

            // Écrire le fichier
            Files.write(filePath, fileBytes);

            // Construire l'URL d'accès
            String fileUrl = baseUrl + "/uploads/" + fileName;

            log.info("File uploaded successfully: {}", fileName);

            return UploadedImageDTO.builder()
                    .url(fileUrl)
                    .id(fileName)
                    .build();

        } catch (IOException e) {
            log.error("Error uploading file to custom bucket", e);
            throw new RuntimeException("Failed to upload file", e);
        }
    }

    /**
     * Upload de fichier avec métadonnées et tags
     */
    public UploadedImageDTO uploadFile(MultipartFile file, String idExterne, String tag1, String tag2, String tag3) {
        try {
            log.debug("Starting file upload with JWT token authentication");

            // Validation du fichier
            validateFile(file);

            // Créer le dossier avec les tags comme structure
            Path uploadPath = createDirectoryStructure(tag1, tag2, tag3);

            // Générer le nom de fichier avec métadonnées
            String fileName = generateFileNameWithMetadata(file.getOriginalFilename(), idExterne, tag1);
            Path filePath = uploadPath.resolve(fileName);

            // Copier le fichier
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // Construire l'URL d'accès
            String relativePath = Paths.get(bucketPath).relativize(filePath).toString().replace("\\", "/");
            String fileUrl = baseUrl + "/uploads/" + relativePath;

            log.info("File uploaded successfully: {} with tags: {}, {}, {}", fileName, tag1, tag2, tag3);

            return UploadedImageDTO.builder()
                    .url(fileUrl)
                    .id(fileName)
                    .build();

        } catch (IOException e) {
            log.error("Error uploading file to custom bucket", e);
            throw new RuntimeException("Failed to upload file", e);
        }
    }

    @Override
    public void deleteImage(String fileName) {
        try {
            log.debug("Deleting file: {} with JWT token authentication", fileName);

            Path filePath = findFileInBucket(fileName);
            if (filePath != null && Files.exists(filePath)) {
                Files.delete(filePath);
                log.info("File deleted successfully: {}", fileName);
            } else {
                log.warn("File not found for deletion: {}", fileName);
                throw new RuntimeException("File not found: " + fileName);
            }
        } catch (IOException e) {
            log.error("Error deleting file: {}", fileName, e);
            throw new RuntimeException("Failed to delete file", e);
        }
    }

    @Override
    public List<Map<String, String>> getAllImages() {
        try {
            log.debug("Fetching all images with JWT token authentication");

            Path uploadPath = Paths.get(bucketPath);
            if (!Files.exists(uploadPath)) {
                log.info("Upload directory does not exist, returning empty list");
                return new ArrayList<>();
            }

            List<Map<String, String>> images = Files.walk(uploadPath)
                    .filter(Files::isRegularFile)
                    .filter(this::isImageFile)
                    .map(this::mapFileToInfo)
                    .collect(Collectors.toList());

            log.info("Found {} images", images.size());
            return images;

        } catch (IOException e) {
            log.error("Error fetching all images", e);
            throw new RuntimeException("Failed to fetch images", e);
        }
    }

    /**
     * Recherche par tags
     */
    public List<Map<String, String>> searchByTags(String tag1, String tag2, String tag3) {
        try {
            log.debug("Searching files by tags: {}, {}, {} with JWT authentication", tag1, tag2, tag3);

            Path uploadPath = Paths.get(bucketPath);
            if (!Files.exists(uploadPath)) {
                return new ArrayList<>();
            }

            List<Map<String, String>> results = Files.walk(uploadPath)
                    .filter(Files::isRegularFile)
                    .filter(path -> matchesTags(path, tag1, tag2, tag3))
                    .map(this::mapFileToInfo)
                    .collect(Collectors.toList());

            log.info("Found {} files matching tags", results.size());
            return results;

        } catch (IOException e) {
            log.error("Error searching files by tags", e);
            throw new RuntimeException("Failed to search files by tags", e);
        }
    }

    /**
     * Recherche par ID externe
     */
    public List<Map<String, String>> searchByExternalId(String externalId) {
        try {
            log.debug("Searching files by external ID: {} with JWT authentication", externalId);

            Path uploadPath = Paths.get(bucketPath);
            if (!Files.exists(uploadPath)) {
                return new ArrayList<>();
            }

            return Files.walk(uploadPath)
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().contains(externalId))
                    .map(this::mapFileToInfo)
                    .collect(Collectors.toList());

        } catch (IOException e) {
            log.error("Error searching files by external ID", e);
            throw new RuntimeException("Failed to search files by external ID", e);
        }
    }

    /**
     * Obtenir les statistiques du bucket
     */
    public Map<String, Object> getBucketStats() {
        try {
            log.debug("Getting bucket statistics with JWT authentication");

            Path uploadPath = Paths.get(bucketPath);
            if (!Files.exists(uploadPath)) {
                return Map.of("totalFiles", 0, "totalSize", 0L, "bucketPath", bucketPath);
            }

            List<Path> files = Files.walk(uploadPath)
                    .filter(Files::isRegularFile)
                    .collect(Collectors.toList());

            long totalSize = files.stream()
                    .mapToLong(path -> {
                        try {
                            return Files.size(path);
                        } catch (IOException e) {
                            return 0L;
                        }
                    })
                    .sum();

            Map<String, Object> stats = new HashMap<>();
            stats.put("totalFiles", files.size());
            stats.put("totalSize", totalSize);
            stats.put("totalSizeFormatted", formatFileSize(totalSize));
            stats.put("bucketPath", bucketPath);
            stats.put("baseUrl", baseUrl);
            stats.put("hasJwtToken", jwtToken != null && !jwtToken.isEmpty());

            log.info("Bucket stats: {} files, {} bytes", files.size(), totalSize);
            return stats;

        } catch (IOException e) {
            log.error("Error getting bucket statistics", e);
            throw new RuntimeException("Failed to get bucket statistics", e);
        }
    }

    // ==================== MÉTHODES UTILITAIRES ====================

    /**
     * Rechercher un PDF par son nom de fichier exact
     */
    public Map<String, String> findPdfById(String fileName) {
        log.debug("Searching for PDF by filename: {}", fileName);

        try {
            Path filePath = findFileInBucket(fileName);
            if (filePath != null) {
                return mapFileToInfo(filePath);
            }
            return null;
        } catch (IOException e) {
            log.error("Error finding PDF by ID: {}", fileName, e);
            throw new RuntimeException("Failed to find PDF", e);
        }
    }
    /**
     * Rechercher des PDFs par ID externe (utilisé lors de l'upload)
     */
    public List<Map<String, String>> findPdfsByExternalId(String externalId) {
        log.debug("Searching PDFs by external ID: {}", externalId);

        try {
            Path uploadPath = Paths.get(bucketPath);
            if (!Files.exists(uploadPath)) {
                return new ArrayList<>();
            }

            List<Map<String, String>> results = Files.walk(uploadPath)
                    .filter(Files::isRegularFile)
                    .filter(path -> {
                        String fileName = path.getFileName().toString();
                        String extension = getFileExtension(fileName).toLowerCase();
                        return extension.equals("pdf") && fileName.contains(externalId);
                    })
                    .map(this::mapFileToInfo)
                    .collect(Collectors.toList());

            log.info("Found {} PDFs for external ID: {}", results.size(), externalId);
            return results;

        } catch (IOException e) {
            log.error("Error searching PDFs by external ID", e);
            throw new RuntimeException("Failed to search PDFs", e);
        }
    }
    /**
     * Obtenir tous les PDFs du bucket
     */
    public List<Map<String, String>> getAllPdfs() {
        log.debug("Fetching all PDF files from bucket");

        try {
            Path uploadPath = Paths.get(bucketPath);
            if (!Files.exists(uploadPath)) {
                return new ArrayList<>();
            }

            List<Map<String, String>> pdfs = Files.walk(uploadPath)
                    .filter(Files::isRegularFile)
                    .filter(path -> {
                        String extension = getFileExtension(path.getFileName().toString()).toLowerCase();
                        return extension.equals("pdf");
                    })
                    .map(this::mapFileToInfo)
                    .collect(Collectors.toList());

            log.info("Found {} PDF files in bucket", pdfs.size());
            return pdfs;

        } catch (IOException e) {
            log.error("Error fetching PDFs from bucket", e);
            throw new RuntimeException("Failed to fetch PDFs", e);
        }
    }
    /**
     * Rechercher des PDFs par pattern dans le nom
     */
    public List<Map<String, String>> findPdfsByPattern(String pattern) {
        log.debug("Searching PDFs by pattern: {}", pattern);

        try {
            Path uploadPath = Paths.get(bucketPath);
            if (!Files.exists(uploadPath)) {
                return new ArrayList<>();
            }

            List<Map<String, String>> results = Files.walk(uploadPath)
                    .filter(Files::isRegularFile)
                    .filter(path -> {
                        String fileName = path.getFileName().toString();
                        String extension = getFileExtension(fileName).toLowerCase();
                        return extension.equals("pdf") &&
                                fileName.toLowerCase().contains(pattern.toLowerCase());
                    })
                    .map(this::mapFileToInfo)
                    .collect(Collectors.toList());

            log.info("Found {} PDFs matching pattern: {}", results.size(), pattern);
            return results;

        } catch (IOException e) {
            log.error("Error searching PDFs by pattern", e);
            throw new RuntimeException("Failed to search PDFs", e);
        }
    }


    private String generateUniqueFileName() {
        return "img_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String generateFileNameWithMetadata(String originalName, String idExterne, String tag1) {
        String extension = getFileExtension(originalName);
        String baseName = removeExtension(originalName);
        String timestamp = String.valueOf(System.currentTimeMillis());

        return String.format("%s_%s_%s_%s.%s",
                sanitizeFileName(baseName),
                sanitizeFileName(idExterne),
                sanitizeFileName(tag1),
                timestamp,
                extension);
    }

    private Path createDirectoryStructure(String tag1, String tag2, String tag3) throws IOException {
        Path basePath = Paths.get(bucketPath);

        // Créer une structure de dossiers basée sur les tags
        StringBuilder pathBuilder = new StringBuilder();
        if (tag1 != null && !tag1.isEmpty()) {
            pathBuilder.append(sanitizeForPath(tag1));
        }
        if (tag2 != null && !tag2.isEmpty()) {
            if (pathBuilder.length() > 0) pathBuilder.append("/");
            pathBuilder.append(sanitizeForPath(tag2));
        }
        if (tag3 != null && !tag3.isEmpty()) {
            if (pathBuilder.length() > 0) pathBuilder.append("/");
            pathBuilder.append(sanitizeForPath(tag3));
        }

        Path finalPath = pathBuilder.length() > 0
                ? basePath.resolve(pathBuilder.toString())
                : basePath.resolve("uncategorized");

        Files.createDirectories(finalPath);
        return finalPath;
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("File is empty or null");
        }

        String fileName = file.getOriginalFilename();
        if (fileName == null) {
            throw new RuntimeException("File name is null");
        }

        String extension = getFileExtension(fileName).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new RuntimeException("File type not allowed: " + extension + ". Allowed: " + ALLOWED_EXTENSIONS);
        }

        // Limite de taille (ex: 10MB)
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new RuntimeException("File size exceeds maximum allowed size (10MB)");
        }

        log.debug("File validation passed for: {}", fileName);
    }

    private String getFileExtension(String fileName) {
        int lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 ? fileName.substring(lastDot + 1) : "";
    }

    private String removeExtension(String fileName) {
        int lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    }

    private String sanitizeFileName(String fileName) {
        if (fileName == null) return "unknown";
        return fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String sanitizeForPath(String pathComponent) {
        if (pathComponent == null) return "unknown";
        return pathComponent.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private Path findFileInBucket(String fileName) throws IOException {
        Path uploadPath = Paths.get(bucketPath);
        if (!Files.exists(uploadPath)) {
            return null;
        }

        return Files.walk(uploadPath)
                .filter(Files::isRegularFile)
                .filter(path -> path.getFileName().toString().equals(fileName))
                .findFirst()
                .orElse(null);
    }

    private boolean matchesTags(Path filePath, String tag1, String tag2, String tag3) {
        String fullPath = filePath.toString();
        String fileName = filePath.getFileName().toString();

        boolean matches = true;

        if (tag1 != null && !tag1.isEmpty()) {
            matches = matches && (fullPath.contains(tag1) || fileName.contains(tag1));
        }
        if (tag2 != null && !tag2.isEmpty()) {
            matches = matches && (fullPath.contains(tag2) || fileName.contains(tag2));
        }
        if (tag3 != null && !tag3.isEmpty()) {
            matches = matches && (fullPath.contains(tag3) || fileName.contains(tag3));
        }

        return matches;
    }

    private boolean isImageFile(Path filePath) {
        String fileName = filePath.getFileName().toString().toLowerCase();
        return fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") ||
                fileName.endsWith(".png") || fileName.endsWith(".gif");
    }

    private Map<String, String> mapFileToInfo(Path filePath) {
        try {
            String fileName = filePath.getFileName().toString();
            String relativePath = Paths.get(bucketPath).relativize(filePath).toString().replace("\\", "/");
            String url = baseUrl + "/uploads/" + relativePath;
            String extension = getFileExtension(fileName);
            long size = Files.size(filePath);

            Map<String, String> fileInfo = new HashMap<>();
            fileInfo.put("fileName", fileName);
            fileInfo.put("url", url);
            fileInfo.put("format", extension);
            fileInfo.put("size", String.valueOf(size));
            fileInfo.put("sizeFormatted", formatFileSize(size));
            fileInfo.put("relativePath", relativePath);
            fileInfo.put("id", fileName);

            return fileInfo;
        } catch (IOException e) {
            log.error("Error mapping file info for: {}", filePath, e);
            return new HashMap<>();
        }
    }

    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
    }

    /**
     * Vérifier si le service est configuré correctement
     */
    public boolean isConfigured() {
        boolean hasToken = jwtToken != null && !jwtToken.isEmpty();
        boolean hasValidPath = bucketPath != null && !bucketPath.isEmpty();
        boolean hasValidUrl = baseUrl != null && !baseUrl.isEmpty();

        log.info("Service configuration - Token: {}, Path: {}, URL: {}",
                hasToken ? "✓" : "✗", hasValidPath ? "✓" : "✗", hasValidUrl ? "✓" : "✗");

        return hasToken && hasValidPath && hasValidUrl;
    }
}
