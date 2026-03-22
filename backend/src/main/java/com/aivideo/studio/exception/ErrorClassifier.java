package com.aivideo.studio.exception;

import org.springframework.http.HttpStatus;

import java.util.Locale;

public final class ErrorClassifier {

    private ErrorClassifier() {
    }

    public static ApiErrorInfo classify(Throwable throwable) {
        if (hasCause(throwable, PolicyBlockedException.class)) {
            return new ApiErrorInfo(
                    "POLICY_BLOCKED",
                    "요청한 내용은 안전 정책상 생성할 수 없습니다. 표현을 완화해 다시 시도해 주세요.",
                    false,
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        if (throwable instanceof IllegalArgumentException) {
            return invalidInput();
        }

        String message = flattenMessage(throwable);
        String lower = message.toLowerCase(Locale.ROOT);

        if (isPolicyBlocked(lower)) {
            return new ApiErrorInfo(
                    "POLICY_BLOCKED",
                    "요청한 내용은 안전 정책상 생성할 수 없습니다. 표현을 완화해 다시 시도해 주세요.",
                    false,
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        if (isRateLimited(lower)) {
            return new ApiErrorInfo(
                    "RATE_LIMITED",
                    "요청이 많아 잠시 지연되고 있습니다. 잠시 후 자동 또는 수동으로 다시 시도해 주세요.",
                    true,
                    HttpStatus.TOO_MANY_REQUESTS
            );
        }

        if (isTemporaryUpstreamFailure(lower)) {
            return new ApiErrorInfo(
                    "UPSTREAM_TEMPORARY",
                    "일시적인 서버 문제로 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
                    true,
                    HttpStatus.BAD_GATEWAY
            );
        }

        return new ApiErrorInfo(
                "GENERATION_FAILED",
                "생성 중 오류가 발생했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.",
                false,
                HttpStatus.BAD_GATEWAY
        );
    }

    public static ApiErrorInfo invalidInput() {
        return new ApiErrorInfo(
                "INVALID_INPUT",
                "요청 형식에 문제가 있어 생성하지 못했습니다. 입력값을 확인해 주세요.",
                false,
                HttpStatus.BAD_REQUEST
        );
    }

    private static boolean isPolicyBlocked(String message) {
        return containsAny(message,
                "safety",
                "policy",
                "blocked",
                "blocklist",
                "content filter",
                "prohibited",
                "harmful",
                "not allowed");
    }

    private static boolean isRateLimited(String message) {
        return containsAny(message,
                "429",
                "rate limit",
                "quota",
                "resource_exhausted",
                "too many requests");
    }

    private static boolean isTemporaryUpstreamFailure(String message) {
        return containsAny(message,
                "timeout",
                "timed out",
                "deadline exceeded",
                "temporarily unavailable",
                "service unavailable",
                "internal server error",
                "connection reset",
                "connection refused",
                "502",
                "503",
                "504");
    }

    private static boolean containsAny(String source, String... keywords) {
        if (source == null || source.isBlank()) {
            return false;
        }
        for (String keyword : keywords) {
            if (source.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private static String flattenMessage(Throwable throwable) {
        StringBuilder sb = new StringBuilder();
        Throwable current = throwable;
        while (current != null) {
            if (current.getMessage() != null && !current.getMessage().isBlank()) {
                if (!sb.isEmpty()) {
                    sb.append(" | ");
                }
                sb.append(current.getMessage());
            }
            current = current.getCause();
        }
        return sb.toString();
    }

    private static boolean hasCause(Throwable throwable, Class<? extends Throwable> type) {
        Throwable current = throwable;
        while (current != null) {
            if (type.isInstance(current)) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
