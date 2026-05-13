#!/usr/bin/env python3
"""
extract_chapter_notes.py
Extrait les notes de section et de chapitre depuis les PDFs du tarif douanier.
Génère deux fichiers SQL :
  - pg6_notes_chapitres.sql  : UPDATE chapitre SET note = ...
  - pg7_notes_sections.sql   : UPDATE section SET note = ...

Usage:
  python extract_chapter_notes.py --pdf-dir ./pdfs-chapitres --output notes.sql
  python extract_chapter_notes.py --pdf-dir ./pdfs-chapitres --apercu
  python extract_chapter_notes.py --pdf-dir ./pdfs-chapitres --diagnose
Dépendances: pip install pdfplumber
"""

import argparse, os, re, sys

try:
    import pdfplumber
except ImportError:
    print("pip install pdfplumber"); sys.exit(1)

# ─── Conversion chiffres romains → code section (format base : '01', '02'...) ─

ROMAIN_VERS_ARABE = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
    'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
    'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20, 'XXI': 21,
}

def section_code_db(romain: str) -> str:
    """Convertit 'I' → '01', 'XIV' → '14', etc. Si non trouvé, retourne tel quel."""
    arabe = ROMAIN_VERS_ARABE.get(romain.upper())
    return str(arabe).zfill(2) if arabe else romain

# ─── Marqueurs ────────────────────────────────────────────────────────────────

TABLE_HEADER_MARKERS = [
    "position statistiques", "désignation des marchandises",
    "designation des marchandises", "n° du tarif", "n.d.p.f",
    "taux des droits", "droits et taxes", "n° tarifaire",
    "unité statistique", "sous désignation", "g.u u.q.n",
]

# Ligne "Chapitre N" (sans "DOUANES ALGERIENNES") = frontière section/chapitre
CHAPITRE_BOUNDARY = re.compile(r'^chapitre\s+\d+\s*$', re.IGNORECASE)
# En-têtes de page répétitifs à filtrer
PAGE_HEADER = re.compile(r'CHAPITRE\s+\d+\s+DOUANES', re.IGNORECASE)
# Code de section (chiffre arabe ou romain)
SECTION_CODE = re.compile(r'[Ss]ection\s+([IVXivx]+|\d+)', re.IGNORECASE)


# ─── Utilitaires ──────────────────────────────────────────────────────────────

def extraire_numero_chapitre(nom: str) -> str | None:
    nums = re.findall(r'\d+', os.path.splitext(nom)[0])
    return nums[-1].lstrip('0') or '0' if nums else None


def est_en_tete_tableau(ligne: str) -> bool:
    l = ligne.strip().lower()
    return len(l) >= 3 and any(m in l for m in TABLE_HEADER_MARKERS)


def est_tableau_cadre(table, page) -> bool:
    """Filtre les tableaux-cadres couvrant >60% de la page."""
    b = table.bbox
    ratio = ((b[2]-b[0]) * (b[3]-b[1])) / (page.width * page.height)
    return ratio > 0.60


def nettoyer(texte: str) -> str:
    texte = re.sub(r'^\s*\d+\s*$', '', texte, flags=re.MULTILINE)
    texte = re.sub(r'\n{3,}', '\n\n', texte)
    return texte.strip()


def echapper(t: str) -> str:
    return t.replace("'", "''")


# ─── Extraction ───────────────────────────────────────────────────────────────

def extraire_depuis_pdf(chemin: str, debug=False) -> tuple[str, str, str]:
    """
    Retourne (section_code, section_note, chapter_note).
    - section_code : ex. "I", "II" (vide si non trouvé)
    - section_note : texte avant la ligne "Chapitre N" (vide si absent)
    - chapter_note : texte après "Chapitre N" et avant l'en-tête du tableau
    """
    toutes_lignes = []
    tableau_atteint = False

    with pdfplumber.open(chemin) as pdf:
        for num_page, page in enumerate(pdf.pages, 1):
            if tableau_atteint:
                break
            texte = page.extract_text()
            if not texte:
                continue
            for ligne in texte.splitlines():
                if est_en_tete_tableau(ligne):
                    tableau_atteint = True
                    break
                if PAGE_HEADER.search(ligne):
                    continue
                toutes_lignes.append(ligne)

            if not tableau_atteint:
                vrais = [t for t in page.find_tables() if not est_tableau_cadre(t, page)]
                if vrais:
                    tableau_atteint = True

    # Extraire le code de section
    section_code = ""
    for ligne in toutes_lignes[:20]:
        m = SECTION_CODE.search(ligne)
        if m:
            section_code = m.group(1).upper()
            break

    # Trouver la frontière section/chapitre
    boundary_idx = None
    for i, ligne in enumerate(toutes_lignes):
        if CHAPITRE_BOUNDARY.match(ligne.strip()):
            boundary_idx = i
            if debug:
                print(f"    Frontière section/chapitre ligne {i}: '{ligne.strip()}'")
            break

    if boundary_idx is not None:
        section_note = nettoyer("\n".join(toutes_lignes[:boundary_idx]))
        chapter_note = nettoyer("\n".join(toutes_lignes[boundary_idx + 1:]))
    else:
        section_note = ""
        chapter_note = nettoyer("\n".join(toutes_lignes))

    return section_code, section_note, chapter_note


