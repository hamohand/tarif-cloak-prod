# Stratégie commerciale — TCI
**Tarif du Commerce International — Classification HS-code par intelligence artificielle**
*Document de lancement — Mars 2026*

---

## 1. Le produit

**TCI (Tarif du Commerce International)** est un SaaS de recherche de codes HS (Système Harmonisé) par IA multilingue.
Il permet à tout professionnel du commerce international de trouver la position tarifaire d'un produit en décrivant l'article en langage naturel, dans n'importe quelle langue.

### Précision importante : HS-code vs Position tarifaire nationale

Le **Système Harmonisé (SH)** est une nomenclature internationale gérée par l'Organisation Mondiale des Douanes (OMD). Il est commun à plus de 200 pays et **s'arrête à 6 chiffres** (ex : `8703.80`).

Au-delà de ces 6 chiffres, chaque pays ajoute ses propres subdivisions nationales :
- **8 chiffres** pour l'Union Européenne (TARIC)
- **10 chiffres** pour l'Algérie (Position tarifaire nationale, dite **P10**)

**TCI va jusqu'au niveau P10 (10 chiffres)**, ce qui est indispensable pour toute opération douanière en Algérie. C'est à ce niveau que sont déterminés les droits de douane, les taxes et les régimes d'importation applicables.

> Aucun outil générique de recherche HS-code ne descend au niveau P10 algérien.
> C'est l'un des différenciateurs majeurs de TCI.

### Fonctionnalités clés

