# Tests unitaires — `search-service`

## Vue d'ensemble

Le `search-service` dispose de **62 tests unitaires** répartis en 5 fichiers.  
Tous s'exécutent **sans base de données ni appel IA réel** (tout est simulé par des mocks).  
Durée totale : **< 15 secondes**.

---

## Comment lancer les tests

### Option 1 — Dans IntelliJ IDEA (recommandé au quotidien)

| Action | Comment |
|--------|---------|
| Lancer **un seul test** | Cliquer sur le ▶️ vert dans la marge à gauche de `@Test` |
| Lancer **toute une classe** | Clic droit sur le nom de la classe → *Run 'NomDeLaClasse'* |
| Lancer **tous les tests** | Clic droit sur le dossier `src/test` → *Run 'All Tests'* |

### Option 2 — En ligne de commande (PowerShell)

Se placer dans le dossier du module :

```powershell
cd c:\Users\hamoh\Documents\projets\tarif\tarif-micros\tarif-cloak-prod\search-service
```

Définir les variables une seule fois dans le terminal :

```powershell
$env:JAVA_HOME = "C:\Users\hamoh\jdk\corretto21\jdk21.0.9_10"
$mvn = "C:\Users\hamoh\.m2\wrapper\dists\apache-maven-3.9.9-bin\4nf9hui3q3djbarqar9g711ggc\apache-maven-3.9.9\bin\mvn.cmd"
```

Puis utiliser l'une des commandes suivantes :

```powershell
# Lancer TOUS les tests
& $mvn test --no-transfer-progress

# Lancer une classe précise
& $mvn test "-Dtest=SearchServiceTest" --no-transfer-progress

# Lancer plusieurs classes en même temps
& $mvn test "-Dtest=AiPromptsTest,JsonUtilsTest,AiServiceTest,SearchServiceTest,DefThemeTest" --no-transfer-progress

# Lancer une méthode précise
& $mvn test "-Dtest=SearchServiceTest#search_cascadeComplete_doitRetournerPosition10" --no-transfer-progress

# Ignorer les tests (build urgent)
& $mvn package -DskipTests
```

### Option 3 — Automatique (CI/CD)

Les tests s'exécutent **automatiquement** à chaque `mvn package` ou `mvn install`,
notamment lors d'un build Docker. Si un test échoue, le build s'arrête.

---

## Lire les résultats

```
Tests run: 62, Failures: 0, Errors: 0, Skipped: 0
```

| Terme | Signification |
|-------|--------------|
| `Failures` | Une assertion a échoué (`assertThat` raté) — logique incorrecte |
| `Errors` | Une exception inattendue s'est produite (NPE, etc.) |
| `Skipped` | Test ignoré (`@Disabled`) |

---

## Description des fichiers de tests

### 1. `AiPromptsTest` — 13 tests
**Fichier :** `src/test/java/com/tarif/search/service/ai/AiPromptsTest.java`

Valide la construction du prompt envoyé à l'IA (`AiPrompts.buildUserPrompt`).  
C'est la méthode centralisée qui garantit la cohérence entre le mode standard et le mode batch.

| Test | Ce qu'il vérifie |
|------|-----------------|
| Balises `<codes_douaniers>` présentes | Le prompt est bien structuré pour l'IA |
| Terme de recherche répété 2 fois | En-tête + question finale |
| Demande de réponse JSON uniquement | L'IA ne peut pas répondre en texte libre |
| RAG inclus entre les balises | Le contexte douanier est bien transmis |
| RAG vide ne plante pas | Robustesse |
| Multilingue (fr, en, ar…) | Fonctionne quelle que soit la langue du produit |
| `getSystemMessage` sans placeholder résiduel | Aucun `{json_keys}` non remplacé dans le prompt système |

---

### 2. `JsonUtilsTest` — 14 tests
**Fichier :** `src/test/java/com/tarif/search/service/ai/JsonUtilsTest.java`

Valide le nettoyage et le parsing des réponses JSON retournées par l'IA.  
L'IA enveloppe parfois le JSON dans des blocs markdown (` ```json `) — ces tests garantissent que c'est bien géré.

