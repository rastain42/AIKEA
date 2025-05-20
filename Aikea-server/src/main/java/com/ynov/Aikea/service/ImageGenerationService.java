package com.ynov.Aikea.service;

import com.ynov.Aikea.atools.ImageProviderEnum;
import com.ynov.Aikea.atools.QualityEnum;
import com.ynov.Aikea.dto.GeneratedImageDTO;
import com.ynov.Aikea.dto.UploadedImageDTO;
import com.ynov.Aikea.entity.RecordedImage;
import com.ynov.Aikea.repository.RecordedImagesRepository;
import io.github.sashirestela.openai.domain.image.Image;
import io.github.sashirestela.openai.domain.image.ImageRequest;
import io.github.sashirestela.openai.domain.image.ImageResponseFormat;
import io.github.sashirestela.openai.domain.image.Size;

import lombok.RequiredArgsConstructor;

import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class ImageGenerationService {

    private final OpenAICallsService openAICallsService ;
    private final ImageUploadCloudinaryService imageUploadCloudinaryService;
    private final RecordedImagesRepository recordedImagesRepository ;

    private final MediaType imageType= MediaType.IMAGE_PNG ;

    public GeneratedImageDTO generateAndSaveImage(String prompt,
                                                  ImageProviderEnum provider, QualityEnum quality) throws Exception {
        byte[] content = null;

            content = getImageFromDalle(prompt, quality);


        RecordedImage recordedImage = saveImage(prompt,content) ;
        saveOnComputer(prompt, content) ;

        return GeneratedImageDTO
                .builder()
                .image(content)
                .internalID(recordedImage.getId())
                .externalID(recordedImage.getCloudID())
                .storageURL(recordedImage.getCloudURI())
                .build() ;
    }

    public byte[] getImageFromDalle(String prompt, QualityEnum quality) throws Exception {

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

        String imageUrl = openAICallsService.generateWithDalle(imageRequest);

        if (imageUrl != null) {
            try {
                RestTemplate restTemplate = new RestTemplate();
                URI uri = new URI(imageUrl);
                RequestEntity<Void> request = RequestEntity.get(uri).build();
                ResponseEntity<byte[]> imageResponse = restTemplate.exchange(request, byte[].class);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(imageType);

                return imageResponse.getBody() ;
            } catch (Exception e) {
                e.printStackTrace();
                throw e ;
            }
        }

        throw new Exception("No URL sent by OpenAI") ;
    }


    public RecordedImage saveImage(String prompt, byte[] content) throws Exception {
        // Save on Cloud
        String fileName = generateFileNameFromPrompt(prompt, 100) ;
        UploadedImageDTO uploaderValue = imageUploadCloudinaryService.uploadImage(content) ;

        if(uploaderValue.URL() == null || uploaderValue.ID() == null) {
            throw new Exception("Error when uploading image to the cloud");
        }

        // Save on DB
        RecordedImage recordedImage = RecordedImage
                .builder()
                .imageName(fileName)
                .cloudURI(uploaderValue.URL())
                .cloudID(uploaderValue.ID())
                .prompt(prompt)
                .build();

        recordedImagesRepository.save(recordedImage) ;

        return recordedImage ;
    }

    public void saveOnComputer(String prompt, byte[] imageBytes) throws IOException, URISyntaxException {
        String simplifyName = "../image/" + prompt
                .substring(0, Math.min(prompt.length(), 20))
                .toLowerCase()
                .replace(",","")
                .replace("'","")
                .replace(" ","_")
                + ".png" ;

        Path targetFilePath = getAvailablePath(Paths.get(simplifyName)) ;
        Files.createDirectories(targetFilePath.getParent());

        try (FileOutputStream fos = new FileOutputStream(targetFilePath.toFile())) {
            fos.write(imageBytes);
            System.out.println("Image saved With name " + targetFilePath.getFileName());
        } catch (IOException e) {
            e.printStackTrace();
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

            if (fileName.length() + cleanWord.length() + (fileName.length() > 0 ? 1 : 0) > maxLength) {
                break;
            }

            if (!fileName.isEmpty()) {
                fileName.append("_");
            }

            fileName.append(cleanWord);
        }

        return !fileName.isEmpty() ? fileName.toString().toLowerCase() + ".png" : "file";
    }

}
