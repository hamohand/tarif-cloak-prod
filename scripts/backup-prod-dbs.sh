#!/bin/bash
# scripts/backup-prod-dbs.sh
# Sauvegarde automatique des bases de données de production HS-Code
# Ce script doit être exécuté sur le VPS, idéalement par Cron.
# Exemple: 0 3 * * * /root/tarif-cloak-prod/scripts/backup-prod-dbs.sh

BACKUP_DIR="/root/backups-hscode"
DATE=$(date +"%Y%m%d_%H%M")
RETENTION_DAYS=15

# Créer le répertoire s'il n'existe pas
mkdir -p "$BACKUP_DIR"

echo "=== Début de la sauvegarde à $(date) ==="

# 1. Sauvegarde de la base principale (App DB)
# L'option -c génère les commandes DROP TABLE avant les CREATE TABLE,
# ce qui rend la restauration beaucoup plus facile et propre.
echo "Sauvegarde de la base de données de l'application..."
docker exec hscode-app-db sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -c' | gzip > "$BACKUP_DIR/app-db-$DATE.sql.gz"

# 2. Sauvegarde de la base Keycloak
echo "Sauvegarde de la base de données Keycloak..."
docker exec hscode-keycloak-db sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -c' | gzip > "$BACKUP_DIR/keycloak-db-$DATE.sql.gz"

# 3. Nettoyage des vieilles sauvegardes
echo "Nettoyage des fichiers de plus de $RETENTION_DAYS jours..."
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "=== Sauvegarde terminée avec succès à $(date) ==="
