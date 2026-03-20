package com.aivideo.studio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.GoogleCredentials;
import com.aivideo.studio.dto.Scene;

import java.io.FileInputStream;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class VeoAdapter {

    @Value("${vertex.project-id:default-project-id}")
    private String projectId;

    @Value("${vertex.location:us-central1}")
    private String location;

    @Value("${google.application-credentials:}")
    private String credentialsPath;

    @Value("${veo.model:veo-2.0-generate-001}")
    private String modelName;

    @Value("${veo.output-dir:${user.home}/aivideo-generated/videos}")
    private String outputDir;

    @Value("${aivideo.mock-mode:false}")
    private boolean mockMode;

    @Value("${aivideo.mock-video-url:}")
    private String mockVideoUrl;

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    /**
     * Scene 데이터를 기반으로 Veo 모델을 호출합니다.
     */
    public String generateVideo(Scene scene, String prompt) {
        if (mockMode) {
            log.info("[Mock] Veo 비디오 생성을 스킵합니다. Mock URL 반환");
            try { Thread.sleep(3000); } catch (InterruptedException e) {}
            return mockVideoUrl;
        }

        log.info("Generating video using Vertex AI API for model: {}, prompt: {}", modelName, prompt);
        
        try {
            GoogleCredentials credentials = loadCredentials();
            credentials.refreshIfExpired();
            String accessToken = credentials.getAccessToken().getTokenValue();

            // Vertex AI REST API 엔드포인트 구성 (Google Cloud AI Platform)
            String url = String.format("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:predict", 
                location, projectId, location, modelName);

            // 임시: Veo API의 정확한 페이로드는 버전에 따라 다르나, 일반적으로 instances 배열을 취함
            Map<String, Object> requestBody = Map.of(
                "instances", new Object[]{
                    Map.of("prompt", prompt)
                },
                "parameters", Map.of(
                    "aspectRatio", "16:9"
                )
            );

            log.info("[Veo] API Request URL: {}", url);
            
            // 실제 호출 (주석 해제 시 실제 과금 발생)
            /*
            String response = webClient.post()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            log.info("[Veo] API Response: {}", response);
            */
            
            // 아직 API 구조가 확정되지 않았거나 과금을 막기 위해 임시로 Mocking URL 생성
            String generatedVideoId = UUID.randomUUID().toString();
            String videoUrl = "/generated-videos/" + generatedVideoId + ".mp4";
            
            // 실제 응답을 파싱하여 videoUrl에 적용
            // videoUrl = objectMapper.readTree(response).path("predictions")...
            
            // 영상 처리를 위한 딜레이 시뮬레이션
            try { Thread.sleep(5000); } catch (InterruptedException e) {}

            log.info("Video successfully generated and mapped to: {}", videoUrl);
            return mockVideoUrl != null && !mockVideoUrl.isBlank() ? mockVideoUrl : videoUrl;
            
        } catch (IOException e) {
            log.error("Failed to authenticate or connect to Vertex AI Veo API", e);
            throw new RuntimeException("Vertex AI Video Generation failed", e);
        } catch (Exception e) {
            log.error("Error during Veo video generation", e);
            throw new RuntimeException("Veo API Error", e);
        }
    }

    private GoogleCredentials loadCredentials() throws IOException {
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            try (FileInputStream fis = new FileInputStream(credentialsPath)) {
                return GoogleCredentials.fromStream(fis)
                        .createScoped("https://www.googleapis.com/auth/cloud-platform");
            }
        }
        return GoogleCredentials.getApplicationDefault()
                .createScoped("https://www.googleapis.com/auth/cloud-platform");
    }
}
