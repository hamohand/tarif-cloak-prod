# 🚀 Actions Immédiates - Étapes Suivantes

## 🎯 Objectif

Faire démarrer le backend correctement et résoudre les problèmes identifiés.

## ✅ Ce qui a été corrigé

- ✅ Erreur YAML (clé `spring` dupliquée) - **CORRIGÉ**

## ❌ Ce qui reste à faire

- ❌ Corriger les credentials PostgreSQL dans `.env`
- ❌ Redémarrer le backend
- ❌ Vérifier que le backend démarre correctement
- ❌ Tester les endpoints

## 📋 Étapes à Suivre (dans l'ordre)

### Étape 1 : Vérifier et Corriger le Fichier `.env`

**Action** : Vérifier que le fichier `.env` contient les bons credentials PostgreSQL.

```bash
# Vérifier le contenu du fichier .env
cat .env

# Ou sur Windows PowerShell
Get-Content .env
```

**Vérifier que ces variables existent et sont correctes** :
```bash
POSTGRES_USER=muhend
POSTGRES_PASSWORD=<votre mot de passe>
POSTGRES_DB=<nom de votre base de données>
```

**Si les credentials sont incorrects** :
1. Ouvrir le fichier `.env`
2. Corriger les valeurs de `POSTGRES_USER`, `POSTGRES_PASSWORD`, et `POSTGRES_DB`
3. Sauvegarder le fichier

### Étape 2 : Vérifier que la Base de Données est Accessible

**Action** : Vérifier que le conteneur de base de données est en cours d'exécution.

```bash
# Vérifier l'état de la base de données
docker ps | grep app-db

# Si elle n'est pas en cours d'exécution, la démarrer
docker-compose -f docker-compose-prod.yml up -d app-db

# Attendre quelques secondes
sleep 5

# Vérifier les logs
docker logs <container-app-db> --tail 20
```

**Sur Windows PowerShell** :
```powershell
docker ps | Select-String "app-db"
docker-compose -f docker-compose-prod.yml up -d app-db
Start-Sleep -Seconds 5
docker logs <container-app-db> --tail 20
```

### Étape 3 : Redémarrer le Backend

**Action** : Redémarrer le backend pour appliquer les corrections.

```bash
# Arrêter le backend (s'il est en cours d'exécution)
docker-compose -f docker-compose-prod.yml stop backend

# Redémarrer le backend
docker-compose -f docker-compose-prod.yml up -d backend

# Ou reconstruire et redémarrer (si des modifications ont été apportées au code)
docker-compose -f docker-compose-prod.yml up -d --build backend
```

**Sur Windows PowerShell** :
```powershell
docker-compose -f docker-compose-prod.yml stop backend
docker-compose -f docker-compose-prod.yml up -d backend
```

### Étape 4 : Vérifier les Logs du Backend

**Action** : Vérifier que le backend démarre sans erreur.

```bash
# Suivre les logs en temps réel
docker logs -f hscode-backend

# Ou voir les dernières lignes
docker logs hscode-backend --tail 100

# Vérifier qu'il n'y a pas d'erreurs
docker logs hscode-backend --tail 100 | grep -i "error\|fatal\|exception"
```

**Sur Windows PowerShell** :
```powershell
docker logs -f hscode-backend
# Ou
docker logs hscode-backend --tail 100
docker logs hscode-backend --tail 100 | Select-String -Pattern "error|fatal|exception" -CaseSensitive:$false
```

**Signes de succès** :
- ✅ `Backend Application Started -port:8081-`
- ✅ `Started BackendApplication in X seconds`
- ✅ Pas d'erreurs `FATAL` ou `Exception`

**Signes d'échec** :
- ❌ `FATAL: password authentication failed for user "muhend"`
- ❌ `Unable to create requested service`
- ❌ `Application run failed`

### Étape 5 : Tester l'Endpoint de Santé

**Action** : Vérifier que le backend répond aux requêtes.

```bash
# Tester l'endpoint de santé
curl -k https://www.hscode.enclume-numerique.com/api/health
```

**Résultat attendu** :
```json
{"status":"UP","service":"backend","message":"Backend is running"}
```

**Sur Windows PowerShell** :
```powershell
Invoke-WebRequest -Uri "https://www.hscode.enclume-numerique.com/api/health" -Method GET -SkipCertificateCheck
```

### Étape 6 : Vérifier dans le Navigateur

**Action** : Vérifier que les pages web fonctionnent.

1. **Ouvrir la page Stats** :
   - URL : https://www.hscode.enclume-numerique.com/admin/stats
   - Vérifier que les organisations se chargent dans la liste déroulante
   - Vérifier la console (F12) pour les erreurs

