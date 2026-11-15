#!/usr/bin/env python3
"""Parse et importe les fichiers JSON des chapitres du tarif douanier algérien (DZ).

Gère les 58 variantes d'en-têtes issues de l'extraction PDF (pages décalées avec bannière
SECTION/CHAPITRE, schémas décalés type chapitres 23 et 85, pages sans en-tête où la
première ligne est devenue les clés du dictionnaire JSON, codes glissés dans `col_00` /
`col_01`, espaces OCR dans les sigles FAP comme `A.S .R.I`, `T.S .V` dans `Autres`,
taxes `DAPS`/`T.I.C` égarées dans FAP).

Exemples d'utilisation :
  python scripts/import_dz_chapter.py data/dz/chapitres/chapitre01.json --sql
  python scripts/import_dz_chapter.py data/dz/chapitres --output backend/src/main/resources/db/migration/V37__enrich_dz_from_chapter_jsons.sql
  python scripts/import_dz_chapter.py data/dz/chapitres --full-reload --output backend/src/main/resources/db/migration/V37__reload_and_enrich_dz_from_chapter_jsons.sql
  python scripts/import_dz_chapter.py --self-test
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unittest
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Assure une sortie UTF-8 même sur console Windows (cp1252)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Motif code P10 algérien tolérant à l'OCR : "0101.21.91.00 L" ou "2 601.11.00.00 D"
P10_LOOSE_RE = re.compile(
    r"(?<!\d)(\d\s*\d\s*\d\s*\d)\s*[.\s]?\s*(\d\s*\d)\s*[.\s]?\s*(\d\s*\d)\s*[.\s]?\s*(\d\s*\d)\s*([A-Za-z])?(?!\d)"
)
# Motif Position 4 chiffres : "01.01", "Sous Position 33. 07", "& Sous Position 89.01"
P4_LOOSE_RE = re.compile(
    r"^(?:&\s*)?(?:sous\s+position\s+|position\s*&\s*sous\s+position\s+|position\s+)?(\d\s*\d)\s*\.\s*(\d\s*\d)\s*$",
    re.IGNORECASE,
)

# Signatures d'en-têtes connus (normalisés en minuscules sans sauts/espaces multiples)
DESIGNATION_HEADERS = (
    "désignation",
    "designation",
    "désignation des produits",
    "designation des produits",
)
POSITION_HEADERS = (
    "position",
    "position &",
    "sous position",
    "position & sous position",
    "sous-position",
)
DD_HEADERS = (
    "droits et taxes",
    "droits et taxes autres droits",
    "droits taxes",
    "dd",
    "d.d",
    "d.d %",
    "d.d%",
)
TVA_HEADERS = ("tva", "t.v.a", "t.v.a %", "t.v.a%")
AUTRES_HEADERS = ("autres", "autres droits et taxes", "autres droits", "autres droits et ta xes")
UQN_HEADERS = ("uqn", "u.q.n")
GU_HEADERS = ("gu", "g.u")
FAP_HEADERS = (
    "fap",
    "f.ap",
    "f.a.p",
    "formalités administratives particulières",
    "formalites administratives particulieres",
)

HEADER_ONLY_DESCS = {
    "désignation",
    "designation",
    "désignation des produits",
    "designation des produits",
    "position",
    "sous position",
    "position & sous position",
}

HEADER_ONLY_TAXES = {
    "autres droits et taxes",
    "droits et taxes",
    "droits & taxes",
    "autres droits",
    "taxes",
    "et taxes",
    "d.d",
    "%",
    "t.v.a",
}

# Sigles connus qui peuvent apparaître seuls comme clé sur une page sans en-tête
KNOWN_STANDALONE_FAPS = {
    "I.S.V", "D.S.V", "C.C", "CC", "V.P.H", "C.P.O", "A.T.I", "A.S.R.I", "A.P.I.E",
    "V.T.I", "A.I.E.M", "D.I.T", "Q.I.S.R", "O.N.E.X", "V.I.M", "C.C.T", "A.E.D.C",
    "A.P.I", "A.P.E", "T.D.M", "I.S", "A.O.A", "H.I.E.T", "A.I.E.S", "T.C.E",
    "A.A.M", "A.E.B.C", "D.R.T.A", "A.D.L.O",
}

EXTRA_DZ_GLOSSARY = [
    ("DZ", "FAP", "H.I.E.T", "Homologation des Équipements de Télécommunications", "Homologation technique requise pour les équipements terminaux et radioélectriques (ARPCE).", "ARPCE"),
    ("DZ", "FAP", "T.C.E", "Titre de Contrôle à l'Exportation / Formalité Technique", "Formalité ou visa administratif requis pour certaines marchandises soumises à contrôle.", "DGD / Administration concernée"),
    ("DZ", "FAP", "D.R.T.A", "Dérogation / Autorisation Technique Réglementaire", "Document ou dérogation technique exigé lors du dédouanement.", "Administration compétente"),
    ("DZ", "FAP", "T.D.M", "Titre / Autorisation DGD ou Ministère Technique", "Document administratif particulier requis à l'importation.", "Ministère technique compétent"),
    ("DZ", "FAP", "I.S", "Inspection Sanitaire", "Contrôle sanitaire obligatoire à la frontière.", "Autorité sanitaire"),
    ("DZ", "FAP", "A.O.A", "Autorisation / Agrément Officiel d'Importation", "Agrément administratif exigé pour les produits concernés.", "Ministère compétent"),
    ("DZ", "FAP", "A.I.E.S", "Autorisation d'Importation d'Équipements Sensibles", "Autorisation spécifique applicable aux équipements réglementés ou sensibles.", "Administration compétente"),
    ("DZ", "FAP", "A.A.M", "Autorisation Administrative / Agrément Ministériel", "Agrément préalable requis pour l'importation de certaines marchandises.", "Ministère technique"),
    ("DZ", "FAP", "A.E.B.C", "Autorisation / Attestation d'Exploitation ou de Contrôle", "Formalité administrative particulière applicable au dédouanement.", "Ministère compétent"),
    ("DZ", "FAP", "A.D.L.O", "Autorisation / Document Réglementaire Spécifique", "Document administratif particulier requis pour certaines positions tarifaires.", "Administration compétente"),
    ("DZ", "TAX", "T.S.V", "Taxe Sanitaire Vétérinaire", "Taxe sanitaire vétérinaire perçue à l'importation sur certains animaux et viandes.", "DGD / Services vétérinaires"),
    ("DZ", "UQN", "1000 U", "Millier d'unités", "Comptage par tranche de 1 000 articles ou unités.", "DGD"),
]

UQN_MAP = {
    "u": "U",
    "2u": "2U",
    "1000 u": "1000 U",
    "kg": "kg",
    "k g": "kg",
    "l": "l",
    "m": "m",
    "m2": "m2",
    "m 2": "m2",
    "m3": "m3",
    "m 3": "m3",
    "carat": "Carat",
    "1000 kw/h": "1000 kw/h",
    "1000kw/h": "1000 kw/h",
    "u (jeu/pack)": "U (jeu/pack)",
}


@dataclass
class ParsedPosition10:
    code: str
    formatted_code: str
    check_digit: str | None
    description: str = ""
    pos4_code: str = ""
    chapter_code: str = ""
    dd: str | None = None
    tva: str | None = None
    autres: str | None = None
    uqn: str | None = None
    gu: str | None = None
    fap: list[str] = field(default_factory=list)

    def regulatory_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if self.dd is not None:
            payload["dd"] = self.dd
        if self.tva is not None:
            payload["tva"] = self.tva
        if self.autres is not None:
            payload["autres"] = self.autres
        if self.uqn is not None:
            payload["uqn"] = self.uqn
        if self.gu is not None:
            payload["gu"] = self.gu
        payload["fap"] = self.fap
        return payload

    def completeness_score(self) -> tuple[int, int, int]:
        filled = sum(1 for v in (self.dd, self.tva, self.autres, self.uqn, self.gu) if v not in (None, "", "-"))
        return (filled, len(self.fap), 1 if self.description else 0)


@dataclass
class ParsedTariffRow:
    code: str
    formatted_code: str | None
    check_digit: str | None
    chapter_code: str
    pos4_code: str
    hs6_code: str
    description: str
    dash_level: int
    is_title: bool
    regulatory_data: dict[str, Any] | None = None
    enriched: bool = False
    score: tuple[int, int, int] = (0, 0, 0)


def _norm_key(key: str) -> str:
    return re.sub(r"\s+", " ", key.strip()).lower()


def _clean_scalar(val: Any) -> str | None:
    if val is None:
        return None
    s = re.sub(r"\s+", " ", str(val).strip())
    return s if s else None


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


def parse_p10_code(raw: str | None) -> tuple[str, str, str | None] | None:
    if not raw:
        return None
    m = P10_LOOSE_RE.search(raw.strip())
    if not m:
        return None
    p1, p2, p3, p4, check = m.groups()
    parts = [re.sub(r"\s+", "", x) for x in (p1, p2, p3, p4)]
    code = "".join(parts)
    if len(code) != 10:
        return None
    formatted = f"{parts[0]}.{parts[1]}.{parts[2]}.{parts[3]}"
    check_digit = check.upper() if check else None
    return code, formatted, check_digit


def parse_p4_code(raw: str | None) -> str | None:
    if not raw:
        return None
    m = P4_LOOSE_RE.match(raw.strip())
    if not m:
        return None
    p1 = re.sub(r"\s+", "", m.group(1))
    p2 = re.sub(r"\s+", "", m.group(2))
    return f"{p1}{p2}"


def normalize_uqn(raw: str | None) -> str | None:
    val = _clean_scalar(raw)
    if not val or val == "-":
        return None
    val = re.sub(r"^u\.?q\.?n\.?\s+", "", val, flags=re.IGNORECASE).strip()
    if not val or val == "-":
        return None
    val_no_star = re.sub(r"\s*\(\*\)\s*", "", val).strip()
    mapped = UQN_MAP.get(val_no_star.lower())
    if mapped:
        return mapped
    return val_no_star


def normalize_autres(raw: str | None) -> str | None:
    val = _clean_scalar(raw)
    if not val or val == "-":
        return None if not val else "-"
    val = re.sub(
        r"^(?:autres\s+droits(?:\s+et\s+taxes)?|droits\s+et\s+taxes|et\s+taxes)\s+",
        "",
        val,
        flags=re.IGNORECASE,
    ).strip()
    if not val:
        return None
    if val == "-":
        return "-"
    if val.lower() in HEADER_ONLY_TAXES:
        return None
    # Fusionne espaces OCR dans sigles de taxe (ex: "T.S .V" -> "T.S.V")
    val = re.sub(r"\s*\.\s*", ".", val)
    return val


def normalize_fap_and_leaked_taxes(raw_fap: str | None, existing_autres: str | None) -> tuple[list[str], str | None]:
    fap_list: list[str] = []
    autres = normalize_autres(existing_autres)

    cleaned = _clean_scalar(raw_fap)
    if not cleaned or cleaned == "-":
        return fap_list, autres

    # Fusionne les espaces OCR entre points/lettres (ex: "A.S .R.I" -> "A.S.R.I", "H .I.E.T" -> "H.I.E.T")
    cleaned = re.sub(r"\s*\.\s*", ".", cleaned)
    tokens = [t.strip() for t in re.split(r"[;,\n|]+", cleaned) if t.strip()]

    for tok in tokens:
        tok = re.sub(r"\(\*+\)", "", tok).strip()
        if not tok or tok == "-":
            continue
        compact = re.sub(r"\s+", "", tok)
        upper_compact = compact.upper()

        # Résidus d'en-têtes glissés depuis PDF (ex: "Droits et Taxes -", "et Taxes -", "ETTAXES-")
        if upper_compact in {"DROITSETTAXES", "DROITSETTAXES-", "ETTAXES", "ETTAXES-", "TAXES", "TAXES-", "AUTRESDROITSETTAXES"}:
            continue
        if upper_compact.startswith("AUTRESDROITSETTAXES"):
            remainder = tok[len("Autres Droits et Taxes"):].strip() if len(tok) > 22 else ""
            if remainder and (not autres or autres == "-"):
                autres = normalize_autres(remainder)
            continue
        if upper_compact.startswith("DAPS") or upper_compact in {"T.I.C", "TIC"} or upper_compact.startswith("T.I.C(") or upper_compact.startswith("TIC("):
            if not autres or autres == "-":
                autres = tok
            continue

        # Normalisation ponctuation et OCR connu
        if upper_compact in {"CC", "C.C"}:
            normalized = "C.C"
        elif upper_compact == "D.RTA":
            normalized = "D.R.T.A"
        else:
            normalized = compact.upper() if "." in compact else tok

        if normalized not in fap_list:
            fap_list.append(normalized)

    return fap_list, autres


def _clean_dd_or_tva(raw: str | None) -> str | None:
    val = _clean_scalar(raw)
    if not val:
        return None
    val = re.sub(r"^(?:d\.?d\.?|t\.?v\.?a\.?)\s+", "", val, flags=re.IGNORECASE).strip()
    if not val or val.lower() in HEADER_ONLY_TAXES:
        return None
    return val


def _clean_gu(raw: str | None) -> str | None:
    val = _clean_scalar(raw)
    if not val:
        return None
    val = re.sub(r"^g\.?u\.?\s+", "", val, flags=re.IGNORECASE).strip()
    return val if val else None


def _strip_desc_prefix(key_clean: str) -> str:
    for prefix in ("Désignation des Produits ", "Designation des Produits ", "Désignation ", "Designation "):
        if key_clean.startswith(prefix):
            return key_clean[len(prefix):].strip()
    return key_clean


def _build_p10_row(
    code: str,
    formatted: str,
    check: str | None,
    desc: str,
    dd: str | None,
    tva: str | None,
    autres: str | None,
    uqn: str | None,
    gu: str | None,
    fap_raw: str | None,
) -> ParsedPosition10:
    fap_list, merged_autres = normalize_fap_and_leaked_taxes(fap_raw, autres)
    return ParsedPosition10(
        code=code,
        formatted_code=formatted,
        check_digit=check,
        description=desc[:4000],
        pos4_code=code[:4],
        chapter_code=code[:2],
        dd=_clean_dd_or_tva(dd),
        tva=_clean_dd_or_tva(tva),
        autres=merged_autres,
        uqn=normalize_uqn(uqn),
        gu=_clean_gu(gu),
        fap=fap_list,
    )


def _extract_promoted_from_keys(record: dict[str, Any]) -> list[ParsedPosition10 | tuple[str, str]]:
    """Extrait une éventuelle ligne P10, Pos4 ou titre à tirets promue en clés du dict."""
    raw_pos: str | None = None
    p4_code: str | None = None
    desc_val: str | None = None
    dd_val: str | None = None
    tva_val: str | None = None
    autres_val: str | None = None
    uqn_val: str | None = None
    gu_val: str | None = None
    fap_parts: list[str] = []
    standalone_dash_titles: list[str] = []

    for k in record.keys():
        key_clean = re.sub(r"\s+", " ", k.strip())
        nk = key_clean.lower()

        if nk.startswith("section "):
            continue

        if m := re.match(r"^(?:&\s*)?(?:sous\s+position|position\s*&\s*sous\s+position|position)\s+(.+)$", key_clean, re.IGNORECASE):
            tail = m.group(1).strip()
            if parse_p10_code(tail):
                raw_pos = tail
                continue
            p4_candidate = parse_p4_code(tail)
            if p4_candidate:
                p4_code = p4_candidate
                continue

        if P10_LOOSE_RE.search(key_clean) and not key_clean.startswith("-"):
            if not raw_pos:
                raw_pos = key_clean
                continue

        if m := re.match(r"^(?:d\.?d(?:\s*%)?|droits et taxes(?:\s+autres droits)?)\s+(.+)$", key_clean, re.IGNORECASE):
            if not nk.startswith("droits et taxes -"):
                dd_val = _clean_scalar(m.group(1))
                continue
        if m := re.match(r"^(?:t\.?v\.?a(?:\s*%)?)\s+(.+)$", key_clean, re.IGNORECASE):
            tva_val = _clean_scalar(m.group(1))
            continue
        if m := re.match(r"^droits et taxes\s+(-|t\.?i\.?c.*)$", key_clean, re.IGNORECASE):
            autres_val = _clean_scalar(m.group(1))
            continue
        if m := re.match(r"^autres(?:\s+droits(?:\s+et\s+ta\s*xes)?)?\s+(.+)$", key_clean, re.IGNORECASE):
            if not nk.startswith("autres droits et ta"):
                autres_val = _clean_scalar(m.group(1))
            else:
                autres_val = _clean_scalar(m.group(1))
            continue
        if m := re.match(r"^u\.?q\.?n\s+(.+)$", key_clean, re.IGNORECASE):
            uqn_val = _clean_scalar(m.group(1))
            continue
        if m := re.match(r"^g\.?u\s+(.+)$", key_clean, re.IGNORECASE):
            if nk != "g.u u.q.n":
                gu_val = _clean_scalar(m.group(1))
                continue
        if m := re.match(r"^f\.?a\.?p\s+(.+)$", key_clean, re.IGNORECASE):
            fap_parts.append(m.group(1))
            continue

        if key_clean == "-":
            fap_parts.append("-")
            continue

        compact_up = re.sub(r"\s+", "", key_clean).upper()
        if compact_up in KNOWN_STANDALONE_FAPS or re.fullmatch(r"(?:[A-Z]\.){1,4}[A-Z]?", compact_up):
            fap_parts.append(key_clean)
            continue

        if nk.startswith("désignation des produits ") or nk.startswith("designation des produits "):
            desc_val = _strip_desc_prefix(key_clean)
            continue
        if key_clean.startswith("-") and count_dashes(key_clean) > 0:
            desc_val = key_clean
            standalone_dash_titles.append(key_clean)
            continue
        if len(key_clean) > 35 and not any(tok in nk for tok in ("droits", "statistiques", "sous position")):
            desc_val = key_clean

    out: list[ParsedPosition10 | tuple[str, str]] = []
    parsed_p10 = parse_p10_code(raw_pos)
    if parsed_p10:
        code, formatted, check = parsed_p10
        fap_joined = "; ".join(fap_parts) if fap_parts else None
        out.append(_build_p10_row(code, formatted, check, desc_val or "", dd_val, tva_val, autres_val, uqn_val, gu_val, fap_joined))
    elif p4_code:
        out.append(("P4", f"{p4_code}|{desc_val or ''}"))
    elif standalone_dash_titles:
        for t in standalone_dash_titles:
            out.append(("TITLE", t))
    return out


def _is_technical_table(rec: dict[str, Any]) -> bool:
    for k in rec.keys():
        kl = k.lower()
        if "grammage g/m2" in kl or "taux de passage dans un tamis" in kl:
            return True
    return False


def _extract_row_fields(rec: dict[str, Any]) -> tuple[str | None, str | None, str | None, str | None, str | None, str | None, str | None, str | None]:
    """Retourne (raw_pos, raw_desc, dd, tva, autres, uqn, gu, fap) selon le schéma détecté."""
    keys = list(rec.keys())

    # Cas A : Tableau avec bannière "SECTION ... CHAPITRE ..." (décalé dans col_01 ou non décalé dans la clé SECTION)
    section_key = next((k for k in keys if k.upper().startswith("SECTION ")), None)
    if section_key is not None:
        sec_val = _clean_scalar(rec.get(section_key))
        col01_val = _clean_scalar(rec.get("col_01"))
        col00_val = _clean_scalar(rec.get("col_00"))
        desig_val = _clean_scalar(rec.get("Désignation")) or _clean_scalar(rec.get("Designation"))
        dd_raw = _clean_scalar(rec.get("DD"))
        sec_has_code = bool(sec_val and (parse_p10_code(sec_val) or parse_p4_code(sec_val)))

        if not sec_has_code and (col01_val or col00_val or (dd_raw and dd_raw.startswith("-"))):
            raw_pos = col01_val or col00_val
            dd_val = _clean_scalar(rec.get("TVA"))
            tva_val = _clean_scalar(rec.get("Autres"))
            autres_val = _clean_scalar(rec.get("FAP"))
            gu_val = _clean_scalar(rec.get("UQN"))
            fap_parts = [v for v in (_clean_scalar(rec.get("col_09")), _clean_scalar(rec.get("col_10"))) if v]
            fap_val = "; ".join(fap_parts) if fap_parts else None
            return raw_pos, dd_raw, dd_val, tva_val, autres_val, desig_val, gu_val, fap_val

        return (
            sec_val or col01_val or col00_val,
            desig_val,
            dd_raw,
            _clean_scalar(rec.get("TVA")),
            _clean_scalar(rec.get("Autres")),
            _clean_scalar(rec.get("UQN")),
            _clean_scalar(rec.get("GU")),
            _clean_scalar(rec.get("FAP")),
        )

    # Cas B : Schéma décalé Chapitre 23 ("Autres D.D T.V.A Droits et Taxes", "DD", "TVA", "G.U U.Q.N", "GU", pas "Autres" ni "UQN")
    if (
        "Autres D.D T.V.A Droits et Taxes" in rec
        and "DD" in rec
        and "TVA" in rec
        and "Autres" not in rec
        and "UQN" not in rec
    ):
        return (
            _clean_scalar(rec.get("Position")),
            _clean_scalar(rec.get("Désignation des Produits")),
            _clean_scalar(rec.get("Autres D.D T.V.A Droits et Taxes")),
            _clean_scalar(rec.get("DD")),
            _clean_scalar(rec.get("TVA")),
            _clean_scalar(rec.get("GU")),
            _clean_scalar(rec.get("G.U U.Q.N")),
            _clean_scalar(rec.get("FAP")),
        )

    # Cas C : Schéma Chapitre 85 sans clé TVA ("Droits et Taxes Autres Droits D.D T.V.A", "Autres", "Statistiques G.U U.Q.N", "UQN")
    has_merged_dd_tva = any("d.d t.v.a" in k.lower() for k in keys)
    has_tva_key = any(k.strip().lower().startswith(("tva", "t.v.a")) for k in keys)
    if has_merged_dd_tva and not has_tva_key:
        dd_key = next((k for k in keys if "d.d t.v.a" in k.lower()), "DD")
        gu_key = next((k for k in keys if "statistiques" in k.lower() or "g.u" in k.lower()), "GU")
        return (
            _clean_scalar(rec.get("Position")) or _clean_scalar(rec.get("col_01")),
            _clean_scalar(rec.get("Désignation des Produits")) or _clean_scalar(rec.get("Désignation")),
            _clean_scalar(rec.get(dd_key)) or _clean_scalar(rec.get("DD")),
            _clean_scalar(rec.get("Autres")),
            None,
            _clean_scalar(rec.get("UQN")),
            _clean_scalar(rec.get(gu_key)),
            _clean_scalar(rec.get("FAP")),
        )

    # Cas D : Schémas standards, en-têtes fusionnés et pages sans en-tête
    norm_keys = {_norm_key(k) for k in keys}
    has_explicit_dd = any(nk in ("d.d", "d.d %", "dd") or nk.startswith("d.d ") for nk in norm_keys)
    has_long_autres = any(nk.startswith("autres droits") for nk in norm_keys)
    has_fap_key = any(nk in ("fap", "f.ap", "f.a.p") or nk.startswith("f.a.p ") for nk in norm_keys)

    raw_pos = None
    col00_val = None
    col01_val = None
    raw_desc = None
    dd_val = None
    tva_val = None
    autres_val = None
    uqn_val = None
    gu_val = None
    fap_val = None

    for k, v in rec.items():
        nk = _norm_key(k)
        sval = _clean_scalar(v)

        if nk == "col_00":
            col00_val = sval
        elif nk == "col_01":
            col01_val = sval
        elif (
            nk in POSITION_HEADERS
            or nk.startswith("sous position")
            or nk.startswith("& sous position")
            or nk.startswith("position &")
        ):
            if sval and not raw_pos:
                raw_pos = sval
        elif nk in DESIGNATION_HEADERS or nk.startswith("désignation des produits ") or nk.startswith("designation des produits "):
            if sval:
                raw_desc = sval
        elif nk in DD_HEADERS or nk.startswith("d.d "):
            if nk == "droits et taxes" and has_explicit_dd:
                autres_val = sval
            else:
                dd_val = sval
        elif nk.startswith("droits et taxes autr") or nk.startswith("droits & taxes") or nk.startswith("autres d.d"):
            dd_val = sval
        elif nk.startswith("droits et taxes -") or nk.startswith("droits et taxes t.i.c"):
            autres_val = sval
        elif nk in TVA_HEADERS or nk.startswith("t.v.a "):
            tva_val = sval
        elif nk in AUTRES_HEADERS or nk.startswith("autres droits et ta"):
            if nk == "autres":
                if has_long_autres and not has_fap_key:
                    fap_val = sval
                else:
                    autres_val = sval
            else:
                autres_val = sval
        elif nk in UQN_HEADERS or nk.startswith("u.q.n "):
            uqn_val = sval
        elif nk in GU_HEADERS or nk.startswith("g.u ") or nk == "statistiques g.u u.q.n" or nk == "g.u u.q.n":
            gu_val = sval
        elif nk in FAP_HEADERS or nk.startswith("f.a.p "):
            fap_val = sval
        elif not has_fap_key and k.strip() == "-":
            if sval:
                fap_val = sval
        elif not has_fap_key and re.sub(r"\s+", "", k.strip()).upper() in KNOWN_STANDALONE_FAPS:
            if sval:
                fap_val = sval
        elif not raw_desc and (k.strip().startswith("-") or (len(k.strip()) > 35 and "droits" not in nk and "position" not in nk)):
            if sval:
                raw_desc = sval

    if not raw_pos:
        raw_pos = col00_val or col01_val
    elif not parse_p10_code(raw_pos) and not parse_p4_code(raw_pos):
        raw_pos = col01_val or col00_val or raw_pos

    return raw_pos, raw_desc, dd_val, tva_val, autres_val, uqn_val, gu_val, fap_val


def extract_rows_from_records(records: list[dict[str, Any]], chapter_hint: str = "") -> list[ParsedTariffRow]:
    rows: list[ParsedTariffRow] = []
    seen_key_signatures: set[tuple[str, ...]] = set()
    current_pos4 = ""

    def attach_retro_pos4(p4: str) -> None:
        for prev in reversed(rows):
            if prev.pos4_code:
                break
            if prev.is_title and prev.code == "":
                prev.pos4_code = p4
                prev.chapter_code = chapter_hint or p4[:2]

    for rec in records:
        if not isinstance(rec, dict) or _is_technical_table(rec):
            continue

        sig = tuple(rec.keys())
        if sig not in seen_key_signatures:
            seen_key_signatures.add(sig)
            for item in _extract_promoted_from_keys(rec):
                if isinstance(item, ParsedPosition10):
                    current_pos4 = item.pos4_code
                    attach_retro_pos4(current_pos4)
                    rows.append(
                        ParsedTariffRow(
                            code=item.code,
                            formatted_code=item.formatted_code,
                            check_digit=item.check_digit,
                            chapter_code=chapter_hint or item.chapter_code,
                            pos4_code=item.pos4_code,
                            hs6_code=item.code[:6],
                            description=item.description,
                            dash_level=count_dashes(item.description),
                            is_title=False,
                            regulatory_data=item.regulatory_dict(),
                            enriched=True,
                            score=item.completeness_score(),
                        )
                    )
                else:
                    kind, val = item
                    if kind == "P4":
                        p4, p4_desc = val.split("|", 1)
                        current_pos4 = p4
                        attach_retro_pos4(current_pos4)
                        rows.append(
                            ParsedTariffRow(
                                code=p4,
                                formatted_code=p4,
                                check_digit=None,
                                chapter_code=chapter_hint or p4[:2],
                                pos4_code=p4,
                                hs6_code="",
                                description=(p4_desc or f"Position {p4}")[:4000],
                                dash_level=0,
                                is_title=True,
                            )
                        )
                    elif kind == "TITLE" and count_dashes(val) > 0:
                        rows.append(
                            ParsedTariffRow(
                                code="",
                                formatted_code=None,
                                check_digit=None,
                                chapter_code=chapter_hint or (current_pos4[:2] if current_pos4 else ""),
                                pos4_code=current_pos4,
                                hs6_code="",
                                description=val[:4000],
                                dash_level=count_dashes(val),
                                is_title=True,
                            )
                        )

        raw_pos, raw_desc, dd_val, tva_val, autres_val, uqn_val, gu_val, fap_val = _extract_row_fields(rec)

        parsed_p10 = parse_p10_code(raw_pos)
        if not parsed_p10 and raw_pos:
            p4_code = parse_p4_code(raw_pos)
            if p4_code:
                current_pos4 = p4_code
                attach_retro_pos4(current_pos4)
                desc_clean = _clean_scalar(raw_desc) or ""
                if desc_clean and desc_clean.lower() not in HEADER_ONLY_DESCS:
                    rows.append(
                        ParsedTariffRow(
                            code=p4_code,
                            formatted_code=p4_code,
                            check_digit=None,
                            chapter_code=chapter_hint or p4_code[:2],
                            pos4_code=p4_code,
                            hs6_code="",
                            description=desc_clean[:4000],
                            dash_level=0,
                            is_title=True,
                        )
                    )
                continue

        if parsed_p10:
            code, formatted, check = parsed_p10
            current_pos4 = code[:4]
            attach_retro_pos4(current_pos4)
            item = _build_p10_row(
                code=code,
                formatted=formatted,
                check=check,
                desc=_clean_scalar(raw_desc) or "",
                dd=dd_val,
                tva=tva_val,
                autres=autres_val,
                uqn=uqn_val,
                gu=gu_val,
                fap_raw=fap_val,
            )
            rows.append(
                ParsedTariffRow(
                    code=item.code,
                    formatted_code=item.formatted_code,
                    check_digit=item.check_digit,
                    chapter_code=chapter_hint or item.chapter_code,
                    pos4_code=item.pos4_code,
                    hs6_code=item.code[:6],
                    description=item.description or f"Position {item.formatted_code}",
                    dash_level=count_dashes(item.description),
                    is_title=False,
                    regulatory_data=item.regulatory_dict(),
                    enriched=True,
                    score=item.completeness_score(),
                )
            )
            continue

        desc_clean = _clean_scalar(raw_desc)
        if desc_clean and desc_clean.lower() not in HEADER_ONLY_DESCS and count_dashes(desc_clean) > 0:
            rows.append(
                ParsedTariffRow(
                    code="",
                    formatted_code=None,
                    check_digit=None,
                    chapter_code=chapter_hint or (current_pos4[:2] if current_pos4 else ""),
                    pos4_code=current_pos4,
                    hs6_code="",
                    description=desc_clean[:4000],
                    dash_level=count_dashes(desc_clean),
                    is_title=True,
                )
            )

    return rows


def extract_positions_from_records(records: list[dict[str, Any]]) -> dict[str, ParsedPosition10]:
    positions: dict[str, ParsedPosition10] = {}
    for row in extract_rows_from_records(records):
        if row.is_title or len(row.code) != 10:
            continue
        reg = row.regulatory_data or {}
        p = ParsedPosition10(
            code=row.code,
            formatted_code=row.formatted_code or row.code,
            check_digit=row.check_digit,
            description=row.description,
            pos4_code=row.pos4_code,
            chapter_code=row.chapter_code,
            dd=reg.get("dd"),
            tva=reg.get("tva"),
            autres=reg.get("autres"),
            uqn=reg.get("uqn"),
            gu=reg.get("gu"),
            fap=list(reg.get("fap") or []),
        )
        prev = positions.get(p.code)
        if prev is None or p.completeness_score() > prev.completeness_score():
            positions[p.code] = p
    return positions


def deduplicate_ordered_rows(rows: list[ParsedTariffRow]) -> list[ParsedTariffRow]:
    """Déduplique les codes non vides (P4 reportés entre pages, P10 éventuels) en préservant l'ordre."""
    out: list[ParsedTariffRow] = []
    index_by_code: dict[str, int] = {}

    for row in rows:
        if row.code == "":
            out.append(row)
            continue

        existing_idx = index_by_code.get(row.code)
        if existing_idx is None:
            index_by_code[row.code] = len(out)
            out.append(row)
        elif not row.is_title and row.score > out[existing_idx].score:
            out[existing_idx] = row

    for idx, row in enumerate(out, start=1):
        # Conserve l'attribut row_order implicite via énumération lors de l'export SQL
        if not row.description:
            row.description = f"Position {row.formatted_code or row.code}"
    return out


