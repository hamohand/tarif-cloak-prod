# Plan de Facturation - HS-Code API

## Vue d'ensemble

Ce document décrit le système de facturation en vigueur pour l'application HS-Code.

**Dernière mise à jour** : Mars 2026

---

## Modèle de facturation actuel

### Plans disponibles

| Type | Description |
|---|---|
| Essai gratuit | Période d'essai avec quota limité, sans facturation |
| Plan mensuel | Forfait fixe mensuel avec quota de requêtes |

Le modèle **pay-per-request a été supprimé**. Seuls les plans mensuels et l'essai gratuit sont proposés.

---

## Plan Essai Gratuit

- `trialPeriodDays` > 0 : durée de l'essai en jours
- `pricePerMonth` : `null`
- `monthlyQuota` : quota de requêtes incluses pendant l'essai

**Règles :**
- Une organisation ne peut utiliser l'essai qu'**une seule fois**
- À l'issue de l'essai, l'accès HS-code est bloqué jusqu'à souscription d'un plan payant

---

## Plans Mensuels

- `pricePerMonth` : prix fixe mensuel en DZD
- `monthlyQuota` : nombre de requêtes autorisées par mois (`null` = illimité)
- `currency` : `DZD` (marché algérien)

**Cycle mensuel :**
- Commence le jour J (date de paiement)
- Se termine le jour J−1 du mois suivant (`monthlyPlanEndDate`)
- Exemple : paiement le 8 mars → accès du 8 mars au 7 avril inclus

**Pas de renouvellement automatique :**
- À l'expiration, l'accès est immédiatement bloqué
- Le client doit manuellement souscrire un nouveau plan via Chargily

---

## Contrôle d'accès

L'accès HS-code est bloqué dans deux cas :

1. **Plan expiré** : `LocalDate.now().isAfter(monthlyPlanEndDate)`
2. **Quota épuisé** : `currentUsage >= monthlyQuota`

Point d'entrée : `InternalController.checkQuota()` → `OrganizationService.canOrganizationMakeRequests()`

---

## Paiement via Chargily Pay

### Flux complet

```
Utilisateur sélectionne un plan payant dans /organization/stats
→ Clic "Payer avec Chargily"
Frontend → POST /api/payments/chargily/checkout  { pricingPlanId, successUrl, cancelUrl }
         ← { url: "https://pay.chargily.com/..." }
Frontend redirige vers url (window.location.href)
Utilisateur paie (CIB ou EDAHABIA)
Chargily → POST /api/webhooks/chargily  (checkout.paid)
Backend  → OrganizationService.activatePlanAfterPayment()
         → Plan activé, monthlyPlanStartDate/EndDate initialisés
Utilisateur redirigé vers /organization/stats (successUrl)
```

### Plans gratuits / essai

Les plans sans prix (`pricePerMonth = 0` ou `null`) sont activés directement sans paiement via `PUT /api/user/organization/pricing-plan`.

### Metadata transmises à Chargily

```json
{
  "organization_id": "6",
  "pricing_plan_id": "9",
  "invoice_id": "1"
}
```

### Événements webhook gérés

| Événement | Action backend |
|---|---|
| `checkout.paid` | Enregistre le paiement, active le plan, marque la facture PAID |
| `checkout.failed` | Enregistre le paiement avec statut FAILED |
| `checkout.canceled` | Enregistre le paiement avec statut CANCELED |

### Sécurité webhook

- Signature HMAC-SHA256 vérifiée sur chaque requête entrante
- Comparaison time-safe via `MessageDigest.isEqual()`
- Route publique (pas de JWT) : `/webhooks/chargily`

---

## Scheduler

`MonthlyPlanSchedulerService` — cron `0 0 0 * * ?` (minuit)

**Seule tâche active :**
- Appliquer les changements de plan en attente (`pendingMonthlyPlanId`) dont la date d'effet est arrivée

**Tâches supprimées :**
- ~~Reconduction automatique des plans expirés~~ (supprimée)
- ~~Application des changements pay-per-request~~ (supprimée)

---

## Factures

- Générées automatiquement à la souscription d'un plan
- Marquées `PAID` par le webhook `checkout.paid` via `invoice_id` dans les metadata
- `InvoiceService` gère la création ; `InvoiceRepository` la persistance

---

## Configuration

```env
CHARGILY_API_KEY=...       # Clé secrète Chargily (Bearer token pour l'API)
CHARGILY_SECRET_KEY=...    # Clé de signature HMAC pour les webhooks
```

- Dashboard test : `https://pay.chargily.com/test/dashboard/developers-corner`
- Dashboard production : `https://pay.chargily.com/dashboard/developers-corner`
- URL webhook à configurer dans Chargily : `https://[domaine]/api/webhooks/chargily`

---

## Endpoints paiement

| Méthode | Endpoint | Description |
|---|---|---|
| POST | `/api/payments/chargily/checkout` | Créer un checkout pour un plan |
| POST | `/api/payments/chargily/checkout/invoice` | Créer un checkout pour une facture existante |
| POST | `/webhooks/chargily` | Réception des webhooks Chargily (public) |
