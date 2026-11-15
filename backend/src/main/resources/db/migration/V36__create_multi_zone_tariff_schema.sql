-- Chantier 2 : Schéma unifié multi-zones (Algérie DZ, Union Européenne EU, ...)
-- Préserve position10_dz pour compatibilité et initialise tariff_position, tariff_glossary, tariff_note.

CREATE TABLE IF NOT EXISTS tariff_position (
    id              BIGSERIAL PRIMARY KEY,
    zone_code       VARCHAR(8) NOT NULL DEFAULT 'DZ',
    code            VARCHAR(16) NOT NULL DEFAULT '',
    formatted_code  VARCHAR(32),
    check_digit     VARCHAR(4),
    chapter_code    VARCHAR(4) NOT NULL DEFAULT '',
    pos4_code       VARCHAR(4) NOT NULL DEFAULT '',
    hs6_code        VARCHAR(6) NOT NULL DEFAULT '',
    description     VARCHAR(4096) NOT NULL,
    dash_level      INTEGER NOT NULL DEFAULT 0,
    is_title        BOOLEAN NOT NULL DEFAULT false,
    row_order       INTEGER NOT NULL DEFAULT 0,
    regulatory_data JSONB,
    enriched        BOOLEAN NOT NULL DEFAULT false,
    source_version  VARCHAR(32) DEFAULT '2026'
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_tariff_position_zone_code
    ON tariff_position (zone_code, code) WHERE code != '';

CREATE INDEX IF NOT EXISTS idx_tariff_position_zone_hs6
    ON tariff_position (zone_code, hs6_code) WHERE hs6_code != '';

CREATE INDEX IF NOT EXISTS idx_tariff_position_zone_pos4_order
    ON tariff_position (zone_code, pos4_code, row_order);

CREATE INDEX IF NOT EXISTS idx_tariff_position_zone_chap_order
    ON tariff_position (zone_code, chapter_code, row_order);

-- Migration initiale depuis position10_dz en préservant exactement l'ordre des lignes (row_order = id)
WITH numbered AS (
    SELECT
        id,
        COALESCE(code, '') AS code,
        description,
        COUNT(*) FILTER (WHERE COALESCE(code, '') ~ '^[0-9]{4,}$')
            OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS grp
    FROM position10_dz
),
resolved AS (
    SELECT
        id,
        code,
        description,
        COALESCE(
            FIRST_VALUE(NULLIF(LEFT(code, 4), '')) OVER (PARTITION BY grp ORDER BY id),
            ''
        ) AS resolved_pos4
    FROM numbered
)
INSERT INTO tariff_position (
    zone_code,
    code,
    formatted_code,
    check_digit,
    chapter_code,
    pos4_code,
    hs6_code,
    description,
    dash_level,
    is_title,
    row_order,
    regulatory_data,
    enriched,
    source_version
)
SELECT
    'DZ' AS zone_code,
    r.code,
    CASE
        WHEN LENGTH(r.code) = 10 THEN
            LEFT(r.code, 4) || '.' || SUBSTRING(r.code, 5, 2) || '.' || SUBSTRING(r.code, 7, 2) || '.' || RIGHT(r.code, 2)
        WHEN LENGTH(r.code) = 4 THEN r.code
        ELSE NULL
    END AS formatted_code,
    NULL AS check_digit,
    CASE
        WHEN LENGTH(r.resolved_pos4) >= 2 THEN LEFT(r.resolved_pos4, 2)
        ELSE ''
    END AS chapter_code,
    r.resolved_pos4 AS pos4_code,
    CASE
        WHEN LENGTH(r.code) >= 6 THEN LEFT(r.code, 6)
        ELSE ''
    END AS hs6_code,
    r.description,
    LENGTH(REGEXP_REPLACE(COALESCE(SUBSTRING(r.description FROM '^[- ]+'), ''), '[^-]', '', 'g')) AS dash_level,
    (r.code = '' OR LENGTH(r.code) < 6) AS is_title,
    r.id AS row_order,
    NULL AS regulatory_data,
    false AS enriched,
    '2026' AS source_version
FROM resolved r
WHERE NOT EXISTS (
    SELECT 1 FROM tariff_position tp WHERE tp.zone_code = 'DZ'
)
ORDER BY r.id ASC;

-- Glossaire officiel des sigles et unités par zone
CREATE TABLE IF NOT EXISTS tariff_glossary (
    id          BIGSERIAL PRIMARY KEY,
    zone_code   VARCHAR(8) NOT NULL,
    category    VARCHAR(16) NOT NULL,
    code        VARCHAR(32) NOT NULL,
    label       VARCHAR(255) NOT NULL,
    description TEXT,
    authority   VARCHAR(128),
    CONSTRAINT uk_tariff_glossary_zone_cat_code UNIQUE (zone_code, category, code)
);

INSERT INTO tariff_glossary (zone_code, category, code, label, description, authority) VALUES
    -- FAP officielles (DGD Algérie)
    ('DZ', 'FAP', 'I.S.V', 'Inspection Sanitaire Vétérinaire', 'Inspection de contrôle sanitaire vétérinaire aux frontières pour les animaux, produits animaux et denrées d''origine animale.', 'Ministère de l''Agriculture / DSV'),
    ('DZ', 'FAP', 'D.S.V', 'Dérogation Sanitaire Vétérinaire', 'Visa ou dérogation sanitaire vétérinaire requis pour l''importation des produits soumis à contrôle vétérinaire.', 'Direction des Services Vétérinaires'),
    ('DZ', 'FAP', 'C.C', 'Contrôle de Conformité / Certificat de Conformité', 'Vérification de conformité aux normes et exigences de sécurité avant mise à la consommation.', 'Ministère du Commerce'),
    ('DZ', 'FAP', 'V.P.H', 'Visa de Contrôle Phytosanitaire', 'Contrôle phytosanitaire obligatoire pour les végétaux, produits végétaux et articles assimilés.', 'Ministère de l''Agriculture / INPV'),
    ('DZ', 'FAP', 'C.P.O', 'Certificat Phytosanitaire du Pays d''Origine', 'Document phytosanitaire délivré par le pays d''origine attestant l''état sanitaire des produits végétaux.', 'INPV / Pays d''origine'),
    ('DZ', 'FAP', 'A.T.I', 'Autorisation Technique Préalable à l''Importation', 'Autorisation technique préalable délivrée pour l''introduction de certains végétaux et produits agricoles.', 'INPV / Ministère de l''Agriculture'),
    ('DZ', 'FAP', 'A.S.R.I', 'Autorisation pour Sources de Rayonnements Ionisants', 'Autorisation requise pour l''importation d''appareils ou substances émettant des rayonnements ionisants.', 'ANSSN'),
    ('DZ', 'FAP', 'A.P.I.E', 'Autorisation Préalable Stupéfiants et Psychotropes', 'Autorisation préalable à l''importation/exportation de stupéfiants et substances psychotropes.', 'Ministère de la Santé'),
    ('DZ', 'FAP', 'V.T.I', 'Visa Technique Préalable à l''Importation', 'Visa technique préalable requis notamment pour les produits pharmaceutiques et dispositifs médicaux.', 'Ministère de la Santé / ANPP'),
    ('DZ', 'FAP', 'A.I.E.M', 'Agrément d''Importation des Équipements Médicaux', 'Agrément exigé pour l''importation et la distribution des équipements médicaux.', 'Ministère de la Santé'),
    ('DZ', 'FAP', 'D.I.T', 'Décision d''Autorisation d''Importation du Tabac', 'Décision réglementaire encadrant l''importation des tabacs manufacturés ou bruts.', 'Direction Générale des Impôts (DGI)'),
    ('DZ', 'FAP', 'Q.I.S.R', 'Quota d''Importation de Substances Réglementées', 'Quota annuel accordé pour les substances réglementées affectant notamment la couche d''ozone.', 'Ministère de l''Environnement'),
    ('DZ', 'FAP', 'O.N.E.X', 'Monopole Office National des Substances Explosives', 'Produits explosifs, poudres et artifices soumis au contrôle et au monopole de l''ONEX.', 'ONEX / MDN'),
    ('DZ', 'FAP', 'V.I.M', 'Visa des Instruments de Mesure', 'Contrôle métrologique des instruments de pesage et de mesure destinés au marché.', 'Office National de Métrologie Légale (ONML)'),
    ('DZ', 'FAP', 'C.C.T', 'Cahier des Charges Type', 'Soumission aux engagements d''un cahier des charges réglementaire applicable au secteur.', 'Ministère du Commerce / Industrie'),
    ('DZ', 'FAP', 'A.E.D.C', 'Attestation d''Exportation (Direction du Commerce)', 'Attestation délivrée par la Direction de Wilaya du Commerce territorialement compétente.', 'Ministère du Commerce'),
    ('DZ', 'FAP', 'A.P.I', 'Autorisation Préalable à l''Importation', 'Autorisation préalable à l''importation délivrée par le ministère technique compétent.', 'Ministère Technique Compétent'),
    ('DZ', 'FAP', 'A.P.E', 'Autorisation Préalable / Agrément Spécifique', 'Autorisation sectorielle ou agrément spécifique exigé par le ministère de tutelle.', 'Ministère de Tutelle'),
    -- Unités de Quantité Normalisée (UQN)
    ('DZ', 'UQN', 'U', 'Unité / Pièce', 'Comptage à l''unité (nombre d''articles ou d''animaux).', 'DGD'),
    ('DZ', 'UQN', '2U', 'Paire', 'Comptage par paire (deux articles appariés).', 'DGD'),
    ('DZ', 'UQN', 'kg', 'Kilogramme', 'Masse nette exprimée en kilogrammes.', 'DGD'),
    ('DZ', 'UQN', 'l', 'Litre', 'Volume exprimé en litres.', 'DGD'),
    ('DZ', 'UQN', 'm', 'Mètre', 'Longueur exprimée en mètres.', 'DGD'),
    ('DZ', 'UQN', 'm2', 'Mètre carré', 'Surface exprimée en mètres carrés.', 'DGD'),
    ('DZ', 'UQN', 'm3', 'Mètre cube', 'Volume exprimé en mètres cubes.', 'DGD'),
    ('DZ', 'UQN', 'Carat', 'Carat métrique', 'Unité de masse pour pierres précieuses et perles (1 carat = 0,2 g).', 'DGD'),
    ('DZ', 'UQN', '1000 kw/h', 'Millier de kilowattheures', 'Énergie électrique exprimée par tranche de 1 000 kWh.', 'DGD'),
    ('DZ', 'UQN', 'U (jeu/pack)', 'Unité (jeu ou conditionnement)', 'Unité conditionnée en jeu, assortiment ou pack.', 'DGD'),
    -- Taxes & Guichet Unique
    ('DZ', 'TAX', 'DD', 'Droit de Douane', 'Taux ad valorem du Droit de Douane applicable à l''importation (%).', 'DGD'),
    ('DZ', 'TAX', 'TVA', 'Taxe sur la Valeur Ajoutée', 'Taux de TVA applicable (taux réduit 9 % ou taux normal 19 %).', 'DGI / DGD'),
    ('DZ', 'TAX', 'DAPS', 'Droit Additionnel Provisoire de Sauvegarde', 'Taxe additionnelle visant à protéger certaines filières de production nationale.', 'DGD / Ministère du Commerce'),
    ('DZ', 'TAX', 'TIC', 'Taxe Intérieure de Consommation', 'Taxe spécifique ou ad valorem frappant certains produits ciblés.', 'DGI / DGD'),
    ('DZ', 'GU', 'GU', 'Code Guichet Unique / Régime', 'Indicateur du régime de traitement ou circuit guichet unique au tarif douanier.', 'DGD')
ON CONFLICT (zone_code, category, code) DO NOTHING;

-- Notes officielles multi-zones (Section / Chapitre / Sous-position / Renvoi)
CREATE TABLE IF NOT EXISTS tariff_note (
    id          BIGSERIAL PRIMARY KEY,
    zone_code   VARCHAR(8) NOT NULL DEFAULT 'DZ',
    level       VARCHAR(16) NOT NULL,
    code        VARCHAR(16) NOT NULL,
    note_text   TEXT NOT NULL,
    CONSTRAINT uk_tariff_note_zone_level_code UNIQUE (zone_code, level, code)
);
