package com.aivideo.studio.service;

import com.aivideo.studio.domain.Scene;
import com.aivideo.studio.domain.SceneElements;
import com.aivideo.studio.dto.ProjectRequest;
import com.aivideo.studio.dto.ProjectResponse;
import com.aivideo.studio.repository.SceneRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

@Service
@Transactional(readOnly = true)
public class SceneService {

    private static final Logger log = LoggerFactory.getLogger(SceneService.class);

    private final SceneRepository sceneRepository;
    private final AIService aiService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final Random random = new Random();

    @Value("${google.api-key:}")
    private String googleApiKey;

    @Value("${gemini.image-model:imagen-3.0-generate-002}")
    private String geminiImageModel;

    @Value("${gemini.video-model:veo-3.0-generate-001}")
    private String geminiVideoModel;

    @Value("${aivideo.mock-mode:false}")
    private boolean mockMode;

    @Value("${aivideo.mock-image-url:https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80}")
    private String mockImageUrl;

    @Value("${aivideo.mock-video-url:https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4}")
    private String mockVideoUrl;

    @Value("${aivideo.generated-files-path:${user.home}/aivideo-generated}")
    private String generatedFilesPath;

    public SceneService(SceneRepository sceneRepository, AIService aiService,
                        RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.sceneRepository = sceneRepository;
        this.aiService = aiService;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public ProjectResponse.SceneResponse getScene(Long id) {
        Scene scene = findScene(id);
        // 폴링 중 — Veo 작업 완료 여부 확인
        if ("generating".equals(scene.getStatus()) && scene.getOperationName() != null) {
            scene = checkVeoOperation(scene);
        }
        return mapToResponse(scene);
    }

    @Transactional
    public ProjectResponse.SceneResponse updateScene(Long id, ProjectRequest.SceneRequest request) {
        Scene scene = findScene(id);
        scene.setTitle(request.getTitle());
        scene.setDescription(request.getDescription());
        scene.setPrompt(request.getPrompt());
        scene.setDuration(request.getDuration());
        scene.setElements(mapToElements(request.getElements()));
        if (scene.getSeed() == null) {
            scene.setSeed(Math.abs(random.nextLong()));
        }
        return mapToResponse(scene);
    }

    @Transactional
    public ProjectResponse.SceneResponse updateStatus(Long id, String status, String imageUrl, String videoUrl) {
        Scene scene = findScene(id);
        scene.setStatus(status);
        if (imageUrl != null) scene.setImageUrl(imageUrl);
        if (videoUrl != null) scene.setVideoUrl(videoUrl);
        return mapToResponse(scene);
    }

    // ─── 이미지 생성 (Gemini/Imagen) ─────────────────────────────────────

    @Transactional
    public ProjectResponse.SceneResponse generateImage(Long id) {
        Scene scene = findScene(id);

        String prompt = aiService.combinePrompt(mapToElementsDto(scene.getElements()));
        if (prompt.isBlank()) prompt = scene.getPrompt();
        scene.setPrompt(prompt);

        if (mockMode || googleApiKey == null || googleApiKey.isBlank()) {
            scene.setStatus("done");
            scene.setImageUrl(mockImageUrl);
            return mapToResponse(scene);
        }

        try {
            String imageUrl = callImagenApi(prompt, id);
            scene.setStatus("done");
            scene.setImageUrl(imageUrl);
        } catch (Exception e) {
            log.error("Imagen API 실패 (sceneId={}): {}", id, e.getMessage());
            scene.setStatus("error");
        }

        return mapToResponse(scene);
    }

    private String callImagenApi(String prompt, Long sceneId) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> instance = new HashMap<>();
        instance.put("prompt", prompt);

        Map<String, Object> parameters = new HashMap<>();
        parameters.put("sampleCount", 1);
        parameters.put("aspectRatio", "16:9");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("instances", List.of(instance));
        requestBody.put("parameters", parameters);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + geminiImageModel + ":predict?key=" + googleApiKey;
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> predictions = (List<Map<String, Object>>) response.getBody().get("predictions");
        String base64Data = (String) predictions.get(0).get("bytesBase64Encoded");

        return saveImageFile(base64Data, sceneId);
    }

    private String saveImageFile(String base64Data, Long sceneId) throws Exception {
        byte[] imageBytes = Base64.getDecoder().decode(base64Data);
        Path filePath = Paths.get(generatedFilesPath, "images", sceneId + ".png");
        Files.createDirectories(filePath.getParent());
        Files.write(filePath, imageBytes);
        return "/generated/images/" + sceneId + ".png";
    }

    // ─── 영상 생성 (Veo 3 — Long Running Operation) ───────────────────────

    @Transactional
    public ProjectResponse.SceneResponse generateVideo(Long id) {
        Scene scene = findScene(id);

        if (mockMode || googleApiKey == null || googleApiKey.isBlank()) {
            scene.setStatus("done");
            scene.setVideoUrl(mockVideoUrl);
            return mapToResponse(scene);
        }

        try {
            String operationName = startVeoGeneration(scene);
            scene.setStatus("generating");
            scene.setOperationName(operationName);
        } catch (Exception e) {
            log.error("Veo API 실패 (sceneId={}): {}", id, e.getMessage());
            scene.setStatus("error");
        }

        return mapToResponse(scene);
    }

