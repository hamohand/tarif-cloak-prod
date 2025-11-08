# Stratégie de Facturation pour les Entreprises Utilisatrices

## 📋 Vue d'ensemble

Cette stratégie définit l'architecture et l'implémentation d'un système de facturation pour les entreprises utilisatrices de la recherche de codes tarifaires. Le système permettra de tracker les utilisations, gérer les quotas, générer des factures et fournir un tableau de bord de consommation.

---

## 🎯 Objectifs

1. **Traçabilité complète** : Enregistrer toutes les recherches avec leurs coûts
2. **Gestion multi-entreprises** : Support de plusieurs entreprises avec leurs utilisateurs
3. **Facturation flexible** : Plans tarifaires configurables (par requête, forfait, quota)
4. **Tableaux de bord** : Visualisation de la consommation en temps réel
5. **Intégration Keycloak** : Liaison avec les utilisateurs existants
6. **Administration** : Interface pour gérer les entreprises et leurs abonnements

---

## 🏗️ Architecture

### 1. Modèle de Données

#### 1.1 Entité `Organization` (Entreprise)
```java
@Entity
public class Organization {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String name;              // Nom de l'entreprise
    private String siret;             // Numéro SIRET (optionnel)
    private String email;             // Email de contact
    private String address;           // Adresse
    private String phone;             // Téléphone
    private Boolean active;           // Entreprise active/inactive
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Relation avec les utilisateurs
    @OneToMany(mappedBy = "organization")
    private List<OrganizationUser> users;
    
    // Relation avec les abonnements
    @OneToMany(mappedBy = "organization")
    private List<Subscription> subscriptions;
    
    // Relation avec les utilisations
    @OneToMany(mappedBy = "organization")
    private List<Usage> usages;
}
```

#### 1.2 Entité `OrganizationUser` (Liaison Utilisateur-Entreprise)
```java
@Entity
public class OrganizationUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String keycloakUserId;    // ID de l'utilisateur dans Keycloak
    private String email;             // Email (copie pour performance)
    private String role;              // ADMIN, USER, VIEWER dans l'entreprise
    
    @ManyToOne
    @JoinColumn(name = "organization_id")
    private Organization organization;
    
    private LocalDateTime joinedAt;
    private Boolean active;
}
```

#### 1.3 Entité `SubscriptionPlan` (Plan d'Abonnement)
```java
@Entity
public class SubscriptionPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String name;              // "Starter", "Professional", "Enterprise"
    private String description;
    private Double monthlyPrice;      // Prix mensuel en EUR
    private Integer monthlyQuota;     // Nombre de requêtes par mois (null = illimité)
    private Double pricePerRequest;   // Prix par requête au-delà du quota
    private Boolean active;           // Plan actif/inactif
}
```

#### 1.4 Entité `Subscription` (Abonnement d'une Entreprise)
```java
@Entity
public class Subscription {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "organization_id")
    private Organization organization;
    
    @ManyToOne
    @JoinColumn(name = "plan_id")
    private SubscriptionPlan plan;
    
    private LocalDateTime startDate;
    private LocalDateTime endDate;    // null = abonnement actif
    private SubscriptionStatus status; // ACTIVE, SUSPENDED, CANCELLED, EXPIRED
    private LocalDateTime createdAt;
}
```

#### 1.5 Entité `Usage` (Utilisation/Tracking)
```java
@Entity
public class Usage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "organization_id")
    private Organization organization;
    
    private String keycloakUserId;    // Utilisateur qui a fait la requête
    private String endpoint;          // "/recherche/sections", "/recherche/chapitres", etc.
    private String searchTerm;        // Terme de recherche
    private Integer tokensUsed;       // Nombre de tokens OpenAI utilisés
    private Double costUsd;           // Coût en USD (coût OpenAI)
    private Double costEur;           // Coût en EUR (converti)
    private LocalDateTime timestamp;  // Date/heure de la requête
    private String requestId;         // ID unique de la requête (pour traçabilité)
    private UsageStatus status;       // SUCCESS, FAILED, QUOTA_EXCEEDED
}
```

