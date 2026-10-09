# APCF-META {"schema":1,"visibility":"public"}
import re
from functools import lru_cache
from pathlib import Path
from common import ROOT,FRAMEWORK_ROOT,parse_meta
from rule_sync import MODULES,RULE_HEADING,sync as sync_rules
from design_contract import validate as validate_design
from standards_contract import validate as validate_standards


@lru_cache(maxsize=None)
def _private_directory(path: Path) -> bool:
    meta = parse_meta(path / ".apcf-dir.yaml")
    return bool(meta and meta.get("visibility") == "private")


def _private_testbed_payload(path: Path) -> bool:
    """Ignore payload below private fixture directories, while checking their markers."""
    path = Path(path)
    testbed = FRAMEWORK_ROOT / "runtime" / "testbed"
    try:
        path.relative_to(testbed)
    except ValueError:
        return False
    if path == testbed:
        return False

    current = path.parent
    while current == testbed or testbed in current.parents:
        if _private_directory(current):
            return True
        if current == testbed:
            break
        current = current.parent
    return False


def main():
    e=[]
    req=['AGENTS.md','.agent-project-control/framework.yaml','.agent-project-control/interfaces/WRITING_STANDARD.md','.agent-project-control/rules/INDEX.md','.agent-project-control/rules/COVERAGE.md','.agent-project-control/skills/SKILLS.lock.yaml','.agent-project-control/design/INDEX.md','.agent-project-control/design/RULES.md','.agent-project-control/design/BASELINES.lock.yaml','.agent-project-control/design/VERIFICATION.md','.agent-project-control/design/PROVENANCE.md']+MODULES
    [e.append('missing: '+x) for x in req if not (ROOT/x).exists()]
    ag=(ROOT/'AGENTS.md').read_text(encoding='utf-8') if (ROOT/'AGENTS.md').exists() else ''
    if '"kind":' in ag: e.append('AGENTS metadata contains kind')
    if re.search(r'\bF\d{2}\b',ag): e.append('legacy Fxx rule id found')
    e.extend('design: '+x for x in validate_design())
    e.extend('standards: '+x for x in validate_standards())
    try:
        rows,expected_index,expected_agents=sync_rules(False)
        actual_index=(ROOT/'.agent-project-control/rules/INDEX.md').read_text(encoding='utf-8')
        if actual_index!=expected_index: e.append('rules/INDEX.md drifted from canonical module headings; run rule_sync.py')
        if ag!=expected_agents: e.append('AGENTS rule indexes drifted from canonical module headings; run rule_sync.py')
    except Exception as ex:
        rows=[]; e.append('rule sync validation failed: '+str(ex))
    seen={}
    for rel in MODULES:
        p=ROOT/rel
        if not p.exists(): continue
        text=p.read_text(encoding='utf-8')
        # Every full rule must carry the four core sections and at least one bad/good example pair
        starts=list(RULE_HEADING.finditer(text))
        for i,m in enumerate(starts):
            end=starts[i+1].start() if i+1<len(starts) else len(text)
            block=text[m.start():end]
            rid=m.group(1)
            seen[rid]=seen.get(rid,0)+1
            for token in ('原则','触发','必须','例外'):
                if token not in block: e.append(f'{rid} missing full section: {token}')
            if '错误示例（Bad Example）' not in block: e.append(f'{rid} missing Bad Example')
            if '正确示例（Good Example）' not in block: e.append(f'{rid} missing Good Example')
    for i in range(1,32):
        rid=f'R{i:02d}'
        if seen.get(rid,0)!=1: e.append(rid+f' canonical body count={seen.get(rid,0)}')
    for rid in sorted(set(seen)-{f'R{i:02d}' for i in range(1,32)}):
        e.append('unknown canonical Rule ID: '+rid)
    managed=[ROOT/'CURRENT.md',ROOT/'AGENTS.md',ROOT/'README.md',ROOT/'README.en.md',ROOT/'TEMPLATE_SPEC.md',ROOT/'CODEX_PROMPT.md',ROOT/'CODEX_DEPLOY.md',ROOT/'PILOT_TEST_PLAN.md',ROOT/'VALIDATION.md',ROOT/'.gitignore']
    for pattern in ('*.md', '*.yaml', '*.py', '*.html'):
        managed.extend(p for p in FRAMEWORK_ROOT.rglob(pattern) if not _private_testbed_payload(p))
    for p in managed:
        if p.name=='.apcf-dir.yaml' or not p.exists(): continue
        if not (parse_meta(p) or parse_meta(p.with_name(p.name+'.apcf-meta.yaml'))): e.append('metadata missing: '+str(p.relative_to(ROOT)))
    dirs=[FRAMEWORK_ROOT]+[x for x in FRAMEWORK_ROOT.rglob('*') if x.is_dir() and '__pycache__' not in x.parts and not _private_testbed_payload(x)]+[ROOT/'.codex',ROOT/'.codex/skills']
    for d in dirs:
        if d.exists() and not (d/'.apcf-dir.yaml').exists(): e.append('dir marker missing: '+str(d.relative_to(ROOT)))
    if e:
        [print('FAIL:',x) for x in e]; raise SystemExit(2)
    print('PASS: framework lint passed; R01-R31 full bodies, examples, routing and derived indexes are consistent')
if __name__=='__main__': main()
