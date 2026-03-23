package com.aivideo.studio.service;

import java.nio.file.Path;
import java.util.List;

/**
 * 영상 병합 비동기 작업의 상태를 추적하는 내부 객체
 */
class MergeJob {

    private final String jobId;
    private final String sessionId;
    private final List<String> sceneIds;
    private final String transitionType;
    private final double transitionDuration;

    private volatile String status = "pending";
    private volatile String errorMessage;
    private volatile Path outputPath;
    private volatile Path tempDir;

    MergeJob(String jobId, String sessionId, List<String> sceneIds, String transitionType, double transitionDuration) {
        this.jobId = jobId;
        this.sessionId = sessionId;
        this.sceneIds = sceneIds;
        this.transitionType = transitionType != null ? transitionType : "crossfade";
        this.transitionDuration = transitionDuration;
    }

    String getJobId()               { return jobId; }
    String getSessionId()           { return sessionId; }
    List<String> getSceneIds()      { return sceneIds; }
    String getTransitionType()      { return transitionType; }
    double getTransitionDuration()  { return transitionDuration; }

    String getStatus()              { return status; }
    void setStatus(String s)        { this.status = s; }

    String getErrorMessage()        { return errorMessage; }
    void setErrorMessage(String m)  { this.errorMessage = m; }

    Path getOutputPath()            { return outputPath; }
    void setOutputPath(Path p)      { this.outputPath = p; }

    Path getTempDir()               { return tempDir; }
    void setTempDir(Path d)         { this.tempDir = d; }
}
