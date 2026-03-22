package com.aivideo.studio.exception;

import org.springframework.http.HttpStatus;

public record ApiErrorInfo(
        String code,
        String userMessage,
        boolean retryable,
        HttpStatus httpStatus
) {
}
