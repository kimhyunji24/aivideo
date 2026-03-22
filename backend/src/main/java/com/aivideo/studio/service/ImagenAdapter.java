package com.aivideo.studio.service;

import com.aivideo.studio.exception.PolicyBlockedException;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.aiplatform.v1.EndpointName;
import com.google.cloud.aiplatform.v1.PredictResponse;
import com.google.cloud.aiplatform.v1.PredictionServiceClient;
import com.google.cloud.aiplatform.v1.PredictionServiceSettings;
import com.google.protobuf.util.JsonFormat;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.List;

/**
 * Imagen 3 (Vertex AI) 이미지 생성 어댑터
 *
 * 필요 설정 (application-local.yml):
 *   vertex.project-id                  : GCP 프로젝트 ID
 *   vertex.location                    : Vertex AI 지역 (기본값: us-central1)
 *   imagen.model                       : Imagen 모델명
 *   imagen.output-dir                  : 이미지 저장 디렉터리
 *   google.application-credentials     : 서비스 계정 JSON 파일 경로
 */
@Slf4j
@Component
public class ImagenAdapter {

    @Value("${vertex.project-id:default-project-id}")
    private String projectId;

    @Value("${vertex.location:us-central1}")
    private String location;

    @Value("${imagen.model:imagen-3.0-generate-002}")
    private String imagenModel;

    @Value("${imagen.output-dir:${user.home}/aivideo-generated/images}")
    private String outputDir;

    /** 서비스 계정 JSON 경로 — 없으면 ADC(Application Default Credentials) 사용 */
    @Value("${google.application-credentials:#{null}}")
    private String credentialsPath;

    private static final String ENDPOINT_SUFFIX = "-aiplatform.googleapis.com:443";

    /**
     * 프롬프트를 받아 Imagen 3로 이미지를 생성하고, 저장된 파일의 URL 경로를 반환합니다.
     *
     * @param prompt  영어 이미지 생성 프롬프트
     * @param sceneId 씬 식별자 (파일명에 사용)
     * @param seed    일관성을 위한 고정 시드값 (null 가능)
     * @return 저장된 이미지 파일의 URL 경로 (예: /generated-images/scene-1.png)
     */
    public String generateImage(String prompt, String sceneId, Integer seed) {
        return generateImage(prompt, sceneId, seed, List.of());
    }

