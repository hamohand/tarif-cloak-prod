-- V35 : Normaliser les codes SH à 6 chiffres dans position6_dz
--
-- Contexte :
-- 1. 99 positions non subdivisées au niveau SH6 (ex. 1206 -> 120600, 0205 -> 020500)
--    avaient été importées dans position6_dz avec un code à 4 chiffres ('1206')
--    au lieu de 6 chiffres ('120600'), ce qui :
--    - bloquait la recherche P6 à 4 chiffres (1206 au lieu de 120600) ;
--    - provoquait une erreur HTTP 404 sur /api/decode-p10?code=120600 lors d'une recherche P10.
-- 2. 957 lignes d'en-tête à 4 chiffres redondantes avec la table position4
--    (ex. '0101' en plus de '010121', '010129', '010130', '010190') étaient présentes
--    dans position6_dz et pouvaient être retournées comme codes SH6.

-- 1. Ajouter le suffixe '00' aux 99 positions à 4 chiffres qui n'ont aucune sous-position à 6 chiffres
UPDATE position6_dz p
SET code = p.code || '00'
WHERE char_length(p.code) = 4
  AND NOT EXISTS (
      SELECT 1
      FROM position6_dz child
      WHERE char_length(child.code) = 6
        AND child.code LIKE p.code || '__'
  );

-- 2. Supprimer les 957 lignes d'en-tête à 4 chiffres redondantes (qui possèdent déjà des sous-positions à 6 chiffres)
DELETE FROM position6_dz p
WHERE char_length(p.code) = 4
  AND EXISTS (
      SELECT 1
      FROM position6_dz child
      WHERE char_length(child.code) = 6
        AND child.code LIKE p.code || '__'
  );
