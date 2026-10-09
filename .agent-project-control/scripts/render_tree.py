# APCF-META {"schema":1,"visibility":"public"}
from html import escape
import subprocess
from pathlib import Path
from common import ROOT,FRAMEWORK_ROOT,write_md,parse_meta
def candidate_files(root: Path):
    # Native Git boundaries exclude dependencies, builds and private execution data.
    top = subprocess.run(['git','-C',str(root),'rev-parse','--show-toplevel'],capture_output=True)
    if top.returncode == 0 and Path(top.stdout.decode('utf-8').strip()).resolve() == root.resolve():
        listed = subprocess.run(['git','-C',str(root),'ls-files','-co','--exclude-standard','-z'],capture_output=True,check=True)
        return sorted({root / raw.decode('utf-8','surrogateescape') for raw in listed.stdout.split(b'\0') if raw})
    return sorted(root.rglob('*'))

def html_tree(items):
    tree = {}
    for item in items:
        node = tree
        for part in item.split('/'):
            node = node.setdefault(part,{})
    def render(node):
        return '<ul>'+''.join('<li>'+('<details open><summary>'+escape(name)+'</summary>'+render(children)+'</details>' if children else '<code>'+escape(name)+'</code>')+'</li>' for name,children in sorted(node.items()))+'</ul>'
    return render(tree)

def main():
    items=[]
    for p in candidate_files(ROOT):
        if p.is_dir() or '.git' in p.parts or '__pycache__' in p.parts: continue
        rel=p.relative_to(ROOT).as_posix()
        if rel.startswith('.codex/skills/') and rel!='.codex/skills/.apcf-dir.yaml': continue
        if rel.startswith('.agent-project-control/runtime/'):
            allowed={'.agent-project-control/runtime/.apcf-dir.yaml'}|{f'.agent-project-control/runtime/{x}/.apcf-dir.yaml' for x in ['testbed','runs','downloads','tmp','cache','large','distribution']}
            if rel not in allowed: continue
        metadata=parse_meta(p) or parse_meta(p.with_name(p.name+'.apcf-meta.yaml'))
        if metadata and metadata.get('visibility')=='private': continue
        if any((parse_meta(parent/'.apcf-dir.yaml') or {}).get('visibility')=='private' for parent in p.parents if parent!=ROOT and parent.is_relative_to(ROOT)): continue
        items.append(rel)
    write_md(FRAMEWORK_ROOT/'generated/TREE.md','# 1. 当前项目文件树\n\n本视图由脚本从真实文件系统及原生 Git 忽略边界生成，不手工维护\n\n```text\n'+'\n'.join(items)+'\n```')
    (FRAMEWORK_ROOT/'generated/TREE.html').write_text('<!-- APCF-META {"schema":1,"visibility":"public"} -->\n<!doctype html><meta charset="utf-8"><title>Project Tree</title><h1>Agent Project Control Framework Tree</h1>'+html_tree(items),encoding='utf-8'); print('PASS: tree rendered')
if __name__=='__main__': main()
