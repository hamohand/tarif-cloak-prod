# Plan de Facturation - HS-Code API

## 📋 Vue d'ensemble

Ce document décrit le système de facturation complet pour l'application HS-Code, incluant les différents types de plans tarifaires et leurs règles de facturation.

---

## 💰 Types de Plans Tarifaires

### 1. Plans Mensuels (avec quota)

**Caractéristiques :**
- `pricePerMonth` : Prix mensuel fixe
- `monthlyQuota` : Nombre de requêtes autorisées par mois
- `pricePerRequest` : `null`

**Facturation :**
- Facture mensuelle générée en fin de mois
- Proratisation lors du changement de plan en cours de mois

### 2. Plans Pay-per-Request (facturation à la requête)

**Caractéristiques :**
- `pricePerRequest` : Prix par requête
- `monthlyQuota` : `null` (pas de limite)
- `pricePerMonth` : `null`

**Facturation :**
- Facture bihebdomadaire (toutes les 2 semaines)
- Génération automatique tous les lundis à 8h00
- Période facturée : 14 derniers jours (du lundi il y a 2 semaines au dimanche dernier)

---

## 🔄 Règles de Changement de Plan

### Cas 1 : Deux plans mensuels

#### oldPlan.quota < newPlan.quota
- ✅ Changement possible immédiatement
- Nouveau quota = `newPlan.quota - requêtes_déjà_consommées_ce_mois`
- Exemple : 
  - Ancien plan : 300 requêtes/mois
  - Nouveau plan : 500 requêtes/mois
  - Requêtes consommées : 100
  - Nouveau quota : 500 - 100 = **400 requêtes**

#### oldPlan.quota > newPlan.quota
- ⚠️ Changement possible uniquement le 1er du mois
- Si changement le 1er : quota complet du nouveau plan
- Si changement après le 1er : exception levée

#### oldPlan.quota == newPlan.quota
- ✅ Changement autorisé, quota identique

### Cas 2 : Un plan Pay-per-Request impliqué

#### Passage d'un plan mensuel vers Pay-per-Request
- ✅ Changement possible immédiatement
- L'ancien plan mensuel est **entièrement dû** (pas de proratisation)
- Facture mensuelle complète générée pour l'ancien plan
- Pas de facture de démarrage pour Pay-per-Request

#### Passage de Pay-per-Request vers un plan mensuel
- ✅ Changement possible immédiatement
- Le nouveau plan mensuel est **entièrement dû** (pas de proratisation)
- Facture mensuelle complète générée pour le nouveau plan
- Pas de facture de clôture pour Pay-per-Request

### Cas 3 : Quota mensuel entièrement consommé

**⚠️ Non implémenté actuellement** : Le passage automatique vers Pay-per-Request lorsque le quota est dépassé n'est pas activé. Une exception `QuotaExceededException` est levée.

---

## 📅 Calendrier de Facturation

### Factures Mensuelles (plans avec quota)

- **Période** : Du 1er au dernier jour du mois
- **Génération** : Manuelle ou automatique en fin de mois
- **Échéance** : 30 jours après la fin de la période

### Factures Bihebdomadaires (plans Pay-per-Request)

- **Période** : 14 jours consécutifs
- **Génération automatique** : Tous les lundis à 8h00
- **Période facturée** : Du lundi il y a 2 semaines au dimanche dernier
- **Échéance** : 14 jours après la fin de la période
- **Format du numéro** : `ORG-{organizationId}-{YYYYMMDD}-BIWEEKLY`

---

## 🧮 Calcul des Coûts

### Coût par requête

Chaque requête est facturée selon la formule :

```
Coût total = Tarif de base (BASE_REQUEST_PRICE_EUR) + Coût des tokens IA
```

**Détail du coût des tokens :**
- Prix input : 0.15 USD par million de tokens
- Prix output : 0.60 USD par million de tokens
- Taux de change USD → EUR : 0.92 (configurable)

**Exemple :**
- Tarif de base : 0.01 EUR
- Tokens input : 1000 tokens
- Tokens output : 500 tokens
- Coût tokens = (1000 × 0.15/1M + 500 × 0.60/1M) × 0.92 = 0.000414 EUR
- **Coût total = 0.01 + 0.000414 = 0.010414 EUR**

### Facture mensuelle

```
Total facture = Σ (Coût de chaque requête du mois)
```

### Facture bihebdomadaire

