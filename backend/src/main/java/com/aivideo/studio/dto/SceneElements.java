package com.aivideo.studio.dto;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SceneElements implements Serializable {
    @JsonDeserialize(using = StringOrObjectToTextDeserializer.class)
    private String mainCharacter;

    @JsonDeserialize(using = StringOrObjectToTextDeserializer.class)
    private String subCharacter;
    private String action;
    private String pose;
    private String background;
    private String time;
    private String composition;
    private String lighting;
    private String mood;
    private String story;
}
