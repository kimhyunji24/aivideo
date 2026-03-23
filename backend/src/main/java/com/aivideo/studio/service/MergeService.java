package com.aivideo.studio.service;

import com.aivideo.studio.dto.MergeJobStatus;
import com.aivideo.studio.dto.ProjectState;
import com.aivideo.studio.dto.Scene;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MergeService {

    private final SessionService sessionService;
    private final VeoAdapter veoAdapter;

    @Value("${veo.duration-seconds:8}")
    private int veoDurationSeconds;

    @Value("${aivideo.generated-files-path:${user.home}/aivideo-generated}")
    private String generatedFilesPath;

    private final ConcurrentHashMap<String, MergeJob> jobs = new ConcurrentHashMap<>();

    /** 병합 결과 파일의 안정적 저장 경로 (재시작 후에도 파일 유지) */
    private Path mergedOutputDir() throws IOException {
        Path dir = Path.of(generatedFilesPath).resolve("merged");
        Files.createDirectories(dir);
        return dir;
    }

    private Path mergedFilePath(String jobId) throws IOException {
        return mergedOutputDir().resolve(jobId + ".mp4");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * 비동기 병합 작업을 시작하고 즉시 jobId를 반환합니다.
     */
    public MergeJobStatus startMerge(String sessionId, List<String> sceneIds, String transitionType, double transitionDuration) {
        if (sceneIds == null || sceneIds.size() < 2) {
            throw new IllegalArgumentException("병합하려면 씬을 2개 이상 선택해야 합니다.");
        }

        String jobId = UUID.randomUUID().toString();
        MergeJob job = new MergeJob(jobId, sessionId, sceneIds, transitionType, transitionDuration);
        jobs.put(jobId, job);

        Thread worker = new Thread(() -> performMerge(job), "merge-" + jobId.substring(0, 8));
        worker.setDaemon(true);
        worker.start();

        log.info("[MergeService] 병합 작업 시작 — jobId: {}, sceneIds: {}", jobId, sceneIds);
        return toStatus(job);
    }

    public MergeJobStatus getStatus(String jobId) {
        // 메모리에 job이 없어도 파일이 있으면 completed로 응답
        MergeJob job = jobs.get(jobId);
        if (job == null) {
            try {
                Path file = mergedFilePath(jobId);
                if (Files.exists(file)) {
                    MergeJobStatus s = new MergeJobStatus();
                    s.setJobId(jobId);
                    s.setStatus("completed");
                    return s;
                }
            } catch (IOException ignored) {}
            throw new IllegalArgumentException("병합 작업을 찾을 수 없습니다: " + jobId);
        }
        return toStatus(job);
    }

    /**
     * 병합 완료된 영상 바이트 반환 (preview / download 공용).
     * 서버 재시작 후에도 파일이 남아 있으면 정상 반환합니다.
     */
    public byte[] getVideoBytes(String jobId) throws IOException {
        Path file = mergedFilePath(jobId);
        if (Files.exists(file)) {
            return Files.readAllBytes(file);
        }
        // 파일이 없으면 메모리 job 상태 확인
        MergeJob job = jobs.get(jobId);
        if (job == null) {
            throw new IllegalArgumentException("병합 결과를 찾을 수 없습니다. 다시 병합해 주세요: " + jobId);
        }
        if (!"completed".equals(job.getStatus())) {
            throw new IllegalStateException("병합이 아직 완료되지 않았습니다. status=" + job.getStatus());
        }
        return Files.readAllBytes(job.getOutputPath());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal merge logic
    // ──────────────────────────────────────────────────────────────────────────

    private void performMerge(MergeJob job) {
        try {
            job.setStatus("processing");

            ProjectState state = sessionService.getSession(job.getSessionId());
            if (state == null) {
                throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + job.getSessionId());
            }

            // 선택된 씬들을 요청 순서대로 정렬
            List<Scene> scenes = job.getSceneIds().stream()
                    .map(id -> findScene(state.getScenes(), id))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

            if (scenes.isEmpty()) {
                throw new IllegalArgumentException("병합할 씬을 찾을 수 없습니다.");
            }

            // 임시 디렉터리 (입력 영상 다운로드용)
            Path tempDir = Files.createTempDirectory("aivideo-merge-tmp-" + job.getJobId().substring(0, 8));
            job.setTempDir(tempDir);

            // GCS에서 각 씬의 영상 다운로드
            List<Path> videoPaths = downloadVideos(scenes, tempDir);

            // 결과 파일을 안정적 디렉토리에 저장 (재시작 후에도 유지)
            Path outputPath = mergedFilePath(job.getJobId());
            if (videoPaths.size() == 1) {
                Files.copy(videoPaths.get(0), outputPath);
            } else if ("cut".equals(job.getTransitionType()) || "none".equals(job.getTransitionType())) {
                mergeWithConcat(videoPaths, outputPath);
            } else {
                mergeWithCrossfade(videoPaths, outputPath, job.getTransitionType(), job.getTransitionDuration());
            }

            job.setOutputPath(outputPath);
            job.setStatus("completed");
            log.info("[MergeService] 병합 완료 — jobId: {}, output: {}", job.getJobId(), outputPath);

        } catch (Exception e) {
            log.error("[MergeService] 병합 실패 — jobId: {}", job.getJobId(), e);
            job.setStatus("error");
            job.setErrorMessage(e.getMessage());
        }
    }

    private List<Path> downloadVideos(List<Scene> scenes, Path tempDir) throws IOException {
        List<Path> paths = new ArrayList<>();
        for (int i = 0; i < scenes.size(); i++) {
            Scene scene = scenes.get(i);
            if (scene.getVideoUrl() == null || scene.getVideoUrl().isBlank()) {
                throw new IllegalArgumentException(
                        "씬 " + scene.getId() + "의 영상이 아직 생성되지 않았습니다.");
            }
            byte[] bytes = veoAdapter.fetchVideoBinary(scene.getVideoUrl()).getBody();
            if (bytes == null || bytes.length == 0) {
                throw new IllegalStateException("씬 " + scene.getId() + "의 영상 데이터를 가져올 수 없습니다.");
            }
            Path videoPath = tempDir.resolve("video_" + i + ".mp4");
            Files.write(videoPath, bytes);
            paths.add(videoPath);
            log.info("[MergeService] 다운로드 완료 씬 {} → {} bytes", scene.getId(), bytes.length);
        }
        return paths;
    }

    /**
     * ffmpeg xfade 필터를 사용하여 N개의 영상을 crossfade(dissolve)로 병합합니다.
     *
     * xfade offset 계산:
     *   currentDuration 은 현재까지 이어진 스트림의 총 길이
     *   다음 클립을 연결할 때 offset = currentDuration - transitionDuration
     *   연결 후 currentDuration += nextClipDuration - transitionDuration
     */
    /** 하드 컷: xfade 없이 단순 이어붙이기 */
    private void mergeWithConcat(List<Path> videoPaths, Path outputPath)
            throws IOException, InterruptedException {

        // concat demuxer를 위한 파일 목록 생성
        Path listFile = outputPath.getParent().resolve("concat_list.txt");
        StringBuilder sb = new StringBuilder();
        for (Path p : videoPaths) {
            sb.append("file '").append(p.toAbsolutePath()).append("'\n");
        }
        Files.writeString(listFile, sb.toString());

        List<String> cmd = List.of(
                "ffmpeg", "-y",
                "-f", "concat", "-safe", "0",
                "-i", listFile.toAbsolutePath().toString(),
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-preset", "fast",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "192k",
                "-movflags", "+faststart",
                outputPath.toAbsolutePath().toString()
        );
        log.info("[MergeService] concat 실행: {}", String.join(" ", cmd));

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        Process process = pb.start();
        String out = new String(process.getInputStream().readAllBytes());
        int exit = process.waitFor();
        if (exit != 0) throw new RuntimeException("ffmpeg concat 실패 (exit " + exit + "): " + out.substring(Math.max(0, out.length() - 500)));
    }

    private void mergeWithCrossfade(List<Path> videoPaths, Path outputPath, String transitionType, double transitionDuration)
            throws IOException, InterruptedException {

        // 각 영상의 실제 재생 시간(초) 조회
        double[] durations = new double[videoPaths.size()];
        for (int i = 0; i < videoPaths.size(); i++) {
            durations[i] = getVideoDuration(videoPaths.get(i));
        }

        // 프론트 transitionType → ffmpeg xfade transition 이름 매핑
        String xfadeTransition = switch (transitionType == null ? "crossfade" : transitionType) {
            case "fadeblack"  -> "fadeblack";
            case "slideleft"  -> "slideleft";
            default           -> "fade"; // crossfade 및 기타
        };

        // xfade/acrossfade 필터 체인 생성
        StringBuilder filter = new StringBuilder();
        double currentDuration = durations[0];

        for (int i = 0; i < videoPaths.size() - 1; i++) {
            boolean isLast = (i == videoPaths.size() - 2);
            
            // Video labels
            String vInputA  = (i == 0) ? "[0:v]" : "[v" + i + "]";
            String vInputB  = "[" + (i + 1) + ":v]";
            String vOutLabel = isLast ? "vout" : "v" + (i + 1);

            // Audio labels (Veo 영상은 기본적으로 오디오 포함)
            String aInputA = (i == 0) ? "[0:a]" : "[a" + i + "]";
            String aInputB = "[" + (i + 1) + ":a]";
            String aOutLabel = isLast ? "aout" : "a" + (i + 1);

            double offset = currentDuration - transitionDuration;

            if (i > 0) filter.append(";");
            
            // Video fade
            filter.append(vInputA).append(vInputB)
                  .append("xfade=transition=").append(xfadeTransition)
                  .append(":duration=")
                  .append(String.format(Locale.US, "%.3f", transitionDuration))
                  .append(":offset=")
                  .append(String.format(Locale.US, "%.3f", offset))
                  .append("[").append(vOutLabel).append("]");
            
            // Audio fade (acrossfade)
            filter.append(";")
                  .append(aInputA).append(aInputB)
                  .append("acrossfade=d=")
                  .append(String.format(Locale.US, "%.3f", transitionDuration))
                  .append("[").append(aOutLabel).append("]");

            currentDuration = currentDuration + durations[i + 1] - transitionDuration;
        }

        // ffmpeg 커맨드 조립
        List<String> cmd = new ArrayList<>();
        cmd.add("ffmpeg");
        cmd.add("-y");
        for (Path p : videoPaths) {
            cmd.add("-i");
            cmd.add(p.toAbsolutePath().toString());
        }
        cmd.add("-filter_complex");
        cmd.add(filter.toString());
        
        // Video output mapping
        cmd.add("-map");
        cmd.add("[vout]");
        cmd.add("-c:v");
        cmd.add("libx264");
        cmd.add("-pix_fmt");
        cmd.add("yuv420p"); // 맥북 QuickTime 호환성을 위해 필수
        cmd.add("-preset");
        cmd.add("fast");
        cmd.add("-crf");
        cmd.add("23");
        
        // Audio output mapping
        cmd.add("-map");
        cmd.add("[aout]");
        cmd.add("-c:a");
        cmd.add("aac");
        cmd.add("-b:a");
        cmd.add("192k");
        
        cmd.add("-movflags");
        cmd.add("+faststart");
        cmd.add(outputPath.toAbsolutePath().toString());

        log.info("[MergeService] ffmpeg 실행: {}", String.join(" ", cmd));

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        Process process = pb.start();

        String ffmpegOutput = new String(process.getInputStream().readAllBytes());
        int exitCode = process.waitFor();

        if (exitCode != 0) {
            int tailStart = Math.max(0, ffmpegOutput.length() - 800);
            log.error("[MergeService] ffmpeg 오류 (exit {}): {}", exitCode, ffmpegOutput.substring(tailStart));
            throw new RuntimeException(
                    "ffmpeg 병합 실패 (exit " + exitCode + "): " +
                    ffmpegOutput.substring(tailStart));
        }
    }

    /**
     * ffprobe로 영상 재생 시간(초)을 조회합니다.
     * ffprobe를 실행할 수 없으면 설정된 기본값(veo.duration-seconds)을 사용합니다.
     */
    private double getVideoDuration(Path videoPath) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "ffprobe", "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    videoPath.toAbsolutePath().toString()
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes()).trim();
            process.waitFor();
            return Double.parseDouble(output);
        } catch (Exception e) {
            log.warn("[MergeService] ffprobe 실패, 기본값 {}초 사용: {}", veoDurationSeconds, e.getMessage());
            return veoDurationSeconds;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private MergeJob requireJob(String jobId) {
        MergeJob job = jobs.get(jobId);
        if (job == null) throw new IllegalArgumentException("병합 작업을 찾을 수 없습니다: " + jobId);
        return job;
    }

    private MergeJobStatus toStatus(MergeJob job) {
        MergeJobStatus s = new MergeJobStatus();
        s.setJobId(job.getJobId());
        s.setStatus(job.getStatus());
        s.setErrorMessage(job.getErrorMessage());
        return s;
    }

    private Scene findScene(List<Scene> scenes, String sceneId) {
        if (scenes == null) return null;
        return scenes.stream()
                .filter(s -> String.valueOf(s.getId()).equals(sceneId))
                .findFirst()
                .orElse(null);
    }
}
