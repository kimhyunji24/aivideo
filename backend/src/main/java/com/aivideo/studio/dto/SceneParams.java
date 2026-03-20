package com.aivideo.studio.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SceneParams implements Serializable {
    private Integer seed;
    private Integer steps;
    private Double cfgScale;
    private String sampler;
}
