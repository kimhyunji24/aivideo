package com.aivideo.studio.controller;

import com.aivideo.studio.service.GenerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/generation")
@RequiredArgsConstructor
public class GenerationController {

    private final GenerationService generationService;

    // TODO: 이미지 생성 및 비디오 생성 추적 엔드포인트 구현 필요
}
