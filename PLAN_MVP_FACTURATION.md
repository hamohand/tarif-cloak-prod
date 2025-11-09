# Plan MVP - Facturation (Approche Progressive)

## 🎯 Objectif Minimal

Commencer par le **strict minimum** : pouvoir **tracker les recherches** et **associer les utilisateurs à des entreprises**.

Pas de facturation, pas de quotas, pas de plans tarifaires pour le moment. Juste **traçabilité de base**.

---

## 📋 Phase 1 : Tracking Basique (Cette semaine)

### Objectif
Enregistrer chaque recherche avec :
- Qui a fait la recherche (utilisateur Keycloak)
- Quand
- Combien ça a coûté (tokens OpenAI)
- Quelle entreprise (à associer plus tard)

### Étapes

#### Étape 1.1 : Créer une table simple `usage_log`
```sql
CREATE TABLE usage_log (
    id BIGSERIAL PRIMARY KEY,
    keycloak_user_id VARCHAR(255),
    endpoint VARCHAR(255),           -- "/recherche/sections", etc.
    search_term VARCHAR(500),
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 6),
    timestamp TIMESTAMP DEFAULT NOW()
);
```

#### Étape 1.2 : Créer l'entité JPA minimale
```java
@Entity
@Table(name = "usage_log")
public class UsageLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String keycloakUserId;
    private String endpoint;
    private String searchTerm;
    private Integer tokensUsed;
    private Double costUsd;
    private LocalDateTime timestamp;
}
```

#### Étape 1.3 : Créer le Repository
```java
public interface UsageLogRepository extends JpaRepository<UsageLog, Long> {
    List<UsageLog> findByKeycloakUserId(String keycloakUserId);
    List<UsageLog> findByTimestampBetween(LocalDateTime start, LocalDateTime end);
}
```

#### Étape 1.4 : Modifier `OpenAiService` pour exposer le coût
```java
// Ajouter un ThreadLocal pour stocker le coût
private static final ThreadLocal<UsageInfo> currentUsage = new ThreadLocal<>();

// Après le calcul du coût
UsageInfo usageInfo = new UsageInfo(totalTokens, prix_requete);
currentUsage.set(usageInfo);

// Méthode statique pour récupérer
public static UsageInfo getCurrentUsage() {
    return currentUsage.get();
}

public static void clearCurrentUsage() {
    currentUsage.remove();
}
```

#### Étape 1.5 : Créer un service simple pour enregistrer
```java
@Service
public class UsageLogService {
    
    @Autowired
    private UsageLogRepository repository;
    
    public void logUsage(String keycloakUserId, String endpoint, 
                        String searchTerm, Integer tokens, Double cost) {
        UsageLog log = new UsageLog();
        log.setKeycloakUserId(keycloakUserId);
        log.setEndpoint(endpoint);
        log.setSearchTerm(searchTerm);
        log.setTokensUsed(tokens);
        log.setCostUsd(cost);
        log.setTimestamp(LocalDateTime.now());
        repository.save(log);
    }
}
```

#### Étape 1.6 : Modifier `RechercheController` pour logger
```java
// Dans chaque méthode (reponseSections, reponseChapitres, etc.)
// Après avoir obtenu le résultat de l'IA

// Récupérer l'utilisateur depuis le JWT
String userId = getKeycloakUserIdFromSecurityContext();

// Récupérer les infos de coût
UsageInfo usage = OpenAiService.getCurrentUsage();
if (usage != null) {
    usageLogService.logUsage(
        userId,
        "/recherche/sections",  // ou le bon endpoint
        termeRecherche,
        usage.getTokens(),
        usage.getCost()
    );
    OpenAiService.clearCurrentUsage();
}
```

#### Étape 1.7 : Créer un endpoint simple pour voir les logs (ADMIN uniquement)
```java
@GetMapping("/admin/usage-logs")
@PreAuthorize("hasRole('ADMIN')")
public List<UsageLog> getUsageLogs(
    @RequestParam(required = false) String userId,
    @RequestParam(required = false) LocalDate startDate,
    @RequestParam(required = false) LocalDate endDate
) {
    // Retourner les logs
}
```

### Résultat attendu
- ✅ Chaque recherche est enregistrée en base
- ✅ On peut voir qui a fait quelle recherche
- ✅ On connaît le coût de chaque recherche
- ✅ Un endpoint ADMIN permet de consulter les logs

**Temps estimé : 2-3 heures**

---

## 📋 Phase 2 : Association Utilisateur → Entreprise (Semaine suivante)

### Objectif
Associer les utilisateurs à des entreprises (manuellement au début).

### Étapes

#### Étape 2.1 : Créer une table `organization` simple
```sql
CREATE TABLE organization (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Étape 2.2 : Créer une table de liaison simple
```sql
CREATE TABLE organization_user (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES organization(id),
    keycloak_user_id VARCHAR(255) NOT NULL,
    UNIQUE(organization_id, keycloak_user_id)
);
```

#### Étape 2.3 : Créer les entités JPA
```java
@Entity
public class Organization {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private LocalDateTime createdAt;
}

