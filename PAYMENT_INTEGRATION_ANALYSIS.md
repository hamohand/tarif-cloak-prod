# Analyse d'Intégration de Paiement Électronique

## État Actuel du Système

### ✅ Ce qui existe déjà
1. **Plans tarifaires** : Système complet avec prix mensuels et par requête
2. **Organisations** : Liées à des plans tarifaires via `pricingPlanId`
3. **Période d'essai** : Support pour les plans d'essai avec `trialExpiresAt`
4. **Quotas** : Gestion des quotas mensuels
5. **Authentification** : Système Keycloak avec rôles ADMIN/USER
6. **Facturation** : ✅ **Système complet de facturation existant !**
   - Génération de factures mensuelles
   - Génération de factures pour périodes personnalisées
   - Statuts de facture (DRAFT, PENDING, PAID, OVERDUE, CANCELLED)
   - Génération de PDF
   - Envoi d'emails de notification
   - Rappels pour factures en retard
   - Historique des factures
   - Lignes de facture détaillées (InvoiceItem)

### ❌ Ce qui manque pour le paiement électronique
1. **Subscriptions/Abonnements** : Pas de suivi des abonnements actifs avec processeur de paiement
2. **Intégration paiement** : Aucun processeur de paiement intégré (Stripe, PayPal, etc.)
3. **Webhooks** : Pas de gestion des événements de paiement du processeur
4. **Métadonnées de paiement** : Pas de stockage des IDs de transaction du processeur
5. **Checkout** : Pas de page de checkout pour payer les factures
6. **Paiements automatiques** : Pas de prélèvement automatique pour les abonnements mensuels
7. **Lien facture-paiement** : Les factures ne sont pas liées aux paiements du processeur

## Options de Processeurs de Paiement

### 1. Stripe (Recommandé) ⭐
**Avantages :**
- API moderne et bien documentée
- Support excellent pour les subscriptions récurrentes
- Webhooks fiables
- Support international (140+ pays)
- Conformité PCI-DSS gérée par Stripe
- Support des cartes, virements, prélèvements SEPA
- Mode test disponible

**Inconvénients :**
- Commission : ~2.9% + 0.30€ par transaction
- Nécessite un compte Stripe

**Idéal pour :**
- Plans mensuels récurrents
- Plans pay-per-request
- Abonnements avec essai gratuit

### 2. PayPal
**Avantages :**
- Reconnaissance de marque
- Accepté mondialement
- Pas de frais d'intégration

**Inconvénients :**
- API moins moderne que Stripe
- Gestion des subscriptions plus complexe
- Expérience utilisateur moins fluide
- Commission similaire

### 3. Mollie (Europe)
**Avantages :**
- Orienté Europe
- Support SEPA direct
- API simple

**Inconvénients :**
- Moins de fonctionnalités que Stripe
- Moins de documentation

## Architecture Proposée

### 1. Modèle de Données

