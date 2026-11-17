# Feuille de Route Produit & Architecture — Éditions SaaS Cloud vs Box Locale DZ

Ce document fixe l'organisation durable du projet entre ses deux éditions hébergées sur des branches distinctes d'un même dépôt Git, ainsi que la stratégie de partage du moteur IA (`search-service`) et des nomenclatures douanières (`DZ` / `EU`).

---

## 1. Vue d'ensemble des deux branches durables

Les deux éditions coexistent dans le **même dépôt Git** :

| Branche | Édition | Cible marché & hébergement | Paiement / Licence | Fournisseur IA par défaut |
| :--- | :--- | :--- | :--- | :--- |
| **`main`** *(référence archivée aussi sur le tag `archive/saas-prod-staging-2026` / `a861b32`)* | **SaaS Cloud** | **Court terme** : Entreprises **UE / International** (VPS UE conforme RGPD).<br>**Moyen terme** : **SaaS `.dz`** sur hébergement algérien dès qu'un fournisseur local fiable sera en place (PME sans boîtier). | Stripe (`EUR`, `MARKET_VERSION=DEFAULT`) et Chargily Pay (`DZD`, `MARKET_VERSION=DZ`), facturation, devis, auto-inscription | OpenAI / Anthropic |
| **`algeria_data_localization`** *(ou `box-dz`)* | **Box Locale Algérie (`DZ`)** | **Immédiat** : Boîtier physique 100 % local sur le LAN d'entreprises algériennes (Mac Mini M4 Pro Metal ou mini-PC Linux GPU NVIDIA), sans port entrant ouvert (`Traefik DNS-01`). | Licences cryptographiques hors-ligne `Ed25519` (`TCI1...`) + création directe des collaborateurs dans Keycloak sans SMTP externe | **Ollama** (`AI_PROVIDER=ollama`, surchargeable) |

---

## 2. Conformité & séparation des données

- **Box Locale (`DZ`)** : répond immédiatement aux exigences de localisation souveraine en Algérie (**Loi n° 18-07** art. 44, 45, 67, 70 modifiée et complétée par la **Loi n° 25-11** du 24 juillet 2025). Toutes les données (PostgreSQL, Keycloak, logs, lots Excel/CSV, inférence Ollama, polices) restent sur le réseau local du client.
- **SaaS Cloud (`main`)** :
  - **En UE maintenant** : le profil `DEFAULT` (`EUR` / Stripe) dessert l'Europe / International sans mélange avec la souveraineté DZ.
  - **En Algérie à moyen terme** : lorsque l'hébergement `.dz` sera disponible, il suffira de déployer `main` avec `MARKET_VERSION=DZ`, `TARIFF_NOMENCLATURE=DZ` et Chargily (`DZD`).

---

## 3. Règle de partage de `search-service` & nomenclature douanière

Pour éviter toute divergence de maintenance sur le moteur de recherche et les prompts :

1. **`search-service/` reste 100 % commun et portable** (`git cherry-pick` possible entre `main` et la branche Box).
2. **Sélection du fournisseur IA (`AI_PROVIDER`)** :
   - Sur la Box Locale : `AI_PROVIDER=ollama` par défaut (tout en conservant la variable surchargeable).
   - Sur le SaaS Cloud : `openai` ou `anthropic` (ou `ollama` si hébergé sur serveur GPU dédié).
3. **Nomenclature au-delà des 6 chiffres SH (`TARIFF_NOMENCLATURE`)** :
   - Les 4 premiers niveaux (`SECTIONS`, `CHAPITRES`, `POSITIONS4`, `POSITIONS6` — code SH international OMD à 6 chiffres) sont **universels**.
   - Au-delà de 6 chiffres, la table interrogée dépendra de la variable **`TARIFF_NOMENCLATURE=DZ|EU`** *(implémentation prévue en Phase 2 sur `main`)* :
     - `TARIFF_NOMENCLATURE=DZ` : sous-positions nationales algériennes à **10 chiffres** (`position10_dz`, déjà actif dans [`SearchService.java`](../search-service/src/main/java/com/tarif/search/service/SearchService.java)).
     - `TARIFF_NOMENCLATURE=EU` : **Nomenclature Combinée européenne à 8 chiffres (`NC8` / `CN8`)**, publiée officiellement chaque année par l'UE. L'utilitaire d'extraction Excel -> CSV [`scripts/cn_to_position8_csv.py`](../scripts/cn_to_position8_csv.py) est déjà ébauché pour alimenter une future table `position8_eu`.

---

## 4. Ordre d'exécution (Plan par phases)

1. **Phase 1 *(en cours — branche Box Locale DZ)*** :
   - Finaliser, commiter et valider de bout en bout l'édition simple **Box Locale Algérie (`DZ`)** avec Ollama local, Traefik DNS-01, licences `Ed25519` et polices embarquées.
2. **Phase 2 *(ensuite — sur `main`)*** :
   - Importer les textes officiels NC8 UE dans `position8_eu` via [`scripts/cn_to_position8_csv.py`](../scripts/cn_to_position8_csv.py).
   - Ajouter le sélecteur `TARIFF_NOMENCLATURE=DZ|EU` dans `search-service` (et le reporter proprement sur la branche Box si besoin pour garder un `search-service/` aligné).
3. **Phase 3 *(moyen terme — SaaS `.dz`)*** :
   - Déployer la branche `main` sur infrastructure algérienne avec `MARKET_VERSION=DZ`, `TARIFF_NOMENCLATURE=DZ` et Chargily Pay (`DZD`).
