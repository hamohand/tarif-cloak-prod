# Guide d'Activation du Thème Personnalisé Keycloak

Ce guide explique comment activer le thème personnalisé `custom-theme` pour Keycloak.

## ✅ Fichiers Créés

La structure suivante a été créée :

```
keycloak/
└── themes/
    ├── README.md
    └── custom-theme/
        ├── theme.properties
        ├── login/
        │   ├── theme.properties
        │   ├── login.ftl
        │   ├── login.css
        │   └── resources/
        │       ├── css/
        │       │   └── custom-login.css
        │       └── img/
        └── account/
```

## 🚀 Étapes d'Activation

### 1. Redémarrer Keycloak

Redémarrer le conteneur Keycloak pour charger le nouveau thème :

```bash
docker-compose -f docker-compose-prod.yml restart keycloak
```

Ou si vous utilisez Docker directement :

```bash
docker restart <nom-du-conteneur-keycloak>
```

### 2. Accéder à l'Administration Keycloak

1. Ouvrir votre navigateur et aller à :
   ```
   https://auth.hscode.enclume-numerique.com
   ```

2. Cliquer sur **Administration Console** (en bas de la page)

3. Se connecter avec les identifiants admin :
   - **Username** : `admin` (ou la valeur de `KEYCLOAK_ADMIN_USER`)
   - **Password** : (la valeur de `KEYCLOAK_ADMIN_PASSWORD`)

### 3. Configurer le Thème

1. Dans le menu de gauche, sélectionner le realm **hscode-realm**

2. Aller dans **Realm Settings** (Paramètres du realm)

3. Cliquer sur l'onglet **Themes** (Thèmes)

4. Dans la section **Login theme**, sélectionner **custom-theme** dans le menu déroulant

5. (Optionnel) Dans la section **Account theme**, sélectionner **custom-theme** également

6. Cliquer sur **Save** (Enregistrer) en bas de la page

### 4. Tester le Thème

1. Se déconnecter de l'administration Keycloak

2. Aller sur la page de connexion :
   ```
   https://auth.hscode.enclume-numerique.com/realms/hscode-realm/protocol/openid-connect/auth?client_id=frontend-client&redirect_uri=https://hscode.enclume-numerique.com/&response_type=code&scope=openid%20profile%20email
   ```

3. Vous devriez voir le nouveau formulaire de connexion avec :
   - Un en-tête personnalisé "Bienvenue sur Enclume-Numérique"
   - Des champs de saisie stylisés avec des bordures arrondies
   - Un bouton de connexion avec un dégradé bleu
   - Un design moderne et cohérent avec votre application

## 🎨 Personnalisation

### Modifier les Couleurs

Les couleurs principales sont définies dans `keycloak/themes/custom-theme/login/login.css` :

- **Bleu principal** : `#1e3c72`
- **Bleu secondaire** : `#2a5298`
- **Bleu accent** : `#3498db`

Pour changer les couleurs, modifier ces valeurs dans le fichier CSS.

### Ajouter un Logo

1. Placer votre logo dans `keycloak/themes/custom-theme/login/resources/img/logo.png`

2. Modifier `keycloak/themes/custom-theme/login/login.ftl` et ajouter dans la section `<#if section = "header">` :

```html
<img src="${url.resourcesPath}/img/logo.png" alt="Logo Enclume-Numérique" class="custom-logo" />
```

3. Ajouter les styles dans `login.css` :

```css
.custom-logo {
    max-width: 200px;
    margin-bottom: 1rem;
    display: block;
    margin-left: auto;
    margin-right: auto;
}
```

### Modifier les Textes

Modifier le fichier `keycloak/themes/custom-theme/login/login.ftl` pour changer les textes affichés.

## 🔧 Dépannage

### Le thème ne s'affiche pas

1. Vérifier que le conteneur Keycloak a bien redémarré :
   ```bash
   docker logs <nom-du-conteneur-keycloak>
   ```

2. Vérifier que le volume est bien monté :
   ```bash
   docker exec <nom-du-conteneur-keycloak> ls -la /opt/keycloak/themes
   ```
   Vous devriez voir le dossier `custom-theme`

3. Vider le cache du navigateur (Ctrl+Shift+Delete)

4. Tester en navigation privée

### Erreurs dans les logs Keycloak

Si vous voyez des erreurs liées au thème dans les logs :

1. Vérifier la syntaxe des fichiers `.ftl` (FreeMarker)
2. Vérifier que les fichiers CSS sont bien formés
3. Vérifier les permissions des fichiers

### Le thème ne se met pas à jour après modification

1. Redémarrer Keycloak après chaque modification
2. Vider le cache du navigateur
3. Vérifier que les fichiers sont bien sauvegardés

## 📝 Notes Importantes

- **Sauvegarde** : Toujours sauvegarder vos modifications dans Git
- **Syntaxe FreeMarker** : Les fichiers `.ftl` utilisent la syntaxe FreeMarker de Keycloak
- **Cache** : Keycloak met en cache les thèmes, redémarrer après chaque modification
- **Variables d'environnement** : Les variables `KC_THEME_CACHE_THEMES` et `KC_THEME_CACHE_TEMPLATES` sont activées pour améliorer les performances

## 🎯 Prochaines Étapes

Une fois le thème activé, vous pouvez :

1. Ajouter votre logo d'entreprise
2. Personnaliser davantage les couleurs pour correspondre à votre charte graphique
3. Ajouter des images de fond si souhaité
4. Personnaliser les messages d'erreur
5. Ajouter des animations CSS pour améliorer l'UX

## 📚 Ressources

- [Documentation Keycloak Themes](https://www.keycloak.org/docs/latest/server_development/#_themes)
- [FreeMarker Documentation](https://freemarker.apache.org/docs/)
- [Keycloak Theme Examples](https://github.com/keycloak/keycloak/tree/main/themes/src/main/resources/theme)

