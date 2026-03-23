package com.aivideo.studio.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImageEditRequest {
    private String frameId;    // null for editing scenes directly, provided for frames
    private String prompt;     // Optional user prompt for what they want to change
    private String maskBase64; // The base64 drawn mask image (data:image/png;base64,... format)
}
