package com.aivideo.studio.domain;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "projects")
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String idea;

    private String finalVideoUrl;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Scene> scenes = new ArrayList<>();

    public void addScene(Scene scene) {
        scenes.add(scene);
        scene.setProject(this);
    }

    public void setFinalVideoUrl(String finalVideoUrl) {
        this.finalVideoUrl = finalVideoUrl;
    }

    public Long getId() { return id; }
    public String getIdea() { return idea; }
    public List<Scene> getScenes() { return scenes; }
}
