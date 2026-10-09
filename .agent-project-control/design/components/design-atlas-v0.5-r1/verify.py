#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
root=Path(__file__).resolve().parent
try:
 data=json.loads((root/'COMPONENT.lock.json').read_text('utf-8'))
 assert data['component']=='design-atlas-v0.5-r1','Wrong component'
 expected=data['files'];actual={p.name for p in root.iterdir()}
 assert actual==set(expected)|{'COMPONENT.lock.json'},'Missing or extra entries'
 for name,sha in expected.items():
  assert '/' not in name and '\\' not in name and (not name.startswith('.') or name=='.apcf-dir.yaml'),'Unsafe name'
  p=root/name;assert p.is_file() and not p.is_symlink(),'Unsafe entry'
  assert hashlib.sha256(p.read_bytes()).hexdigest()==sha,'SHA mismatch: '+name
 print('PASS: installed component bytes verified')
except Exception as e:
 print('FAIL:',e,file=sys.stderr);raise SystemExit(2)
