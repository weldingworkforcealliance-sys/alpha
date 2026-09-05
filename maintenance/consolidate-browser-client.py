from pathlib import Path
import re

changed = []
pattern = re.compile(
    r"useState\(\(\)\s*=>\s*createBrowserClient\(\s*"
    r"process\.env\.NEXT_PUBLIC_SUPABASE_URL!,\s*"
    r"process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!\s*"
    r"\)\s*\)"
)

for path in Path('app').rglob('*.tsx'):
    text = path.read_text(encoding='utf-8')
    if 'createBrowserClient' not in text:
        continue

    original = text
    text = text.replace(
        "import { createBrowserClient } from '@supabase/ssr';",
        "import { getSupabase } from '@/lib/supabase-browser';",
    )
    text = pattern.sub('useState(getSupabase)', text)

    if text != original:
        path.write_text(text, encoding='utf-8')
        changed.append(str(path))

remaining = []
for path in Path('app').rglob('*.tsx'):
    if 'createBrowserClient' in path.read_text(encoding='utf-8'):
        remaining.append(str(path))

if remaining:
    raise SystemExit('Unconverted createBrowserClient usage: ' + ', '.join(remaining))

print(f'Converted {len(changed)} files')
for path in changed:
    print(path)