#### 1.6 Entité `Invoice` (Facture)
```java
@Entity
public class Invoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String invoiceNumber;     // Numéro de facture unique (ex: INV-2025-001)
    
    @ManyToOne
    @JoinColumn(name = "organization_id")
    private Organization organization;
    
    private LocalDate periodStart;    // Début de la période facturée
    private LocalDate periodEnd;      // Fin de la période facturée
    private Integer totalRequests;    // Nombre total de requêtes
    private Double totalAmountEur;    // Montant total en EUR
    private InvoiceStatus status;     // DRAFT, SENT, PAID, OVERDUE, CANCELLED
    private LocalDateTime issuedAt;
    private LocalDateTime paidAt;
    private String pdfPath;           // Chemin vers le PDF de la facture
}
```

#### 1.7 Entité `InvoiceItem` (Ligne de Facture)
```java
@Entity
public class InvoiceItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "invoice_id")
    private Invoice invoice;
    
    private String description;       // "1000 requêtes - Plan Professional"
    private Integer quantity;         // Nombre de requêtes
    private Double unitPrice;         // Prix unitaire
    private Double totalPrice;        // Prix total (quantity * unitPrice)
}
```

---

### 2. Intégration avec Keycloak

#### 2.1 Stratégie de Liaison Utilisateur-Entreprise

**Option A : Utiliser les Groupes Keycloak (Recommandé)**
- Créer un groupe Keycloak par entreprise
- Ajouter les utilisateurs aux groupes correspondants
- Synchroniser périodiquement les groupes avec la table `OrganizationUser`

**Option B : Table d'Association Dédiée**
- Créer une table `OrganizationUser` qui lie `keycloakUserId` à `organizationId`
- Gérer les associations via l'API backend
- Plus de contrôle mais nécessite une synchronisation manuelle

**Recommandation : Option A** pour une meilleure intégration avec Keycloak.

#### 2.2 Attributs Personnalisés Keycloak
- Ajouter un attribut `organization_id` aux utilisateurs
- Utiliser les groupes Keycloak pour représenter les entreprises
- Stocker les rôles au niveau de l'organisation dans la base de données

---

### 3. Tracking des Utilisations

#### 3.1 Intercepteur de Requêtes

Créer un `@Aspect` ou un `@Interceptor` pour intercepter les appels aux endpoints de recherche :

```java
@Aspect
@Component
public class UsageTrackingAspect {
    
    @Autowired
    private UsageService usageService;
    
    @Autowired
    private OrganizationService organizationService;
    
    @Around("@annotation(org.springframework.web.bind.annotation.GetMapping) && " +
            "execution(* com.muhend.backend.codesearch.controller.RechercheController.*(..))")
    public Object trackUsage(ProceedingJoinPoint joinPoint) throws Throwable {
        // 1. Récupérer l'utilisateur depuis le JWT
        String keycloakUserId = getKeycloakUserIdFromSecurityContext();
        String organizationId = getOrganizationIdFromUser(keycloakUserId);
        
        // 2. Vérifier les quotas
        if (!usageService.checkQuota(organizationId)) {
            throw new QuotaExceededException("Quota mensuel dépassé");
        }
        
        // 3. Exécuter la requête et mesurer le coût
        long startTime = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long duration = System.currentTimeMillis() - startTime;
        
        // 4. Récupérer les informations de coût depuis OpenAiService
        Double cost = extractCostFromRequest(); // À implémenter
        
        // 5. Enregistrer l'utilisation
        Usage usage = new Usage();
        usage.setOrganizationId(organizationId);
        usage.setKeycloakUserId(keycloakUserId);
        usage.setEndpoint(getEndpoint(joinPoint));
        usage.setSearchTerm(getSearchTerm(joinPoint));
        usage.setCostUsd(cost);
        usage.setTimestamp(LocalDateTime.now());
        usageService.saveUsage(usage);
        
        return result;
    }
}
```