| Test | Ce qu'il vérifie |
|------|-----------------|
| JSON valide reconnu | `isValidJson` fonctionne |
| JSON tronqué rejeté | Détection de réponse coupée (tokens insuffisants) |
| Backticks supprimés | Nettoyage des marqueurs markdown |
| Préfixe `json` retiré | Nettoyage du format ` ```json ` |
| `null` ou vide → exception | Comportement explicite en cas d'erreur |
| Texte libre → exception | L'IA a répondu sans JSON |
| Objet seul encapsulé en tableau | `{"code":"08"}` → `[{"code":"08"}]` |
| Justification null tolérée | Mode simple (sans justification) |

---

### 3. `AiServiceTest` — 9 tests
**Fichier :** `src/test/java/com/tarif/search/service/ai/AiServiceTest.java`

Valide l'orchestration des providers IA (OpenAI / Anthropic / Ollama).  
Tous les appels réseau sont mockés.

| Test | Ce qu'il vérifie |
|------|-----------------|
| Provider `openai` → OpenAiService appelé | Sélection correcte |
| Provider `anthropic` → AnthropicService appelé | Sélection correcte |
| Provider `ollama` → OllamaService appelé | Sélection correcte |
| Provider inconnu → fallback OpenAI | Robustesse de configuration |
| Réponse non-JSON → exception remontée | Comportement attendu |
| Tableau vide `[]` → liste vide | Aucun résultat trouvé |
| Terme dans le prompt envoyé | Le bon produit est transmis à l'IA |
| Liste non vide → codes inclus dans l'affichage | Formatage correct |
| Liste vide → message d'absence | Message utilisateur |

---

### 4. `SearchServiceTest` — 18 tests
**Fichier :** `src/test/java/com/tarif/search/service/SearchServiceTest.java`

C'est le test le plus important : il valide la **cascade de classification en 5 niveaux**.  
Sans ce test, une régression dans la logique de cascade pourrait passer inaperçue.

```
SECTIONS → CHAPITRES → POSITIONS4 → POSITIONS6 → POSITIONS10
   (II)       (08)       (0808)     (0808 10)   (0808 10 10)
```

Les tests sont organisés en 6 groupes (`@Nested`) :

#### Arrêts précoces
| Test | Ce qu'il vérifie |
|------|-----------------|
| Level 0 vide → arrêt immédiat | Pas d'appels IA inutiles si les sections échouent |
| Level 1 vide → arrêt | Cascade stoppée dès les chapitres |
| Level 2 vide → arrêt | Cascade stoppée aux positions 4 chiffres |

#### Contrôle du niveau maximum (`maxLevel`)
| Test | Ce qu'il vérifie |
|------|-----------------|
| `maxLevel=SECTIONS` | Les chapitres ne sont jamais consultés |
| `maxLevel=CHAPITRES` | Les positions 4 ne sont jamais consultées |
| `maxLevel=POSITIONS6` | Les positions 10 ne sont jamais consultées → économie de coût IA |

#### Fallbacks (remontée au niveau précédent)
| Test | Ce qu'il vérifie |
|------|-----------------|
| Level 3 vide → Level 2 retourné | Si l'IA ne trouve pas de Position6, on remonte à Position4 |
| Level 4 vide → Level 3 retourné | Si l'IA ne trouve pas de Position10, on remonte à Position6 |

#### Logique de retry
| Test | Ce qu'il vérifie |
|------|-----------------|
| Succès à la 2ème tentative → 2 appels seulement | Pas de tentatives inutiles |
| 3 exceptions techniques → liste vide, sans crash | Robustesse réseau |

#### Modes d'affichage
| Test | Ce qu'il vérifie |
|------|-----------------|
| `withCascade=false` → dernier niveau uniquement | Mode précision |
| `withCascade=true` → tous les niveaux accumulés | Mode complet |
| `withDescription=false` → 0 appel à `getDescription` | Pas de requête DB inutile |
| `withDescription=true` → description injectée | Enrichissement des résultats |

#### Cascade complète
| Test | Ce qu'il vérifie |
|------|-----------------|
| Retourne le code `0808 10 10` | Résultat nominal jusqu'au niveau 10 |
| Les 5 niveaux IA sont appelés dans l'ordre | Ordre de la cascade respecté |
| RAG Level4 vide → IA Level4 non appelée | Skip intelligent si pas de données |

---

### 5. `DefThemeTest` — 8 tests
**Fichier :** `src/test/java/com/tarif/search/service/ai/DefThemeTest.java`

Valide les modes de configuration des résultats (`DefTheme`).

| Test | Ce qu'il vérifie |
|------|-----------------|
| `getCode()` → seul `withCode` activé | Mode minimal |
| `getThemeDescrip()` → seul `withDescription` | Mode par défaut de l'application |
| `getThemeAll()` → description + justification + cascade | Mode complet |
| `getThemeJustif()` → seul `withJustification` | Mode avec explication IA |
| `getThemeDescripJustif()` → description + justification | Sans accumulation |
| `getThemeJustifCascade()` → justification + cascade | Sans description DB |
| `getThemeDescripCascade()` → description + cascade | Sans justification |
| `toBuilder()` → dérive sans modifier l'original | Immutabilité garantie |

---

## Structure des fichiers de tests

```
src/test/java/com/tarif/search/
├── service/
│   ├── SearchServiceTest.java       ← Cascade 5 niveaux (18 tests)
│   └── ai/
│       ├── AiPromptsTest.java       ← Construction du prompt (13 tests)
│       ├── AiServiceTest.java       ← Orchestration providers (9 tests)
│       ├── JsonUtilsTest.java       ← Parsing réponses IA (14 tests)
│       └── DefThemeTest.java        ← Modes d'affichage (8 tests)
```

---

## Résultat attendu (tous les tests)

```
Tests run: 62, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```