def load_json_file(path: Path) -> list[dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return [r for r in raw if isinstance(r, dict)]
    if isinstance(raw, dict):
        for candidate in ("rows", "data", "items", "records"):
            if isinstance(raw.get(candidate), list):
                return [r for r in raw[candidate] if isinstance(r, dict)]
    raise ValueError(f"Format JSON inattendu dans {path}")


def _sql_str(val: str | None) -> str:
    if val is None:
        return "NULL"
    return "'" + val.replace("'", "''") + "'"


def generate_update_sql(positions: dict[str, ParsedPosition10], batch_size: int = 500) -> str:
    if not positions:
        return "-- Aucune position 10 chiffres trouvée.\n"

    lines = [
        "-- Enrichissement des positions 10 chiffres Algérie (DZ) depuis les chapitres JSON officiels",
        f"-- Total positions uniques extraites : {len(positions)}",
        "",
    ]

    items = [positions[k] for k in sorted(positions.keys())]
    for i in range(0, len(items), batch_size):
        chunk = items[i : i + batch_size]
        lines.append("UPDATE tariff_position AS t")
        lines.append("SET formatted_code = v.formatted_code,")
        lines.append("    check_digit = v.check_digit,")
        lines.append("    regulatory_data = v.regulatory_data::jsonb,")
        lines.append("    enriched = true")
        lines.append("FROM (VALUES")

        tuples_sql = []
        for item in chunk:
            reg_json = json.dumps(item.regulatory_dict(), ensure_ascii=False, separators=(",", ":"))
            tuples_sql.append(
                f"    ({_sql_str(item.code)}, {_sql_str(item.formatted_code)}, "
                f"{_sql_str(item.check_digit)}, {_sql_str(reg_json)})"
            )
        lines.append(",\n".join(tuples_sql))
        lines.append(") AS v(code, formatted_code, check_digit, regulatory_data)")
        lines.append("WHERE t.zone_code = 'DZ' AND t.code = v.code;")
        lines.append("")

    return "\n".join(lines)


def generate_full_reload_sql(rows: list[ParsedTariffRow], batch_size: int = 500) -> str:
    clean_rows = deduplicate_ordered_rows(rows)
    p10_count = sum(1 for r in clean_rows if not r.is_title and len(r.code) == 10)
    p4_count = sum(1 for r in clean_rows if r.is_title and len(r.code) == 4)
    title_count = sum(1 for r in clean_rows if r.code == "")

    lines = [
        "-- Rechargement complet et enrichissement réglementaire Algérie (DZ) depuis les 97 chapitres JSON officiels (DGD)",
        f"-- Lignes totales : {len(clean_rows)} (Positions 4 : {p4_count}, Titres intermédiaires : {title_count}, Feuilles P10 : {p10_count})",
        "",
        "ALTER TABLE tariff_position ALTER COLUMN description TYPE VARCHAR(4096);",
        "",
        "UPDATE chapitre",
        "SET description = 'OBJETS D''ART, DE COLLECTION OU D''ANTIQUITÉ'",
        "WHERE code = '97' AND description LIKE '%Politique de confidentialité%';",
        "",
        "INSERT INTO tariff_glossary (zone_code, category, code, label, description, authority) VALUES",
    ]
    glossary_tuples = [
        f"    ({_sql_str(z)}, {_sql_str(cat)}, {_sql_str(c)}, {_sql_str(lbl)}, {_sql_str(desc)}, {_sql_str(auth)})"
        for z, cat, c, lbl, desc, auth in EXTRA_DZ_GLOSSARY
    ]
    lines.append(",\n".join(glossary_tuples))
    lines.append("ON CONFLICT (zone_code, category, code) DO NOTHING;")
    lines.append("")
    lines.append("DELETE FROM tariff_position WHERE zone_code = 'DZ';")
    lines.append("")

    for i in range(0, len(clean_rows), batch_size):
        chunk = clean_rows[i : i + batch_size]
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
                f"    ('DZ', {_sql_str(row.code)}, {_sql_str(row.formatted_code)}, {_sql_str(row.check_digit)}, "
                f"{_sql_str(row.chapter_code)}, {_sql_str(row.pos4_code)}, {_sql_str(row.hs6_code)}, "
                f"{_sql_str(row.description)}, {row.dash_level}, {'true' if row.is_title else 'false'}, "
                f"{row_order}, {reg_sql}, {'true' if row.enriched else 'false'}, 'DGD-2024')"
            )
        lines.append(",\n".join(tuples_sql) + ";")
        lines.append("")

    return "\n".join(lines)


