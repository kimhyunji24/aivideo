package com.aivideo.studio.controller;

import com.aivideo.studio.exception.SessionNotFoundException;
import com.aivideo.studio.exception.UpstreamServiceException;
import com.aivideo.studio.exception.ApiErrorInfo;
import com.aivideo.studio.exception.ErrorClassifier;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestControllerAdvice
@Slf4j
public class ApiExceptionHandler {

    @ExceptionHandler(SessionNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleSessionNotFound(SessionNotFoundException ex, HttpServletRequest request) {
        return buildError(
                HttpStatus.NOT_FOUND,
                "SESSION_NOT_FOUND",
                ex.getMessage(),
                false,
                ex.getMessage(),
                request.getRequestURI()
        );
    }

    @ExceptionHandler(UpstreamServiceException.class)
    public ResponseEntity<Map<String, Object>> handleUpstreamFailure(UpstreamServiceException ex, HttpServletRequest request) {
        ApiErrorInfo info = ErrorClassifier.classify(ex);
        return buildError(
                info.httpStatus(),
                info.code(),
                info.userMessage(),
                info.retryable(),
                ex.getMessage(),
                request.getRequestURI()
        );
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest request) {
        ApiErrorInfo info = ErrorClassifier.invalidInput();
        return buildError(
                info.httpStatus(),
                info.code(),
                info.userMessage(),
                info.retryable(),
                ex.getMessage(),
                request.getRequestURI()
        );
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex, HttpServletRequest request) {
        String message = ex.getReason() != null ? ex.getReason() : ex.getMessage();
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        return buildError(
                status,
                "HTTP_" + status.value(),
                message,
                status.is5xxServerError(),
                message,
                request.getRequestURI()
        );
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntime(RuntimeException ex, HttpServletRequest request) {
        log.error("Runtime error on {}", request.getRequestURI(), ex);
        String message = ex.getMessage() != null && !ex.getMessage().isBlank()
                ? ex.getMessage()
                : "Runtime server error";
        return buildError(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                message,
                true,
                ex.getMessage(),
                request.getRequestURI()
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unexpected error on {}", request.getRequestURI(), ex);
        ApiErrorInfo info = ErrorClassifier.classify(ex);
        return buildError(
                info.httpStatus(),
                info.code(),
                info.userMessage(),
                info.retryable(),
                ex.getMessage(),
                request.getRequestURI()
        );
    }

    private ResponseEntity<Map<String, Object>> buildError(
            HttpStatus status,
            String code,
            String userMessage,
            boolean retryable,
            String detail,
            String path
    ) {
        String requestId = UUID.randomUUID().toString();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now());
        body.put("requestId", requestId);
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("code", code);
        body.put("retryable", retryable);
        body.put("userMessage", userMessage);
        body.put("message", userMessage);
        body.put("detail", detail);
        body.put("path", path);
        log.warn("API error response [{}] {} {} - {}", requestId, status.value(), code, detail);
        return ResponseEntity.status(status).body(body);
    }
}
