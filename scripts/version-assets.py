"""Refresh static resource URLs after edits so Pages/browser caches fetch new bytes."""
from pathlib import Path
import hashlib,re
root=Path(__file__).resolve().parent.parent
for name in ['index.html','admin.html']:
 p=root/name
 def version(m):
  attr,url=m.groups();path=root/url.split('?')[0]
  if not path.is_file() or not (url.startswith('assets/') or url.startswith('config.js')): return m.group()
  return f'{attr}="{url.split("?")[0]}?v={hashlib.sha256(path.read_bytes()).hexdigest()[:12]}"'
 p.write_text(re.sub(r'(src|href)="([^"]+)"',version,p.read_text()))
