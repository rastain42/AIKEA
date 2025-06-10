package com.ynov.Aikea.service;

import com.lowagie.text.Document;
import com.lowagie.text.Image;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import com.ynov.Aikea.atools.QualityEnum;
import com.ynov.Aikea.config.JwtTokenProvider;
import com.ynov.Aikea.dto.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.Exceptions;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RequiredArgsConstructor
@Service
public class PDFContentService {

    private final ResourceLoader resourceLoader;
    private  String basePath;
    private final ImageGenerationService imageGenerationService;
    private final TextGenerationService textGenerationService;
    private final UploadService uploadService;
    private static final Logger logger = LogManager.getLogger();


    @PostConstruct
    public void init() {
        try {
            Resource resource = resourceLoader.getResource("classpath:pdf");
            if (resource.exists()) {
                this.basePath = resource.getFile().getAbsolutePath();
            } else {
                // Create a temporary directory if classpath resource doesn't exist
                Path tempDir = Files.createTempDirectory("aikea-pdf");
                this.basePath = tempDir.toAbsolutePath().toString();
                System.out.println("Created temporary PDF directory: " + this.basePath);
            }
        } catch (IOException e) {
            // Fallback to system temp directory
            try {
                Path tempDir = Files.createTempDirectory("aikea-pdf");
                this.basePath = tempDir.toAbsolutePath().toString();
                System.out.println("Using fallback temporary PDF directory: " + this.basePath);
            } catch (IOException ex) {
                throw new RuntimeException("Failed to resolve or create PDF directory", ex);
            }
        }
    }



    public PDFContentDTO generatePDFContent(ImageGenerationRequest imageGenerationRequest) throws Exception {

        GeneratedImageDTO generatedImage = imageGenerationService.generateAndSaveImage(
                imageGenerationRequest.getPrompt(), QualityEnum.valueOf(
                        imageGenerationRequest.getQuality().toUpperCase()
                )
        );
        GeneratedTextDTO generatedText = textGenerationService.generateTextFromImageUrl(generatedImage.getUrl());

        PDFContentDTO pdfContent = new PDFContentDTO();
        pdfContent.setGeneratedText(generatedText);
        pdfContent.setGeneratedImage(generatedImage);

        return pdfContent;
    }

    public String extractFilenameFromUrl(String url) {
        Pattern pattern = Pattern.compile("[^/]+$");
        Matcher matcher = pattern.matcher(url.split("\\?")[0]);
        if (matcher.find()) {
            return matcher.group(0);
        }
        return "";
    }

    public MultipartFile createPDF(PDFContentDTO pdfContent) throws FileNotFoundException {
        String externalID = pdfContent.getGeneratedImage().getExternalID();
        String pdfName = externalID.substring(externalID.lastIndexOf('/') + 1) + ".pdf";
        String pdfPath = basePath + "/" + pdfName;
        File pdfFile = null;

        try {
            // Créer le dossier si besoin
            Files.createDirectories(Path.of(basePath));

            // Générer le PDF localement
            Document document = new Document();
            pdfFile = new File(pdfPath);
            PdfWriter.getInstance(document, new FileOutputStream(pdfFile));
            document.open();
            document.add(new Paragraph(pdfContent.getGeneratedText().getText()));
            Image image = Image.getInstance(pdfContent.getGeneratedImage().getStorageURL());
            image.scaleAbsolute(300f, 200f); // largeur: 300 points, hauteur: 200 points
            image.scalePercent(50); // 50% de la taille originale
            image.scalePercent(75, 50); // 75% de largeur, 50% de hauteur

            float maxWidth = document.getPageSize().getWidth() - document.leftMargin() - document.rightMargin();
            float maxHeight = 300f;
            image.scaleToFit(maxWidth, maxHeight);

            float fixedWidth = 400f;
            image.scaleToFit(fixedWidth, 10000); // hauteur très grande pour ne pas contraindre
            image.setAlignment(Image.ALIGN_CENTER);
            document.add(image);
            document.close();

            // Convertir le fichier PDF en MultipartFile pour uploadService
            MultipartFile multipartFile = convertToMultipartFile(pdfFile, pdfName);

            // Appel au service d'upload avec tous les paramètres requis
            uploadService.saveFile(
                    multipartFile,
                    "pdf",                                  // fileType
                    extractFilenameFromUrl(pdfContent.getGeneratedImage().getStorageURL()), // description
                    "application/pdf",                      // contentType
                    null,                                   // url (peut-être null si c'est local)
                    null,                                   // bucketUrl (peut-être null si c'est local)
                    true,                                   // isPublic (ajustez selon vos besoins)
                    null,                                   // userId
                    null                                    // categoryId (ajustez selon vos besoins)
            );

            return multipartFile;
        } catch (Exception e) {
            logger.info("Exception occurred while creating PDF", e );

            throw Exceptions.propagate(e);
        }
    }

    // Méthode helper pour convertir un File en MultipartFile
    private MultipartFile convertToMultipartFile(File file, String filename) throws IOException {
        return new MultipartFile() {
            @Override
            public String getName() {
                return "file";
            }

            @Override
            public String getOriginalFilename() {
                return filename;
            }

            @Override
            public String getContentType() {
                return "application/pdf";
            }

            @Override
            public boolean isEmpty() {
                return file.length() == 0;
            }

            @Override
            public long getSize() {
                return file.length();
            }

            @Override
            public byte[] getBytes() throws IOException {
                return Files.readAllBytes(file.toPath());
            }

            @Override
            public InputStream getInputStream() throws IOException {
                return new FileInputStream(file);
            }

            @Override
            public void transferTo(File dest) throws IOException, IllegalStateException {
                Files.copy(file.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
        };
    }

}