# ─── Diagnostic ───────────────────────────────────────────────────────────────

def diagnostiquer(chemin: str):
    print(f"\n{'='*60}\nDIAGNOSTIC : {os.path.basename(chemin)}\n{'='*60}")
    with pdfplumber.open(chemin) as pdf:
        print(f"Pages : {len(pdf.pages)}")
        for i, page in enumerate(pdf.pages[:3], 1):
            print(f"\n─── Page {i} ───")
            texte = page.extract_text()
            if not texte:
                print("  ⚠️  Aucun texte"); continue
            lignes = [l for l in texte.splitlines() if l.strip()]
            print(f"  {len(lignes)} lignes")
            for l in lignes[:10]:
                print(f"    > {l[:100]}")
            for l in lignes:
                if est_en_tete_tableau(l):
                    print(f"  🛑 EN-TÊTE TABLEAU : '{l.strip()}'"); break
                if CHAPITRE_BOUNDARY.match(l.strip()):
                    print(f"  📌 FRONTIÈRE section/chapitre : '{l.strip()}'")
            tables = page.find_tables()
            cadres = [t for t in tables if est_tableau_cadre(t, page)]
            vrais  = [t for t in tables if not est_tableau_cadre(t, page)]
            print(f"  Tableaux: {len(tables)} ({len(cadres)} cadres ignorés, {len(vrais)} vrais)")

    print()
    sc, sn, cn = extraire_depuis_pdf(chemin, debug=True)
    print(f"\nSection détectée : '{sc}'")
    print(f"Note de section  : {len(sn)} chars")
    print(f"Note de chapitre : {len(cn)} chars")


# ─── Génération SQL ───────────────────────────────────────────────────────────

def generer_sql_sections(section_notes: dict) -> str:
    """Génère les UPDATE pour la table section (codes convertis en format base '01', '02'...)."""
    lignes = [
        "-- Notes explicatives de sections — tarif douanier algérien",
        "-- Généré par extract_chapter_notes.py",
        "",
        "ALTER TABLE section ADD COLUMN IF NOT EXISTS note TEXT NULL;",
        "",
    ]
    for sc in sorted(section_notes, key=lambda x: ROMAIN_VERS_ARABE.get(x.upper(), 99)):
        code_db = section_code_db(sc)
        lignes.append(f"-- Section {sc} → code DB '{code_db}'")
        lignes.append(f"UPDATE section SET note = '{echapper(section_notes[sc])}' WHERE TRIM(code) = '{code_db}';")
        lignes.append("")
    lignes.append("SELECT code, description, LENGTH(note) AS note_chars FROM section WHERE note IS NOT NULL ORDER BY code;")
    return "\n".join(lignes)


