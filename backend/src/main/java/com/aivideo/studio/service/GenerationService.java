package com.aivideo.studio.service;

import com.aivideo.studio.dto.ProjectState;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GenerationService {
    
    private final SessionService sessionService;

    // TODO: 실제 이미지/비디오 생성 AI (ComfyUI, Stable Diffusion, API 등) 연동 로직 추가
}
