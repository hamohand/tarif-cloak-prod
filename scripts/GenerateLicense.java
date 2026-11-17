import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.LocalDate;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Utilitaire CLI autonome Java 21 (sans dépendances externes) pour gérer les clés
 * et jetons de licence Ed25519 (format TCI1.<payloadBase64Url>.<signatureBase64Url>).
 *
 * Exemples :
 *   java scripts/GenerateLicense.java --gen-keys
 *   java scripts/GenerateLicense.java --sign --private-key "<B64>" --license-id "LIC-DZ-001" --box-id "box-client1-dz" --org "Transitaire Alger" --plan "Box Enterprise" --expires "2027-11-16" --max-users 20 --grace-days 30
 *   java scripts/GenerateLicense.java --verify --public-key "<B64>" --token "TCI1...."
 */
public class GenerateLicense {

    private static final String TOKEN_PREFIX = "TCI1";

    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            printUsage();
            System.exit(1);
        }

        String mode = args[0];
        Map<String, String> opts = parseArgs(args, 1);

        switch (mode) {
            case "--gen-keys" -> handleGenKeys();
            case "--sign" -> handleSign(opts);
            case "--verify" -> handleVerify(opts);
            default -> {
                System.err.println("Commande inconnue: " + mode);
                printUsage();
                System.exit(1);
            }
        }
    }

    private static void handleGenKeys() throws Exception {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("Ed25519");
        KeyPair kp = kpg.generateKeyPair();
        String pubB64 = Base64.getEncoder().encodeToString(kp.getPublic().getEncoded());
        String privB64 = Base64.getEncoder().encodeToString(kp.getPrivate().getEncoded());

        System.out.println("=== Paire de clés Ed25519 générée ===");
        System.out.println("LICENSE_PUBLIC_KEY=" + pubB64);
        System.out.println("TCI_LICENSE_PRIVATE_KEY=" + privB64);
        System.out.println();
        System.out.println("Conservez TCI_LICENSE_PRIVATE_KEY strictement hors-ligne chez l'éditeur.");
        System.out.println("Déployez LICENSE_PUBLIC_KEY dans le .env de chaque Box.");
    }

    private static void handleSign(Map<String, String> opts) throws Exception {
        String privB64 = opts.getOrDefault("private-key", System.getenv("TCI_LICENSE_PRIVATE_KEY"));
        if (isBlank(privB64)) {
            throw new IllegalArgumentException("--private-key (ou TCI_LICENSE_PRIVATE_KEY) est obligatoire.");
        }

        String licenseId = requireOpt(opts, "license-id");
        String boxId = opts.getOrDefault("box-id", "*");
        String org = requireOpt(opts, "org");
        String plan = opts.getOrDefault("plan", "Box Standard");
        String expiresStr = requireOpt(opts, "expires");
        LocalDate expiresAt = LocalDate.parse(expiresStr);
        LocalDate issuedAt = opts.containsKey("issued")
                ? LocalDate.parse(opts.get("issued"))
                : LocalDate.now();
        Integer maxUsers = opts.containsKey("max-users") ? Integer.valueOf(opts.get("max-users")) : null;
        Integer monthlyQuota = opts.containsKey("monthly-quota") ? Integer.valueOf(opts.get("monthly-quota")) : null;
        int graceDays = Integer.parseInt(opts.getOrDefault("grace-days", "30"));

        StringBuilder json = new StringBuilder();
        json.append("{");
        appendJsonString(json, "licenseId", licenseId);
        json.append(",");
        appendJsonString(json, "boxId", boxId);
        json.append(",");
        appendJsonString(json, "organizationName", org);
        json.append(",");
        appendJsonString(json, "planName", plan);
        json.append(",");
        json.append("\"maxUsers\":").append(maxUsers != null ? maxUsers : "null").append(",");
        json.append("\"monthlyQuota\":").append(monthlyQuota != null ? monthlyQuota : "null").append(",");
        appendJsonString(json, "issuedAt", issuedAt.toString());
        json.append(",");
        appendJsonString(json, "expiresAt", expiresAt.toString());
        json.append(",");
        json.append("\"graceDays\":").append(graceDays);
        json.append("}");

        String payloadB64 = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(json.toString().getBytes(StandardCharsets.UTF_8));
        String signingInput = TOKEN_PREFIX + "." + payloadB64;

        byte[] privBytes = Base64.getDecoder().decode(stripKey(privB64));
        PrivateKey privateKey = KeyFactory.getInstance("Ed25519")
                .generatePrivate(new PKCS8EncodedKeySpec(privBytes));

        Signature signer = Signature.getInstance("Ed25519");
        signer.initSign(privateKey);
        signer.update(signingInput.getBytes(StandardCharsets.UTF_8));
        String sigB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(signer.sign());

        System.out.println(signingInput + "." + sigB64);
    }

    private static void handleVerify(Map<String, String> opts) throws Exception {
        String pubB64 = requireOpt(opts, "public-key");
        String token = requireOpt(opts, "token").replaceAll("\\s+", "");

        String[] parts = token.split("\\.");
        if (parts.length != 3 || !TOKEN_PREFIX.equals(parts[0])) {
            throw new IllegalArgumentException("Format de jeton invalide (attendu: TCI1.<payload>.<signature>).");
        }

        byte[] pubBytes = Base64.getDecoder().decode(stripKey(pubB64));
        PublicKey publicKey = KeyFactory.getInstance("Ed25519")
                .generatePublic(new X509EncodedKeySpec(pubBytes));

        Signature verifier = Signature.getInstance("Ed25519");
        verifier.initVerify(publicKey);
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.UTF_8));
        boolean ok = verifier.verify(Base64.getUrlDecoder().decode(parts[2]));

        String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        System.out.println("Signature Ed25519 valide : " + ok);
        System.out.println("Payload : " + payloadJson);
        if (!ok) {
            System.exit(2);
        }
    }

    private static Map<String, String> parseArgs(String[] args, int startIdx) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = startIdx; i < args.length; i++) {
            String arg = args[i];
            if (arg.startsWith("--")) {
                String key = arg.substring(2);
                if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
                    map.put(key, args[++i]);
                } else {
                    map.put(key, "true");
                }
            }
        }
        return map;
    }

    private static String requireOpt(Map<String, String> opts, String key) {
        String v = opts.get(key);
        if (isBlank(v)) {
            throw new IllegalArgumentException("Option requise manquante: --" + key);
        }
        return v;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String stripKey(String key) {
        return key.replaceAll("-----BEGIN [A-Z ]+-----", "")
                  .replaceAll("-----END [A-Z ]+-----", "")
                  .replaceAll("\\s+", "");
    }

    private static void appendJsonString(StringBuilder sb, String key, String value) {
        sb.append("\"").append(escapeJson(key)).append("\":");
        if (value == null) {
            sb.append("null");
        } else {
            sb.append("\"").append(escapeJson(value)).append("\"");
        }
    }

    private static String escapeJson(String s) {
        StringBuilder out = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\b' -> out.append("\\b");
                case '\f' -> out.append("\\f");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        return out.toString();
    }

    private static void printUsage() {
        System.out.println("Usage:");
        System.out.println("  java scripts/GenerateLicense.java --gen-keys");
        System.out.println("  java scripts/GenerateLicense.java --sign --private-key <B64> --license-id <ID> --box-id <BOX> --org <NOM> --plan <PLAN> --expires <YYYY-MM-DD> [--max-users <N>] [--monthly-quota <N>] [--grace-days <N>]");
        System.out.println("  java scripts/GenerateLicense.java --verify --public-key <B64> --token <TCI1...>");
    }
}
