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
public class Character implements Serializable {
    private String id;
    private String name;
    private String imageUrl;
    private String gender;
    private String appearance;
    private String personality;
    private String values;
    private String trauma;
}
