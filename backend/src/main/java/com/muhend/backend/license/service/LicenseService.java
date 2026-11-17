package com.muhend.backend.license.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.muhend.backend.license.dto.LicensePayload;
import com.muhend.backend.license.dto.LicenseStatusDto;
import com.muhend.backend.license.model.OnPremLicenseState;
import com.muhend.backend.license.repository.OnPremLicenseStateRepository;
import com.muhend.backend.license.service.Ed25519LicenseVerifier.LicenseVerificationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Service de gestion des licences On-Premise :
 * - Vérification cryptographique Ed25519 hors-ligne
 * - Anti-rollback d'horloge système
 * - Période de grâce hors-ligne configurable
 * - Heartbeat sortant minimal (boxId + licenseId uniquement, zéro PII)
 */
@Service
@Slf4j
public class LicenseService {

    private static final long SINGLETON_STATE_ID = 1L;

    private final OnPremLicenseStateRepository licenseStateRepository;
    private final Ed25519LicenseVerifier licenseVerifier;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final String configuredBoxId;
    private final String publicKeyBase64;
    private final String configuredToken;
    private final String tokenFilePath;
    private final String heartbeatUrl;
    private final int defaultOfflineGraceDays;
    private volatile HttpClient httpClient;

    @Autowired
    public LicenseService(
            OnPremLicenseStateRepository licenseStateRepository,
            Ed25519LicenseVerifier licenseVerifier,
            ObjectMapper objectMapper,
            @Value("${box.id:box-dz-default}") String configuredBoxId,
            @Value("${box.license.public-key:}") String publicKeyBase64,
            @Value("${box.license.token:}") String configuredToken,
            @Value("${box.license.token-file:/data/license/license.jwt}") String tokenFilePath,
            @Value("${box.license.heartbeat-url:}") String heartbeatUrl,
            @Value("${box.license.offline-grace-days:30}") int defaultOfflineGraceDays) {
        this(
                licenseStateRepository,
                licenseVerifier,
                objectMapper,
                Clock.systemDefaultZone(),
                configuredBoxId,
                publicKeyBase64,
                configuredToken,
                tokenFilePath,
                heartbeatUrl,
                defaultOfflineGraceDays
        );
    }

    public LicenseService(
            OnPremLicenseStateRepository licenseStateRepository,
            Ed25519LicenseVerifier licenseVerifier,
            ObjectMapper objectMapper,
            Clock clock,
            String configuredBoxId,
            String publicKeyBase64,
            String configuredToken,
            String tokenFilePath,
            String heartbeatUrl,
            int defaultOfflineGraceDays) {
        this.licenseStateRepository = licenseStateRepository;
        this.licenseVerifier = licenseVerifier;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
        this.configuredBoxId = configuredBoxId != null ? configuredBoxId.trim() : "box-dz-default";
        this.publicKeyBase64 = publicKeyBase64 != null ? publicKeyBase64.trim() : "";
        this.configuredToken = configuredToken != null ? configuredToken.trim() : "";
        this.tokenFilePath = tokenFilePath != null ? tokenFilePath.trim() : "";
        this.heartbeatUrl = heartbeatUrl != null ? heartbeatUrl.trim() : "";
        this.defaultOfflineGraceDays = Math.max(0, defaultOfflineGraceDays);
    }

    private HttpClient getHttpClient() {
        HttpClient client = this.httpClient;
        if (client == null) {
            synchronized (this) {
                client = this.httpClient;
                if (client == null) {
                    client = HttpClient.newBuilder()
                            .connectTimeout(Duration.ofSeconds(5))
                            .build();
                    this.httpClient = client;
                }
            }
        }
        return client;
    }

