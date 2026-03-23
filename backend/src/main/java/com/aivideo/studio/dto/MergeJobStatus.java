package com.aivideo.studio.dto;

import lombok.Data;

@Data
public class MergeJobStatus {
    private String jobId;
    /** pending | processing | completed | error */
    private String status;
    private String errorMessage;
}
