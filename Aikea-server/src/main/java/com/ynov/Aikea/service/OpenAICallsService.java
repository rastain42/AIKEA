package com.ynov.Aikea.service;

import io.github.sashirestela.openai.SimpleOpenAI;
import io.github.sashirestela.openai.domain.image.ImageRequest;
import io.github.sashirestela.openai.domain.image.ImageResponseFormat;
import io.github.sashirestela.openai.domain.image.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
        imageResponse.stream().forEach(img -> System.out.println("\n" + img.getUrl()));

        return imageResponse.get(0).getUrl() ;
    }

    public String generateWithDalle(ImageRequest imageRequest) throws Exception {
        if (imageRequest.getN() != 1) {
            throw new Exception("Only support Single Image");
        }

        try {
            var futureImage = openAI.images().create(imageRequest);
            var imageResponse = futureImage.join();
            imageResponse.stream().forEach(img -> System.out.println("\n" + img.getUrl()));
            return imageResponse.get(0).getUrl();
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

}