    @Transactional
    public LicenseStatusDto getCurrentStatus() {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = LocalDate.now(clock);
        OnPremLicenseState state = getOrCreateState(now);

        // Protection anti-rollback d'horloge (tolérance de 24h pour fuseaux/NTP mineurs)
        if (state.getLastSeenAt() != null && now.isBefore(state.getLastSeenAt().minusHours(24))) {
            log.error("Incohérence d'horloge détectée sur la Box {} (now={}, lastSeen={})",
                    configuredBoxId, now, state.getLastSeenAt());
            return buildErrorStatus("CLOCK_TAMPERED", state.getLicenseId(), null, state.getLastHeartbeatOkAt(),
                    "Incohérence d'horloge système détectée. Vérifiez la date/heure du serveur et la synchronisation NTP.");
        }

        if (state.getLastSeenAt() == null || now.isAfter(state.getLastSeenAt().plusMinutes(5))) {
            state.setLastSeenAt(now);
            state.setUpdatedAt(now);
            licenseStateRepository.save(state);
        }

        if (Boolean.TRUE.equals(state.getRevoked())) {
            return buildErrorStatus("REVOKED", state.getLicenseId(), null, state.getLastHeartbeatOkAt(),
                    "Cette licence a été révoquée. Contactez votre fournisseur pour obtenir une nouvelle clé.");
        }

        String rawToken = resolveToken(state);
        if (rawToken == null || rawToken.isBlank()) {
            return buildErrorStatus("MISSING", null, null, state.getLastHeartbeatOkAt(),
                    "Aucune clé de licence installée sur cette Box. Activez votre licence dans Mon organisation.");
        }

        if (publicKeyBase64.isBlank()) {
            return buildErrorStatus("MISSING", null, null, state.getLastHeartbeatOkAt(),
                    "Clé publique de vérification de licence non configurée (LICENSE_PUBLIC_KEY).");
        }

        LicensePayload payload;
        try {
            payload = licenseVerifier.verifyAndParse(rawToken, publicKeyBase64);
        } catch (LicenseVerificationException e) {
            log.warn("Échec de vérification de la licence sur la Box {}: {}", configuredBoxId, e.getMessage());
            return buildErrorStatus("INVALID_SIGNATURE", state.getLicenseId(), null, state.getLastHeartbeatOkAt(),
                    "Clé de licence invalide ou corrompue.");
        }

        if (payload.getBoxId() != null && !payload.getBoxId().isBlank()
                && !"*".equals(payload.getBoxId())
                && !payload.getBoxId().equals(configuredBoxId)) {
            return buildErrorStatus("BOX_MISMATCH", payload.getLicenseId(), payload, state.getLastHeartbeatOkAt(),
                    "Cette clé de licence est liée à un autre boîtier (" + payload.getBoxId() + ").");
        }

        int effectiveGraceDays = payload.getGraceDays() != null
                ? Math.max(0, payload.getGraceDays())
                : defaultOfflineGraceDays;

        // Vérifier le délai max hors-ligne depuis le dernier heartbeat réussi si un serveur heartbeat est configuré
        if (!heartbeatUrl.isBlank() && state.getLastHeartbeatOkAt() != null) {
            long daysSinceHeartbeat = Duration.between(state.getLastHeartbeatOkAt(), now).toDays();
            if (daysSinceHeartbeat > defaultOfflineGraceDays) {
                return buildErrorStatus("HEARTBEAT_OVERDUE", payload.getLicenseId(), payload, state.getLastHeartbeatOkAt(),
                        "Connexion de vérification de licence requise (aucun heartbeat depuis " + daysSinceHeartbeat + " jours).");
            }
        }

        LocalDate expiresAt = payload.getExpiresAt();
        LocalDate hardExpiry = expiresAt.plusDays(effectiveGraceDays);
        long daysRemaining = ChronoUnit.DAYS.between(today, expiresAt);
        long graceRemaining = Math.max(0L, ChronoUnit.DAYS.between(today, hardExpiry));

        if (today.isAfter(hardExpiry)) {
            return LicenseStatusDto.builder()
                    .valid(false)
                    .state("EXPIRED")
                    .licenseId(payload.getLicenseId())
                    .boxId(configuredBoxId)
                    .organizationName(payload.getOrganizationName())
                    .planName(payload.getPlanName())
                    .issuedAt(payload.getIssuedAt())
                    .expiresAt(expiresAt)
                    .daysRemaining(daysRemaining)
                    .offlineGraceDaysRemaining(0L)
                    .maxUsers(payload.getMaxUsers())
                    .monthlyQuota(payload.getMonthlyQuota())
                    .lastHeartbeatAt(state.getLastHeartbeatOkAt())
                    .message("Abonnement expiré le " + expiresAt + ". Veuillez saisir une nouvelle clé de licence.")
                    .build();
        }

        boolean inGracePeriod = today.isAfter(expiresAt);
        String stateCode = inGracePeriod ? "GRACE_PERIOD" : "VALID";
        String message = inGracePeriod
                ? "Période de grâce active : abonnement expiré le " + expiresAt + " (" + graceRemaining + " jour(s) restant(s) avant blocage)."
                : "Licence active (" + daysRemaining + " jour(s) restant(s) avant renouvellement).";

        return LicenseStatusDto.builder()
                .valid(true)
                .state(stateCode)
                .licenseId(payload.getLicenseId())
                .boxId(configuredBoxId)
                .organizationName(payload.getOrganizationName())
                .planName(payload.getPlanName())
                .issuedAt(payload.getIssuedAt())
                .expiresAt(expiresAt)
                .daysRemaining(daysRemaining)
                .offlineGraceDaysRemaining(graceRemaining)
                .maxUsers(payload.getMaxUsers())
                .monthlyQuota(payload.getMonthlyQuota())
                .lastHeartbeatAt(state.getLastHeartbeatOkAt())
                .message(message)
                .build();
    }