class ImportDzChapterSelfTest(unittest.TestCase):
    def test_standard_row_and_ocr_fap(self) -> None:
        records = [
            {
                "Autres": "-",
                "Droits et Taxes": "5",
                "Désignation": "- - - - De pur sang arabe",
                "FAP": "I.S.V; A.S .R.I; CC",
                "GU": "1",
                "Position": "0101.21.91.00 L",
                "TVA": "9",
                "UQN": "k g",
                "col_01": "",
            },
            {
                "Autres": "",
                "Droits et Taxes": "",
                "Désignation": "- - - Autres que de course :",
                "FAP": "",
                "GU": "",
                "Position": "",
                "TVA": "",
                "UQN": "",
                "col_01": "",
            },
        ]
        res = extract_positions_from_records(records)
        self.assertEqual(list(res.keys()), ["0101219100"])
        p = res["0101219100"]
        self.assertEqual(p.formatted_code, "0101.21.91.00")
        self.assertEqual(p.check_digit, "L")
        self.assertEqual(p.dd, "5")
        self.assertEqual(p.tva, "9")
        self.assertEqual(p.uqn, "kg")
        self.assertEqual(p.gu, "1")
        self.assertEqual(p.fap, ["I.S.V", "A.S.R.I", "C.C"])

    def test_headerless_dict_keys_and_col01_and_leaked_daps(self) -> None:
        records = [
            {
                "Sous Position 6907.21.29.10 V": "6907.21.29.90 H",
                "Désignation": "- - - Autres",
                "D.D 30": "30",
                "T.V.A 19": "19",
                "Autres Droits et Taxes DAPS (60%)": "DAPS (60%)",
                "U.Q.N m2": "m 2",
                "G.U 8": "8",
                "F.A.P -": "DAPS (60%)",
                "C.C": "C.C",
            }
        ]
        res = extract_positions_from_records(records)
        self.assertIn("6907212910", res)
        self.assertIn("6907212990", res)

        from_keys = res["6907212910"]
        self.assertEqual(from_keys.formatted_code, "6907.21.29.10")
        self.assertEqual(from_keys.check_digit, "V")
        self.assertEqual(from_keys.dd, "30")
        self.assertEqual(from_keys.tva, "19")
        self.assertEqual(from_keys.autres, "DAPS (60%)")
        self.assertEqual(from_keys.uqn, "m2")
        self.assertEqual(from_keys.gu, "8")
        self.assertEqual(from_keys.fap, ["C.C"])

        from_vals = res["6907212990"]
        self.assertEqual(from_vals.check_digit, "H")
        self.assertEqual(from_vals.autres, "DAPS (60%)")
        self.assertEqual(from_vals.uqn, "m2")
        self.assertEqual(from_vals.fap, [])

    def test_shifted_section_chap23_chap85_and_ocr_spaces(self) -> None:
        records = [
            # Cas A : bannière SECTION / CHAPITRE (chapitre 03)
            {
                "Autres": "9",
                "DD": "- - - - Destinées à la reproduction (**)",
                "Désignation": "kg",
                "FAP": "-",
                "GU": "",
                "SECTION I CHAPITRE 3 DOUANES ALGERIENNES - 2024 -": "",
                "TVA": "5",
                "UQN": "1",
                "col_01": "0301.99.11.00 W",
                "col_09": "I.S.V; D.S.V ; C.C",
            },
            # Cas B : schéma chapitre 23
            {
                "Autres D.D T.V.A Droits et Taxes": "30",
                "DD": "19",
                "Désignation des Produits": "- - - - Destinés à l'alimentation des animaux",
                "FAP": "C.C; I.S.V; D.S.V",
                "G.U U.Q.N": "1",
                "GU": "kg",
                "Position": "2301.10.11.00 Y",
                "TVA": "-",
            },
            # Cas C : schéma chapitre 85 avec pipe + "H .I.E.T | et Taxes -"
            {
                "Autres": "19",
                "Droits et Taxes Autres Droits D.D T.V.A": "15",
                "Désignation des Produits": "- - - - Autres",
                "FAP": "C.C; H .I.E.T | et Taxes -",
                "Position": "8517.18.99.00 J",
                "Statistiques G.U U.Q.N": "7",
                "UQN": "U",
            },
            # Espace OCR dans le code + T.S .V
            {
                "Autres": "T.S .V",
                "Autres D.D T.V.A Droits et Taxes": "5",
                "Désignation des Produits": "- - Non agglomérés (*)",
                "FAP": "-",
                "G.U U.Q.N": "4",
                "Position": "2 601.11.00.00 D",
                "TVA": "19",
                "UQN": "kg",
                "col_01": "",
            },
            # Cas A non décalé : code dans SECTION ..., col_01 vide (chapitre 02)
            {
                "Autres": "T.S.V; DAPS (70%)",
                "DD": "30",
                "Désignation": "- - - - Autres",
                "FAP": "C.C; I.S.V; D.S.V",
                "GU": "1",
                "SECTION I CHAPITRE 2 DOUANES ALGERIENNES - 2024 -": "0204.23.29.00 H",
                "TVA": "-",
                "UQN": "kg",
                "col_01": "",
            },
            # Cas A décalé avec préfixes inline dans valeurs (chapitre 76)
            {
                "Autres": "T.V.A 19",
                "DD": "- - - - Tournures et copeaux",
                "Désignation": "U.Q.N kg",
                "FAP": "Droits et Taxes -",
                "GU": "",
                "SECTION XV CHAPITRE 76 DOUANES ALGERIENNES - 2024 -": "",
                "TVA": "D.D 15",
                "UQN": "G.U 5",
                "col_01": "Position 7602.00.11.00 Z",
                "col_09": "C.C.T; A.E.D.C",
            },
        ]
        res = extract_positions_from_records(records)

        p02 = res["0204232900"]
        self.assertEqual(p02.dd, "30")
        self.assertEqual(p02.tva, "-")
        self.assertEqual(p02.autres, "T.S.V; DAPS (70%)")
        self.assertEqual(p02.uqn, "kg")
        self.assertEqual(p02.gu, "1")
        self.assertEqual(p02.fap, ["C.C", "I.S.V", "D.S.V"])

        p76 = res["7602001100"]
        self.assertEqual(p76.dd, "15")
        self.assertEqual(p76.tva, "19")
        self.assertEqual(p76.autres, "-")
        self.assertEqual(p76.uqn, "kg")
        self.assertEqual(p76.gu, "5")
        self.assertEqual(p76.fap, ["C.C.T", "A.E.D.C"])

        p03 = res["0301991100"]
        self.assertEqual(p03.dd, "5")
        self.assertEqual(p03.tva, "9")
        self.assertEqual(p03.uqn, "kg")
        self.assertEqual(p03.gu, "1")
        self.assertEqual(p03.fap, ["I.S.V", "D.S.V", "C.C"])

        p23 = res["2301101100"]
        self.assertEqual(p23.dd, "30")
        self.assertEqual(p23.tva, "19")
        self.assertEqual(p23.uqn, "kg")
        self.assertEqual(p23.gu, "1")

        p85 = res["8517189900"]
        self.assertEqual(p85.dd, "15")
        self.assertEqual(p85.tva, "19")
        self.assertEqual(p85.uqn, "U")
        self.assertEqual(p85.gu, "7")
        self.assertEqual(p85.fap, ["C.C", "H.I.E.T"])

        p26 = res["2601110000"]
        self.assertEqual(p26.formatted_code, "2601.11.00.00")
        self.assertEqual(p26.check_digit, "D")
        self.assertEqual(p26.autres, "T.S.V")

        sql = generate_full_reload_sql(extract_rows_from_records(records))
        self.assertIn("DELETE FROM tariff_position WHERE zone_code = 'DZ';", sql)
        self.assertIn("INSERT INTO tariff_position", sql)
        self.assertIn("'2601110000'", sql)


