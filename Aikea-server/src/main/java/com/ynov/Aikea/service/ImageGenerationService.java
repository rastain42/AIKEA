package com.ynov.Aikea.service;

import com.ynov.Aikea.atools.QualityEnum;
import com.ynov.Aikea.dto.GeneratedImageDTO;
import com.ynov.Aikea.entity.RecordedImage;
import com.ynov.Aikea.entity.Upload;
import com.ynov.Aikea.repository.RecordedImagesRepository;
import io.github.sashirestela.openai.domain.image.ImageRequest;
import io.github.sashirestela.openai.domain.image.ImageResponseFormat;
import io.github.sashirestela.openai.domain.image.Size;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
@RequiredArgsConstructor
public class ImageGenerationService {

    private final OpenAICallsService openAICallsService;
    private final UploadService uploadService;
    private final RecordedImagesRepository recordedImagesRepository;

    private final MediaType imageType = MediaType.IMAGE_PNG;

    private String basePath;
    private final ResourceLoader resourceLoader;

    @PostConstruct
    public void init() {
        try {
            Resource resource = resourceLoader.getResource("classpath:static/images");
            if (resource.exists()) {
                this.basePath = resource.getFile().getAbsolutePath();
            } else {
                // Create a temporary directory if classpath resource doesn't exist
                Path tempDir = Files.createTempDirectory("aikea-images");
                this.basePath = tempDir.toAbsolutePath().toString();
                System.out.println("Created temporary image directory: " + this.basePath);
            }
        } catch (IOException e) {
            // Fallback to system temp directory
            try {
                Path tempDir = Files.createTempDirectory("aikea-images");
                this.basePath = tempDir.toAbsolutePath().toString();
                System.out.println("Using fallback temporary image directory: " + this.basePath);
            } catch (IOException ex) {
                throw new RuntimeException("Failed to resolve or create image directory", ex);
            }
        }
    }

    public GeneratedImageDTO generateAndSaveImage(String prompt, QualityEnum quality) throws Exception {
        // Obtenir l'image de DALL-E sous forme de tableau d'octets
        String imageUrl= getImageUrlFromDalle(prompt, quality);
        byte[] content = getImageFromUrl(imageUrl);

        // Vérifier que l'image a bien été obtenue
        if (content == null || content.length == 0) {
            throw new RuntimeException("Failed to generate image from DALL-E");
        }

        // Enregistrer l'image dans la base de données
        RecordedImage recordedImage = saveImage(prompt, content, quality);

        // Enregistrer l'image sur le disque
        saveOnComputer(prompt, content);


        return GeneratedImageDTO
                .builder()
                .image(content)
                .internalID(recordedImage.getId())
                .externalID(recordedImage.getCloudID())
                .storageURL(recordedImage.getCloudURI())
                .url(imageUrl)
                .build();
    }

    public String getImageUrlFromDalle(String prompt, QualityEnum quality) throws Exception {
        ImageRequest imageRequest = null;

        if(quality == QualityEnum.LOW) {
            imageRequest = ImageRequest.builder()
                    .prompt(prompt)
                    .n(1)
                    .size(Size.X256)
                    .responseFormat(ImageResponseFormat.URL)
                    .model("dall-e-2")
                    .build() ;
        }
        else if (quality == QualityEnum.MEDIUM) {
            imageRequest = ImageRequest.builder()
                    .prompt(prompt)
                    .n(1)
                    .size(Size.X1024)
                    .responseFormat(ImageResponseFormat.URL)
                    .model("dall-e-3")
                    .build() ;
        }
        else if(quality == QualityEnum.HIGH) {
            imageRequest = ImageRequest.builder()
                    .prompt(prompt)
                    .n(1)
                    .size(Size.X1792X)
                    .quality(ImageRequest.Quality.HD)
                    .responseFormat(ImageResponseFormat.URL)
                    .model("dall-e-3")
                    .build() ;
        }
try {
    return openAICallsService.generateWithDalle(imageRequest);

}catch (Exception e) {
    throw new Exception("No URL sent by OpenAI"+e.getMessage()) ;

}


    }
    public byte[] getImageFromUrl(String imageUrl) throws Exception {

        if (imageUrl != null) {
            try {
                RestTemplate restTemplate = new RestTemplate();
                URI uri = new URI(imageUrl);
                RequestEntity<Void> request = RequestEntity.get(uri).build();
                ResponseEntity<byte[]> imageResponse = restTemplate.exchange(request, byte[].class);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(imageType);

                return imageResponse.getBody();
            } catch (Exception e) {
                e.printStackTrace();
                throw e ;
            }
        }

        throw new Exception("No URL sent by OpenAI") ;
    }


