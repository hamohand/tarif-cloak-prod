import re

with open('backend/src/main/resources/db/migration/V0_2__create_nomenclature_tables.sql', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove all DROP TABLE
text = re.sub(r'(?i)DROP TABLE IF EXISTS [^\;]+\;', '', text)

# Add IF NOT EXISTS to CREATE TABLE
text = re.sub(r'(?i)CREATE TABLE ([a-zA-Z0-9_]+)', r'CREATE TABLE IF NOT EXISTS \1', text)

# Find all blocks of INSERT INTO ... VALUES (...) ... ; and replace ; with ON CONFLICT (code) DO NOTHING;
import re
text = re.sub(r'(?i)(INSERT INTO [a-zA-Z0-9_]+ [^;]+\));', r'\1 ON CONFLICT (code) DO NOTHING;', text)

with open('backend/src/main/resources/db/migration/V0_2__create_nomenclature_tables.sql', 'w', encoding='utf-8') as f:
    f.write(text)