def main() -> int:
    parser = argparse.ArgumentParser(description="Importateur des chapitres JSON algériens (DZ) vers SQL.")
    parser.add_argument("input", nargs="?", help="Fichier chapitreXX.json ou dossier contenant les JSON.")
    parser.add_argument("--sql", action="store_true", help="Affiche le SQL généré sur stdout.")
    parser.add_argument("--output", "-o", help="Chemin du fichier SQL de sortie.")
    parser.add_argument("--full-reload", action="store_true", help="Génère un rechargement complet DELETE+INSERT avec hiérarchie ordonnée.")
    parser.add_argument("--batch-size", type=int, default=500, help="Taille des lots SQL (défaut: 500).")
    parser.add_argument("--self-test", action="store_true", help="Exécute les tests unitaires intégrés.")
    args = parser.parse_args()

    if args.self_test:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(ImportDzChapterSelfTest)
        result = unittest.TextTestRunner(stream=sys.stdout, verbosity=2).run(suite)
        return 0 if result.wasSuccessful() else 1

    if not args.input:
        parser.error("Veuillez fournir un fichier ou un dossier en argument, ou utiliser --self-test.")

    target = Path(args.input)
    if not target.exists():
        print(f"Erreur : chemin introuvable : {target}", file=sys.stderr)
        return 1

    files = sorted(target.glob("*.json")) if target.is_dir() else [target]
    if not files:
        print(f"Erreur : aucun fichier .json trouvé dans {target}", file=sys.stderr)
        return 1

    if args.full_reload:
        all_rows: list[ParsedTariffRow] = []
        for jf in files:
            m_chap = re.search(r"(\d{2})", jf.stem)
            chap_hint = m_chap.group(1) if m_chap else ""
            records = load_json_file(jf)
            all_rows.extend(extract_rows_from_records(records, chapter_hint=chap_hint))
        sql_text = generate_full_reload_sql(all_rows, batch_size=args.batch_size)
        unique_p10 = len({r.code for r in deduplicate_ordered_rows(all_rows) if not r.is_title and len(r.code) == 10})
    else:
        merged: dict[str, ParsedPosition10] = {}
        for jf in files:
            records = load_json_file(jf)
            chapter_positions = extract_positions_from_records(records)
            for code, parsed in chapter_positions.items():
                prev = merged.get(code)
                if prev is None or parsed.completeness_score() > prev.completeness_score():
                    merged[code] = parsed
        sql_text = generate_update_sql(merged, batch_size=args.batch_size)
        unique_p10 = len(merged)

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(sql_text, encoding="utf-8")
        print(f"OK : {unique_p10} positions P10 uniques extraites depuis {len(files)} fichier(s) -> {out_path}")
    elif args.sql or not args.output:
        sys.stdout.write(sql_text)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