    /**
     * referenceImages는 현재 프로젝트/리전에서 capability 모델 접근이 열리기 전까지 즉시 실패 처리한다.
     */
    public String generateImage(String prompt, String sceneId, Integer seed, List<String> referenceImageUrls) {
        if (referenceImageUrls != null && !referenceImageUrls.isEmpty()) {
            throw new IllegalArgumentException("referenceImages 요청 실패: capability 모델 접근이 필요합니다.");
        }

        log.info("[Imagen3] 이미지 생성 시작 — sceneId: {}, prompt 길이: {}", sceneId, prompt.length());

        try {
            PredictionServiceSettings settings = buildServiceSettings();

            try (PredictionServiceClient client = PredictionServiceClient.create(settings)) {

                // 엔드포인트 구성
                EndpointName endpointName = EndpointName.ofProjectLocationPublisherModelName(
                        projectId, location, "google", imagenModel
                );

                // 요청 인스턴스 JSON
                String instanceJson = String.format("{\"prompt\": \"%s\"}", escapeJson(prompt));

                // 생성 파라미터 JSON
                // 주의: Vertex AI Imagen 3 (imagen-3.0-generate-001)는 seed 파라미터를 지원하지 않으므로 포함하지 않아야 합니다.
                String parametersJson =
                        "{ \"sampleCount\": 1, \"aspectRatio\": \"16:9\", " +
                        "\"safetyFilterLevel\": \"block_some\", \"personGeneration\": \"allow_adult\" }";

                // Protobuf Value 빌드 (FQCN으로 충돌 회피)
                com.google.protobuf.Value.Builder instanceBuilder = com.google.protobuf.Value.newBuilder();
                JsonFormat.parser().merge(instanceJson, instanceBuilder);
                com.google.protobuf.Value instance = instanceBuilder.build();

                com.google.protobuf.Value.Builder paramBuilder = com.google.protobuf.Value.newBuilder();
                JsonFormat.parser().merge(parametersJson, paramBuilder);
                com.google.protobuf.Value parameters = paramBuilder.build();

                // Vertex AI 예측 호출
                log.info("[Imagen3] Vertex AI 호출 중 — endpoint: {}", endpointName);
                PredictResponse response = client.predict(endpointName, List.of(instance), parameters);

                if (response.getPredictionsList().isEmpty()) {
                    throw new PolicyBlockedException("Imagen3 응답에 이미지 데이터가 없습니다. (safety filter)");
                }

                // Base64 이미지 디코딩
                com.google.protobuf.Value prediction = response.getPredictions(0);
                if (!prediction.hasStructValue()
                        || !prediction.getStructValue().containsFields("bytesBase64Encoded")) {
                    throw new PolicyBlockedException("Imagen3 응답에 이미지 바이트가 없습니다. (safety filter)");
                }
                String base64Image = prediction.getStructValue()
                        .getFieldsOrThrow("bytesBase64Encoded")
                        .getStringValue();
                if (base64Image == null || base64Image.isBlank()) {
                    throw new PolicyBlockedException("Imagen3 응답 이미지 바이트가 비어 있습니다. (safety filter)");
                }

                byte[] imageBytes = Base64.getDecoder().decode(base64Image);
                String savedPath = saveImageToFile(imageBytes, sceneId);

                log.info("[Imagen3] 이미지 생성 완료 — sceneId: {}, 저장경로: {}", sceneId, savedPath);
                return savedPath;
            }

        } catch (PolicyBlockedException e) {
            throw e;
        } catch (Exception e) {
            log.error("[Imagen3] 이미지 생성 실패 — sceneId: {}, 원인: {}", sceneId, e.getMessage(), e);
            throw new RuntimeException("Imagen3 이미지 생성 실패: " + e.getMessage(), e);
        }
    }

    // ─── Private 헬퍼 ────────────────────────────────────────────────────────

    private PredictionServiceSettings buildServiceSettings() throws IOException {
        String endpoint = location + ENDPOINT_SUFFIX;
        GoogleCredentials credentials = loadCredentials();

        return PredictionServiceSettings.newBuilder()
                .setEndpoint(endpoint)
                .setCredentialsProvider(() -> credentials)
                .build();
    }

    /**
     * 인증 우선순위:
     *   1. application-local.yml의 google.application-credentials 경로
     *   2. 환경변수 GOOGLE_APPLICATION_CREDENTIALS (ADC 자동 인식)
     */
    private GoogleCredentials loadCredentials() throws IOException {
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            log.info("[Imagen3] 인증 정보 로드 — 경로: {}", credentialsPath);
            try (FileInputStream fis = new FileInputStream(credentialsPath)) {
                return GoogleCredentials.fromStream(fis)
                        .createScoped("https://www.googleapis.com/auth/cloud-platform");
            }
        }
        log.info("[Imagen3] Application Default Credentials(ADC) 사용");
        return GoogleCredentials.getApplicationDefault()
                .createScoped("https://www.googleapis.com/auth/cloud-platform");
    }

    /** 이미지 바이트 배열을 디스크에 저장하고 웹 접근 URL 경로를 반환합니다. */
    private String saveImageToFile(byte[] imageBytes, String sceneId) throws IOException {
        Path dir = Paths.get(outputDir);
        Files.createDirectories(dir);

        String filename = "scene-" + sceneId + "-" + System.currentTimeMillis() + ".png";
        Path filePath = dir.resolve(filename);
        Files.write(filePath, imageBytes);

        return "/generated-images/" + filename;
    }

    private String escapeJson(String text) {
        return text
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
