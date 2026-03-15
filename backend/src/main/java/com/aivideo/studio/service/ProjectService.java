package com.aivideo.studio.service;

import com.aivideo.studio.domain.Project;
import com.aivideo.studio.domain.Scene;
import com.aivideo.studio.domain.SceneElements;
import com.aivideo.studio.dto.ProjectRequest;
import com.aivideo.studio.dto.ProjectResponse;
import com.aivideo.studio.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final Random random = new Random();

    @Transactional
    public ProjectResponse createProject(ProjectRequest request) {
        Project project = Project.builder()
                .idea(request.getIdea())
                .build();

        if (request.getScenes() != null) {
            request.getScenes().forEach(sceneRequest -> {
                Scene scene = Scene.builder()
                        .title(sceneRequest.getTitle())
                        .description(sceneRequest.getDescription())
                        .prompt(sceneRequest.getPrompt())
                        .duration(sceneRequest.getDuration())
                        .status("pending")
                        .seed(Math.abs(random.nextLong()))
                        .elements(mapToElements(sceneRequest.getElements()))
                        .build();
                project.addScene(scene);
            });
        }

        Project savedProject = projectRepository.save(project);
        return mapToResponse(savedProject);
    }

    public List<ProjectResponse> getAllProjects() {
        return projectRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public ProjectResponse getProject(Long id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + id));
        return mapToResponse(project);
    }

    @Transactional
    public ProjectResponse updateFinalVideo(Long id, String finalVideoUrl) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + id));
        project.setFinalVideoUrl(finalVideoUrl);
        return mapToResponse(project);
    }

    private SceneElements mapToElements(ProjectRequest.SceneElementsDto dto) {
        if (dto == null) return new SceneElements();
        return SceneElements.builder()
                .mainCharacter(dto.getMainCharacter())
                .subCharacter(dto.getSubCharacter())
                .action(dto.getAction())
                .pose(dto.getPose())
                .background(dto.getBackground())
                .time(dto.getTime())
                .composition(dto.getComposition())
                .lighting(dto.getLighting())
                .mood(dto.getMood())
                .story(dto.getStory())
                .build();
    }

    private ProjectResponse mapToResponse(Project project) {
        return ProjectResponse.builder()
                .id(project.getId())
                .idea(project.getIdea())
                .scenes(project.getScenes().stream().map(scene -> ProjectResponse.SceneResponse.builder()
                        .id(scene.getId())
                        .title(scene.getTitle())
                        .description(scene.getDescription())
                        .prompt(scene.getPrompt())
                        .imageUrl(scene.getImageUrl())
                        .videoUrl(scene.getVideoUrl())
                        .duration(scene.getDuration())
                        .status(scene.getStatus())
                        .seed(scene.getSeed())
                        .elements(mapToElementsDto(scene.getElements()))
                        .build()).collect(Collectors.toList()))
                .build();
    }

    private ProjectRequest.SceneElementsDto mapToElementsDto(SceneElements elements) {
        if (elements == null) return new ProjectRequest.SceneElementsDto();
        return ProjectRequest.SceneElementsDto.builder()
                .mainCharacter(elements.getMainCharacter())
                .subCharacter(elements.getSubCharacter())
                .action(elements.getAction())
                .pose(elements.getPose())
                .background(elements.getBackground())
                .time(elements.getTime())
                .composition(elements.getComposition())
                .lighting(elements.getLighting())
                .mood(elements.getMood())
                .story(elements.getStory())
                .build();
    }
}
