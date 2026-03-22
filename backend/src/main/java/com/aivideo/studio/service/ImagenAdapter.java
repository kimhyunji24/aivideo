package com.aivideo.studio.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
@RequiredArgsConstructor
public class ImagenAdapter {
    private final ObjectMapper objectMapper;
    private final WebClient webClient;

    @Value("${vertex.project-id:default-project-id}")
    private String projectId;

    @Value("${vertex.location:us-central1}")
    private String location;

    @Value("${imagen.model:imagen-3.0-capability-001}")
    private String imagenModel;

    @Value("${imagen.fallback-model:imagen-3.0-generate-002}")
    private String fallbackModel;

    @Value("${imagen.output-dir:${user.home}/aivideo-generated/images}")
    private String outputDir;

    /** 서비스 계정 JSON 경로 — 없으면 ADC(Application Default Credentials) 사용 */
    @Value("${google.application-credentials:#{null}}")
    private String credentialsPath;

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

    public String generateImage(String prompt, String sceneId, Integer seed, List<String> referenceImageUrls) {
        log.info("[Imagen3] 이미지 생성 시작 — sceneId: {}, prompt 길이: {}", sceneId, prompt.length());

        try {
            List<Map<String, Object>> referenceImages = buildReferenceImages(referenceImageUrls);
            String selectedModel = selectModel(referenceImages);
            String base64Image = predictViaRest(selectedModel, prompt, referenceImages, seed);
            byte[] imageBytes = Base64.getDecoder().decode(base64Image);
            String savedPath = saveImageToFile(imageBytes, sceneId);
            log.info("[Imagen3] 이미지 생성 완료 — sceneId: {}, 저장경로: {}", sceneId, savedPath);
            return savedPath;

        } catch (Exception e) {
            log.error("[Imagen3] 이미지 생성 실패 — sceneId: {}, 원인: {}", sceneId, e.getMessage(), e);
            throw new RuntimeException("Imagen3 이미지 생성 실패: " + e.getMessage(), e);
        }
    }

    // ─── Private 헬퍼 ────────────────────────────────────────────────────────

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

    private String buildInstanceJson(String prompt, List<Map<String, Object>> referenceImages) throws IOException {
        Map<String, Object> instance = new LinkedHashMap<>();
        instance.put("prompt", withReferenceTokens(prompt, referenceImages));

        if (!referenceImages.isEmpty()) {
            instance.put("referenceImages", referenceImages);
            log.info("[Imagen3] referenceImages 포함 — count: {}", referenceImages.size());
        }

        return objectMapper.writeValueAsString(instance);
    }

    private String predictViaRest(String model, String prompt, List<Map<String, Object>> referenceImages, Integer seed) throws IOException {
        GoogleCredentials credentials = loadCredentials();
        credentials.refreshIfExpired();
        String accessToken = credentials.getAccessToken().getTokenValue();

        String instanceJson = buildInstanceJson(prompt, referenceImages);
        @SuppressWarnings("unchecked")
        Map<String, Object> instance = objectMapper.readValue(instanceJson, Map.class);

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("instances", List.of(instance));
        Map<String, Object> parameters = new LinkedHashMap<>();
        // capability-001은 파라미터 허용 범위가 좁아 최소 파라미터만 전달
        parameters.put("sampleCount", 1);
        parameters.put("addWatermark", false);
        if (seed == null || seed < 0) {
            throw new IllegalArgumentException("seed는 필수이며 0 이상의 정수여야 합니다.");
        }
        parameters.put("seed", seed);
        requestBody.put("parameters", parameters);

        String url = String.format(
                "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:predict",
                location, projectId, location, model
        );
        log.info("[Imagen3] Vertex REST 호출 — model: {}, withRefs: {}", model, !referenceImages.isEmpty());

        String response;
        try {
            response = webClient.post()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
        } catch (Exception e) {
            throw enrichWebClientException(e);
        }

        if (response == null || response.isBlank()) {
            throw new RuntimeException("Imagen3 REST 응답이 비어 있습니다.");
        }

        var root = objectMapper.readTree(response);
        var predictions = root.path("predictions");
        if (!predictions.isArray() || predictions.isEmpty()) {
            throw new RuntimeException("Imagen3 REST 응답에 predictions가 없습니다: " + response);
        }
        String base64Image = predictions.get(0).path("bytesBase64Encoded").asText("");
        if (base64Image.isBlank()) {
            throw new RuntimeException("Imagen3 REST 응답에 bytesBase64Encoded가 없습니다: " + response);
        }
        return base64Image;
    }

