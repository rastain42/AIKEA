package com.ynov.Aikea.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
@ToString
@Table(name = "uploads")
public class Upload {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "id_externe")
    private String idExterne;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "original_name", nullable = false)
    private String originalName;

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "file_path", nullable = false)
    private String filePath;

    @Column(name = "tag1")
    private String tag1;

    @Column(name = "tag2")
    private String tag2;

    @Column(name = "tag3")
    private String tag3;

    @Column(name = "is_public", nullable = false)
    private Boolean isPublic;

    @CreationTimestamp
    @Column(name = "upload_date", nullable = false, updatable = false)
    private LocalDateTime uploadDate;

    @Column(name = "uploader_id")
    private Long uploaderId;

    @Column(name = "uploader_name")
    private String uploaderName;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "download_count", nullable = false)
    private Integer downloadCount = 0;

    @PrePersist
    public void prePersist() {
        if (isPublic == null) {
            isPublic = false;
        }
        if (downloadCount == null) {
            downloadCount = 0;
        }
    }
    /**
     * Incrémente le compteur de téléchargements
     * @return Le nouveau nombre de téléchargements
     */
    public int incrementDownloadCount() {
        if (this.downloadCount == null) {
            this.downloadCount = 0;
        }
        this.downloadCount++;
        return this.downloadCount;
    }
    /**
     * Vérifie si le fichier est une image
     * @return true si le fichier est une image, false sinon
     */
    @Transient
    public boolean isImage() {
        if (mimeType == null) return false;
        return mimeType.startsWith("image/");
    }

    /**
     * Vérifie si le fichier est un PDF
     * @return true si le fichier est un PDF, false sinon
     */
    @Transient
    public boolean isPdf() {
        if (mimeType == null) return false;
        return "application/pdf".equals(mimeType);
    }

    /**
     * Vérifie si le fichier est un document texte
     * @return true si le fichier est un document texte, false sinon
     */
    @Transient
    public boolean isTextDocument() {
        if (mimeType == null) return false;
        return mimeType.contains("text/") ||
                mimeType.contains("document") ||
                mimeType.contains("msword") ||
                mimeType.contains("application/vnd.openxmlformats-officedocument");
    }

    /**
     * Retourne l'extension du fichier
     * @return l'extension du fichier original
     */
    @Transient
    public String getFileExtension() {
        if (originalName == null || !originalName.contains(".")) {
            return "";
        }
        return originalName.substring(originalName.lastIndexOf(".") + 1);
    }

}