#### Table `subscription`
```sql
CREATE TABLE subscription (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organization(id),
    pricing_plan_id BIGINT NOT NULL REFERENCES pricing_plan(id),
    status VARCHAR(50) NOT NULL, -- active, canceled, past_due, unpaid, trialing
    payment_provider VARCHAR(50) NOT NULL, -- stripe, paypal, etc.
    payment_provider_subscription_id VARCHAR(255), -- ID de l'abonnement chez le processeur
    payment_provider_customer_id VARCHAR(255), -- ID du client chez le processeur
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    canceled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### Table `payment`
```sql
CREATE TABLE payment (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT REFERENCES subscription(id),
    organization_id BIGINT NOT NULL REFERENCES organization(id),
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status VARCHAR(50) NOT NULL, -- pending, succeeded, failed, refunded
    payment_provider VARCHAR(50) NOT NULL,
    payment_provider_payment_id VARCHAR(255), -- ID du paiement chez le processeur
    payment_method VARCHAR(50), -- card, sepa, etc.
    description TEXT,
    invoice_url VARCHAR(500), -- URL vers la facture
    paid_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### Table `invoice`
```sql
CREATE TABLE invoice (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organization(id),
    subscription_id BIGINT REFERENCES subscription(id),
    payment_id BIGINT REFERENCES payment(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status VARCHAR(50) NOT NULL, -- draft, open, paid, void, uncollectible
    due_date TIMESTAMP,
    paid_at TIMESTAMP,
    invoice_pdf_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 2. Workflow de Paiement

#### Création d'un Abonnement
1. **Frontend** : L'utilisateur sélectionne un plan tarifaire
2. **Backend** : Crée une session de checkout Stripe/PayPal
3. **Processeur** : Redirige l'utilisateur vers la page de paiement
4. **Webhook** : Le processeur notifie le backend du succès/échec
5. **Backend** : Crée/met à jour la subscription et active le plan

#### Paiement Récurrent (Mensuel)
1. **Processeur** : Tente le prélèvement automatique
2. **Webhook** : Notification de succès/échec
3. **Backend** : Met à jour le statut de la subscription
4. **Email** : Envoi de facture en cas de succès
5. **Notification** : Alertes en cas d'échec de paiement

#### Paiement à la Requête (Pay-per-Request)
1. **Backend** : Détecte qu'une requête dépasse le quota gratuit
2. **Frontend** : Affiche un modal de paiement
3. **Processeur** : Traite le paiement ponctuel
4. **Webhook** : Confirmation du paiement
5. **Backend** : Crédite les requêtes supplémentaires

### 3. Services Backend

#### `PaymentService`
- Création de sessions de checkout
- Gestion des webhooks
- Création/mise à jour des subscriptions
- Traitement des paiements

#### `SubscriptionService`
- Gestion du cycle de vie des abonnements
- Vérification des statuts
- Gestion des périodes d'essai
- Annulation/renouvellement

#### `InvoiceService`
- Génération de factures
- Envoi par email
- Gestion des statuts

### 4. Endpoints API

#### Public (après authentification)
- `POST /api/payments/checkout` : Créer une session de checkout
- `GET /api/subscriptions/current` : Récupérer l'abonnement actuel
- `GET /api/payments/history` : Historique des paiements
- `GET /api/invoices` : Liste des factures

#### Webhooks (public, vérifié par signature)
- `POST /api/webhooks/stripe` : Webhook Stripe
- `POST /api/webhooks/paypal` : Webhook PayPal

#### Admin
- `GET /api/admin/subscriptions` : Liste des abonnements
- `GET /api/admin/payments` : Liste des paiements
- `POST /api/admin/subscriptions/{id}/cancel` : Annuler un abonnement

### 5. Intégration Frontend

#### Composants nécessaires
1. **CheckoutComponent** : Page de checkout
2. **SubscriptionStatusComponent** : Statut de l'abonnement
3. **PaymentHistoryComponent** : Historique des paiements
4. **InvoiceListComponent** : Liste des factures
5. **BillingSettingsComponent** : Gestion de la facturation

#### Flux utilisateur
1. Sélection d'un plan → Redirection vers checkout
2. Paiement → Confirmation → Activation du plan
3. Dashboard → Affichage du statut de l'abonnement
4. Gestion → Possibilité de changer/annuler le plan

## Étapes d'Implémentation Recommandées

### Phase 1 : Infrastructure de Base (2-3 semaines)
1. ✅ Créer les entités JPA (Subscription, Payment, Invoice)
2. ✅ Créer les repositories
3. ✅ Créer les services de base
4. ✅ Intégrer Stripe SDK
5. ✅ Configurer les variables d'environnement

### Phase 2 : Checkout et Abonnements (2-3 semaines)
1. ✅ Créer les endpoints de checkout
2. ✅ Implémenter la création de sessions Stripe
3. ✅ Gérer les webhooks Stripe
4. ✅ Créer/mettre à jour les subscriptions
5. ✅ Activer les plans après paiement

### Phase 3 : Gestion des Abonnements (1-2 semaines)
1. ✅ Endpoints pour gérer les abonnements
2. ✅ Annulation/renouvellement
3. ✅ Gestion des périodes d'essai
4. ✅ Vérification des statuts

### Phase 4 : Facturation (1-2 semaines)
1. ✅ Génération de factures
2. ✅ Envoi par email
3. ✅ Téléchargement PDF
4. ✅ Historique des factures

### Phase 5 : Frontend (2-3 semaines)
1. ✅ Intégration Stripe Elements
2. ✅ Composants de checkout
3. ✅ Dashboard de gestion
4. ✅ Historique des paiements

### Phase 6 : Pay-per-Request (1-2 semaines)
1. ✅ Détection du dépassement de quota
2. ✅ Modal de paiement
3. ✅ Traitement des paiements ponctuels
4. ✅ Crédit des requêtes

## Considérations Techniques

### Sécurité
- ✅ Validation des webhooks via signatures
- ✅ Stockage sécurisé des clés API
- ✅ Pas de stockage des données de carte (géré par le processeur)
- ✅ Conformité RGPD pour les données de paiement

### Performance
- ✅ Traitement asynchrone des webhooks
- ✅ Cache des statuts de subscription
- ✅ Optimisation des requêtes de facturation

### Fiabilité
- ✅ Retry logic pour les webhooks
- ✅ Idempotence des opérations
- ✅ Logging détaillé
- ✅ Monitoring des échecs de paiement

## Coûts Estimés

### Stripe
- Commission : 2.9% + 0.30€ par transaction
- Pas de frais mensuels
- Mode test gratuit

### Infrastructure
- Stockage supplémentaire : ~10-20 Go (factures PDF)
- Bandwidth : Négligeable
- Temps de développement : 8-12 semaines

## Recommandation

**✅ OUI, il est temps d'ajouter le paiement électronique**

**Raisons :**
1. Le système de plans tarifaires est déjà en place
2. Les organisations sont liées aux plans
3. L'architecture est prête pour l'intégration
4. Stripe offre une excellente intégration pour ce cas d'usage
5. Le marché SaaS nécessite un système de paiement fiable

**Approche recommandée :**
1. Commencer par Stripe (le plus simple et le plus flexible)
2. Implémenter d'abord les abonnements mensuels
3. Ajouter ensuite le pay-per-request
4. Intégrer la facturation progressivement

**Priorité :**
- **Haute** : Checkout et abonnements mensuels
- **Moyenne** : Facturation et historique
- **Basse** : Pay-per-request (peut être ajouté plus tard)

## Prochaines Étapes

Si vous souhaitez procéder, je recommande de :
1. Créer les entités de base (Subscription, Payment, Invoice)
2. Intégrer Stripe SDK
3. Créer les endpoints de base
4. Implémenter le checkout
5. Gérer les webhooks

Souhaitez-vous que je commence par créer les entités et la structure de base ?