#### 3.2 Modification de `OpenAiService`

Modifier `OpenAiService.demanderAiAide()` pour exposer le coût :

```java
public class OpenAiService {
    
    // Stocker le coût dans un ThreadLocal pour l'aspect
    private static final ThreadLocal<Double> currentRequestCost = new ThreadLocal<>();
    
    public String demanderAiAide(String titre, String question) {
        // ... code existant ...
        
        // Après calcul du coût
        prix_requete = totalTokens * PRICE_TOTAL;
        currentRequestCost.set(prix_requete);
        
        return assistantMessage;
    }
    
    public static Double getCurrentRequestCost() {
        return currentRequestCost.get();
    }
    
    public static void clearCurrentRequestCost() {
        currentRequestCost.remove();
    }
}
```

---

### 4. Services Backend

#### 4.1 `OrganizationService`
- `createOrganization(OrganizationDto dto)` : Créer une entreprise
- `updateOrganization(Long id, OrganizationDto dto)` : Mettre à jour
- `getOrganization(Long id)` : Récupérer une entreprise
- `listOrganizations()` : Lister toutes les entreprises
- `addUserToOrganization(String keycloakUserId, Long organizationId, String role)` : Ajouter un utilisateur
- `removeUserFromOrganization(String keycloakUserId, Long organizationId)` : Retirer un utilisateur
- `getOrganizationUsers(Long organizationId)` : Lister les utilisateurs d'une entreprise

#### 4.2 `UsageService`
- `saveUsage(Usage usage)` : Enregistrer une utilisation
- `getUsageByOrganization(Long organizationId, LocalDate start, LocalDate end)` : Récupérer les utilisations
- `getUsageStats(Long organizationId, LocalDate start, LocalDate end)` : Statistiques d'utilisation
- `checkQuota(Long organizationId)` : Vérifier si le quota est dépassé
- `getCurrentMonthUsage(Long organizationId)` : Utilisation du mois en cours

#### 4.3 `SubscriptionService`
- `createSubscription(Long organizationId, Long planId)` : Créer un abonnement
- `updateSubscription(Long subscriptionId, SubscriptionDto dto)` : Mettre à jour
- `cancelSubscription(Long subscriptionId)` : Annuler un abonnement
- `getActiveSubscription(Long organizationId)` : Récupérer l'abonnement actif
- `renewSubscription(Long subscriptionId)` : Renouveler un abonnement

#### 4.4 `InvoiceService`
- `generateInvoice(Long organizationId, LocalDate start, LocalDate end)` : Générer une facture
- `getInvoice(Long invoiceId)` : Récupérer une facture
- `listInvoices(Long organizationId)` : Lister les factures d'une entreprise
- `markInvoiceAsPaid(Long invoiceId)` : Marquer une facture comme payée
- `generateInvoicePdf(Long invoiceId)` : Générer le PDF de la facture

---

### 5. Contrôleurs REST API

