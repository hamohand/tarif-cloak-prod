# 📋 Plan Phase 5 - Facturation

## 🎯 Objectif

Implémenter un système de facturation mensuel pour les organisations, permettant de :
- Générer automatiquement des factures mensuelles basées sur l'utilisation
- Générer des factures au format PDF
- Envoyer des factures par email (optionnel)
- Visualiser les factures dans l'interface utilisateur

## 📊 Architecture

### Backend

#### 1. Entités
- **Invoice** : Facture principale
  - `id`, `organizationId`, `organizationName`, `invoiceNumber`, `periodStart`, `periodEnd`, `totalAmount`, `status`, `createdAt`, `dueDate`
- **InvoiceItem** : Ligne de facture
  - `id`, `invoiceId`, `description`, `quantity`, `unitPrice`, `totalPrice`

#### 2. Services
- **InvoiceService** : Génération et gestion des factures
- **InvoicePdfService** : Génération de PDF
- **InvoiceEmailService** : Envoi d'emails (optionnel)

#### 3. Controllers
- **InvoiceController** : Endpoints REST pour les factures

#### 4. DTOs
- **InvoiceDto** : DTO pour les factures
- **InvoiceItemDto** : DTO pour les lignes de facture
- **CreateInvoiceRequest** : Request pour créer une facture
- **InvoiceListResponse** : Response pour la liste des factures

### Frontend

#### 1. Services
- **InvoiceService** : Service Angular pour les factures

#### 2. Composants
- **InvoicesComponent** : Liste des factures
- **InvoiceDetailComponent** : Détail d'une facture
- **InvoicePdfViewerComponent** : Visualisation PDF (optionnel)

#### 3. Routes
- `/invoices` : Liste des factures (admin et user)
- `/invoices/:id` : Détail d'une facture

## 📋 Étapes d'Implémentation

### Étape 1 : Modèle de Données (Backend)

#### 1.1 Créer l'entité Invoice
- Table `invoice`
- Champs : id, organization_id, invoice_number, period_start, period_end, total_amount, status, created_at, due_date

#### 1.2 Créer l'entité InvoiceItem
- Table `invoice_item`
- Champs : id, invoice_id, description, quantity, unit_price, total_price

#### 1.3 Créer les repositories
- `InvoiceRepository`
- `InvoiceItemRepository`

### Étape 2 : Service de Génération de Factures

#### 2.1 Créer InvoiceService
- Méthode `generateMonthlyInvoice(organizationId, year, month)`
- Méthode `getInvoiceById(invoiceId)`
- Méthode `getInvoicesByOrganization(organizationId)`
- Méthode `getAllInvoices()` (admin)

#### 2.2 Logique de génération
- Agréger les `usage_log` pour le mois
- Calculer le total par organisation
- Créer les lignes de facture (par type d'endpoint ou agrégé)
- Générer un numéro de facture unique

### Étape 3 : Génération PDF

#### 3.1 Ajouter la dépendance
- iText ou Apache PDFBox

#### 3.2 Créer InvoicePdfService
- Méthode `generatePdf(invoice)`
- Template de facture professionnel
- En-tête avec logo et informations
- Détails de l'organisation
- Lignes de facture
- Total et informations de paiement

#### 3.3 Endpoint pour télécharger le PDF
- `GET /api/invoices/{id}/pdf`

### Étape 4 : Endpoints REST

#### 4.1 InvoiceController
- `GET /api/invoices` : Liste des factures (admin et user)
- `GET /api/invoices/{id}` : Détail d'une facture
- `GET /api/invoices/{id}/pdf` : Télécharger le PDF
- `POST /api/invoices/generate` : Générer une facture manuellement (admin)
- `POST /api/invoices/generate-monthly` : Générer les factures mensuelles pour toutes les organisations (admin)

### Étape 5 : Interface Utilisateur (Frontend)

#### 5.1 Service Angular
- `InvoiceService` avec méthodes pour récupérer les factures

#### 5.2 Composant Liste des Factures
- Tableau avec les factures
- Filtrage par organisation (admin)
- Filtrage par période
- Téléchargement PDF
- Affichage du statut (payé, en attente, etc.)

#### 5.3 Composant Détail de Facture
- Informations de la facture
- Lignes de facture
- Total
- Bouton pour télécharger le PDF

#### 5.4 Routes
- `/invoices` : Liste des factures
- `/invoices/:id` : Détail d'une facture

### Étape 6 : Tâches Planifiées (Optionnel)

#### 6.1 Génération Automatique Mensuelle
- Tâche planifiée pour générer les factures à la fin du mois
- `@Scheduled(cron = "0 0 1 * * ?")` : Le 1er de chaque mois à minuit

#### 6.2 Envoi Automatique par Email (Optionnel)
- Envoyer les factures par email aux organisations
- Template d'email avec pièce jointe PDF

## 📊 Structure des Données

### Invoice
```java
@Entity
@Table(name = "invoice")
public class Invoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;
    
    @Column(name = "organization_name", nullable = false)
    private String organizationName;
    
    @Column(name = "invoice_number", unique = true, nullable = false)
    private String invoiceNumber;
    
    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;
    
    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;
    
    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;
    
    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    private InvoiceStatus status;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;
    
    public enum InvoiceStatus {
        DRAFT,      // Brouillon
        PENDING,    // En attente de paiement
        PAID,       // Payé
        OVERDUE,    // En retard
        CANCELLED   // Annulé
    }
}
```

### InvoiceItem
```java
@Entity
@Table(name = "invoice_item")
public class InvoiceItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;
    
    @Column(name = "description", nullable = false)
    private String description;
    
    @Column(name = "quantity", nullable = false)
    private Integer quantity;
    
    @Column(name = "unit_price", nullable = false, precision = 10, scale = 6)
    private BigDecimal unitPrice;
    
    @Column(name = "total_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalPrice;
}
```

## 🔧 Implémentation

### Ordre d'Implémentation

1. **Modèle de données** (Invoice, InvoiceItem, Repositories)
2. **Service de génération** (InvoiceService)
3. **Endpoints REST** (InvoiceController)
4. **Génération PDF** (InvoicePdfService)
5. **Interface utilisateur** (Service Angular, Composants)
6. **Tâches planifiées** (Génération automatique)

### Temps Estimé

- **Modèle de données** : 1-2 heures
- **Service de génération** : 2-3 heures
- **Endpoints REST** : 1-2 heures
- **Génération PDF** : 3-4 heures
- **Interface utilisateur** : 3-4 heures
- **Tâches planifiées** : 1 heure
- **Total** : 11-16 heures

## 📝 Notes

- Les factures sont générées mensuellement
- Chaque facture couvre une période d'un mois
- Le numéro de facture est unique et généré automatiquement
- Les factures peuvent être générées manuellement ou automatiquement
- Les factures peuvent être téléchargées en PDF
- Les factures peuvent être envoyées par email (optionnel)

---

**Dernière mise à jour** : Début de la Phase 5 - Facturation