    private RuntimeException enrichWebClientException(Exception e) {
        if (e instanceof WebClientResponseException we) {
            String body = we.getResponseBodyAsString();
            String message = String.format(
                    "Vertex predict failed: %d %s, body=%s",
                    we.getRawStatusCode(),
                    we.getStatusText(),
                    body
            );
            return new RuntimeException(message, we);
        }
        return new RuntimeException(e.getMessage(), e);
    }

    private List<Map<String, Object>> buildReferenceImages(List<String> referenceImageUrls) {
        if (referenceImageUrls == null || referenceImageUrls.isEmpty()) {
            return List.of();
        }

        List<Map<String, Object>> refs = new ArrayList<>();
        int idx = 1;
        for (String url : referenceImageUrls) {
            if (url == null || url.isBlank()) continue;
            ParsedDataUrl parsed = parseImageUrl(url.trim());
            if (parsed == null) {
                log.warn("[Imagen3] 지원하지 않는 reference image 형식이라 스킵: {}", shorten(url));
                continue;
            }

            Map<String, Object> ref = new LinkedHashMap<>();
            ref.put("referenceType", "REFERENCE_TYPE_SUBJECT");
            ref.put("referenceId", idx++);
            ref.put("referenceImage", Map.of("bytesBase64Encoded", parsed.base64Data));
            ref.put("subjectImageConfig", Map.of(
                    "subjectType", "SUBJECT_TYPE_DEFAULT",
                    "subjectDescription", "reference subject"
            ));
            refs.add(ref);
            if (refs.size() >= 2) break;
        }
        return refs;
    }

    private String selectModel(List<Map<String, Object>> referenceImages) {
        boolean hasRefs = referenceImages != null && !referenceImages.isEmpty();
        boolean capabilityConfigured = imagenModel != null && imagenModel.contains("capability");
        if (hasRefs || !capabilityConfigured) {
            return imagenModel;
        }
        log.info("[Imagen3] referenceImages가 없어 capability 모델 대신 fallback 모델 사용 — model: {}", fallbackModel);
        return fallbackModel;
    }

    private String withReferenceTokens(String prompt, List<Map<String, Object>> refs) {
        if (prompt == null || prompt.isBlank() || refs == null || refs.isEmpty()) {
            return prompt;
        }
        String normalized = prompt.trim();
        StringBuilder tokenList = new StringBuilder();
        for (Map<String, Object> ref : refs) {
            Object idObj = ref.get("referenceId");
            if (idObj instanceof Number num) {
                String token = "[" + num.intValue() + "]";
                if (!normalized.contains(token)) {
                    if (tokenList.length() > 0) tokenList.append(" ");
                    tokenList.append(token);
                }
            }
        }
        if (tokenList.length() == 0) {
            return normalized;
        }
        String strictRefInstruction;
        if (refs.size() >= 2) {
            strictRefInstruction =
                    "Use reference [1] for the primary subject identity/appearance and [2] for background/environment consistency. " +
                    "If text conflicts with references, ALWAYS follow references. " +
                    "Do not alter subject face, body proportions, key colors, or outfit details from [1].";
        } else {
            strictRefInstruction =
                    "Use reference [1] as the exact source of truth for subject identity and appearance. " +
                    "If text conflicts with reference [1], ALWAYS follow reference [1]. " +
                    "Do not alter subject face, body proportions, key colors, or outfit details from [1].";
        }
        return normalized + " " + strictRefInstruction + " " + tokenList;
    }

