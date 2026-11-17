# Architecture des Éditions Git — `saas-dz-ue` · `saas-conference` · `dz-localization`

Ce document décrit l'organisation unifiée du dépôt autour de **3 branches actives**, sans aucune distinction `prod` / `staging` (dont l'historique passé reste conservé sous les tags `archive/*` et `main`).

---

## 1. Règle commune aux 3 branches

Chaque branche possède à sa racine **exactement les mêmes points d'entrée** :

| Fichier | Rôle | Suivi Git |
| :--- | :--- | :--- |
| **`docker-compose.yml`** | Orchestration unique de la branche active (`docker compose up -d --build`) | Versionné |
| **`.env.example`** | Gabarit complet des variables attendues par la branche active | Versionné |
| **`.env`** | Configuration réelle et secrets de la machine (VPS ou Box locale) | **Ignoré** (`.gitignore`) |

Pour passer d'une édition à l'autre dans un répertoire propre :
```bash
git checkout <branche>
docker compose up -d --build
```

---

## 2. Les 3 branches actives

| Branche | Édition | Cible & Fonctionnement | Migrations Flyway |
| :--- | :--- | :--- | :--- |
| **`saas-dz-ue`** | **SaaS Cloud (`DZ` + `UE`)** | Nomenclatures officielles Algérie (P10 DGD enrichie : droits, taxes, formalités) et Union Européenne 2026 (NC8), comparateur `DZ ↔ UE`, double marché `DA` (Chargily) / `EUR` (Stripe) + repli virement/facture, devis publics, encart *Box Locale*, quotas visiteurs Internet stricts (`1` recherche IA / IP / jour). | `V0_1` → `V40` |
| **`saas-conference`** | **SaaS Conférence / Démo** | Dérivée directe de `saas-dz-ue` partageant **exactement le même fichier `.env`**, avec des quotas visiteurs et limites de débit relevés par défaut (`25` recherches IA / IP / jour, `50` décodages / IP / jour, `50` devis / IP / jour, rate-limit `15`/`40`) pour absorber le Wi-Fi NAT partagé d'une salle de conférence, et l'URL Chargily de test par défaut. | `V0_1` → `V40` |
| **`dz-localization`** | **Box Locale Algérie (`DZ` souverain sur site)** | Dérivée de `saas-dz-ue` : conserve toutes les nomenclatures enrichies (`DZ` + `UE` + comparateur) en exécution **100 % locale** sur le LAN de l'entreprise (moteur IA **Ollama** interactif & batch, licences hors-ligne `Ed25519` `TCI1...`, création directe des collaborateurs dans Keycloak sans SMTP externe, polices WOFF2 hors-ligne, HTTPS LAN Let's Encrypt DNS-01). | `V0_1` → `V40` + **`V41`** *(table `onprem_license_state`)* |

---

## 3. Conformité & trajectoire Algérie / UE

1. **Europe & International (immédiat)** : `saas-dz-ue` sur VPS européen conforme RGPD.
2. **Entreprises algériennes (immédiat — conformité Loi n° 18-07 & Loi n° 25-11)** : `dz-localization` déployée sur boîtier physique dans les locaux du client (zéro donnée personnelle ni description de marchandise transmise hors du LAN).
3. **SaaS `.dz` hébergé en Algérie (moyen terme)** : déploiement direct de `saas-dz-ue` sur infrastructure souveraine algérienne dès que l'hébergement `.dz` cible est retenu.