    private String startVeoGeneration(Scene scene) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String prompt = scene.getPrompt() != null ? scene.getPrompt() : "cinematic scene";

        Map<String, Object> instance = new HashMap<>();
        instance.put("prompt", prompt);
        if (scene.getImageUrl() != null) {
            instance.put("image", Map.of("url", scene.getImageUrl()));
        }

        Map<String, Object> parameters = new HashMap<>();
        parameters.put("aspectRatio", "16:9");
        parameters.put("durationSeconds", scene.getDuration() != null ? scene.getDuration() : 3);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("instances", List.of(instance));
        requestBody.put("parameters", parameters);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + geminiVideoModel + ":predictLongRunning?key=" + googleApiKey;
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

        String operationName = (String) response.getBody().get("name");
        log.info("Veo operation started: {}", operationName);
        return operationName;
    }

    @Transactional
    private Scene checkVeoOperation(Scene scene) {
        try {
            String url = "https://generativelanguage.googleapis.com/v1beta/" + scene.getOperationName() + "?key=" + googleApiKey;
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, null, Map.class);
            Map<?, ?> body = response.getBody();

            Boolean done = (Boolean) body.get("done");
            if (Boolean.TRUE.equals(done)) {
                Map<?, ?> responseMap = (Map<?, ?>) body.get("response");
                if (responseMap != null) {
                    String videoUrl = extractVideoUrl(responseMap, scene.getId());
                    scene.setVideoUrl(videoUrl);
                    scene.setStatus("done");
                    scene.setOperationName(null);
                } else {
                    // error 케이스
                    scene.setStatus("error");
                    scene.setOperationName(null);
                }
                sceneRepository.save(scene);
            }
        } catch (Exception e) {
            log.error("Veo operation poll 실패 (sceneId={}): {}", scene.getId(), e.getMessage());
        }
        return scene;
    }

    @SuppressWarnings("unchecked")
    private String extractVideoUrl(Map<?, ?> responseMap, Long sceneId) throws Exception {
        try {
            // Veo 응답: response.generateVideoResponse.generatedSamples[0].video
            Map<?, ?> generateVideoResponse = (Map<?, ?>) responseMap.get("generateVideoResponse");
            List<Map<?, ?>> samples = (List<Map<?, ?>>) generateVideoResponse.get("generatedSamples");
            Map<?, ?> video = (Map<?, ?>) samples.get(0).get("video");

            // URI가 있으면 직접 사용, 없으면 base64 디코딩 후 저장
            String uri = (String) video.get("uri");
            if (uri != null && !uri.isBlank()) {
                return uri;
            }

            String base64Data = (String) video.get("bytesBase64Encoded");
            if (base64Data != null) {
                return saveVideoFile(base64Data, sceneId);
            }
        } catch (Exception e) {
            log.error("Veo 응답 파싱 실패: {}", e.getMessage());
        }
        return null;
    }

    private String saveVideoFile(String base64Data, Long sceneId) throws Exception {
        byte[] videoBytes = Base64.getDecoder().decode(base64Data);
        Path filePath = Paths.get(generatedFilesPath, "videos", sceneId + ".mp4");
        Files.createDirectories(filePath.getParent());
        Files.write(filePath, videoBytes);
        return "/generated/videos/" + sceneId + ".mp4";
    }

    // ─── 공통 매핑 ───────────────────────────────────────────────────────

    private Scene findScene(Long id) {
        return sceneRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Scene not found: " + id));
    }

    private SceneElements mapToElements(ProjectRequest.SceneElementsDto dto) {
        if (dto == null) return new SceneElements();
        SceneElements e = new SceneElements();
        e.setMainCharacter(dto.getMainCharacter());
        e.setSubCharacter(dto.getSubCharacter());
        e.setAction(dto.getAction());
        e.setPose(dto.getPose());
        e.setBackground(dto.getBackground());
        e.setTime(dto.getTime());
        e.setComposition(dto.getComposition());
        e.setLighting(dto.getLighting());
        e.setMood(dto.getMood());
        e.setStory(dto.getStory());
        return e;
    }

    private ProjectResponse.SceneResponse mapToResponse(Scene scene) {
        ProjectResponse.SceneResponse r = new ProjectResponse.SceneResponse();
        r.setId(scene.getId());
        r.setTitle(scene.getTitle());
        r.setDescription(scene.getDescription());
        r.setPrompt(scene.getPrompt());
        r.setImageUrl(scene.getImageUrl());
        r.setVideoUrl(scene.getVideoUrl());
        r.setDuration(scene.getDuration());
        r.setStatus(scene.getStatus());
        r.setSeed(scene.getSeed());
        r.setElements(mapToElementsDto(scene.getElements()));
        return r;
    }

    private ProjectRequest.SceneElementsDto mapToElementsDto(SceneElements e) {
        if (e == null) return new ProjectRequest.SceneElementsDto();
        ProjectRequest.SceneElementsDto dto = new ProjectRequest.SceneElementsDto();
        dto.setMainCharacter(e.getMainCharacter());
        dto.setSubCharacter(e.getSubCharacter());
        dto.setAction(e.getAction());
        dto.setPose(e.getPose());
        dto.setBackground(e.getBackground());
        dto.setTime(e.getTime());
        dto.setComposition(e.getComposition());
        dto.setLighting(e.getLighting());
        dto.setMood(e.getMood());
        dto.setStory(e.getStory());
        return dto;
    }
}
