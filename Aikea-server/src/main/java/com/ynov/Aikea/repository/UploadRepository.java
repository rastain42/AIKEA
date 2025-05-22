package com.ynov.Aikea.repository;

import com.ynov.Aikea.entity.Upload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UploadRepository extends JpaRepository<Upload, Integer> {

    /**
     * Trouve tous les uploads publics
     */
    List<Upload> findByIsPublicTrue();

    /**
     * Trouve des uploads par un ensemble de tags
     */
    @Query("SELECT u FROM Upload u WHERE " +
            "(:tag1 IS NULL OR :tag1 = '' OR u.tag1 = :tag1) AND " +
            "(:tag2 IS NULL OR :tag2 = '' OR u.tag2 = :tag2) AND " +
            "(:tag3 IS NULL OR :tag3 = '' OR u.tag3 = :tag3)")
    List<Upload> findByTags(@Param("tag1") String tag1,
                            @Param("tag2") String tag2,
                            @Param("tag3") String tag3);

    /**
     * Trouve des uploads publics par un ensemble de tags
     */
    @Query("SELECT u FROM Upload u WHERE " +
            "u.isPublic = true AND " +
            "(:tag1 IS NULL OR :tag1 = '' OR u.tag1 = :tag1) AND " +
            "(:tag2 IS NULL OR :tag2 = '' OR u.tag2 = :tag2) AND " +
            "(:tag3 IS NULL OR :tag3 = '' OR u.tag3 = :tag3)")
    List<Upload> findPublicByTags(@Param("tag1") String tag1,
                                  @Param("tag2") String tag2,
                                  @Param("tag3") String tag3);

    /**
     * Recherche par groupID (correspondant à l'ID externe)
     */
    @Query("SELECT u FROM Upload u WHERE u.idExterne = :groupID AND u.isPublic = true")
    List<Upload> findPublicByGroupID(@Param("groupID") String groupID);

    /**
     * Recherche par nom de fichier original (recherche insensible à la casse)
     */
    List<Upload> findByOriginalNameContainingIgnoreCase(String originalName);

    /**
     * Trouve les uploads correspondant à un ID externe
     */
    List<Upload> findByIdExterne(String idExterne);

    /**
     * Compte le nombre total de fichiers publics
     */
    long countByIsPublicTrue();

    /**
     * Trouve les derniers uploads ajoutés
     */
    @Query(value = "SELECT u FROM Upload u ORDER BY u.uploadDate DESC LIMIT :limit")
    List<Upload> findRecentUploads(@Param("limit") int limit);
}
