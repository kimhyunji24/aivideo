package com.aivideo.studio.exception;

public class PolicyBlockedException extends RuntimeException {

    public PolicyBlockedException(String message) {
        super(message);
    }

    public PolicyBlockedException(String message, Throwable cause) {
        super(message, cause);
    }
}