#### 5.1 `OrganizationController` (`/api/organizations`)
- `POST /api/organizations` : Créer une entreprise (ADMIN uniquement)
- `GET /api/organizations` : Lister les entreprises (ADMIN)
- `GET /api/organizations/{id}` : Récupérer une entreprise
- `PUT /api/organizations/{id}` : Mettre à jour (ADMIN ou OWNER de l'entreprise)
- `DELETE /api/organizations/{id}` : Supprimer (ADMIN uniquement)
- `POST /api/organizations/{id}/users` : Ajouter un utilisateur
- `DELETE /api/organizations/{id}/users/{userId}` : Retirer un utilisateur
- `GET /api/organizations/{id}/users` : Lister les utilisateurs

#### 5.2 `UsageController` (`/api/usage`)
- `GET /api/usage` : Mes utilisations (USER)
- `GET /api/usage/organization/{organizationId}` : Utilisations de mon entreprise (ADMIN de l'entreprise)
- `GET /api/usage/stats` : Statistiques de consommation
- `GET /api/usage/quota` : État du quota actuel

#### 5.3 `SubscriptionController` (`/api/subscriptions`)
- `GET /api/subscriptions/plans` : Lister les plans disponibles
- `POST /api/subscriptions` : Créer un abonnement (ADMIN)
- `GET /api/subscriptions/organization/{organizationId}` : Abonnement d'une entreprise
- `PUT /api/subscriptions/{id}` : Mettre à jour un abonnement
- `DELETE /api/subscriptions/{id}` : Annuler un abonnement

#### 5.4 `InvoiceController` (`/api/invoices`)
- `GET /api/invoices` : Mes factures (USER de l'entreprise)
- `GET /api/invoices/{id}` : Détails d'une facture
- `GET /api/invoices/{id}/pdf` : Télécharger le PDF
- `POST /api/invoices/generate` : Générer une facture (ADMIN)

---

### 6. Sécurité et Autorisations

#### 6.1 Rôles
- **ADMIN** (système) : Accès complet à toutes les entreprises
- **ORGANIZATION_ADMIN** : Administration d'une entreprise spécifique
- **ORGANIZATION_USER** : Utilisateur d'une entreprise (peut faire des recherches)
- **ORGANIZATION_VIEWER** : Consultation seule (pas de recherches)

#### 6.2 Rules Spring Security
```java
@PreAuthorize("hasRole('ADMIN') or (hasRole('ORGANIZATION_ADMIN') and @organizationService.isUserInOrganization(authentication.name, #organizationId))")
```

#### 6.3 Vérification de Quota
- Avant chaque requête, vérifier le quota mensuel
- Si quota dépassé, retourner une erreur `429 Too Many Requests`
- Permettre le dépassement avec facturation supplémentaire (optionnel)

---

### 7. Frontend Angular

#### 7.1 Modules à Créer
- **OrganizationModule** : Gestion des entreprises
- **UsageModule** : Tableau de bord de consommation
- **SubscriptionModule** : Gestion des abonnements
- **InvoiceModule** : Visualisation des factures

#### 7.2 Composants Principaux

**OrganizationManagementComponent**
- Liste des entreprises (ADMIN)
- Formulaire de création/édition
- Gestion des utilisateurs d'une entreprise

**UsageDashboardComponent**
- Graphique de consommation (par jour, semaine, mois)
- Tableau des dernières utilisations
- Indicateurs de quota (utilisé / total)
- Coûts cumulés

**SubscriptionManagementComponent**
- Liste des plans disponibles
- Abonnement actif de l'entreprise
- Historique des abonnements

**InvoiceListComponent**
- Liste des factures
- Téléchargement de PDF
- Filtres par période

#### 7.3 Services Angular
- `OrganizationService` : Appels API pour les entreprises
- `UsageService` : Récupération des utilisations
- `SubscriptionService` : Gestion des abonnements
- `InvoiceService` : Gestion des factures

---

### 8. Migrations de Base de Données

#### 8.1 Utiliser Flyway ou Liquibase
Créer des migrations SQL pour :
1. Créer les tables (`organizations`, `organization_users`, `subscription_plans`, `subscriptions`, `usages`, `invoices`, `invoice_items`)
2. Créer les index pour les performances
3. Ajouter les contraintes de clés étrangères
4. Insérer les plans d'abonnement par défaut

#### 8.2 Plan de Migration
1. **Phase 1** : Créer les tables et relations
2. **Phase 2** : Migrer les utilisateurs existants (créer des organisations par défaut)
3. **Phase 3** : Activer le tracking des utilisations
4. **Phase 4** : Générer les premières factures

---

### 9. Plan d'Implémentation

#### Phase 1 : Fondations (Semaine 1-2)
- [ ] Créer les entités JPA
- [ ] Créer les repositories
- [ ] Créer les services de base (Organization, Usage, Subscription)
- [ ] Créer les migrations de base de données
- [ ] Tests unitaires des services

#### Phase 2 : Tracking (Semaine 3)
- [ ] Implémenter l'aspect de tracking des utilisations
- [ ] Modifier `OpenAiService` pour exposer les coûts
- [ ] Intégrer la vérification de quota
- [ ] Tests d'intégration du tracking

#### Phase 3 : API Backend (Semaine 4)
- [ ] Créer les contrôleurs REST
- [ ] Implémenter la sécurité et les autorisations
- [ ] Tests d'intégration des API
- [ ] Documentation Swagger/OpenAPI

#### Phase 4 : Frontend (Semaine 5-6)
- [ ] Créer les modules Angular
- [ ] Implémenter les composants de gestion
- [ ] Intégrer les graphiques de consommation (Chart.js ou ng2-charts)
- [ ] Tests E2E

#### Phase 5 : Facturation (Semaine 7)
- [ ] Implémenter la génération de factures
- [ ] Génération de PDF (iText ou Apache PDFBox)
- [ ] Système de notification par email
- [ ] Tests de facturation

#### Phase 6 : Intégration Keycloak (Semaine 8)
- [ ] Synchronisation avec les groupes Keycloak
- [ ] Gestion des rôles au niveau organisation
- [ ] Tests d'intégration

#### Phase 7 : Optimisation et Documentation (Semaine 9-10)
- [ ] Optimisation des requêtes (index, cache)
- [ ] Documentation utilisateur
- [ ] Documentation développeur
- [ ] Déploiement en production

---

### 10. Métriques et Monitoring

#### 10.1 Métriques à Suivre
- Nombre de requêtes par jour/mois
- Coûts totaux par entreprise
- Taux d'utilisation des quotas
- Temps de réponse des API
- Taux d'erreur

#### 10.2 Alertes
- Quota dépassé à 80%
- Quota dépassé à 100%
- Facture impayée depuis X jours
- Erreurs de tracking

---

### 11. Tarification Suggérée

#### Plan Starter (29€/mois)
- 1 000 requêtes/mois incluses
- 0,05€ par requête supplémentaire
- Support par email

#### Plan Professional (99€/mois)
- 10 000 requêtes/mois incluses
- 0,03€ par requête supplémentaire
- Support prioritaire
- Export des données

#### Plan Enterprise (299€/mois)
- 50 000 requêtes/mois incluses
- 0,02€ par requête supplémentaire
- Support dédié
- API personnalisée
- SLA garanti

---

### 12. Questions à Résoudre

1. **Conversion USD/EUR** : Comment gérer la fluctuation des taux de change ?
   - **Réponse** : Utiliser un taux fixe mensuel ou un service de conversion en temps réel

2. **Facturation des échecs** : Faut-il facturer les requêtes qui échouent ?
   - **Réponse** : Non, facturer uniquement les requêtes réussies (coût OpenAI réel)

3. **Période de facturation** : Mensuelle, trimestrielle, annuelle ?
   - **Réponse** : Commencer par mensuelle, permettre le changement de période

4. **Paiement** : Intégration avec un service de paiement (Stripe, PayPal) ?
   - **Réponse** : Phase 2, commencer par facturation manuelle

5. **Rétention des données** : Combien de temps garder les données d'utilisation ?
   - **Réponse** : Minimum 2 ans pour les factures, 1 an pour les détails d'utilisation

---

## 🚀 Prochaines Étapes

1. **Valider la stratégie** avec l'équipe
2. **Créer un POC** (Proof of Concept) pour valider l'approche
3. **Démarrer l'implémentation** selon le plan défini
4. **Itérer** en fonction des retours utilisateurs

---

## 📚 Ressources

- [Spring Data JPA Documentation](https://spring.io/projects/spring-data-jpa)
- [Keycloak Admin Client](https://www.keycloak.org/docs/latest/server_admin/#admin-client-api)
- [Angular Material](https://material.angular.io/) pour l'UI
- [Chart.js](https://www.chartjs.org/) pour les graphiques
- [iText PDF](https://itextpdf.com/) pour la génération de PDF

