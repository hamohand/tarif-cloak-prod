# 🔧 Correction - Erreur YAML : Clé `spring` dupliquée

## ❌ Problème Identifié

Le backend crash au démarrage avec l'erreur :
```
org.yaml.snakeyaml.constructor.DuplicateKeyException: found duplicate key spring
```

## 🔍 Cause

Dans le fichier `application.yml`, il y avait **deux clés `spring:` au niveau racine** :
- **Ligne 10** : Configuration principale (datasource, jpa, security)
- **Ligne 95** : Configuration du cache

En YAML, on ne peut pas avoir deux clés au même niveau avec le même nom. Cela provoque une erreur de parsing.

## ✅ Solution Appliquée

J'ai fusionné la configuration du cache dans la section `spring:` principale. La configuration du cache est maintenant sous la section `spring:` principale (lignes 36-42) :

```yaml
spring:
  application:
    name: backend
  datasource:
    # ... configuration datasource ...
  jpa:
    # ... configuration jpa ...
  security:
    # ... configuration security ...
  cache:
    type: caffeine
    caffeine:
      spec: maximumSize=500,expireAfterWrite=5m
```

## 📋 Structure du Fichier Corrigée

1. **Configuration principale** (niveau racine) :
   - `server:` - Configuration du serveur
   - `spring:` - Configuration Spring (datasource, jpa, security, cache)
   - `resilience4j:` - Configuration Resilience4j
   - `keycloak:` - Configuration Keycloak Admin Client
   - `logging:` - Configuration du logging
   - `openai:`, `anthropic:`, `ollama:` - Configuration des services IA
   - `cors:` - Configuration CORS

2. **Profils Spring** (après `---`) :
   - Profil `dev` : Configuration de développement
   - Profil `prod` : Configuration de production

Les sections `spring:` dans les profils (lignes 104 et 121) sont valides car elles sont dans des documents YAML séparés (séparés par `---`).

## 🚀 Prochaines Étapes

1. ✅ **Redémarrer le backend** :
```bash
docker-compose -f docker-compose-prod.yml restart backend
```

2. ✅ **Vérifier les logs** :
```bash
docker logs -f hscode-backend
```

3. ✅ **Vérifier que le backend démarre correctement** :
```bash
docker ps | grep backend
```

4. ✅ **Tester l'endpoint de santé** :
```bash
curl -k https://www.hscode.enclume-numerique.com/api/health
```

## 📝 Notes

- Les profils Spring (après `---`) peuvent avoir leurs propres sections `spring:` car ce sont des documents YAML séparés
- La configuration du cache est maintenant correctement intégrée dans la section `spring:` principale
- Le fichier YAML est maintenant valide et le backend devrait démarrer correctement

---

**Dernière mise à jour** : Après correction de l'erreur YAML