@Entity
public class OrganizationUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    private Organization organization;
    
    private String keycloakUserId;
}
```

#### Étape 2.4 : Ajouter `organization_id` à `usage_log`
```sql
ALTER TABLE usage_log 
ADD COLUMN organization_id BIGINT REFERENCES organization(id);
```

#### Étape 2.5 : Créer un endpoint ADMIN pour gérer les entreprises
```java
@PostMapping("/admin/organizations")
@PreAuthorize("hasRole('ADMIN')")
public Organization createOrganization(@RequestBody String name) {
    // Créer l'entreprise
}

@PostMapping("/admin/organizations/{orgId}/users")
@PreAuthorize("hasRole('ADMIN')")
public void addUserToOrganization(
    @PathVariable Long orgId,
    @RequestBody String keycloakUserId
) {
    // Associer l'utilisateur à l'entreprise
}
```

#### Étape 2.6 : Modifier le logging pour inclure l'organisation
```java
// Dans RechercheController, après avoir récupéré userId
Long organizationId = organizationService.getOrganizationIdByUserId(userId);
usageLogService.logUsage(userId, endpoint, searchTerm, tokens, cost, organizationId);
```

### Résultat attendu
- ✅ On peut créer des entreprises
- ✅ On peut associer des utilisateurs à des entreprises
- ✅ Les logs incluent l'entreprise
- ✅ On peut filtrer les logs par entreprise

**Temps estimé : 2-3 heures**

---

## 📋 Phase 3 : Visualisation Simple (Semaine suivante)

### Objectif
Créer une page simple pour voir les statistiques d'utilisation.

### Étapes

#### Étape 3.1 : Créer un endpoint de stats
```java
@GetMapping("/admin/usage/stats")
@PreAuthorize("hasRole('ADMIN')")
public Map<String, Object> getStats(
    @RequestParam(required = false) Long organizationId,
    @RequestParam(required = false) LocalDate startDate,
    @RequestParam(required = false) LocalDate endDate
) {
    // Retourner :
    // - Nombre total de requêtes
    // - Coût total
    // - Par utilisateur
    // - Par entreprise
}
```

#### Étape 3.2 : Créer une page Angular simple
- Liste des entreprises
- Pour chaque entreprise : nombre de requêtes, coût total
- Liste des utilisations récentes

### Résultat attendu
- ✅ Une page admin pour voir les stats
- ✅ Visualisation par entreprise
- ✅ Visualisation par utilisateur

**Temps estimé : 3-4 heures**

---

## 📋 Phase 4 : Quotas Basiques (Plus tard, si nécessaire)

### Objectif
Ajouter une limite simple par entreprise.

### Étapes

#### Étape 4.1 : Ajouter un champ `monthly_quota` à `organization`
```sql
ALTER TABLE organization 
ADD COLUMN monthly_quota INTEGER;
```

#### Étape 4.2 : Créer une méthode pour vérifier le quota
```java
public boolean checkQuota(Long organizationId) {
    // Compter les requêtes du mois en cours
    // Comparer avec le quota
}
```

#### Étape 4.3 : Modifier le controller pour vérifier avant de chercher
```java
if (!usageLogService.checkQuota(organizationId)) {
    throw new QuotaExceededException("Quota dépassé");
}
```

### Résultat attendu
- ✅ Limite de requêtes par mois par entreprise
- ✅ Blocage si quota dépassé

**Temps estimé : 2 heures**

---

## 🚀 Ordre d'Implémentation Recommandé

### ✅ Phase 1 : Tracking Basique (TERMINÉE)
- ✅ Table `usage_log`
- ✅ Entité + Repository
- ✅ Service de logging
- ✅ Modification du controller
- ✅ Endpoint ADMIN pour voir les logs
- **Documentation** : Voir `DOCUMENTATION_PHASES.md` - Phase 1

### ✅ Phase 2 : Association Utilisateur → Entreprise (TERMINÉE)
- ✅ Tables `organization` et `organization_user`
- ✅ Endpoints ADMIN pour gérer
- ✅ Mise à jour du logging
- **Documentation** : Voir `DOCUMENTATION_PHASES.md` - Phase 2

### ✅ Phase 3 : Visualisation (TERMINÉE)
- ✅ Endpoint de stats
- ✅ Page Angular simple
- ✅ Filtrage par organisation et période
- **Documentation** : Voir `DOCUMENTATION_PHASES.md` - Phase 3

### ✅ Phase 4 : Quotas (TERMINÉE)
- ✅ Vérification de quota
- ✅ Blocage si dépassé
- ✅ Gestionnaire d'exceptions
- ✅ Endpoint pour mettre à jour le quota
- ✅ Tests unitaires et d'intégration
- **Documentation** : Voir `DOCUMENTATION_PHASES.md` - Phase 4

---

## 📝 Notes Importantes

1. **Pas de migration complexe** : On crée les tables une par une, simplement
2. **Pas de facturation** : Juste du tracking pour l'instant
3. **Pas de plans tarifaires** : On verra plus tard
4. **Pas de PDF** : On verra plus tard
5. **Pas de paiement** : On verra plus tard

**On avance petit à petit, on teste, on ajuste, puis on ajoute les fonctionnalités suivantes.**

---

## 🎯 Critères de Succès pour la Phase 1

- [ ] Chaque recherche est enregistrée en base
- [ ] On peut voir les logs via l'API ADMIN
- [ ] Les coûts sont correctement enregistrés
- [ ] Pas de régression sur les fonctionnalités existantes

Une fois la Phase 1 terminée et testée, on passe à la Phase 2.