    private ParsedDataUrl parseImageUrl(String imageUrl) {
        ParsedDataUrl parsedDataUrl = parseDataUrl(imageUrl);
        if (parsedDataUrl != null) {
            return parsedDataUrl;
        }
        ParsedDataUrl generatedImage = parseGeneratedImageUrl(imageUrl);
        if (generatedImage != null) {
            return generatedImage;
        }
        return parseRemoteImageUrl(imageUrl);
    }

    private ParsedDataUrl parseDataUrl(String dataUrl) {
        if (dataUrl == null || !dataUrl.startsWith("data:image/")) {
            return null;
        }
        int commaIndex = dataUrl.indexOf(',');
        if (commaIndex < 0) return null;
        String meta = dataUrl.substring(5, commaIndex);
        if (!meta.contains(";base64")) return null;
        String base64 = dataUrl.substring(commaIndex + 1).trim();
        if (base64.isBlank()) return null;
        String mime = meta.replace(";base64", "").trim();
        return new ParsedDataUrl(mime, base64);
    }

    private ParsedDataUrl parseGeneratedImageUrl(String imageUrl) {
        if (imageUrl == null || !imageUrl.startsWith("/generated-images/")) {
            return null;
        }
        try {
            String filename = imageUrl.substring("/generated-images/".length());
            Path baseDir = Paths.get(outputDir).toAbsolutePath().normalize();
            Path filePath = baseDir.resolve(filename).normalize();
            if (!filePath.startsWith(baseDir)) {
                log.warn("[Imagen3] reference image 경로 이탈 감지: {}", imageUrl);
                return null;
            }
            if (!Files.exists(filePath)) {
                log.warn("[Imagen3] reference image 파일이 존재하지 않습니다: {}", filePath);
                return null;
            }
            byte[] bytes = Files.readAllBytes(filePath);
            String mimeType = detectMimeType(filePath, bytes);
            String base64 = Base64.getEncoder().encodeToString(bytes);
            return new ParsedDataUrl(mimeType, base64);
        } catch (Exception e) {
            log.warn("[Imagen3] generated-image reference 파싱 실패: {}, cause={}", imageUrl, e.getMessage());
            return null;
        }
    }

    private ParsedDataUrl parseRemoteImageUrl(String imageUrl) {
        if (imageUrl == null || (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://"))) {
            return null;
        }
        try {
            byte[] bytes = webClient.get()
                    .uri(imageUrl)
                    .retrieve()
                    .bodyToMono(byte[].class)
                    .block();
            if (bytes == null || bytes.length == 0) {
                return null;
            }
            String mimeType = detectMimeType(null, bytes);
            String base64 = Base64.getEncoder().encodeToString(bytes);
            return new ParsedDataUrl(mimeType, base64);
        } catch (Exception e) {
            log.warn("[Imagen3] remote reference 파싱 실패: {}, cause={}", imageUrl, e.getMessage());
            return null;
        }
    }

    private String detectMimeType(Path filePath, byte[] bytes) {
        try {
            if (filePath != null) {
                String probed = Files.probeContentType(filePath);
                if (probed != null && probed.startsWith("image/")) {
                    return probed;
                }
            }
        } catch (Exception ignored) {
            // noop
        }

        if (bytes != null && bytes.length >= 8) {
            if (bytes[0] == (byte) 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) {
                return "image/png";
            }
            if (bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8) {
                return "image/jpeg";
            }
            if (bytes.length >= 6) {
                byte[] gif87a = new byte[]{'G', 'I', 'F', '8', '7', 'a'};
                byte[] gif89a = new byte[]{'G', 'I', 'F', '8', '9', 'a'};
                byte[] head = Arrays.copyOf(bytes, 6);
                if (Arrays.equals(head, gif87a) || Arrays.equals(head, gif89a)) {
                    return "image/gif";
                }
            }
        }
        return "image/png";
    }

    private String shorten(String text) {
        if (text == null) return "";
        if (text.length() <= 60) return text;
        return text.substring(0, 57) + "...";
    }

    private record ParsedDataUrl(String mimeType, String base64Data) {}
}
