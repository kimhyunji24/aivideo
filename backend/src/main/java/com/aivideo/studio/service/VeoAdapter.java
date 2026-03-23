package com.aivideo.studio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.google.auth.oauth2.GoogleCredentials;
import com.aivideo.studio.dto.Scene;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Base64;

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

    @Value("${veo.model:veo-3.1-generate-preview}")
    private String modelName;

    @Value("${veo.output-dir:${user.home}/aivideo-generated/videos}")
    private String outputDir;

    @Value("${veo.storage-uri:}")
    private String veoStorageUri;

    @Value("${veo.duration-seconds:4}")
    private int durationSeconds;

    @Value("${veo.poll-interval-ms:10000}")
    private long pollIntervalMs;

    @Value("${veo.poll-timeout-ms:600000}")
    private long pollTimeoutMs;

    @Value("${imagen.output-dir:${user.home}/aivideo-generated/images}")
    private String imagenOutputDir;

    @Value("${aivideo.frontend-base-url:http://localhost:3000}")
    private String frontendBaseUrl;

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public String generateVideo(Scene scene, String prompt) {
        return generateVideo(scene, prompt, List.of(), null, null);
    }

    /**
     * Scene 데이터를 기반으로 Veo 모델을 호출합니다.
     *
     * @param referenceImageUrls 참조 이미지 URL 목록 (최대 3개)
     * @param firstFrameUrl      시작 프레임 이미지 URL
     * @param lastFrameUrl       마지막 프레임 이미지 URL
     */
    public String generateVideo(
            Scene scene,
            String prompt,
            List<String> referenceImageUrls,
            String firstFrameUrl,
            String lastFrameUrl
    ) {
        List<String> refs = sanitizeReferenceImages(referenceImageUrls);
        String first = normalizeImageUrl(firstFrameUrl);
        String last = normalizeImageUrl(lastFrameUrl);
        if (first != null && last != null && first.equals(last)) {
            // 동일 이미지를 첫/마지막 프레임으로 동시에 넣으면 모델이 한 장면으로 수렴하는 경우가 많아 마지막 프레임 제약은 제거한다.
            log.info("[Veo] firstFrame and lastFrame are identical. Dropping lastFrame constraint.");
            last = null;
        }

        if (!isVeo3Model()) {
            if (!refs.isEmpty()) {
                log.warn("[Veo] Older Veo model does not support referenceImages. Ignoring them.");
                refs = List.of();
            }
            if (last != null) {
                log.warn("[Veo] Older Veo model does not support lastFrame. Ignoring it.");
                last = null;
            }
        }
        validateStorageUri();

        log.info("[Veo] video generation start - model: {}, refs: {}, firstFrame: {}, lastFrame: {}",
                modelName, refs.size(), first != null, last != null);
        
        try {
            GoogleCredentials credentials = loadCredentials();
            credentials.refreshIfExpired();
            String accessToken = credentials.getAccessToken().getTokenValue();

            String operationName = requestVideoGeneration(accessToken, prompt, refs, first, last);
            JsonNode operation = pollOperationUntilDone(accessToken, operationName);
            String videoUri = extractVideoUri(operation);
            log.info("[Veo] video generation completed - operation: {}, videoUri: {}", operationName, videoUri);
            return videoUri;

        } catch (IOException e) {
            log.error("Failed to authenticate or connect to Vertex AI Veo API", e);
            throw new RuntimeException("Vertex AI Video Generation failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Veo API polling interrupted", e);
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

    private Map<String, Object> buildVideoRequestBody(
            String prompt,
            List<String> referenceImageUrls,
            String firstFrameUrl,
            String lastFrameUrl
    ) throws IOException {
        Map<String, Object> instance = new LinkedHashMap<>();
        instance.put("prompt", prompt);
        Map<String, Object> firstFrameImage = resolveImageInput(firstFrameUrl);
        if (firstFrameImage != null) {
            instance.put("image", firstFrameImage);
        }

        if (!referenceImageUrls.isEmpty()) {
            List<Map<String, Object>> refs = new ArrayList<>();
            for (String imageUrl : referenceImageUrls) {
                Map<String, Object> image = resolveImageInput(imageUrl);
                if (image == null) {
                    continue;
                }
                refs.add(Map.of(
                        "referenceType", "REFERENCE_TYPE_SUBJECT",
                        "referenceId", "asset-" + (refs.size() + 1),
                        "referenceImage", image
                ));
            }
            if (!refs.isEmpty()) {
                instance.put("referenceImages", refs);
            }
        }

        Map<String, Object> lastFrameImage = resolveImageInput(lastFrameUrl);
        if (lastFrameImage != null) {
            instance.put("lastFrame", lastFrameImage);
        }

        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("aspectRatio", "16:9");
        parameters.put("resolution", "720p"); // 해상도 720p 고정 (사용자 요청)
        parameters.put("sampleCount", 1);
        parameters.put("durationSeconds", normalizeDurationSeconds(durationSeconds));
        parameters.put("storageUri", veoStorageUri);

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("instances", List.of(instance));
        requestBody.put("parameters", parameters);
        return requestBody;
    }

    private List<String> sanitizeReferenceImages(List<String> referenceImageUrls) {
        if (referenceImageUrls == null || referenceImageUrls.isEmpty()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (String url : referenceImageUrls) {
            String normalized = normalizeImageUrl(url);
            if (normalized == null) continue;
            if (!result.contains(normalized)) {
                result.add(normalized);
            }
            if (result.size() >= 3) {
                break;
            }
        }
        return result;
    }

    private String normalizeImageUrl(String url) {
        if (url == null) return null;
        String trimmed = url.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isVeo3Model() {
        return modelName != null && modelName.startsWith("veo-3");
    }

    private String requestVideoGeneration(
            String accessToken,
            String prompt,
            List<String> referenceImageUrls,
            String firstFrameUrl,
            String lastFrameUrl
    ) throws IOException {
        String url = String.format(
                "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:predictLongRunning",
                location, projectId, location, modelName
        );

        Map<String, Object> requestBody = buildVideoRequestBody(prompt, referenceImageUrls, firstFrameUrl, lastFrameUrl);
        log.info("[Veo] Request URL: {}", url);
        log.debug("[Veo] Request Body: {}", objectMapper.writeValueAsString(requestBody));

        String responseBody = webClient.post()
                .uri(url)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .onStatus(status -> status.isError(), clientResponse ->
                        clientResponse.bodyToMono(String.class)
                                .map(body -> new RuntimeException("Veo predictLongRunning error "
                                        + clientResponse.statusCode() + ": " + body)))
                .bodyToMono(String.class)
                .block();

        JsonNode root = objectMapper.readTree(responseBody);
        String operationName = root.path("name").asText(null);
        if (operationName == null || operationName.isBlank()) {
            throw new RuntimeException("Veo response missing operation name: " + responseBody);
        }
        return operationName;
    }

    private JsonNode pollOperationUntilDone(String accessToken, String operationName) throws IOException, InterruptedException {
        String url = String.format(
                "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:fetchPredictOperation",
                location, projectId, location, modelName
        );
        long startedAt = System.currentTimeMillis();
        while (true) {
            String responseBody = webClient.post()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("operationName", operationName))
                    .retrieve()
                    .onStatus(status -> status.isError(), clientResponse ->
                            clientResponse.bodyToMono(String.class)
                                    .map(body -> new RuntimeException("Veo fetchPredictOperation error "
                                            + clientResponse.statusCode() + ": " + body)))
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = objectMapper.readTree(responseBody);
            if (root.path("done").asBoolean(false)) {
                if (root.has("error")) {
                    String errorMsg = root.path("error").toString();
                    if (errorMsg.contains("sensitive words that violate Google's Responsible AI practices")) {
                        throw new RuntimeException("구글 안전 필터 차단: 번역된 비디오 프롬프트에 구글 정책(폭력, 선정성 등)에 위배되는 민감한 단어가 포함되어 영상 생성이 차단되었습니다. 기획 대본이나 로그라인을 더 부드럽고 건전한 단어로 수정해 주세요.");
                    }
                    throw new RuntimeException("Veo operation failed: " + errorMsg);
                }
                return root;
            }

            if (System.currentTimeMillis() - startedAt > pollTimeoutMs) {
                throw new RuntimeException("Veo operation polling timeout after " + pollTimeoutMs + "ms");
            }
            Thread.sleep(pollIntervalMs);
        }
    }

    private String extractVideoUri(JsonNode operation) {
        JsonNode videos = operation.path("response").path("videos");
        if (!videos.isArray() || videos.isEmpty()) {
            throw new RuntimeException("Veo operation completed but no videos were returned: " + operation.toString());
        }
        JsonNode firstVideo = videos.get(0);
        String gcsUri = firstVideo.path("gcsUri").asText(null);
        if (gcsUri != null && !gcsUri.isBlank()) {
            return toHttpUrlIfGsUri(gcsUri);
        }
        String uri = firstVideo.path("uri").asText(null);
        if (uri != null && !uri.isBlank()) {
            return uri;
        }
        throw new RuntimeException("Veo response video URI is missing: " + firstVideo.toString());
    }

    private String toHttpUrlIfGsUri(String uri) {
        if (uri == null || !uri.startsWith("gs://")) {
            return uri;
        }
        String withoutScheme = uri.substring("gs://".length());
        int slashIndex = withoutScheme.indexOf('/');
        if (slashIndex < 0) {
            return uri;
        }
        String bucket = withoutScheme.substring(0, slashIndex);
        String object = withoutScheme.substring(slashIndex + 1);
        if (bucket.isBlank() || object.isBlank()) {
            return uri;
        }
        return "https://storage.googleapis.com/" + bucket + "/" + object;
    }

    public ResponseEntity<byte[]> fetchVideoBinary(String videoUrl) throws IOException {
        String normalized = normalizeImageUrl(videoUrl);
        if (normalized == null) {
            throw new IllegalArgumentException("비디오 URL이 비어 있습니다.");
        }

        String fetchUrl = normalized.startsWith("gs://")
                ? toHttpUrlIfGsUri(normalized)
                : normalized;

        boolean needsAuth = isGoogleStorageUrl(fetchUrl);
        WebClient.RequestHeadersSpec<?> request = webClient.get()
                .uri(fetchUrl)
                .accept(MediaType.parseMediaType("video/mp4"), MediaType.ALL);

        if (needsAuth) {
            GoogleCredentials credentials = loadCredentials();
            credentials.refreshIfExpired();
            String accessToken = credentials.getAccessToken().getTokenValue();
            request = request.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
        }

        ResponseEntity<byte[]> entity = request
                .retrieve()
                .toEntity(byte[].class)
                .block();

        if (entity == null || entity.getBody() == null || entity.getBody().length == 0) {
            throw new IllegalStateException("비디오 데이터를 불러오지 못했습니다: " + fetchUrl);
        }
        return entity;
    }

    private boolean isGoogleStorageUrl(String url) {
        if (url == null || url.isBlank()) return false;
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host == null) return false;
            return host.equals("storage.googleapis.com")
                    || host.equals("storage.cloud.google.com")
                    || host.endsWith(".storage.googleapis.com")
                    || host.endsWith(".googleapis.com");
        } catch (Exception e) {
            return url.contains("storage.googleapis.com") || url.contains("googleapis.com");
        }
    }

    private Map<String, Object> resolveImageInput(String imageRef) throws IOException {
        String normalized = normalizeImageUrl(imageRef);
        if (normalized == null) {
            return null;
        }
        if (normalized.startsWith("gs://")) {
            return Map.of("gcsUri", normalized);
        }
        if (normalized.startsWith("data:image/")) {
            return parseDataUrl(normalized);
        }
        if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
            return loadImageAsBase64FromHttpUrl(normalized);
        }

        String generatedPath = extractGeneratedImagePath(normalized);
        if (generatedPath != null) {
            return loadImageAsBase64FromGeneratedDir(generatedPath);
        }
        if (normalized.startsWith("/")) {
            String base = (frontendBaseUrl == null || frontendBaseUrl.isBlank())
                    ? "http://localhost:3000"
                    : frontendBaseUrl.replaceAll("/+$", "");
            return loadImageAsBase64FromHttpUrl(base + normalized);
        }

        log.warn("[Veo] Unsupported image reference type, skipping: {}", normalized);
        return null;
    }

    private Map<String, Object> parseDataUrl(String dataUrl) {
        int commaIndex = dataUrl.indexOf(',');
        if (commaIndex < 0) {
            return null;
        }
        String meta = dataUrl.substring(5, commaIndex); // remove leading "data:"
        String dataPart = dataUrl.substring(commaIndex + 1);
        if (!meta.contains(";base64")) {
            return null;
        }
        String mimeType = meta.split(";")[0];
        return Map.of(
                "bytesBase64Encoded", dataPart,
                "mimeType", mimeType
        );
    }

    private Map<String, Object> loadImageAsBase64FromGeneratedDir(String relativePath) throws IOException {
        Path baseDir = Paths.get(imagenOutputDir).toAbsolutePath().normalize();
        Path resolved = baseDir.resolve(relativePath).normalize();
        if (!resolved.startsWith(baseDir)) {
            throw new IllegalArgumentException("Invalid generated image path: " + relativePath);
        }
        byte[] bytes = Files.readAllBytes(resolved);
        String mimeType = detectMimeType(resolved);
        return Map.of(
                "bytesBase64Encoded", Base64.getEncoder().encodeToString(bytes),
                "mimeType", mimeType
        );
    }

    private Map<String, Object> loadImageAsBase64FromHttpUrl(String imageUrl) {
        ResponseEntity<byte[]> entity = webClient.get()
                .uri(imageUrl)
                .accept(MediaType.IMAGE_JPEG, MediaType.IMAGE_PNG, MediaType.IMAGE_GIF, MediaType.valueOf("image/webp"), MediaType.ALL)
                .retrieve()
                .toEntity(byte[].class)
                .block();

        if (entity == null || entity.getBody() == null || entity.getBody().length == 0) {
            throw new IllegalArgumentException("URL 이미지 데이터를 읽을 수 없습니다: " + imageUrl);
        }

        MediaType contentType = entity.getHeaders().getContentType();
        String mimeType = (contentType != null) ? contentType.toString() : guessMimeTypeFromUrl(imageUrl);

        return Map.of(
                "bytesBase64Encoded", Base64.getEncoder().encodeToString(entity.getBody()),
                "mimeType", mimeType
        );
    }

    private String guessMimeTypeFromUrl(String imageUrl) {
        if (imageUrl == null) return "image/png";
        String lower = imageUrl.toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".png")) return "image/png";
        return "image/png";
    }

    private String detectMimeType(Path path) throws IOException {
        String mimeType = Files.probeContentType(path);
        if (mimeType != null && !mimeType.isBlank()) {
            return mimeType;
        }
        String filename = path.getFileName().toString().toLowerCase();
        if (filename.endsWith(".png")) return "image/png";
        if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
        if (filename.endsWith(".webp")) return "image/webp";
        return "image/png";
    }

    private String extractGeneratedImagePath(String imageRef) {
        String marker = "/generated-images/";
        int idx = imageRef.indexOf(marker);
        if (idx < 0) {
            return null;
        }
        String relative = imageRef.substring(idx + marker.length());
        int queryIndex = relative.indexOf('?');
        if (queryIndex >= 0) {
            relative = relative.substring(0, queryIndex);
        }
        return relative.isBlank() ? null : relative;
    }

    private void validateStorageUri() {
        if (veoStorageUri == null || veoStorageUri.isBlank()) {
            throw new IllegalArgumentException("veo.storage-uri (gs://...) 설정이 필요합니다.");
        }
        if (!veoStorageUri.startsWith("gs://")) {
            throw new IllegalArgumentException("veo.storage-uri는 gs:// 로 시작해야 합니다.");
        }
    }

    private int normalizeDurationSeconds(int requested) {
        // Veo image_to_video supports 4, 6, 8 seconds.
        if (requested == 4 || requested == 6 || requested == 8) {
            return requested;
        }
        return 4;
    }
}
