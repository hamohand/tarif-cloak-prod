# Variables d'Environnement Keycloak - Configuration des Thèmes

## Variables de Cache des Thèmes

### KC_THEME_STATIC_MAX_AGE

**Type** : Chaîne de caractères (nombre en secondes)  
**Valeur recommandée** : `"2592000"` (30 jours)

Définit la durée de cache pour les fichiers statiques des thèmes (CSS, images, JavaScript).

- **2592000** = 30 jours (recommandé pour la production)
- **86400** = 1 jour (pour le développement)
- **3600** = 1 heure (pour les tests)

### KC_THEME_CACHE_THEMES

**Type** : Chaîne de caractères (`"true"` ou `"false"`)  
**Valeur recommandée** : `"true"`

Active ou désactive le cache des thèmes compilés.

- **`"true"`** : Active le cache (recommandé pour la production)
  - Améliore les performances
  - Réduit la charge sur le serveur
  - Les modifications de thème nécessitent un redémarrage de Keycloak

- **`"false"`** : Désactive le cache (pour le développement)
  - Les modifications de thème sont immédiatement visibles
  - Performance réduite
  - Utile uniquement pendant le développement

### KC_THEME_CACHE_TEMPLATES

**Type** : Chaîne de caractères (`"true"` ou `"false"`)  
**Valeur recommandée** : `"true"`

Active ou désactive le cache des templates FreeMarker (fichiers `.ftl`).

- **`"true"`** : Active le cache (recommandé pour la production)
  - Améliore les performances
  - Les modifications de templates nécessitent un redémarrage

- **`"false"`** : Désactive le cache (pour le développement)
  - Les modifications de templates sont immédiatement visibles
  - Performance réduite
  - Utile uniquement pendant le développement

## Configuration Recommandée

### Production

```yaml
KC_THEME_STATIC_MAX_AGE: "2592000"  # 30 jours
KC_THEME_CACHE_THEMES: "true"        # Cache activé
KC_THEME_CACHE_TEMPLATES: "true"     # Cache activé
```

### Développement

```yaml
KC_THEME_STATIC_MAX_AGE: "3600"      # 1 heure
KC_THEME_CACHE_THEMES: "false"       # Cache désactivé
KC_THEME_CACHE_TEMPLATES: "false"    # Cache désactivé
```

## Notes Importantes

1. **Format des valeurs** : Les valeurs doivent être des chaînes de caractères entre guillemets (`"true"` et non `true`)

2. **Redémarrage requis** : Après modification d'un thème, redémarrer Keycloak pour voir les changements si le cache est activé

3. **Vider le cache du navigateur** : Même avec le cache désactivé, vider le cache du navigateur peut être nécessaire

4. **Performance** : En production, toujours activer le cache pour de meilleures performances

5. **Développement** : Désactiver le cache uniquement pendant le développement pour voir les modifications immédiatement

## Exemple dans docker-compose.yml

```yaml
keycloak:
  environment:
    # ... autres variables ...
    
    # Configuration des thèmes personnalisés
    KC_THEME_STATIC_MAX_AGE: "2592000"      # 30 jours
    KC_THEME_CACHE_THEMES: "true"           # Cache activé
    KC_THEME_CACHE_TEMPLATES: "true"        # Cache activé
```

## Vérification

Pour vérifier que les variables sont bien prises en compte :

1. Redémarrer Keycloak
2. Vérifier les logs :
   ```bash
   docker logs <nom-du-conteneur-keycloak> | grep -i theme
   ```
3. Tester le chargement d'un fichier de thème dans le navigateur

