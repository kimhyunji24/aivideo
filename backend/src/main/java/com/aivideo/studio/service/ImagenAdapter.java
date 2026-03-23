package com.aivideo.studio.service;

import com.aivideo.studio.exception.PolicyBlockedException;
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

import com.google.cloud.aiplatform.v1.EndpointName;
import com.google.cloud.aiplatform.v1.PredictResponse;
import com.google.cloud.aiplatform.v1.PredictionServiceClient;
import com.google.cloud.aiplatform.v1.PredictionServiceSettings;
import com.google.protobuf.util.JsonFormat;

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

    @Value("${imagen.mock-mode:false}")
    private boolean mockMode;

    @Value("${imagen.mock-image-url:#{null}}")
    private String mockImageUrl;

    /**
     * 프롬프트를 받아 Imagen 3로 이미지를 생성하고, 저장된 파일의 URL 경로를 반환합니다.
     *
     * @param prompt  영어 이미지 생성 프롬프트
     * @param sceneId 씬 식별자 (파일명에 사용)
     * @param seed    일관성을 위한 고정 시드값 (null 가능)
     * @return 저장된 이미지 파일의 URL 경로 (예: /generated-images/scene-1.png)
     */
    public String generateImage(String prompt, String sceneId, Integer seed) {
        return generateImage(prompt, sceneId, seed, List.of(), List.of());
    }

    public String generateImage(String prompt, String sceneId, Integer seed, List<String> referenceImageUrls) {
        return generateImage(prompt, sceneId, seed, referenceImageUrls, List.of());
    }

    /**
     * 캐릭터 외형 묘사(appearance) 목록을 함께 받아 레퍼런스 이미지의 subjectDescription에 반영합니다.
     *
     * @param appearanceDescriptions referenceImageUrls와 순서가 대응되는 영어 외형 묘사 목록
     */
    public String generateImage(String prompt, String sceneId, Integer seed, List<String> referenceImageUrls, List<String> appearanceDescriptions) {
        return generateImage(prompt, sceneId, seed, referenceImageUrls, appearanceDescriptions, true);
    }

    /**
     * strictIdentity=false 시: 레퍼런스는 얼굴/외형 참조에만 사용하고 포즈/동작은 텍스트 프롬프트를 우선합니다.
     * 자세 변경 등 포즈 재생성에 사용하세요.
     */
    public String generateImage(String prompt, String sceneId, Integer seed, List<String> referenceImageUrls, List<String> appearanceDescriptions, boolean strictIdentity) {
        log.info("[Imagen3] 이미지 생성 시작 — sceneId: {}, prompt 길이: {}, strictIdentity: {}", sceneId, prompt.length(), strictIdentity);

        try {
            List<Map<String, Object>> referenceImages = buildReferenceImages(referenceImageUrls, appearanceDescriptions);
            String selectedModel = selectModel(referenceImages);
            String base64Image = predictViaRest(selectedModel, prompt, referenceImages, seed, strictIdentity);
            byte[] imageBytes = Base64.getDecoder().decode(base64Image);
            String savedPath = saveImageToFile(imageBytes, sceneId);
            log.info("[Imagen3] 이미지 생성 완료 — sceneId: {}, 저장경로: {}", sceneId, savedPath);
            return savedPath;

        } catch (PolicyBlockedException e) {
            throw e;
        } catch (Exception e) {
            log.error("[Imagen3] 이미지 생성 실패 — sceneId: {}, 원인: {}", sceneId, e.getMessage(), e);
            throw new RuntimeException("Imagen3 이미지 생성 실패: " + e.getMessage(), e);
        }
    }

    /**
     * 프롬프트, 원본 이미지 URL, 마스크 이미지 Base64를 받아 Imagen 3로 인페인팅(Inpainting)을 수행합니다.
     */
    public String editImage(String prompt, String targetImageUrl, String maskImageBase64, String sceneId) {
        if (mockMode) {
            log.info("[Mock] Imagen 이미지 인페인팅을 스킵합니다. Mock URL 반환");
            return (mockImageUrl != null && !mockImageUrl.isBlank())
                    ? mockImageUrl
                    : "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80";
        }

        log.info("[Imagen3] 이미지 인페인팅 시작 — sceneId: {}, prompt 기재 유무: {}", sceneId, prompt != null && !prompt.isBlank());

        try {
            // 원본 이미지 로드
            String filename = targetImageUrl.substring(targetImageUrl.lastIndexOf('/') + 1);
            Path filePath = Paths.get(outputDir).resolve(filename);
            byte[] baseImageBytes = Files.readAllBytes(filePath);
            String baseImageBase64 = Base64.getEncoder().encodeToString(baseImageBytes);

            GoogleCredentials credentials = loadCredentials();
            credentials.refreshIfExpired();
            String accessToken = credentials.getAccessToken().getTokenValue();

            // imagen-3.0-capability-001 referenceImages inpainting format
            Map<String, Object> instance = new LinkedHashMap<>();
            if (prompt != null && !prompt.isBlank()) {
                instance.put("prompt", prompt.trim());
            }

            Map<String, Object> rawRef = new LinkedHashMap<>();
            rawRef.put("referenceType", "REFERENCE_TYPE_RAW");
            rawRef.put("referenceId", 1);
            rawRef.put("referenceImage", Map.of("bytesBase64Encoded", baseImageBase64));

            Map<String, Object> maskRef = new LinkedHashMap<>();
            maskRef.put("referenceType", "REFERENCE_TYPE_MASK");
            maskRef.put("referenceId", 2);
            maskRef.put("referenceImage", Map.of("bytesBase64Encoded", maskImageBase64));
            maskRef.put("maskImageConfig", Map.of("maskMode", "MASK_MODE_USER_PROVIDED"));

            instance.put("referenceImages", List.of(rawRef, maskRef));

            Map<String, Object> parameters = new LinkedHashMap<>();
            parameters.put("editMode", "EDIT_MODE_INPAINT_INSERTION");
            parameters.put("sampleCount", 1);

            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("instances", List.of(instance));
            requestBody.put("parameters", parameters);

            String url = String.format(
                    "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/imagen-3.0-capability-001:predict",
                    location, projectId, location
            );

            log.info("[Imagen3] Vertex AI Edit REST 호출 중 — URL: {}", url);

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
                if ("{}".equals(response.trim())) {
                    throw new RuntimeException("구글 안전 필터 차단: 정책에 의해 편집이 차단되었습니다.");
                }
                throw new RuntimeException("Imagen3 REST 응답에 predictions가 없습니다: " + response);
            }
            String resultBase64 = predictions.get(0).path("bytesBase64Encoded").asText("");
            if (resultBase64.isBlank()) {
                throw new RuntimeException("Imagen3 REST 응답에 bytesBase64Encoded가 없습니다.");
            }

            byte[] imageBytes = Base64.getDecoder().decode(resultBase64);
            String savedPath = saveImageToFile(imageBytes, sceneId + "-edited");

            log.info("[Imagen3] 이미지 인페인팅 완료 — 저장경로: {}", savedPath);
            return savedPath;

        } catch (PolicyBlockedException e) {
            throw e;
        } catch (Exception e) {
            log.error("[Imagen3] 이미지 인페인팅 실패 — sceneId: {}, 원인: {}", sceneId, e.getMessage(), e);
            throw new RuntimeException("Imagen3 이미지 인페인팅 실패: " + e.getMessage(), e);
        }
    }

    // ─── Private 헬퍼 ────────────────────────────────────────────────────────

    private String escapeJson(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    private PredictionServiceSettings buildServiceSettings() throws IOException {
        PredictionServiceSettings.Builder builder = PredictionServiceSettings.newBuilder()
                .setEndpoint(location + "-aiplatform.googleapis.com:443");
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            try (FileInputStream fis = new FileInputStream(credentialsPath)) {
                builder.setCredentialsProvider(() -> GoogleCredentials.fromStream(fis)
                        .createScoped("https://www.googleapis.com/auth/cloud-platform"));
            }
        } else {
            builder.setCredentialsProvider(() -> GoogleCredentials.getApplicationDefault()
                    .createScoped("https://www.googleapis.com/auth/cloud-platform"));
        }
        return builder.build();
    }

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
        return buildInstanceJson(prompt, referenceImages, true);
    }

    private String buildInstanceJson(String prompt, List<Map<String, Object>> referenceImages, boolean strictIdentity) throws IOException {
        Map<String, Object> instance = new LinkedHashMap<>();
        instance.put("prompt", withReferenceTokens(prompt, referenceImages, strictIdentity));

        if (!referenceImages.isEmpty()) {
            instance.put("referenceImages", referenceImages);
            log.info("[Imagen3] referenceImages 포함 — count: {}", referenceImages.size());
        }

        return objectMapper.writeValueAsString(instance);
    }

    private String predictViaRest(String model, String prompt, List<Map<String, Object>> referenceImages, Integer seed) throws IOException {
        return predictViaRest(model, prompt, referenceImages, seed, true);
    }

    private String predictViaRest(String model, String prompt, List<Map<String, Object>> referenceImages, Integer seed, boolean strictIdentity) throws IOException {
        GoogleCredentials credentials = loadCredentials();
        credentials.refreshIfExpired();
        String accessToken = credentials.getAccessToken().getTokenValue();

        String instanceJson = buildInstanceJson(prompt, referenceImages, strictIdentity);
        Map<String, Object> instance = new LinkedHashMap<>(objectMapper.readValue(instanceJson, Map.class));
        if (referenceImages != null && !referenceImages.isEmpty()) {
            // Google Imagen 3 requires 'referenceImages' (or 'referenceImage' in older versions) at the instance level.
            instance.put("referenceImages", referenceImages);
        }

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("instances", List.of(instance));
        Map<String, Object> parameters = new LinkedHashMap<>();
        // capability-001은 파라미터 허용 범위가 좁아 최소 파라미터만 전달
        parameters.put("sampleCount", 1);
        // addWatermark: false 는 특정 권한(Allowlisting)이 없으면 400 오류를 유발하므로 제거하고 기본값(true) 사용
        // parameters.put("addWatermark", false);
        parameters.put("personGeneration", "ALLOW_ADULT"); // 인물 생성 차단 우회 보호장치
        
        // 워터마크가 활성화된 상태(addWatermark 옵션 사용 불가 시 기본값 true)에서는
        // Google Imagen 3 API가 seed 파라미터를 지원하지 않아 400 에러를 뱉습니다. 
        // 따라서 seed 파라미터 전달을 생략하고 레퍼런스 이미지(Reference Subject)만으로 일관성을 유지합니다.
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
            if ("{}".equals(response.trim())) {
                throw new RuntimeException("구글 안전 필터 차단: 프롬프트 또는 업로드한 사진(저작권, 실존 인물 등)이 모델 정책에 의해 차단되어 빈 응답({})이 반환되었습니다. 다른 사진이나 내용으로 시도해주세요.");
            }
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
        return buildReferenceImages(referenceImageUrls, List.of());
    }

    /**
     * 레퍼런스 이미지 목록과 대응되는 캐릭터 외형 묘사(appearance) 목록을 받아 Imagen referenceImages 페이로드를 구성합니다.
     * appearanceDescriptions가 비어 있거나 인덱스에 값이 없을 경우 빈 description으로 대체합니다.
     *
     * @param referenceImageUrls     레퍼런스 이미지 URL 목록 (data URL, /generated-images/..., https://...)
     * @param appearanceDescriptions 각 이미지에 대응되는 캐릭터 외형 묘사 (영어 권장)
     */
    public List<Map<String, Object>> buildReferenceImages(List<String> referenceImageUrls, List<String> appearanceDescriptions) {
        if (referenceImageUrls == null || referenceImageUrls.isEmpty()) {
            return List.of();
        }

        List<Map<String, Object>> refs = new ArrayList<>();
        int idx = 1;
        for (int i = 0; i < referenceImageUrls.size(); i++) {
            String url = referenceImageUrls.get(i);
            if (url == null || url.isBlank()) continue;
            ParsedDataUrl parsed = parseImageUrl(url.trim());
            if (parsed == null) {
                log.warn("[Imagen3] 지원하지 않는 reference image 형식이라 스킵: {}", shorten(url));
                continue;
            }

            // 캐릭터 외형 묘사를 subjectDescription으로 활용 (없으면 간략한 기본값 사용)
            String appearance = (appearanceDescriptions != null && i < appearanceDescriptions.size())
                    ? appearanceDescriptions.get(i)
                    : null;
            String subjectDesc = (appearance != null && !appearance.isBlank())
                    ? shorten(appearance, 200)
                    : "reference subject " + idx;

            Map<String, Object> ref = new LinkedHashMap<>();
            ref.put("referenceType", "REFERENCE_TYPE_SUBJECT");
            ref.put("referenceId", idx++);
            ref.put("referenceImage", Map.of("bytesBase64Encoded", parsed.base64Data));
            ref.put("subjectImageConfig", Map.of(
                    "subjectType", "SUBJECT_TYPE_PERSON",
                    "subjectDescription", subjectDesc
            ));
            refs.add(ref);
            if (refs.size() >= 4) break;
        }
        return refs;
    }

    private String selectModel(List<Map<String, Object>> referenceImages) {
        boolean hasRefs = referenceImages != null && !referenceImages.isEmpty();
        if (hasRefs) {
            // Subject Reference는 capability 모델만 지원
            String capModel = (imagenModel != null && imagenModel.contains("capability"))
                    ? imagenModel : "imagen-3.0-capability-001";
            log.info("[Imagen3] referenceImages 있음 — capability 모델 사용: {}", capModel);
            return capModel;
        }
        // 레퍼런스 없으면 generate 모델 사용 (빠르고 저렴)
        String genModel = (imagenModel != null && imagenModel.contains("generate"))
                ? imagenModel : fallbackModel;
        log.info("[Imagen3] referenceImages 없음 — generate 모델 사용: {}", genModel);
        return genModel;
    }

    private String withReferenceTokens(String prompt, List<Map<String, Object>> refs) {
        return withReferenceTokens(prompt, refs, true);
    }

    private String withReferenceTokens(String prompt, List<Map<String, Object>> refs, boolean strictIdentity) {
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
        String refInstruction;
        if (strictIdentity) {
            // 씬 간 캐릭터 일관성용 — 레퍼런스가 텍스트보다 우선
            refInstruction = refs.size() >= 2
                    ? "PRIMARY IDENTITY LOCK — reference [1] is the immutable anchor across ALL scenes. " +
                      "All panels MUST exactly replicate face geometry, hair color/length/style, skin tone, eye shape/color, " +
                      "and outfit (color, texture, cut, accessories) from reference [1]. " +
                      "Use reference [2] only as continuity/background support. " +
                      "Any deviation from these references is a CRITICAL failure. " +
                      "If text description conflicts with references, ALWAYS follow references."
                    : "PRIMARY IDENTITY LOCK — reference [1] is immutable across ALL scenes. " +
                      "Every panel MUST exactly reproduce face geometry, hair color/length/style, skin tone, eye shape/color, " +
                      "and exact outfit (color, texture, cut, accessories) from reference [1]. " +
                      "Any deviation from reference [1] is a CRITICAL failure. " +
                      "If text conflicts with reference [1], ALWAYS follow reference [1].";
        } else {
            // 자세/동작 변경용 — 얼굴·외형·그림체만 참조, 포즈는 텍스트 우선
            refInstruction = "IDENTITY AND STYLE REFERENCE ONLY — use reference [1] to match: " +
                    "face structure, skin tone, eye color and shape, hair color and style, outfit appearance, " +
                    "art style, rendering style, and background environment. " +
                    "CRITICAL: Do NOT replicate the body pose or arm positions from reference [1]. " +
                    "The limbs and body must be fully replaced by the pose described in the text prompt. " +
                    "This avoids duplicate limbs. " +
                    "Text prompt takes absolute priority for body pose; reference takes priority for face, appearance, style, and background.";
        }
        return refInstruction + " " + tokenList + " " + normalized;
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
        return shorten(text, 60);
    }

    private String shorten(String text, int maxLen) {
        if (text == null) return "";
        if (text.length() <= maxLen) return text;
        return text.substring(0, maxLen - 3) + "...";
    }

    private record ParsedDataUrl(String mimeType, String base64Data) {}
}