2. **Ouvrir la page Tableau de bord** :
   - URL : https://www.hscode.enclume-numerique.com/dashboard
   - Vérifier que les statistiques s'affichent
   - Vérifier la console (F12) pour les erreurs

3. **Vérifier les alertes** :
   - Vérifier que le badge d'alertes se charge dans la navbar
   - Vérifier qu'il n'y a pas d'erreurs 502

## 🔧 Résolution des Problèmes Courants

### Problème 1 : Erreur d'authentification PostgreSQL

**Symptôme** :
```
FATAL: password authentication failed for user "muhend"
```

**Solution** :
1. Vérifier le fichier `.env` et corriger les credentials
2. Redémarrer le backend
3. Si le problème persiste, réinitialiser la base de données (⚠️ ATTENTION : supprime les données)

### Problème 2 : Backend ne démarre pas

**Symptôme** : Le conteneur backend s'arrête immédiatement après le démarrage.

**Solution** :
1. Vérifier les logs : `docker logs hscode-backend --tail 100`
2. Vérifier les variables d'environnement
3. Vérifier que la base de données est accessible
4. Vérifier que le port 8081 n'est pas déjà utilisé

### Problème 3 : Endpoint retourne 502 Bad Gateway

**Symptôme** : Les requêtes vers `/api/*` retournent 502.

**Solution** :
1. Vérifier que le backend est en cours d'exécution : `docker ps | grep backend`
2. Vérifier que Traefik peut router vers le backend
3. Vérifier les logs de Traefik
4. Vérifier que le réseau Docker `webproxy` existe

### Problème 4 : Liste déroulante des organisations vide

**Symptôme** : La liste déroulante ne contient que "Toutes".

**Solution** :
1. Vérifier que le backend est accessible
2. Vérifier que l'utilisateur a le rôle ADMIN
3. Vérifier les logs du backend pour les erreurs
4. Vérifier la console du navigateur (F12) pour les erreurs

## 📊 Checklist de Vérification

- [ ] Le fichier `.env` contient les bons credentials PostgreSQL
- [ ] La base de données est en cours d'exécution
- [ ] Les credentials correspondent entre `.env` et `docker-compose-prod.yml`
- [ ] Le backend peut se connecter à la base de données
- [ ] Le backend démarre sans erreur
- [ ] L'endpoint `/api/health` répond correctement
- [ ] Les endpoints protégés fonctionnent avec un token JWT valide
- [ ] La page Stats charge les organisations
- [ ] La page Tableau de bord affiche les statistiques
- [ ] Les alertes se chargent correctement
- [ ] Aucune erreur 502 dans le navigateur

## 🚨 Commandes d'Urgence

### Si le backend ne démarre pas

```bash
# Voir les logs
docker logs hscode-backend --tail 100

# Redémarrer le backend
docker-compose -f docker-compose-prod.yml restart backend

# Reconstruire et redémarrer
docker-compose -f docker-compose-prod.yml up -d --build backend
```

### Si la base de données ne répond pas

```bash
# Vérifier l'état
docker ps | grep app-db

# Redémarrer la base de données
docker-compose -f docker-compose-prod.yml restart app-db

# Vérifier les logs
docker logs <container-app-db> --tail 50
```

### Si tout échoue

```bash
# Arrêter tous les conteneurs
docker-compose -f docker-compose-prod.yml down

# Redémarrer toute la stack
docker-compose -f docker-compose-prod.yml up -d

# Vérifier l'état
docker-compose -f docker-compose-prod.yml ps
```

## 🎯 Résultat Attendu

Une fois toutes les étapes terminées :
- ✅ Le backend démarre correctement
- ✅ Les endpoints répondent correctement
- ✅ Les pages web fonctionnent sans erreurs
- ✅ Les organisations se chargent dans la liste déroulante
- ✅ Les statistiques s'affichent correctement
- ✅ Les alertes se chargent sans erreur

## 📝 Notes Importantes

- **Ne jamais commiter le fichier `.env`** dans le dépôt Git
- **Sauvegarder régulièrement la base de données** pour éviter la perte de données
- **Vérifier les logs régulièrement** pour détecter les problèmes
- **Tester les endpoints après chaque modification** pour s'assurer que tout fonctionne

## 🔗 Documentation Associée

- **ETAPES_SUIVANTES.md** : Guide détaillé des étapes
- **DIAGNOSTIC_BACKEND_502.md** : Guide de diagnostic pour les erreurs 502
- **CORRECTION_ERREUR_BACKEND_PASSWORD.md** : Guide de correction pour l'erreur d'authentification PostgreSQL
- **CORRECTION_ERREUR_YAML.md** : Guide de correction pour l'erreur YAML
- **RESUME_PROBLEME_BACKEND.md** : Résumé du problème et solutions

---

**Dernière mise à jour** : Après correction de l'erreur YAML

