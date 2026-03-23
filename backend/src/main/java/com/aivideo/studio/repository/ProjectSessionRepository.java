package com.aivideo.studio.repository;

import com.aivideo.studio.dto.ProjectState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Repository
@RequiredArgsConstructor
@Slf4j
public class ProjectSessionRepository {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String KEY_PREFIX = "session:project:";
    private static final Duration DEFAULT_TTL = Duration.ofHours(24); // 24시간 세션 유지
    private final Map<String, FallbackEntry> fallbackStore = new ConcurrentHashMap<>();

    private record FallbackEntry(ProjectState state, Instant expiresAt) {}

    public void save(String sessionId, ProjectState state) {
        String redisKey = KEY_PREFIX + sessionId;
        try {
            redisTemplate.opsForValue().set(redisKey, state, DEFAULT_TTL);
            fallbackStore.remove(redisKey);
            syncFallbackToRedisBestEffort();
        } catch (RuntimeException ex) {
            log.warn("Redis save failed. Falling back to memory store. key={}", redisKey, ex);
            fallbackStore.put(redisKey, new FallbackEntry(state, Instant.now().plus(DEFAULT_TTL)));
        }
    }

    public ProjectState findById(String sessionId) {
        String redisKey = KEY_PREFIX + sessionId;
        try {
            Object value = redisTemplate.opsForValue().get(redisKey);
            if (value instanceof ProjectState state) {
                // Redis가 복구된 경우 메모리에 남은 세션들을 백그라운드로 재동기화
                syncFallbackToRedisBestEffort();
                return state;
            }
            // Redis miss면 폴백 저장소를 확인
            return getFallback(redisKey);
        } catch (RuntimeException ex) {
            log.warn("Redis read failed. Reading from memory fallback. key={}", redisKey, ex);
            return getFallback(redisKey);
        }
    }

    public void delete(String sessionId) {
        String redisKey = KEY_PREFIX + sessionId;
        try {
            redisTemplate.delete(redisKey);
        } catch (RuntimeException ex) {
            log.warn("Redis delete failed. Removing memory fallback only. key={}", redisKey, ex);
        }
        fallbackStore.remove(redisKey);
    }

    private ProjectState getFallback(String redisKey) {
        FallbackEntry entry = fallbackStore.get(redisKey);
        if (entry == null) return null;
        if (entry.expiresAt().isBefore(Instant.now())) {
            fallbackStore.remove(redisKey);
            return null;
        }
        return entry.state();
    }

    private void syncFallbackToRedisBestEffort() {
        if (fallbackStore.isEmpty()) return;
        for (Map.Entry<String, FallbackEntry> e : fallbackStore.entrySet()) {
            FallbackEntry entry = e.getValue();
            if (entry.expiresAt().isBefore(Instant.now())) {
                fallbackStore.remove(e.getKey());
                continue;
            }
            try {
                redisTemplate.opsForValue().set(e.getKey(), entry.state(), DEFAULT_TTL);
                fallbackStore.remove(e.getKey());
            } catch (RuntimeException ex) {
                // Redis가 아직 불안정하면 다음 요청에서 다시 시도
                return;
            }
        }
    }
}
