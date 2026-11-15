# Données tarifaires Union Européenne (NC8 / TDC 2026)

Source officielle : **Journal officiel de l'Union européenne — Règlement d'exécution (UE) 2025/1926 de la Commission du 22 septembre 2025** (`CELEX:32025R1926`), modifiant l'annexe I du règlement (CEE) n° 2658/87 relatif à la Nomenclature combinée (NC 2026) en vigueur à compter du 1er janvier 2026 (version française officielle).

Le fichier XHTML téléchargé localement (`data/eu/cn2026_fr.xhtml`, ~24 Mo) est ignoré par Git (`data/eu/*.xhtml` dans `.gitignore`).

## Régénérer la migration Flyway (`V38`)

```powershell
python scripts/import_eu_cn8.py --output backend/src/main/resources/db/migration/V38__import_eu_cn8_nomenclature.sql
```

Pour exécuter le jeu de tests unitaires intégré :

```powershell
python scripts/import_eu_cn8.py --self-test
```
