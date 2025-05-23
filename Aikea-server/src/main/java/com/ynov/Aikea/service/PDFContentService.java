package com.ynov.Aikea.service;

import com.lowagie.text.Document;
import com.lowagie.text.Image;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import com.ynov.Aikea.atools.QualityEnum;
import com.ynov.Aikea.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@RequiredArgsConstructor
@Service
public class PDFContentService {

    private final ImageGenerationService imageGenerationService;
    private final TextGenerationService textGenerationService;

    public PDFContentDTO generatePDFContent(ImageGenerationRequest imageGenerationRequest) throws Exception {

        GeneratedImageDTO generatedImage = imageGenerationService.generateAndSaveImage(imageGenerationRequest.getPrompt(), QualityEnum.valueOf(imageGenerationRequest.getQuality()));
        GeneratedTextDTO generatedText = textGenerationService.generateTextFromImageUrl(generatedImage.getStorageURL());

        PDFContentDTO pdfContent = new PDFContentDTO();
        pdfContent.setGeneratedText(generatedText);
        pdfContent.setGeneratedImage(generatedImage);

        return pdfContent;
    }

    public String createPDF(PDFContentDTO pdfContent) throws FileNotFoundException {

        String pdfDir = "src/main/resources/pdf/";
        String externalID = pdfContent.getGeneratedImage().getExternalID();
        String pdfName = externalID.substring(externalID.lastIndexOf('/') + 1) + ".pdf";
        String pdfPath = pdfDir + pdfName;

        try {
            // Créer le dossier si besoin
            Files.createDirectories(Path.of(pdfDir));

            // Générer le PDF localement
            Document document = new Document();
            PdfWriter.getInstance(document, new FileOutputStream(pdfPath));
            document.open();
            document.add(new Paragraph(pdfContent.getGeneratedText().getText()));
            Image image = Image.getInstance(pdfContent.getGeneratedImage().getStorageURL());
            document.add(image);
            document.close();

            return pdfPath;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}
