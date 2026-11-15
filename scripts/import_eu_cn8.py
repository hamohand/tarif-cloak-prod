#!/usr/bin/env python3
"""Télécharge, parse et importe la Nomenclature Combinée UE 2026 officielle (NC8 / TDC) en français.

Source officielle : Règlement d'exécution (UE) 2025/1926 de la Commission du 22 septembre 2025
(CELEX:32025R1926), Deuxième Partie — Tableau des droits (Journal officiel de l'Union européenne).

Exemples d'utilisation :
  python scripts/import_eu_cn8.py --self-test
  python scripts/import_eu_cn8.py --output backend/src/main/resources/db/migration/V38__import_eu_cn8_nomenclature.sql
"""

from __future__ import annotations

import argparse
import html as html_lib
import json
import re
import sys
import unittest
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DEFAULT_CELLAR_URL = "http://publications.europa.eu/resource/cellar/c3c0d050-b5fa-11f0-b37f-01aa75ed71a1.0010.03/DOC_1"
FALLBACK_CELEX_URL = "https://publications.europa.eu/resource/celex/32025R1926"
DEFAULT_CACHE_PATH = Path("data/eu/cn2026_fr.xhtml")

EU_GLOSSARY = [
    ("EU", "TAX", "DD", "Droit conventionnel TDC (Pays tiers)", "Taux du Tarif Douanier Commun applicable aux pays tiers hors accords préférentiels (Règlement UE 2025/1926).", "DG TAXUD"),
    ("EU", "UQN", "p/st", "Nombre de pièces", "Unité supplémentaire : comptage par pièce / tête / unité.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "pa", "Nombre de paires", "Unité supplémentaire : comptage par paire.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "kg", "Kilogramme", "Masse nette en kilogrammes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "l", "Litre", "Volume en litres.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "m", "Mètre", "Longueur en mètres.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "m2", "Mètre carré", "Surface en mètres carrés.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "m3", "Mètre cube", "Volume en mètres cubes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "c/k", "Carat (1 carat métrique = 2 × 10^-4 kg)", "Masse en carats métriques pour pierres et perles.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "ce/el", "Nombre d'éléments", "Nombre d'éléments (notamment piles et accumulateurs).", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "ct/l", "Port en lourd en tonnes métriques", "Capacité de charge utile des navires en tonnes métriques.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "g", "Gramme", "Masse nette en grammes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "gi F/S", "Gramme d'isotopes fissiles", "Masse en grammes des isotopes fissiles.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "GT", "Tonnage brut (Jauge brute)", "Tonnage brut des navires.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "1 000 kWh", "Millier de kilowattheures", "Énergie électrique exprimée par tranche de 1 000 kWh.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "1 000 l", "Millier de litres", "Volume exprimé par tranche de 1 000 litres.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "1 000 p/st", "Millier de pièces", "Quantité exprimée par tranche de 1 000 unités.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "100 p/st", "Centaine de pièces", "Quantité exprimée par tranche de 100 unités.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "l alc. 100 %", "Litre d'alcool pur (100 %)", "Volume d'alcool pur à 100 % exprimé en litres.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "kg/net eda", "Kilogramme poids net égoutté", "Masse nette de produit égoutté en kilogrammes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "kg H2O2", "Kilogramme de peroxyde d'hydrogène", "Masse nette de H2O2 contenu en kilogrammes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "kg K2O", "Kilogramme d'oxyde de potassium", "Masse nette de K2O contenu en kilogrammes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "kg KOH", "Kilogramme d'hydroxyde de potassium", "Masse nette de KOH contenu en kilogrammes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "kg met.am.", "Kilogramme de méthylamines", "Masse nette de méthylamines contenues en kilogrammes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "kg N", "Kilogramme d'azote", "Masse nette d'azote contenu en kilogrammes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "kg NaOH", "Kilogramme d'hydroxyde de sodium", "Masse nette de NaOH (soude caustique) en kilogrammes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "kg P2O5", "Kilogramme de pentaoxyde de diphosphore", "Masse nette de P2O5 contenu en kilogrammes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "kg 90 % sdt", "Kilogramme de matière sèche à 90 %", "Masse en kg rapportée à 90 % de matière sèche.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "kg U", "Kilogramme d'uranium", "Masse nette d'uranium contenu en kilogrammes.", "Eurostat / DG TAXUD"),
    ("EU", "UQN", "TJ", "Térajoule (pouvoir calorifique supérieur)", "Quantité d'énergie en térajoules.", "Eurostat / DG TAXUD"),
]


@dataclass
class EuTariffRow:
    code: str
    formatted_code: str | None
    chapter_code: str
    pos4_code: str
    hs6_code: str
    description: str
    dash_level: int
    is_title: bool
    regulatory_data: dict[str, Any] | None = None
    enriched: bool = False


class _OjTableRowParser(HTMLParser):
    """Extrait les lignes <tr> -> [cellule, ...] d'un fragment XHTML du Journal officiel UE."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.rows: list[list[str]] = []
        self._in_tr = False
        self._in_td = False
        self._skip_note_depth = 0
        self._current_row: list[str] = []
        self._cell_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        if tag == "tr":
            self._in_tr = True
            self._current_row = []
        elif tag in ("td", "th") and self._in_tr:
            self._in_td = True
            self._cell_parts = []
        elif self._in_td:
            if self._skip_note_depth > 0:
                self._skip_note_depth += 1
            elif tag == "a":
                href = attr_map.get("href") or ""
                if href.startswith("#ntr") or "ntc" in (attr_map.get("id") or ""):
                    self._skip_note_depth = 1
            elif tag == "br":
                self._cell_parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if self._skip_note_depth > 0:
            self._skip_note_depth -= 1
            return
        if tag in ("td", "th") and self._in_td:
            raw = html_lib.unescape("".join(self._cell_parts)).replace("\xa0", " ")
            cleaned = re.sub(r"\s+", " ", raw).strip()
            self._current_row.append(cleaned)
            self._in_td = False
        elif tag == "tr" and self._in_tr:
            if len(self._current_row) == 4:
                self.rows.append(self._current_row)
            self._in_tr = False

    def handle_data(self, data: str) -> None:
        if self._in_td and self._skip_note_depth == 0:
            self._cell_parts.append(data)

    def handle_entityref(self, name: str) -> None:
        if self._in_td and self._skip_note_depth == 0:
            self._cell_parts.append(html_lib.unescape(f"&{name};"))

    def handle_charref(self, name: str) -> None:
        if self._in_td and self._skip_note_depth == 0:
            self._cell_parts.append(html_lib.unescape(f"&#{name};"))


def count_dashes(description: str | None) -> int:
    if not description:
        return 0
    count = 0
    for ch in description:
        if ch == "-":
            count += 1
        elif ch != " ":
            break
    return count


def normalize_leading_dashes(desc: str) -> tuple[str, int]:
    """Convertit les tirets Unicode (–, —) initiaux du JO UE en tirets ASCII uniformes."""
    s = re.sub(r"\s+", " ", desc.replace("\xa0", " ")).strip()
    m = re.match(r"^([\u2012\u2013\u2014\u2015-](?:\s*[\u2012\u2013\u2014\u2015-])*)\s*(.*)$", s)
    if not m:
        return s, 0
    dash_count = len(re.findall(r"[\u2012\u2013\u2014\u2015-]", m.group(1)))
    if dash_count == 0:
        return s, 0
    rest = m.group(2).strip()
    prefix = " ".join("-" for _ in range(dash_count))
    normalized = f"{prefix} {rest}".strip() if rest else prefix
    return normalized, dash_count


def normalize_eu_duty(raw: str) -> str | None:
    val = re.sub(r"\s+", " ", (raw or "").replace("\xa0", " ")).strip()
    if not val or val in {"-", "—", "–"}:
        return None
    if val.lower() == "exemption":
        return "0 % (Exemption)"
    if re.fullmatch(r"\d+(?:[.,]\d+)?", val):
        return f"{val} %"
    return val


def normalize_eu_uqn(raw: str) -> str | None:
    val = re.sub(r"\s+", " ", (raw or "").replace("\xa0", " ")).strip()
    if not val or val in {"-", "—", "–"}:
        return None
    val = val.replace("m²", "m2").replace("m³", "m3")
    return val


def extract_part_two_slice(xhtml_text: str) -> str:
    p2_matches = [m.start() for m in re.finditer(r"DEUXI[ÈE]ME PARTIE", xhtml_text)]
    p3_matches = [m.start() for m in re.finditer(r"TROISI[ÈE]ME PARTIE", xhtml_text)]
    if p2_matches and p3_matches:
        start = p2_matches[-1]
        end = next((pos for pos in p3_matches if pos > start), len(xhtml_text))
        return xhtml_text[start:end]
    return xhtml_text


def parse_eu_cn8_xhtml(xhtml_text: str) -> list[EuTariffRow]:
    slice_html = extract_part_two_slice(xhtml_text)
    parser = _OjTableRowParser()
    parser.feed(slice_html)
    parser.close()

    rows: list[EuTariffRow] = []
    seen_codes: set[str] = set()
    current_pos4 = ""

    for col_code, col_desc, col_duty, col_supp in parser.rows:
        digits = re.sub(r"\s+", "", col_code)
        # Ignore en-têtes numériques du tableau ("1", "2", "3", "4" ou "Code NC")
        if digits in {"1", "2", "3", "4"} or not col_desc:
            continue

        desc_norm, dash_level = normalize_leading_dashes(col_desc)
        if not desc_norm:
            continue

        # Code Position 4 chiffres (chapitres 01..97 uniquement)
        if re.fullmatch(r"\d{4}", digits):
            chap = int(digits[:2])
            if not (1 <= chap <= 97):
                current_pos4 = ""
                continue
            current_pos4 = digits
            if digits not in seen_codes:
                seen_codes.add(digits)
                rows.append(
                    EuTariffRow(
                        code=digits,
                        formatted_code=digits,
                        chapter_code=digits[:2],
                        pos4_code=digits,
                        hs6_code="",
                        description=desc_norm[:4000],
                        dash_level=0,
                        is_title=True,
                        regulatory_data=None,
                        enriched=False,
                    )
                )
            continue

        # Sous-position intermédiaire 6 chiffres
        if re.fullmatch(r"\d{6}", digits):
            chap = int(digits[:2])
            if not (1 <= chap <= 97):
                continue
            current_pos4 = digits[:4]
            rows.append(
                EuTariffRow(
                    code="",
                    formatted_code=None,
                    chapter_code=digits[:2],
                    pos4_code=digits[:4],
                    hs6_code=digits,
                    description=desc_norm[:4000],
                    dash_level=max(1, dash_level),
                    is_title=True,
                    regulatory_data=None,
                    enriched=False,
                )
            )
            continue

        # Feuille NC8 à 8 chiffres
        if re.fullmatch(r"\d{8}", digits):
            chap = int(digits[:2])
            if not (1 <= chap <= 97):
                continue
            current_pos4 = digits[:4]
            if digits in seen_codes:
                continue
            seen_codes.add(digits)

            dd = normalize_eu_duty(col_duty)
            uqn = normalize_eu_uqn(col_supp)
            reg: dict[str, Any] = {"fap": []}
            if dd is not None:
                reg["dd"] = dd
            if uqn is not None:
                reg["uqn"] = uqn

            formatted = f"{digits[:4]}.{digits[4:6]}.{digits[6:8]}"
            rows.append(
                EuTariffRow(
                    code=digits,
                    formatted_code=formatted,
                    chapter_code=digits[:2],
                    pos4_code=digits[:4],
                    hs6_code=digits[:6],
                    description=desc_norm[:4000],
                    dash_level=dash_level,
                    is_title=False,
                    regulatory_data=reg,
                    enriched=True,
                )
            )
            continue

        # Ligne de titre intermédiaire sans code (avec tirets)
        if not digits and dash_level > 0 and current_pos4:
            rows.append(
                EuTariffRow(
                    code="",
                    formatted_code=None,
                    chapter_code=current_pos4[:2],
                    pos4_code=current_pos4,
                    hs6_code="",
                    description=desc_norm[:4000],
                    dash_level=dash_level,
                    is_title=True,
                    regulatory_data=None,
                    enriched=False,
                )
            )

    return rows


def _sql_str(val: str | None) -> str:
    if val is None:
        return "NULL"
    return "'" + val.replace("'", "''") + "'"


def generate_eu_sql(rows: list[EuTariffRow], batch_size: int = 500) -> str:
    nc8_count = sum(1 for r in rows if not r.is_title and len(r.code) == 8)
    pos4_count = sum(1 for r in rows if r.is_title and len(r.code) == 4)
    title_count = sum(1 for r in rows if r.code == "")

    lines = [
        "-- Import officiel de la Nomenclature Combinée UE 2026 (NC8 + Droit conventionnel TDC + Unités supplémentaires)",
        "-- Source : Règlement d'exécution (UE) 2025/1926 de la Commission (CELEX:32025R1926, JO L 31.10.2025)",
        f"-- Lignes totales : {len(rows)} (Positions 4 : {pos4_count}, Titres : {title_count}, Feuilles NC8 : {nc8_count})",
        "",
        "INSERT INTO tariff_glossary (zone_code, category, code, label, description, authority) VALUES",
    ]
    glossary_tuples = [
        f"    ({_sql_str(z)}, {_sql_str(cat)}, {_sql_str(c)}, {_sql_str(lbl)}, {_sql_str(desc)}, {_sql_str(auth)})"
        for z, cat, c, lbl, desc, auth in EU_GLOSSARY
    ]
    lines.append(",\n".join(glossary_tuples))
    lines.append("ON CONFLICT (zone_code, category, code) DO NOTHING;")
    lines.append("")
    lines.append("DELETE FROM tariff_position WHERE zone_code = 'EU';")
    lines.append("")

    for i in range(0, len(rows), batch_size):
        chunk = rows[i : i + batch_size]
        lines.append(
            "INSERT INTO tariff_position (zone_code, code, formatted_code, check_digit, "
            "chapter_code, pos4_code, hs6_code, description, dash_level, is_title, "
            "row_order, regulatory_data, enriched, source_version) VALUES"
        )
        tuples_sql = []
        for offset, row in enumerate(chunk):
            row_order = i + offset + 1
            reg_sql = (
                f"{_sql_str(json.dumps(row.regulatory_data, ensure_ascii=False, separators=(',', ':')))}::jsonb"
                if row.regulatory_data is not None
                else "NULL"
            )
            tuples_sql.append(
                f"    ('EU', {_sql_str(row.code)}, {_sql_str(row.formatted_code)}, NULL, "
                f"{_sql_str(row.chapter_code)}, {_sql_str(row.pos4_code)}, {_sql_str(row.hs6_code)}, "
                f"{_sql_str(row.description)}, {row.dash_level}, {'true' if row.is_title else 'false'}, "
                f"{row_order}, {reg_sql}, {'true' if row.enriched else 'false'}, 'CN2026')"
            )
        lines.append(",\n".join(tuples_sql) + ";")
        lines.append("")

    return "\n".join(lines)


def ensure_cn2026_xhtml(cache_path: Path) -> str:
    if cache_path.exists():
        return cache_path.read_text(encoding="utf-8")

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    headers = {
        "Accept": "application/xhtml+xml, text/html;q=0.9",
        "Accept-Language": "fr",
        "User-Agent": "TCI-CustomCodes-Importer/1.0",
    }
    last_err: Exception | None = None
    for url in (DEFAULT_CELLAR_URL, FALLBACK_CELEX_URL):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw_bytes = resp.read()
                text = raw_bytes.decode("utf-8")
                cache_path.write_text(text, encoding="utf-8")
                return text
        except Exception as exc:  # pragma: no cover - réseau externe
            last_err = exc
    raise RuntimeError(f"Impossible de télécharger la NC 2026 officielle : {last_err}")


class ImportEuCn8SelfTest(unittest.TestCase):
    SAMPLE_XHTML = """<?xml version="1.0" encoding="UTF-8"?>
    <html><body>
      <p>DEUXIÈME PARTIE — TABLEAU DES DROITS</p>
      <table>
        <tr class="oj-table">
          <td class="oj-table"><p class="oj-tbl-cod">0101 </p></td>
          <td class="oj-table"><p class="oj-tbl-txt"><span class="oj-bold">Chevaux, ânes, mulets et bardots, vivants:</span></p></td>
          <td class="oj-table"><p class="oj-normal">&#160;</p></td>
          <td class="oj-table"><p class="oj-normal">&#160;</p></td>
        </tr>
        <tr class="oj-table">
          <td class="oj-table"><p class="oj-normal">&#160;</p></td>
          <td class="oj-table"><p class="oj-tbl-txt">– <span class="oj-bold">Chevaux:</span></p></td>
          <td class="oj-table"><p class="oj-normal">&#160;</p></td>
          <td class="oj-table"><p class="oj-normal">&#160;</p></td>
        </tr>
        <tr class="oj-table">
          <td class="oj-table"><p class="oj-tbl-cod">0101&#160;21&#160;00 </p></td>
          <td class="oj-table"><p class="oj-tbl-txt">– – <span class="oj-bold">reproducteurs de race pure</span>
            <a id="ntc19-test" href="#ntr19-test">&#160;(<span class="oj-super oj-note-tag">19</span>)</a>
          </p></td>
          <td class="oj-table"><p class="oj-tbl-txt">exemption</p></td>
          <td class="oj-table"><p class="oj-tbl-txt">p/st</p></td>
        </tr>
        <tr class="oj-table">
          <td class="oj-table"><p class="oj-tbl-cod">0101&#160;29 </p></td>
          <td class="oj-table"><p class="oj-tbl-txt">– – <span class="oj-bold">autres:</span></p></td>
          <td class="oj-table"><p class="oj-normal">&#160;</p></td>
          <td class="oj-table"><p class="oj-normal">&#160;</p></td>
        </tr>
        <tr class="oj-table">
          <td class="oj-table"><p class="oj-tbl-cod">0101&#160;29&#160;90 </p></td>
          <td class="oj-table"><p class="oj-tbl-txt">– – – autres</p></td>
          <td class="oj-table"><p class="oj-tbl-txt">11,5</p></td>
          <td class="oj-table"><p class="oj-tbl-txt">p/st</p></td>
        </tr>
        <tr class="oj-table">
          <td class="oj-table"><p class="oj-tbl-cod">9950&#160;00&#160;00 </p></td>
          <td class="oj-table"><p class="oj-tbl-txt">Code spécial chapitre 99 ignoré</p></td>
          <td class="oj-table"><p class="oj-tbl-txt">—</p></td>
          <td class="oj-table"><p class="oj-tbl-txt">—</p></td>
        </tr>
      </table>
      <p>TROISIÈME PARTIE — ANNEXES TARIFAIRES</p>
    </body></html>
    """

    def test_parse_eu_cn8_hierarchy_and_sql(self) -> None:
        rows = parse_eu_cn8_xhtml(self.SAMPLE_XHTML)
        self.assertEqual(len(rows), 5)

        p4, dash1, leaf1, hs6_title, leaf2 = rows
        self.assertEqual((p4.code, p4.is_title, p4.pos4_code), ("0101", True, "0101"))
        self.assertEqual((dash1.code, dash1.dash_level, dash1.description), ("", 1, "- Chevaux:"))

        self.assertEqual(leaf1.code, "01012100")
        self.assertEqual(leaf1.formatted_code, "0101.21.00")
        self.assertEqual(leaf1.hs6_code, "010121")
        self.assertEqual(leaf1.dash_level, 2)
        self.assertEqual(leaf1.description, "- - reproducteurs de race pure")
        self.assertEqual(leaf1.regulatory_data, {"fap": [], "dd": "0 % (Exemption)", "uqn": "p/st"})

        self.assertEqual((hs6_title.code, hs6_title.hs6_code, hs6_title.dash_level, hs6_title.is_title), ("", "010129", 2, True))
        self.assertEqual(leaf2.regulatory_data, {"fap": [], "dd": "11,5 %", "uqn": "p/st"})

        sql = generate_eu_sql(rows)
        self.assertIn("DELETE FROM tariff_position WHERE zone_code = 'EU';", sql)
        self.assertIn("'01012100'", sql)
        self.assertIn("'0101.21.00'", sql)
        self.assertNotIn("99500000", sql)


def main() -> int:
    parser = argparse.ArgumentParser(description="Importateur officiel Nomenclature Combinée UE 2026 (NC8).")
    parser.add_argument("--input", "-i", type=Path, default=DEFAULT_CACHE_PATH, help="Fichier XHTML cache local.")
    parser.add_argument("--output", "-o", type=Path, help="Fichier SQL Flyway de sortie.")
    parser.add_argument("--batch-size", type=int, default=500, help="Taille des lots SQL (défaut: 500).")
    parser.add_argument("--self-test", action="store_true", help="Exécute les tests unitaires intégrés.")
    args = parser.parse_args()

    if args.self_test:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(ImportEuCn8SelfTest)
        result = unittest.TextTestRunner(stream=sys.stdout, verbosity=2).run(suite)
        return 0 if result.wasSuccessful() else 1

    xhtml_text = ensure_cn2026_xhtml(args.input)
    rows = parse_eu_cn8_xhtml(xhtml_text)
    sql_text = generate_eu_sql(rows, batch_size=args.batch_size)
    nc8_count = sum(1 for r in rows if not r.is_title and len(r.code) == 8)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(sql_text, encoding="utf-8")
        print(f"OK : {nc8_count} positions NC8 uniques ({len(rows)} lignes totales) -> {args.output}")
    else:
        sys.stdout.write(sql_text)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
