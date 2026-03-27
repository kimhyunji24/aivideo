package com.aivideo.studio.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;

/**
 * Accept either a plain string or an object and normalize it into a display string.
 */
public class StringOrObjectToTextDeserializer extends JsonDeserializer<String> {

    @Override
    public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        JsonNode node = parser.readValueAsTree();
        if (node == null || node.isNull()) return null;
        if (node.isTextual()) return node.asText();
        if (node.isObject()) {
            String name = textOrNull(node.get("name"));
            String appearance = textOrNull(node.get("appearance"));
            if (name != null && appearance != null) return name + " (" + appearance + ")";
            if (name != null) return name;
            if (appearance != null) return appearance;
        }
        return node.toString();
    }

    private String textOrNull(JsonNode node) {
        if (node == null || node.isNull() || !node.isTextual()) return null;
        String value = node.asText();
        return value == null || value.isBlank() ? null : value;
    }
}
