package com.ynov.Aikea.service;

import com.ynov.Aikea.atools.QualityEnum;
import com.ynov.Aikea.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
}