    public RecordedImage saveImage(String prompt, byte[] content, QualityEnum quality) throws Exception {
        // Créer un nom de fichier basé sur le prompt
        String fileName = generateFileNameFromPrompt(prompt, 100);

        // Créer un MultipartFile à partir du tableau de bytes
        MultipartFile multipartFile = new ByteArrayMultipartFile(
                fileName,
                fileName,
                "image/png",
                content
        );

        // Utiliser UploadService pour enregistrer l'image
        Upload savedUpload = uploadService.saveFile(
                multipartFile,
                "AI_GEN",  // identifiant externe pour les images générées par IA
                "ai-generated",  // tag1
                "dall-e",       // tag2
                quality != null ? quality.toString() : "MEDIUM",  // tag3 basé sur la qualité
                prompt,         // description (utiliser le prompt)
                true,           // isPublic (rendre public par défaut)
                null,           // uploaderId (null car généré par système)
                "AI-SYSTEM"     // uploaderName
        );

        // Créer et sauvegarder un RecordedImage pour maintenir la compatibilité
        RecordedImage recordedImage = RecordedImage
                .builder()
                .imageName(fileName)
                .cloudURI(savedUpload.getFilePath())  // Utiliser le chemin du fichier sauvegardé
                .cloudID(String.valueOf(savedUpload.getId()))  // Utiliser l'ID de l'upload comme ID externe
                .prompt(prompt)
                .build();

        recordedImagesRepository.save(recordedImage);

        return recordedImage;
    }

    // Classe personnalisée pour éviter d'avoir besoin de MockMultipartFile
    public static class ByteArrayMultipartFile implements MultipartFile {
        private final byte[] content;
        private final String name;
        private final String originalFilename;
        private final String contentType;

        public ByteArrayMultipartFile(String name, String originalFilename, String contentType, byte[] content) {
            this.name = name;
            this.originalFilename = originalFilename;
            this.contentType = contentType;
            this.content = content;
        }

        @Override
        public String getName() {
            return name;
        }

        @Override
        public String getOriginalFilename() {
            return originalFilename;
        }

        @Override
        public String getContentType() {
            return contentType;
        }

        @Override
        public boolean isEmpty() {
            return content == null || content.length == 0;
        }

        @Override
        public long getSize() {
            return content.length;
        }

        @Override
        public byte[] getBytes() throws IOException {
            return content;
        }

        @Override
        public InputStream getInputStream() throws IOException {
            return new ByteArrayInputStream(content);
        }

        @Override
        public void transferTo(File dest) throws IOException, IllegalStateException {
            try (FileOutputStream fos = new FileOutputStream(dest)) {
                fos.write(content);
            }
        }
    }

    public void saveOnComputer(String prompt, byte[] imageBytes) throws IOException {
        // Spécifiez le chemin où vous souhaitez sauvegarder l'image
        String filename = generateFileNameFromPrompt(prompt, 50);

        if (filename == null || filename.isEmpty()) {
            filename = "generated_image_" + System.currentTimeMillis() + ".png";
        }

        // Construisez le chemin complet
        File directory = new File(basePath);
        if (!directory.exists()) {
            System.out.println("Creating directory: " + directory.getAbsolutePath());
            boolean created = directory.mkdirs();
            if (!created) {
                System.err.println("Failed to create directory");
            }
        }

        // Chemin complet du fichier
        File file = new File(directory, filename);
        System.out.println("Saving image to: " + file.getAbsolutePath());

        // Écrire le fichier
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(imageBytes);
            System.out.println("Image saved successfully. Size: " + imageBytes.length + " bytes");
        } catch (IOException e) {
            System.err.println("Error saving image: " + e.getMessage());
            throw e;
        }
    }

    private static Path getAvailablePath(Path originalPath) {
        Path parent = originalPath.getParent();
        String fileName = originalPath.getFileName().toString();
        String name = fileName;
        String extension = "";

        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex != -1) {
            name = fileName.substring(0, dotIndex);
            extension = fileName.substring(dotIndex); // includes the dot
        }

        int count = 1;
        Path newPath = originalPath;

        while (Files.exists(newPath)) {
            String newFileName = name + "_" + count + extension;
            newPath = (parent != null) ? parent.resolve(newFileName) : Paths.get(newFileName);
            count++;
        }

        return newPath;
    }

    public static String generateFileNameFromPrompt(String prompt, int maxLength) {
        if (prompt == null || prompt.isBlank()) return "file";

        StringBuilder fileName = new StringBuilder();
        String[] words = prompt.split("\\s+");

        for (String word : words) {
            String cleanWord = word.replaceAll("[^a-zA-Z0-9]", "");
            if (cleanWord.isEmpty()) continue;

            if (fileName.length() + cleanWord.length() + (!fileName.isEmpty() ? 1 : 0) > maxLength) {
                break;
            }

            if (!fileName.isEmpty()) {
                fileName.append("_");
            }

            fileName.append(cleanWord);
        }

        return !fileName.isEmpty() ? fileName.toString().toLowerCase() + ".png" : "file.png";
    }
}
