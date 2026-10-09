# APCF-META {"schema":1,"visibility":"public"}
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DESIGN=ROOT/".agent-project-control/design"
RULES=DESIGN/"RULES.md"
INDEX=DESIGN/"INDEX.md"
LOCK=DESIGN/"BASELINES.lock.yaml"
PROJECT_DESIGN=ROOT/".agent-project-control/DESIGN.md"

CATEGORIES=[
    ("structure-visual","结构与视觉层级",["D01","D02","D03","D04","D05","D06"]),
    ("interaction-recovery","交互、焦点与恢复",["D07","D08","D09","D10","D11"]),
    ("content-responsive","内容模型与响应适配",["D12","D13"]),
    ("implementation-performance","实现复用与性能",["D14"]),
    ("verification-evolution","验证与设计演进",["D15","D16"]),
]
ALLOWED_ADOPTION={"UNRESOLVED","ADOPTED","PARTIAL","NOT_APPLICABLE"}
EXPECTED_RULES_VERSION="v0.1"
RULE_RE=re.compile(r"^## (D\d{2}) · (.+)$",re.M)
REQUIRED=("### 原则","### 触发","### 必须","### 验证","### 例外","### 错误示例","### 正确示例","### 依据")

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def validate_reference_archive(path,tokens_path):
    errors=[]
    try:
        with zipfile.ZipFile(path) as archive:
            names=archive.namelist()
            if len(names)!=len(set(names)): errors.append('reference archive has duplicate members')
            for name in names:
                parts=Path(name.replace('\\','/')).parts
                if Path(name).is_absolute() or '..' in parts or ':' in name or any(p in {'iterations','history','evidence','.git'} for p in parts):
                    errors.append('reference archive contains unsafe or historical path: '+name)
                if name.endswith(('.json','.js','.css','.html','.md','.py','.txt')):
                    if re.search(rb'\b(?:IT|TR)-\d+\b|iterations/|REQUEST\.md',archive.read(name)):
                        errors.append('reference archive contains source-turn context: '+name)
            descriptor=json.loads(archive.read('TEMPLATE.json'))
            if descriptor.get('reference_only') is not True or descriptor.get('auto_adopt') is not False:
                errors.append('reference descriptor must be reference-only and opt-in')
            if any(k in descriptor for k in ('current_iteration','current_turn','current_turn_path','legacy_iterations','approval','framework_reference')):
                errors.append('reference descriptor contains source adoption/history fields')
            manifest=json.loads(archive.read('build.json'))
            html_hash=hashlib.sha256(archive.read('Workbench.html')).hexdigest()
            if descriptor.get('artifact',{}).get('sha256')!=html_hash or manifest.get('sha256')!=html_hash:
                errors.append('reference HTML differs from build/descriptor hash')
            for name,expected in manifest.get('source_files',{}).items():
                if hashlib.sha256(archive.read(name)).hexdigest()!=expected:
                    errors.append('reference build source hash mismatch: '+name)
            if archive.read('src/tokens.json')!=Path(tokens_path).read_bytes():
                errors.append('reference tokens differ from Profile token authority')
    except (OSError,ValueError,KeyError,zipfile.BadZipFile) as ex:
        errors.append('reference archive validation failed: '+str(ex))
    return errors

def lock_value(key):
    text=LOCK.read_text(encoding="utf-8")
    m=re.search(rf"(?m)^{re.escape(key)}:\s*(?:\"([^\"]*)\"|([^\n#]+))\s*$",text)
    if not m: raise ValueError(f"lock key missing: {key}")
    return (m.group(1) if m.group(1) is not None else m.group(2)).strip()

def rows():
    text=RULES.read_text(encoding="utf-8")
    ms=list(RULE_RE.finditer(text)); out=[]
    for i,m in enumerate(ms):
        end=ms[i+1].start() if i+1<len(ms) else len(text)
        out.append((m.group(1),m.group(2).strip(),text[m.start():end].rstrip()))
    return out