def generer_sql(chapter_notes: dict, section_notes: dict, chapter_sections: dict) -> str:
    """Génère les UPDATE pour la table chapitre (note combinée section + chapitre)."""
    lignes = [
        "-- Notes explicatives chapitres — tarif douanier algérien",
        "-- Généré par extract_chapter_notes.py",
        "",
        "ALTER TABLE chapitre ADD COLUMN IF NOT EXISTS note TEXT NULL;",
        "",
    ]
    for code in sorted(chapter_notes, key=lambda x: int(x) if x.isdigit() else 0):
        sec = chapter_sections.get(code, "")
        sec_note = section_notes.get(sec, "")
        chap_note = chapter_notes[code]

        if sec_note and chap_note:
            full = f"[Note de la Section {sec}]\n{sec_note}\n\n[Note du Chapitre {code.zfill(2)}]\n{chap_note}"
        elif sec_note:
            full = f"[Note de la Section {sec}]\n{sec_note}"
        else:
            full = chap_note

        lignes.append(f"-- Chapitre {code.zfill(2)} (Section {sec})")
        lignes.append(f"UPDATE chapitre SET note = '{echapper(full)}' WHERE TRIM(code) = '{code}';")
        lignes.append("")

    lignes.append("SELECT code, section, LEFT(note,80) AS apercu FROM chapitre WHERE note IS NOT NULL ORDER BY code;")
    return "\n".join(lignes)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--pdf-dir",  "-d", required=True)
    p.add_argument("--output",   "-o", default="notes_chapitre.sql")
    p.add_argument("--apercu",   action="store_true", help="Affiche les notes extraites")
    p.add_argument("--dump",     action="store_true", help="Écrit les .txt de chaque chapitre")
    p.add_argument("--diagnose", action="store_true", help="Diagnostic détaillé de la structure PDF")
    p.add_argument("--debug",    action="store_true")
    args = p.parse_args()

    if not os.path.isdir(args.pdf_dir):
        print(f"Dossier '{args.pdf_dir}' introuvable."); sys.exit(1)

    pdfs = sorted(f for f in os.listdir(args.pdf_dir) if f.lower().endswith(".pdf"))
    if not pdfs:
        print("Aucun PDF trouvé."); sys.exit(1)

    if args.diagnose:
        for nom in pdfs:
            diagnostiquer(os.path.join(args.pdf_dir, nom))
        return

    print(f"📂 {len(pdfs)} PDF(s)\n")
    chapter_notes    = {}  # {chapter_code: note_text}
    section_notes    = {}  # {section_code: note_text}
    chapter_sections = {}  # {chapter_code: section_code}
    erreurs = []

    for nom in pdfs:
        code = extraire_numero_chapitre(nom)
        if not code:
            print(f"  ⚠️  {nom} → numéro non détecté, ignoré"); continue

        print(f"  📄 {nom} → Chapitre {code.zfill(2)} ... ", end="", flush=True)
        try:
            sc, sn, cn = extraire_depuis_pdf(os.path.join(args.pdf_dir, nom), args.debug)

            if not cn and not sn:
                print("⚠️  Aucune note extraite → utilisez --diagnose")
                erreurs.append(nom); continue

            chapter_sections[code] = sc

            if sn and sc and sc not in section_notes:
                section_notes[sc] = sn
                print(f"✅  Section {sc} ({len(sn)} chars) + Chapitre ({len(cn)} chars)")
            else:
                print(f"✅  Chapitre ({len(cn)} chars)" + (f" · Section {sc}" if sc else ""))

            chapter_notes[code] = cn

            if args.dump:
                sec_note = section_notes.get(sc, "")
                contenu = (f"=== NOTE SECTION {sc} ===\n{sec_note}\n\n" if sec_note else "") + \
                          f"=== NOTE CHAPITRE {code.zfill(2)} ===\n{cn}"
                path = os.path.join(args.pdf_dir, f"note_ch{code.zfill(2)}.txt")
                open(path, "w", encoding="utf-8").write(contenu)
                print(f"     📁 {path}")

            if args.apercu:
                sec_note = section_notes.get(sc, "")
                if sec_note:
                    print(f"\n    [Section {sc} — {len(sec_note)} chars]")
                    print("    " + sec_note[:300].replace("\n", "\n    "))
                print(f"\n    [Chapitre {code.zfill(2)} — {len(cn)} chars]")
                print("    " + cn[:300].replace("\n", "\n    "))
                print()

        except Exception as e:
            print(f"❌  {e}")
            if args.debug:
                import traceback; traceback.print_exc()
            erreurs.append(nom)

    print(f"\n✅ {len(chapter_notes)} chapitre(s), {len(section_notes)} section(s) avec note")
    if erreurs:
        print(f"⚠️  Erreurs : {', '.join(erreurs)}")

    if not chapter_notes:
        print("Rien à exporter."); sys.exit(1)

    if args.apercu:
        print("Mode aperçu : SQL non généré."); return

    # ── SQL chapitres ──────────────────────────────────────────────────────────
    sql = generer_sql(chapter_notes, section_notes, chapter_sections)
    open(args.output, "w", encoding="utf-8").write(sql)
    print(f"\n📝 SQL chapitres : {args.output}")

    # ── SQL sections ───────────────────────────────────────────────────────────
    if section_notes:
        base = os.path.splitext(args.output)[0]
        output_sections = base.replace("pg6", "pg7").replace("chapitres", "sections") + ".sql"
        if output_sections == args.output:
            output_sections = base + "_sections.sql"
        sql_sec = generer_sql_sections(section_notes)
        open(output_sections, "w", encoding="utf-8").write(sql_sec)
        print(f"📝 SQL sections  : {output_sections}")

    print(f"\n   Appliquer :")
    print(f"   scp {args.output} user@vps:/tmp/")
    print(f"   docker cp /tmp/<fichier> staging-app-db:/tmp/")
    print(f"   docker exec staging-app-db psql -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/<fichier>")


if __name__ == "__main__":
    main()
