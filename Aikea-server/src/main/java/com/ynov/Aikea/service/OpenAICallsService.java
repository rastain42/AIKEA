package com.ynov.Aikea.service;

import io.github.sashirestela.openai.SimpleOpenAI;
import io.github.sashirestela.openai.common.content.ContentPart.ContentPartText;
import io.github.sashirestela.openai.common.content.ContentPart.ContentPartImageUrl;

import io.github.sashirestela.openai.common.content.ContentPart.ContentPartImageUrl.ImageUrl;
import io.github.sashirestela.openai.domain.chat.ChatMessage.UserMessage;
import io.github.sashirestela.openai.domain.chat.ChatMessage.SystemMessage;
import io.github.sashirestela.openai.domain.chat.ChatRequest;
import io.github.sashirestela.openai.domain.image.ImageRequest;
import io.github.sashirestela.openai.domain.image.ImageResponseFormat;
import io.github.sashirestela.openai.domain.image.Size;
import io.github.sashirestela.openai.support.Base64Util;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.List;
import java.util.concurrent.CompletionException;

@Service
public class OpenAICallsService {

    private final SimpleOpenAI openAI;

    public OpenAICallsService(@Value("${spring.ai.openai.api-key}")
                              String openAiApiKey) {
        openAI = SimpleOpenAI.builder()
                .apiKey(openAiApiKey)
                .build();
    }

    public String generateWithDalle(String prompt){
        var imageRequest = ImageRequest.builder()
                .prompt(prompt)
                .n(1)
                .size(Size.X256)
                .responseFormat(ImageResponseFormat.URL)
                .model("dall-e-2")
                .build();
        var futureImage = openAI.images().create(imageRequest);
        var imageResponse = futureImage.join();
        imageResponse.forEach(img -> System.out.println("\n" + img.getUrl()));

        return imageResponse.getFirst().getUrl() ;
    }

    public String generateWithDalle(ImageRequest imageRequest) throws Exception {
        if (imageRequest.getN() != 1) {
            throw new Exception("Only support Single Image");
        }

        try {
            var futureImage = openAI.images().create(imageRequest);
            var imageResponse = futureImage.join();
            imageResponse.forEach(img -> System.out.println("\n" + img.getUrl()));
            return imageResponse.getFirst().getUrl();
        } catch (CompletionException e) {
            System.err.println("Request failed:");
            if (e.getCause() != null) {
                e.getCause().printStackTrace();
            } else {
                e.printStackTrace();
            }
            throw new Exception("Failed to generate image with DALL·E", e);
        }
    }

    public String generateWithChatGPT(String prompt, String context) {
        var chatRequest = ChatRequest.builder()
                .model("gpt-4o-mini")
                .message(SystemMessage.of(context))
                .message(UserMessage.of(prompt))
                .temperature(0.0)
                .maxCompletionTokens(300)
                .build();
        var futureChat = openAI.chatCompletions().create(chatRequest);
        var chatResponse = futureChat.join();
        return chatResponse.firstContent();
    }

    public String generateWithChatGPTFromImageURL(String prompt, String imageURL, String context) {
        var chatRequest = ChatRequest.builder()
                .model("gpt-4o-mini")
                .messages(List.of(
                                UserMessage.of(List.of(
                                                ContentPartText.of(context),
                                                ContentPartText.of(prompt),
                                                ContentPartImageUrl.of(
                                                        ImageUrl.of(imageURL)
                                                )
                                        )
                                )
                        )
                )
                .temperature(0.0)
                .maxCompletionTokens(300)
                .build();
        var futureChat = openAI.chatCompletions().create(chatRequest);
        var chatResponse = futureChat.join();

        return chatResponse.firstContent();
    }

    public String generateWithChatGPTFromLocalImage(String prompt, String imagePath, String context) {
        var chatRequest = ChatRequest.builder()
                .model("gpt-4o-mini")
                .messages(List.of(
                        UserMessage.of(List.of(
                                ContentPartText.of(context),
                                ContentPartText.of(prompt),
                                ContentPartImageUrl.of(ImageUrl.of(
                                        Base64Util.encode(imagePath, Base64Util.MediaType.IMAGE)))))))
                .temperature(0.0)
                .maxCompletionTokens(500)
                .build();
        var futureChat = openAI.chatCompletions().create(chatRequest);
        var chatResponse = futureChat.join();

        return chatResponse.firstContent();
    }

    public String generateWithChatGPTFromLocalImageRaw(String prompt, byte[] imageBytes, String context) {

        // Encode the image bytes to Base64
        String base64Image = Base64.getEncoder().encodeToString(imageBytes);

        var chatRequest = ChatRequest.builder()
                .model("gpt-4o-mini")
                .messages(List.of(
                        UserMessage.of(List.of(
                                ContentPartText.of(context),
                                ContentPartText.of(prompt),
                                ContentPartImageUrl.of(
                                        ImageUrl.of(base64Image)
                                )))))
                .temperature(0.0)
                .maxCompletionTokens(500)
                .build();
        var futureChat = openAI.chatCompletions().create(chatRequest);
        var chatResponse = futureChat.join();

        return chatResponse.firstContent();
    }
}