def render_index():
    rs=rows(); titles={r:t for r,t,_ in rs}
    out=['<!-- APCF-META {"schema":1,"visibility":"public"} -->','# 1. 共享设计基线路由','',
         '本文件只负责路由，不保存第二份 D 规则正文；完整规则只在 `RULES.md`，精确样板参数只在 Profile，项目采用事实只在项目 `DESIGN.md`','',
         '## 1.1. 读取顺序','',
         '1. 先读项目 `.agent-project-control/DESIGN.md`，确认现有设计事实和采用状态',
         '2. 再读本索引，按当前任务选择实际命中的分类和 D 编号',
         '3. 目标明确时可用 `--rule` / `--category` 只读相关 D 规则；在 APCF 自动 Design 事前路由中，先保守读取完整 `RULES.md` 避免漏项，实际适用性由每条规则的触发条件决定',
         '4. 项目实现事实继续读取项目原生源码、tokens、组件库、Storybook 或设计资产；完整规则读取不等于项目自动采用任何 Profile','',
         '## 1.2. 分类路由','']
    for slug,label,ids in CATEGORIES:
        out.append(f'- **{label}**（`{slug}`）：'+'、'.join(f'`{rid}`' for rid in ids))
    out += ['','## 1.3. D 规则索引','']
    for rid,title,_ in rs: out.append(f'- **{rid}**. {title}')
    out += ['','## 1.4. 当前共享 Design 规范版本','',
            f'- **正式版本**：`{lock_value("rules_version")}`；唯一规范正文为 `RULES.md` 中的 D01–D16','',
            '## 1.5. 可选 Profile','',
            '- **tool-workbench-2.3.1**：中性、规整、内容优先的工具型网站样板；`auto_adopt: false`；只有项目 `DESIGN.md` 明确记录采用后，精确参数才成为项目设计事实','',
            '## 1.6. 采用状态','',
            '项目 `DESIGN.md` 使用 `UNRESOLVED / ADOPTED / PARTIAL / NOT_APPLICABLE`；模板携带共享基线不等于项目自动采用任何 Profile','',
            '## 1.7. 定向读取','',
            '```powershell',
            'python -B .agent-project-control/scripts/design_contract.py --rule D07',
            'python -B .agent-project-control/scripts/design_contract.py --category interaction-recovery',
            '```','']
    # APCF-DESIGN-ATLAS-V05-R1: generated optional component route
    out += ['', '- **design-atlas-v0.5-r1**：可选 UI 修订；289 项逐条案例、类型化画布、原生格式查看器与平衡约束；`auto_adopt: false`；入口 `components/design-atlas-v0.5-r1/COMPONENT.md`', '']
    return '\n'.join(out)

def validate():
    e=[]
    needed=[RULES,INDEX,LOCK,DESIGN/"SOURCES.md",DESIGN/"VERIFICATION.md",DESIGN/"PROVENANCE.md",PROJECT_DESIGN]
    for p in needed:
        if not p.exists(): e.append('missing: '+str(p.relative_to(ROOT)))
    if e: return e
    rs=rows(); ids=[r for r,_,_ in rs]
    expected=[f'D{i:02d}' for i in range(1,17)]
    if ids!=expected: e.append(f'D rule order/coverage mismatch: {ids}')
    for rid,_,block in rs:
        for token in REQUIRED:
            if token not in block: e.append(f'{rid} missing section: {token}')
    if INDEX.read_text(encoding='utf-8')!=render_index(): e.append('design/INDEX.md drifted; run design_contract.py --sync')
    try:
        if lock_value('rules_version')!=EXPECTED_RULES_VERSION: e.append(f'rules_version must be {EXPECTED_RULES_VERSION}')
        if digest(RULES)!=lock_value('canonical_rules_sha256'): e.append('RULES.md hash differs from BASELINES.lock.yaml')
        if lock_value('auto_adopt').lower()!='false': e.append('shared Profile must not auto-adopt')
        for path_key,hash_key in [('tokens_path','tokens_sha256'),('reference_archive_path','reference_archive_sha256')]:
            p=ROOT/lock_value(path_key)
            if not p.is_file(): e.append(f'missing profile asset: {lock_value(path_key)}')
            elif digest(p)!=lock_value(hash_key): e.append(f'profile asset hash mismatch: {lock_value(path_key)}')
        reference=ROOT/lock_value('reference_archive_path')
        tokens=ROOT/lock_value('tokens_path')
        if reference.is_file() and tokens.is_file(): e.extend(validate_reference_archive(reference,tokens))
    except Exception as ex:
        e.append('baseline lock validation failed: '+str(ex))
    pd=PROJECT_DESIGN.read_text(encoding='utf-8')
    m=re.search(r'\*\*采用状态\*\*：`([^`]+)`',pd)
    if not m or m.group(1) not in ALLOWED_ADOPTION: e.append('project DESIGN.md missing valid adoption state')
    pm=re.search(r'\*\*Profile 状态\*\*：`([^`]+)`',pd)
    if not pm or pm.group(1) not in ALLOWED_ADOPTION: e.append('project DESIGN.md missing valid Profile state')
    if 'D01' in pd and 'D16' in pd and '共享 D01–D16 正文' not in pd:
        e.append('project DESIGN.md appears to duplicate shared rule bodies')
    return e

def select_rule(rid):
    for r,_,block in rows():
        if r==rid: return block
    raise SystemExit('FAIL: unknown design rule '+rid)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--check',action='store_true')
    ap.add_argument('--sync',action='store_true')
    ap.add_argument('--rule')
    ap.add_argument('--category')
    a=ap.parse_args()
    if a.sync:
        INDEX.write_text(render_index(),encoding='utf-8'); print('PASS: design index synchronized')
    if a.rule: print(select_rule(a.rule))
    if a.category:
        match=next((x for x in CATEGORIES if x[0]==a.category),None)
        if not match: raise SystemExit('FAIL: unknown design category '+a.category)
        print(f'# {match[1]}')
        for rid in match[2]: print('\n'+select_rule(rid))
    if a.check or not (a.sync or a.rule or a.category):
        errors=validate()
        if errors:
            for x in errors: print('FAIL:',x)
            raise SystemExit(2)
        print('PASS: D01-D16, router, project adoption state and locked design Profile are consistent')

if __name__=='__main__': main()