```
Total facture = Σ (Coût de chaque requête des 14 derniers jours)
```

---

## 🔐 Sécurité et Validation

### Vérifications avant génération de facture

1. ✅ L'organisation existe
2. ✅ Aucune facture n'existe déjà pour la période
3. ✅ Au moins une requête a été effectuée pendant la période (pour Pay-per-Request)

### Gestion des erreurs

- Les erreurs lors de la génération de factures n'interrompent pas le processus
- Les erreurs sont loggées mais n'empêchent pas la génération des autres factures
- Les factures déjà existantes sont ignorées silencieusement

---

## 📧 Notifications

### Email de facture

- Envoyé automatiquement lors de la génération d'une facture
- Destinataires :
  - Email de l'organisation
  - Emails de tous les utilisateurs de l'organisation (récupérés depuis Keycloak)

### Email de rappel (facture en retard)

- Envoyé automatiquement pour les factures en retard
- Tâche planifiée : Tous les jours à 9h00
- Une facture est marquée "OVERDUE" si la date d'échéance est dépassée

---

## 🛠️ Configuration Technique

### Schedulers Spring

1. **Génération factures bihebdomadaires**
   - Cron : `0 0 8 * * MON` (Tous les lundis à 8h00)
   - Méthode : `generateBiweeklyInvoicesForPayPerRequestPlans()`

2. **Marquage factures en retard**
   - Cron : `0 0 9 * * ?` (Tous les jours à 9h00)
   - Méthode : `markOverdueInvoices()`

### Variables d'environnement

```env
# Tarif de base par requête (en EUR)
BASE_REQUEST_PRICE_EUR=0.01

# Taux de change USD → EUR (optionnel, défaut: 0.92)
USD_TO_EUR_RATE=0.92
```

---

## 📊 Exemples de Scénarios

### Scénario 1 : Changement de plan mensuel vers un quota supérieur

**Date** : 15 janvier  
**Ancien plan** : 300 requêtes/mois  
**Nouveau plan** : 500 requêtes/mois  
**Requêtes consommées** : 100 requêtes

**Résultat** :
- ✅ Changement autorisé immédiatement
- Nouveau quota : 500 - 100 = **400 requêtes** pour le reste du mois
- Facture de clôture proratisée pour l'ancien plan (1er-14 janvier)
- Facture de démarrage proratisée pour le nouveau plan (15-31 janvier)

### Scénario 2 : Passage vers Pay-per-Request

**Date** : 15 janvier  
**Ancien plan** : Plan mensuel 300 requêtes/mois  
**Nouveau plan** : Pay-per-Request

**Résultat** :
- ✅ Changement autorisé immédiatement
- Facture mensuelle complète générée pour l'ancien plan (mois entier)
- Pas de facture de démarrage
- Factures bihebdomadaires générées automatiquement à partir du lundi suivant

### Scénario 3 : Facture bihebdomadaire Pay-per-Request

**Date d'exécution** : Lundi 20 janvier à 8h00  
**Période facturée** : Du lundi 6 janvier au dimanche 19 janvier  
**Requêtes effectuées** : 150 requêtes  
**Coût moyen par requête** : 0.05 EUR

**Résultat** :
- Facture générée : **7.50 EUR** (150 × 0.05)
- Numéro de facture : `ORG-123-20240106-BIWEEKLY`
- Échéance : Dimanche 2 février (14 jours après la fin de période)

---

## 📝 Notes Importantes

1. **Proratisation** : Seulement pour les changements entre deux plans mensuels
2. **Facturation complète** : Toujours appliquée lorsqu'un plan Pay-per-Request est impliqué
3. **Quota dépassé** : Actuellement, une exception est levée. Le passage automatique vers Pay-per-Request n'est pas activé.
4. **Factures vides** : Les factures bihebdomadaires ne sont pas générées si aucune requête n'a été effectuée pendant la période.

---

## 🔄 Évolutions Futures Possibles

- [ ] Passage automatique vers Pay-per-Request lorsque le quota mensuel est dépassé
- [ ] Configuration personnalisable de la fréquence des factures bihebdomadaires
- [ ] Support de factures trimestrielles ou annuelles
- [ ] Système de remises et promotions
- [ ] Export des factures en PDF
- [ ] Intégration avec des systèmes de paiement (Stripe, PayPal, etc.)

---

**Dernière mise à jour** : Janvier 2025

