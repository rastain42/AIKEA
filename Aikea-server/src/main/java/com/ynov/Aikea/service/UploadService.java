package com.ynov.Aikea.service;

import com.ynov.Aikea.entity.Upload;
import com.ynov.Aikea.repository.UploadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class UploadService {

    private static final Logger logger = LoggerFactory.getLogger(UploadService.class);

    @Value("${app.upload.directory:uploads}")
    private String uploadDirectory;

    @Autowired
    private UploadRepository uploadRepository;

    /**
     * Enregistre un fichier téléchargé sur le serveur et dans la base de données
     * @param file Fichier téléchargé
     * @param idExterne Identifiant externe associé (par exemple, ID du groupe ou de l'utilisateur)
     * @param tag1 Premier tag pour la catégorisation
     * @param tag2 Deuxième tag pour la catégorisation
     * @param tag3 Troisième tag pour la catégorisation
     * @param description Description du fichier
     * @param isPublic Indique si le fichier est public
     * @param uploaderId ID de l'utilisateur qui télécharge
     * @param uploaderName Nom de l'utilisateur qui télécharge
     * @return L'entité Upload créée
     * @throws IOException Si une erreur survient pendant le téléchargement
     */
    public Upload saveFile(MultipartFile file, String idExterne,
                           String tag1, String tag2, String tag3,
                           String description, Boolean isPublic,
                           Long uploaderId, String uploaderName) throws IOException {

        // Valider le type de fichier
        String mimeType = file.getContentType();
        if (mimeType == null || !isPdfOrImage(mimeType)) {
            throw new IllegalArgumentException("Format de fichier non supporté. Seuls les PDF et images sont acceptés.");
        }

        // Création du répertoire si nécessaire
        Path uploadPath = Paths.get(uploadDirectory);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        // Génération d'un nom de fichier unique
        String originalFilename = file.getOriginalFilename();
        String fileExtension = getFileExtension(originalFilename);
        String uniqueFilename = UUID.randomUUID().toString() + "." + fileExtension;

        // Chemin complet du fichier
        Path filePath = uploadPath.resolve(uniqueFilename);

        // Sauvegarde du fichier
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        // Création de l'entité Upload
        Upload upload = Upload.builder()
                .fileName(uniqueFilename)
                .originalName(originalFilename)
                .mimeType(mimeType)
                .fileSize(file.getSize())
                .filePath(filePath.toString())
                .idExterne(idExterne)
                .tag1(tag1)
                .tag2(tag2)
                .tag3(tag3)
                .description(description)
                .isPublic(isPublic != null ? isPublic : false)
                .uploaderId(uploaderId)
                .uploaderName(uploaderName)
                .downloadCount(0)
                .uploadDate(LocalDateTime.now())
                .build();

        // Sauvegarde dans la base de données
        Upload savedUpload = uploadRepository.save(upload);
        logger.info("Fichier sauvegardé avec succès: {}", savedUpload.getFileName());

        return savedUpload;
    }

    /**
     * Récupère un fichier par son ID
     * @param id L'ID du fichier
     * @return L'entité Upload trouvée ou null
     */
    public Upload getFile(int id) {
        return uploadRepository.findById(id).orElse(null);
    }

    /**
     * Supprime un fichier
     * @param id L'ID du fichier à supprimer
     * @throws IOException Si une erreur survient lors de la suppression
     */
    public void deleteFile(int id) throws IOException {
        Upload upload = uploadRepository.findById(id).orElse(null);

        if (upload != null) {
            // Suppression du fichier physique
            Path filePath = Paths.get(upload.getFilePath());
            if (Files.exists(filePath)) {
                Files.delete(filePath);
            }

            // Suppression de l'enregistrement en base
            uploadRepository.delete(upload);
            logger.info("Fichier supprimé avec succès: {}", upload.getFileName());
        } else {
            logger.warn("Tentative de suppression d'un fichier inexistant: {}", id);
        }
    }

    /**
     * Récupère tous les fichiers publics
     * @return La liste des fichiers publics
     */
    public List<Upload> getAllPublicFiles() {
        return uploadRepository.findByIsPublicTrue();
    }

    /**
     * Recherche des fichiers par tags
     * @param tag1 Premier tag
     * @param tag2 Deuxième tag
     * @param tag3 Troisième tag
     * @param publicOnly Indique si seuls les fichiers publics doivent être retournés
     * @return La liste des fichiers correspondant aux critères
     */
    public List<Upload> searchByTags(String tag1, String tag2, String tag3, boolean publicOnly) {
        if (publicOnly) {
            return uploadRepository.findPublicByTags(tag1, tag2, tag3);
        } else {
            return uploadRepository.findByTags(tag1, tag2, tag3);
        }
    }

    /**
     * Vérifie si le type MIME est un PDF ou une image
     * @param mimeType Le type MIME à vérifier
     * @return true si c'est un PDF ou une image
     */
    private boolean isPdfOrImage(String mimeType) {
        return mimeType.startsWith("image/") || mimeType.equals("application/pdf");
    }

    /**
     * Extrait l'extension d'un nom de fichier
     * @param filename Le nom du fichier
     * @return L'extension du fichier
     */
    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "bin"; // Extension par défaut
        }
        return filename.substring(filename.lastIndexOf(".") + 1);
    }

    /**
     * Incrémente le compteur de téléchargements d'un fichier
     * @param id L'ID du fichier
     * @return Le nombre de téléchargements après incrémentation
     */
    public int incrementDownloadCount(int id) {
        Upload upload = uploadRepository.findById(id).orElse(null);
        if (upload != null) {
            upload.incrementDownloadCount();
            uploadRepository.save(upload);
            return upload.getDownloadCount();
        }
        return 0;
    }

    /**
     * Marque un fichier comme public ou privé
     * @param id L'ID du fichier
     * @param isPublic La nouvelle visibilité
     * @return true si la mise à jour a réussi
     */
    public boolean updateVisibility(int id, boolean isPublic) {
        Upload upload = uploadRepository.findById(id).orElse(null);
        if (upload != null) {
            upload.setIsPublic(isPublic);
            uploadRepository.save(upload);
            return true;
        }
        return false;
    }

    /**
     * Met à jour les tags d'un fichier
     * @param id L'ID du fichier
     * @param tag1 Premier tag
     * @param tag2 Deuxième tag
     * @param tag3 Troisième tag
     * @return true si la mise à jour a réussi
     */
    public boolean updateTags(int id, String tag1, String tag2, String tag3) {
        Upload upload = uploadRepository.findById(id).orElse(null);
        if (upload != null) {
            upload.setTag1(tag1);
            upload.setTag2(tag2);
            upload.setTag3(tag3);
            uploadRepository.save(upload);
            return true;
        }
        return false;
    }
}
