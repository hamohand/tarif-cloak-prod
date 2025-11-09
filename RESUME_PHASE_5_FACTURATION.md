# 📋 Résumé Phase 5 - Facturation

## ✅ État d'Implémentation

### Backend ✅

#### 1. Modèle de Données
- ✅ **Invoice** : Entité pour les factures
  - Champs : id, organizationId, organizationName, organizationEmail, invoiceNumber, periodStart, periodEnd, totalAmount, status, createdAt, dueDate, paidAt, notes
  - Statuts : DRAFT, PENDING, PAID, OVERDUE, CANCELLED
  
- ✅ **InvoiceItem** : Entité pour les lignes de facture
  - Champs : id, invoice, description, quantity, unitPrice, totalPrice, itemType

#### 2. Repositories
- ✅ **InvoiceRepository** : Méthodes pour récupérer les factures
- ✅ **InvoiceItemRepository** : Méthodes pour récupérer les lignes de facture

#### 3. Services
- ✅ **InvoiceService** : Service pour générer et gérer les factures
  - `generateMonthlyInvoice(organizationId, year, month)` : Génère une facture mensuelle
  - `generateInvoice(organizationId, periodStart, periodEnd)` : Génère une facture pour une période personnalisée
  - `generateMonthlyInvoicesForAllOrganizations(year, month)` : Génère les factures pour toutes les organisations
  - `getInvoiceById(invoiceId)` : Récupère une facture par son ID
  - `getInvoicesByOrganization(organizationId)` : Récupère les factures d'une organisation
  - `getAllInvoices()` : Récupère toutes les factures (admin)
  - `updateInvoiceStatus(invoiceId, status, notes)` : Met à jour le statut d'une facture

- ✅ **InvoicePdfService** : Service pour générer des PDF
  - `generatePdf(invoice)` : Génère un PDF à partir d'une facture
  - Template professionnel avec en-tête, informations, lignes de facture, total, notes, pied de page

#### 4. Controllers
- ✅ **InvoiceController** : Endpoints REST pour les factures
  - `GET /api/invoices/my-invoices` : Liste des factures de l'utilisateur connecté
  - `GET /api/invoices/my-invoices/{id}` : Détail d'une facture de l'utilisateur connecté
  - `GET /api/invoices/my-invoices/{id}/pdf` : Télécharger le PDF d'une facture
  - `GET /api/invoices/admin/all` : Liste de toutes les factures (admin)
  - `GET /api/invoices/admin/organization/{organizationId}` : Factures d'une organisation (admin)
  - `GET /api/invoices/admin/{id}` : Détail d'une facture (admin)
  - `GET /api/invoices/admin/{id}/pdf` : Télécharger le PDF d'une facture (admin)
  - `POST /api/invoices/admin/generate` : Générer une facture pour une période personnalisée (admin)
  - `POST /api/invoices/admin/generate-monthly` : Générer une facture mensuelle (admin)
  - `POST /api/invoices/admin/generate-all-monthly` : Générer les factures mensuelles pour toutes les organisations (admin)
  - `PUT /api/invoices/admin/{id}/status` : Mettre à jour le statut d'une facture (admin)

#### 5. DTOs
- ✅ **InvoiceDto** : DTO pour les factures
- ✅ **InvoiceItemDto** : DTO pour les lignes de facture
- ✅ **GenerateInvoiceRequest** : Request pour générer une facture
- ✅ **UpdateInvoiceStatusRequest** : Request pour mettre à jour le statut

#### 6. Dépendances
- ✅ **iText 8.0.5** : Bibliothèque pour la génération de PDF
  - `kernel` : Core de iText
  - `layout` : Mise en page
  - `html2pdf` : Conversion HTML vers PDF (optionnel)

### Frontend ⏳ (À implémenter)

#### 1. Service Angular
- ⏳ **InvoiceService** : Service pour récupérer les factures
  - `getMyInvoices()` : Récupère les factures de l'utilisateur connecté
  - `getInvoiceById(id)` : Récupère une facture par son ID
  - `downloadInvoicePdf(id)` : Télécharge le PDF d'une facture
  - `getAllInvoices()` : Récupère toutes les factures (admin)
  - `generateInvoice(request)` : Génère une facture (admin)
  - `updateInvoiceStatus(id, status)` : Met à jour le statut d'une facture (admin)

#### 2. Composants Angular
- ⏳ **InvoicesComponent** : Liste des factures
  - Tableau avec les factures
  - Filtrage par période
  - Téléchargement PDF
  - Affichage du statut
  
- ⏳ **InvoiceDetailComponent** : Détail d'une facture
  - Informations de la facture
  - Lignes de facture
  - Total
  - Bouton pour télécharger le PDF

#### 3. Routes
- ⏳ `/invoices` : Liste des factures
- ⏳ `/invoices/:id` : Détail d'une facture

## 📊 Fonctionnalités

### Génération de Factures

1. **Facture Mensuelle** :
   - Génère automatiquement une facture pour un mois donné
   - Agrége les logs d'utilisation pour la période
   - Crée des lignes de facture par endpoint
   - Calcule le total basé sur les coûts réels

2. **Facture Période Personnalisée** :
   - Génère une facture pour une période spécifique
   - Même logique que la facture mensuelle

3. **Génération en Masse** :
   - Génère les factures pour toutes les organisations ayant une utilisation
   - Ignore les organisations sans utilisation
   - Ignore les organisations ayant déjà une facture pour la période

### Numérotation des Factures

- Format : `INV-{YYYYMM}-{ORG_ID}-{SEQUENCE}`
- Exemple : `INV-202411-001-1`
- Unicité garantie par la base de données

### Génération PDF

- Template professionnel avec :
  - En-tête avec numéro de facture
  - Informations de l'organisation
  - Informations de facturation (période, dates)
  - Tableau des lignes de facture
  - Total HT, TVA (0%), Total TTC
  - Notes (si présentes)
  - Pied de page

### Sécurité

- ✅ Utilisateurs : Peuvent voir uniquement les factures de leur organisation
- ✅ Admin : Peuvent voir toutes les factures et générer des factures
- ✅ Vérification des permissions sur chaque endpoint

## 🔧 Prochaines Étapes

### Backend
- [ ] Ajouter une tâche planifiée pour générer automatiquement les factures mensuelles
- [ ] Ajouter des tests unitaires et d'intégration
- [ ] Ajouter la gestion des erreurs et la validation

### Frontend
- [ ] Créer le service Angular `InvoiceService`
- [ ] Créer le composant `InvoicesComponent`
- [ ] Créer le composant `InvoiceDetailComponent`
- [ ] Ajouter les routes
- [ ] Ajouter les liens dans la navbar
- [ ] Tester l'intégration complète

### Améliorations Futures
- [ ] Envoi automatique des factures par email
- [ ] Templates de facture personnalisables
- [ ] Gestion de la TVA
- [ ] Historique des paiements
- [ ] Rappels de paiement

## 📝 Notes

- Les factures sont générées basées sur les logs d'utilisation réels
- Le total est calculé à partir des coûts réels des requêtes OpenAI
- Les factures peuvent être générées manuellement ou automatiquement
- Les PDF sont générés à la demande (pas de stockage de fichiers)
- La numérotation des factures est unique et séquentielle

---

**Dernière mise à jour** : Après implémentation du backend de la Phase 5