- **Recherche HS-code (6 chiffres)** par description libre multilingue
- **Recherche Position10 (10 chiffres)** — niveau opérationnel pour les douanes algériennes
- Hiérarchie complète restituée : section → chapitre → position (4) → sous-position (6) → position nationale (10)
- Décodage inverse : retrouver la désignation complète à partir d'un code existant (2, 4, 6 ou 10 chiffres)
- Traitement de listes (batch jusqu'à 1 000 articles)
- Gestion multi-utilisateurs par organisation
- Tarification en crédits (transparente et prévisible)

---

## 2. Le marché cible

### 2.1 Professionnels prioritaires

| Profil | Besoin | Volume estimé | Priorité |
|---|---|---|---|
| Transitaires / commissionnaires en douane | Classification quotidienne, volume élevé | Fort | ⭐⭐⭐ |
| PME importatrices/exportatrices | Déclarations douanières, calcul de droits | Moyen | ⭐⭐⭐ |
| Cabinets de conseil douanier et fiscal | Service à leurs propres clients | Moyen | ⭐⭐ |
| E-commerçants transfrontaliers | Classification de catalogues entiers | Fort | ⭐⭐ |
| Freight forwarders | Service à valeur ajoutée pour leurs clients | Fort | ⭐⭐ |
| Chambres de commerce | Service aux PME membres | Effet levier | ⭐⭐ |
| Fabricants exportateurs | Tarification, négociation, conformité | Moyen | ⭐⭐ |
| Agences de promotion des exportations | Accompagnement des exportateurs | Institutionnel | ⭐ |
| Banques (commerce international) | Lettres de crédit, crédits documentaires | Institutionnel | ⭐ |

### 2.2 Géographie initiale

- **Phase 1 :** Algérie (nomenclature DZ intégrée, marché sous-servi)
- **Phase 2 :** France et Maghreb (Tunisie, Maroc)
- **Phase 3 :** Reste du monde francophone et arabophone

---

## 3. Analyse concurrentielle

| Outil | Points forts | Faiblesses vs TCI |
|---|---|---|
| Customs Info / Schedule B | Données officielles US | S'arrête à 6 chiffres, anglais uniquement, pas d'IA |
| HS Code Finder (outils génériques) | Gratuits | S'arrête à 6 chiffres, pas multilingue, pas de batch |
| ChatGPT (usage direct) | Accessible | S'arrête à 6 chiffres, pas structuré, pas de batch |
| Douanes.gouv.fr / TARIC | Officiel EU (8 chiffres) | Pas d'IA, pas multilingue, ne couvre pas la nomenclature DZ |
| Portail des douanes algériennes | Officiel DZ (10 chiffres) | Pas d'IA, recherche manuelle uniquement, pas de batch |

**Avantages différenciateurs de TCI :**

- **Seul outil IA qui descend jusqu'au niveau P10 (10 chiffres) de la nomenclature algérienne**
- Multilingue : arabe, chinois, français, anglais...
- Résultat structuré avec justification à chaque niveau
- Batch API pour traitement en volume (jusqu'à 1 000 articles)
- Nomenclature DZ intégrée et maintenue nativement
- SaaS intégrable dans un workflow métier

---

## 4. Stratégie d'entrée sur le marché

### Phase 1 — Validation Invité (Mars → Mai 2026)

**Objectif :** Prouver la précision et l'utilité auprès de 10 à 20 beta-testeurs professionnels.

**Environnement dédié :** Instance de production séparée avec `BETA_MODE=true`
- Interface simplifiée (pas de facturation, pas de devis, pas de gestion d'alertes)
- Plan **Invité** assigné automatiquement à l'inscription : 500 crédits / 30 jours
- Réinitialisation du plan possible une seule fois par l'admin (`trialRenewCount` ≤ 1)
- Page `/aide` publique avec guide d'utilisation intégré

**Actions :**
1. Identifier et contacter 10 à 20 professionnels ciblés
   - Priorité : transitaires indépendants et PME exportatrices
   - Canaux : LinkedIn, réseaux douaniers, chambres de commerce

2. Recueillir le feedback structuré (5 questions — voir section 7)

3. Itérer rapidement sur les retours
   - Corriger les erreurs de classification identifiées
   - Améliorer l'UX selon les retours terrain

**Indicateurs de succès Phase 1 :**
- Taux de précision déclaré ≥ 85% par les testeurs
- Au moins 3 témoignages positifs exploitables
- Au moins 2 beta-testeurs prêts à passer en plan payant
- Validation du prix cible (question directe dans le formulaire)

---

### Phase 2 — Traction (Juin → Septembre 2026)

**Objectif :** Atteindre les premiers 10 clients payants.

**Actions :**
1. Affiner la grille tarifaire selon les retours beta
2. Déployer l'instance Client (sans `BETA_MODE`) avec paiement Chargily Pay
3. Proposer un plan d'entrée accessible (ex : 1 000 crédits/mois à prix réduit)
4. Créer une page de témoignages sur le site
5. Démarcher les chambres de commerce algériennes et françaises
   - Proposer un accord de partenariat : accès groupé pour leurs membres
6. Publier du contenu de démonstration (LinkedIn, YouTube)
7. Approcher 2–3 freight forwarders pour une intégration ou un accord de revente

**Indicateurs de succès Phase 2 :**
- 10 clients payants actifs
- MRR (revenu mensuel récurrent) > 500 €
- NPS (satisfaction) ≥ 7/10

---

### Phase 3 — Croissance (Octobre 2026 →)

**Objectif :** Automatiser l'acquisition et développer les comptes clés.

**Actions :**
1. SEO : contenu autour des codes HS (articles, guides par secteur)
2. API publique pour les intégrateurs et développeurs
3. Partenariats avec des ERP / TMS (logiciels de gestion du transport)
4. Extension de la nomenclature à d'autres pays (France, Tunisie, Maroc)
5. Offre "Entreprise" avec SLA, support dédié et intégration sur mesure

---

## 5. Modèle de tarification recommandé

| Plan | Crédits/mois | Prix | Cible |
|---|---|---|---|
| Invité | 500 | Gratuit (30 jours) | Validation beta |
| Starter | 1 000 | ~15 €/mois | PME, auto-entrepreneurs |
| Professionnel | 5 000 | ~50 €/mois | Transitaires, cabinets |
| Entreprise | Illimité | Sur devis | Grands comptes, intégrateurs |

**Coût en crédits par opération :**
- Recherche HS-code (6 chiffres) : 10 crédits
- Recherche Position10 (10 chiffres) : 15 crédits
- Décodage inverse HS : 2 crédits
- Décodage inverse P10 : 5 crédits

---

## 6. Mail d'invitation beta — Template

**Objet :** Testez gratuitement notre outil de classification douanière HS-code — 30 jours offerts

---

Madame, Monsieur,

Je développe **TCI (Tarif du Commerce International)**, un outil de recherche de codes HS
par intelligence artificielle, et je recherche des professionnels du commerce international
pour le tester en conditions réelles avant son lancement commercial.

**Ce que je vous propose :**
- Accès complet et gratuit pendant **30 jours**
- **500 crédits** offerts (soit ~33 recherches Position10 ou ~50 recherches HS-code)
- Aucune carte bancaire requise
- Un guide d'utilisation intégré directement dans l'application

**TCI en pratique :**
- Décrivez votre produit en français, anglais, arabe ou toute autre langue
- L'IA retourne le code HS, la hiérarchie complète jusqu'au niveau P10 et une justification
- Décodez instantanément un code existant pour obtenir sa désignation officielle

👉 Créer mon compte : https://[domaine-invité]/auth/register

Je reste disponible par email ou WhatsApp pour toute question.

Cordialement,
**Hamroun Mohammed** — Enclume-Numérique
mohhamroun@gmail.com | WhatsApp : +213 5 60 96 80 66

---

## 7. Formulaire de feedback beta (5 questions)

1. **La recherche** — Les codes retournés vous semblent-ils corrects et utiles dans votre activité ?
2. **La facilité d'utilisation** — Avez-vous eu des difficultés à prendre en main l'outil ? Lesquelles ?
3. **Les crédits** — 500 crédits vous ont-ils semblé suffisants pour évaluer le service ?
4. **Ce qui manque** — Quelle fonctionnalité vous aurait été la plus utile et qui n'est pas présente ?
5. **La suite** — À quel prix mensuel seriez-vous prêt(e) à utiliser cet outil dans votre entreprise ?

> La question 5 est stratégique : elle valide la grille tarifaire avant le lancement commercial.

---

## 8. Risques et plans de mitigation

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Précision IA insuffisante sur certains secteurs | Moyen | Élevé | Feedback beta, fine-tuning par secteur |
| Concurrence de ChatGPT / outils gratuits | Élevé | Moyen | Différenciation par le workflow, le batch, et l'intégration métier |
| Résistance au changement des professionnels | Moyen | Moyen | Démonstration en live, période d'essai généreuse |
| Dépendance à un seul fournisseur IA (OpenAI) | Moyen | Élevé | Multi-provider déjà en place (Anthropic, Ollama) |
| Réglementation sur les données douanières | Faible | Élevé | Aucune donnée sensible stockée côté utilisateur |

---

*Document rédigé en Mars 2026 — à réviser après la Phase 1 de validation (Mai 2026).*
