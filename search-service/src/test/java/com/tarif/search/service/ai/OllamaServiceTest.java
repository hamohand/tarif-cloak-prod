package com.tarif.search.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.model.UsageInfo;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OllamaService — /api/chat, JSON mode et num_ctx")
class OllamaServiceTest {

    @Mock
    private RestTemplate restTemplate;

    private AiPrompts aiPrompts;
    private OllamaService ollamaService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        aiPrompts = new AiPrompts();
        ollamaService = new OllamaService(
                aiPrompts,
                restTemplate,
                "http://localhost:11434/",
                "qwen2.5:14b",
                16384,
                "24h",
                true
        );
    }

    @AfterEach
    void tearDown() {
        ollamaService.clearUsageInfo();
    }

    @Test
    @DisplayName("Appelle /api/chat avec format=json, keep_alive=24h et options.num_ctx=16384")
    void demanderAiAide_doitAppelerChatEndpointAvecParametresLocaux() throws Exception {
        String apiResponse = """
                {
                  "model": "qwen2.5:14b",
                  "message": {
                    "role": "assistant",
                    "content": "[{\\"code\\":\\"0808 10\\",\\"justification\\":\\"Pommes\\"}]"
                  },
                  "prompt_eval_count": 320,
                  "eval_count": 45
                }
                """;

        when(restTemplate.exchange(
                eq("http://localhost:11434/api/chat"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(String.class)
        )).thenReturn(ResponseEntity.ok(apiResponse));

        String result = ollamaService.demanderAiAide("POSITIONS6", "pommes", true, "POSITIONS6");

        assertThat(result).contains("0808 10");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<HttpEntity<String>> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(
                eq("http://localhost:11434/api/chat"),
                eq(HttpMethod.POST),
                entityCaptor.capture(),
                eq(String.class)
        );

        JsonNode body = objectMapper.readTree(entityCaptor.getValue().getBody());
        assertThat(body.path("model").asText()).isEqualTo("qwen2.5:14b");
        assertThat(body.path("format").asText()).isEqualTo("json");
        assertThat(body.path("keep_alive").asText()).isEqualTo("24h");
        assertThat(body.path("stream").asBoolean()).isFalse();
        assertThat(body.path("options").path("num_ctx").asInt()).isEqualTo(16384);
        assertThat(body.path("options").path("temperature").asDouble()).isEqualTo(0.0);
        assertThat(body.path("messages")).hasSize(2);
        assertThat(body.path("messages").get(0).path("role").asText()).isEqualTo("system");
        assertThat(body.path("messages").get(1).path("role").asText()).isEqualTo("user");

        UsageInfo usage = ollamaService.getLastUsageInfo();
        assertThat(usage).isNotNull();
        assertThat(usage.getPromptTokens()).isEqualTo(320);
        assertThat(usage.getCompletionTokens()).isEqualTo(45);
        assertThat(usage.getTokens()).isEqualTo(365);
        assertThat(usage.getCostUsd()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("Erreur HTTP ou réseau lève AiProviderException pour permettre le retry")
    void demanderAiAide_enCasErreurReseau_doitLeverAiProviderException() {
        when(restTemplate.exchange(
                eq("http://localhost:11434/api/chat"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(String.class)
        )).thenThrow(new RestClientException("Connection refused"));

        assertThatThrownBy(() -> ollamaService.demanderAiAide("SECTIONS", "acier", false, "SECTIONS"))
                .isInstanceOf(AiProviderException.class)
                .hasMessageContaining("Ollama");

        assertThat(ollamaService.getLastUsageInfo()).isNull();
    }

    @Test
    @DisplayName("Statut HTTP non-2xx lève AiProviderException")
    void demanderAiAide_enCasHttp500_doitLeverAiProviderException() {
        when(restTemplate.exchange(
                eq("http://localhost:11434/api/chat"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(String.class)
        )).thenReturn(new ResponseEntity<>("error", HttpStatus.INTERNAL_SERVER_ERROR));

        assertThatThrownBy(() -> ollamaService.demanderAiAide("SECTIONS", "acier", false, "SECTIONS"))
                .isInstanceOf(AiProviderException.class);
    }
}
