# Données tarifaires Algérie (Chapitres JSON)

Placez ici vos 97 fichiers JSON officiels (`chapitre01.json` à `chapitre97.json`).

Les fichiers JSON de ce dossier sont ignorés par Git (`data/dz/chapitres/*.json`) afin de ne pas versionner de volumineux fichiers bruts dans le dépôt.

## Générer la migration d'enrichissement Flyway (`V36`)

Une fois les fichiers JSON copiés dans ce dossier, exécutez depuis la racine du dépôt :

```powershell
python scripts/import_dz_chapter.py data/dz/chapitres --full-reload --output backend/src/main/resources/db/migration/V36__reload_and_enrich_dz_from_chapter_jsons.sql
```

Pour vérifier le parseur sur ses cas de test intégrés :

```powershell
python scripts/import_dz_chapter.py --self-test
```
