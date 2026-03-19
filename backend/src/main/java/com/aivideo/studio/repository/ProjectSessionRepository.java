package com.aivideo.studio.repository;

import com.aivideo.studio.dto.ProjectState;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;

@Repository
@RequiredArgsConstructor
public class ProjectSessionRepository {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String KEY_PREFIX = "session:project:";
    private static final Duration DEFAULT_TTL = Duration.ofHours(24); // 24시간 세션 유지

    public void save(String sessionId, ProjectState state) {
        redisTemplate.opsForValue().set(KEY_PREFIX + sessionId, state, DEFAULT_TTL);
    }

    public ProjectState findById(String sessionId) {
        Object value = redisTemplate.opsForValue().get(KEY_PREFIX + sessionId);
        if (value instanceof ProjectState) {
            return (ProjectState) value;
        }
        return null;
    }

    public void delete(String sessionId) {
        redisTemplate.delete(KEY_PREFIX + sessionId);
    }
}
