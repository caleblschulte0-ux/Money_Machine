from pathlib import Path

p = Path('barkly/app/scripts/overlap-check.mjs')
s = p.read_text()
old = "  const park = page.getByText('park', { exact: true }).first();\n  if (await park.count()) await park.click();"
new = "  const park = page.getByRole('tab', { name: 'Park', exact: true }).first();\n  if (await park.count()) await park.click();"
if old not in s:
    raise SystemExit('missing overlap park selector')
p.write_text(s.replace(old, new, 1))