    @Transactional
    public LicenseStatusDto activateLicense(String rawToken) {
        if (publicKeyBase64.isBlank()) {
            throw new IllegalStateException("Clé publique de licence non configurée sur cette instance.");
        }

        LicensePayload payload;
        try {
            payload = licenseVerifier.verifyAndParse(rawToken, publicKeyBase64);
        } catch (LicenseVerificationException e) {
            throw new IllegalArgumentException("Clé de licence invalide : " + e.getMessage(), e);
        }

        if (payload.getBoxId() != null && !payload.getBoxId().isBlank()
                && !"*".equals(payload.getBoxId())
                && !payload.getBoxId().equals(configuredBoxId)) {
            throw new IllegalArgumentException("Cette clé est destinée au boîtier '" + payload.getBoxId()
                    + "' et ne correspond pas à cette Box ('" + configuredBoxId + "').");
        }

        int effectiveGraceDays = payload.getGraceDays() != null
                ? Math.max(0, payload.getGraceDays())
                : defaultOfflineGraceDays;
        LocalDate today = LocalDate.now(clock);
        if (today.isAfter(payload.getExpiresAt().plusDays(effectiveGraceDays))) {
            throw new IllegalArgumentException("Cette clé de licence est déjà expirée depuis le " + payload.getExpiresAt() + ".");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        String trimmedToken = rawToken.replaceAll("\\s+", "");

        OnPremLicenseState state = getOrCreateState(now);
        state.setLicenseId(payload.getLicenseId());
        state.setBoxId(configuredBoxId);
        state.setToken(trimmedToken);
        state.setRevoked(false);
        state.setLastSeenAt(now);
        state.setLastHeartbeatOkAt(now);
        state.setUpdatedAt(now);
        licenseStateRepository.save(state);

        persistTokenFile(trimmedToken);
        log.info("Licence On-Premise activée: licenseId={}, boxId={}, expiresAt={}",
                payload.getLicenseId(), configuredBoxId, payload.getExpiresAt());

        return getCurrentStatus();
    }

    /**
     * Heartbeat sortant périodique (aucune donnée personnelle ou métier transmise).
     */
    @Scheduled(fixedDelayString = "${box.license.heartbeat-interval-ms:43200000}", initialDelay = 45000)
    @Transactional
    public void performHeartbeat() {
        if (heartbeatUrl.isBlank()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now(clock);
        OnPremLicenseState state = getOrCreateState(now);

        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("boxId", configuredBoxId);
            body.put("licenseId", state.getLicenseId());
            body.put("timestamp", Instant.now(clock).toString());

            String json = objectMapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(heartbeatUrl))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = getHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                if (response.body() != null && !response.body().isBlank()) {
                    JsonNode root = objectMapper.readTree(response.body());
                    if (root.path("revoked").asBoolean(false)) {
                        state.setRevoked(true);
                        state.setUpdatedAt(now);
                        licenseStateRepository.save(state);
                        log.error("Licence révoquée par le serveur d'abonnement (licenseId={})", state.getLicenseId());
                        return;
                    }
                    String renewedToken = root.path("token").asText("");
                    if (!renewedToken.isBlank()) {
                        activateLicense(renewedToken);
                        return;
                    }
                }
                state.setLastHeartbeatOkAt(now);
                state.setUpdatedAt(now);
                licenseStateRepository.save(state);
                log.debug("Heartbeat licence réussi pour boxId={}", configuredBoxId);
            } else {
                log.warn("Heartbeat licence HTTP {} (mode grâce hors-ligne conservé)", response.statusCode());
            }
        } catch (Exception e) {
            log.warn("Heartbeat licence indisponible (mode hors-ligne actif) : {}", e.getMessage());
        }
    }

    private OnPremLicenseState getOrCreateState(LocalDateTime now) {
        return licenseStateRepository.findById(SINGLETON_STATE_ID).orElseGet(() -> {
            OnPremLicenseState created = new OnPremLicenseState();
            created.setId(SINGLETON_STATE_ID);
            created.setBoxId(configuredBoxId);
            created.setRevoked(false);
            created.setLastSeenAt(now);
            created.setUpdatedAt(now);
            return licenseStateRepository.save(created);
        });
    }

    private String resolveToken(OnPremLicenseState state) {
        if (state.getToken() != null && !state.getToken().isBlank()) {
            return state.getToken();
        }
        String fileToken = readTokenFile();
        if (fileToken != null && !fileToken.isBlank()) {
            return fileToken;
        }
        return configuredToken;
    }

    private String readTokenFile() {
        if (tokenFilePath.isBlank()) {
            return null;
        }
        try {
            Path path = Path.of(tokenFilePath);
            if (Files.isRegularFile(path)) {
                return Files.readString(path, StandardCharsets.UTF_8).trim();
            }
        } catch (IOException e) {
            log.warn("Impossible de lire le fichier de licence {}: {}", tokenFilePath, e.getMessage());
        }
        return null;
    }

    private void persistTokenFile(String token) {
        if (tokenFilePath.isBlank()) {
            return;
        }
        try {
            Path path = Path.of(tokenFilePath);
            Path parent = path.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.writeString(path, token, StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.warn("Impossible d'écrire le fichier de licence {} (sauvegardé en BDD uniquement): {}",
                    tokenFilePath, e.getMessage());
        }
    }

    private LicenseStatusDto buildErrorStatus(
            String stateCode,
            String licenseId,
            LicensePayload payload,
            LocalDateTime lastHeartbeatAt,
            String message) {
        return LicenseStatusDto.builder()
                .valid(false)
                .state(stateCode)
                .licenseId(licenseId)
                .boxId(configuredBoxId)
                .organizationName(payload != null ? payload.getOrganizationName() : null)
                .planName(payload != null ? payload.getPlanName() : null)
                .issuedAt(payload != null ? payload.getIssuedAt() : null)
                .expiresAt(payload != null ? payload.getExpiresAt() : null)
                .maxUsers(payload != null ? payload.getMaxUsers() : null)
                .monthlyQuota(payload != null ? payload.getMonthlyQuota() : null)
                .lastHeartbeatAt(lastHeartbeatAt)
                .message(message)
                .build();
    }
}
