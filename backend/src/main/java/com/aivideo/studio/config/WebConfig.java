package com.aivideo.studio.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    /** Imagen 3로 생성된 이미지가 저장되는 디렉터리 */
    @Value("${imagen.output-dir:${user.home}/aivideo-generated/images}")
    private String imageOutputDir;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }

    /**
     * Imagen 3가 저장한 이미지를 /generated-images/** URL로 서빙합니다.
     * 프론트엔드에서 scene.imageUrl = "/generated-images/scene-xxx.png" 형태로 접근합니다.
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = "file:" + imageOutputDir + "/";
        registry.addResourceHandler("/generated-images/**")
                .addResourceLocations(location);
    }
}
