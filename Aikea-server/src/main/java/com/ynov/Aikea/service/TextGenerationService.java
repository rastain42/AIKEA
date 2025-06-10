package com.ynov.Aikea.service;

import com.ynov.Aikea.dto.GeneratedTextDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TextGenerationService {

    private final OpenAICallsService openAICallsService ;
    String genrationContext = "Tu es agent immobilier et tu t'exprime de la sorte";
    String basePrompt = "Génère la description d'une piece de vie en te basant sur l'image envoyée (en priorité), ou sur le prompt suivant (si tu ne reçois pas d'image): ";
    String basePromptImage = "Génère la description d'une piece (salon, chambre, cuisine, etc.) en te basant sur l'image envoyée";

    public GeneratedTextDTO generateText(String prompt) {
        prompt = basePrompt + prompt;
        String generatedText = openAICallsService.generateWithChatGPT(prompt, genrationContext);
        return GeneratedTextDTO.builder().text(generatedText).build();
    }

    public GeneratedTextDTO generateTextFromImageUrl(String imageUrl) {
        String generatedText = openAICallsService.generateWithChatGPTFromImageURL(basePromptImage, imageUrl, genrationContext);
        return GeneratedTextDTO.builder().text(generatedText).build();
    }

    public GeneratedTextDTO generateTextFromLocalImage(String imagePath) {
        String generatedText = openAICallsService.generateWithChatGPTFromLocalImage(basePromptImage, imagePath, genrationContext);
        return GeneratedTextDTO.builder().text(generatedText).build();
    }
}