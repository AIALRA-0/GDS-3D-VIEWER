# APCF-META {"schema":1,"visibility":"public"}
import argparse
import re
from collections import Counter, defaultdict
from pathlib import Path

TEST_RE = re.compile(
    r"^- 【(?P<status>未执行|进行中|PASS|FAIL|BLOCKED|不适用)】"
    r"【(?P<id>TEST-[A-Za-z0-9_-]+)】"
    r"【对应 (?P<refs>CL-[A-Za-z0-9_-]+(?:[、,， ]+CL-[A-Za-z0-9_-]+)*)】"
    r"【(?P<object>[^】\n]+)】："
    r"在【(?P<context>[^】\n]+)】下，"
    r"执行【(?P<action>[^】\n]+)】，"
    r"必须观察到【(?P<expected>[^】\n]+)】；"
    r"实际观察到【(?P<actual>[^】\n]+)】，"
    r"证据为【(?P<evidence>[^】\n]+)】\s*$"
)

CHECKLIST_RE = re.compile(
    r"^- 【(?P<status>未开始|进行中|已完成|阻塞|不适用)】"
    r"【(?P<id>CL-[A-Za-z0-9_-]+)】"
    r"【(?P<object>[^】\n]+)】：(?P<body>.+)$"
)


def _body_lines(text):
    lines=[]
    heading_skipped=False
    for raw in text.splitlines():
        stripped=raw.strip()
        if not stripped or "APCF-META" in stripped:
            continue
        if not heading_skipped and stripped.startswith("# "):
            heading_skipped=True
            continue
        lines.append(stripped)
    return lines


def _split_refs(raw):
    return [x for x in re.split(r"[、,， ]+", raw.strip()) if x]


def parse_tests(text):
    tests=[]
    for line in _body_lines(text):
        m=TEST_RE.match(line)
        if not m:
            continue
        row=m.groupdict()
        row["refs"]=_split_refs(row["refs"])
        tests.append(row)
    return tests


def parse_checklist(text):
    items=[]
    for line in _body_lines(text):
        m=CHECKLIST_RE.match(line)
        if not m:
            continue
        items.append(m.groupdict())
    return items


def validate_text(text, checklist_text=None):
    errors=[]
    raw_lines=_body_lines(text)
    tests=parse_tests(text)

    for line in raw_lines:
        if not TEST_RE.match(line):
            errors.append(f"unrecognized TEST record; every current acceptance item must be exactly one line: {line[:180]}")

    if not tests:
        errors.append("TEST.md must contain at least one current TEST-ID record")
        return errors

    seen=set()
    for row in tests:
        tid=row["id"]
        if tid in seen:
            errors.append(f"duplicate TEST-ID: {tid}")
        seen.add(tid)
        for field in ("object","context","action","expected","actual","evidence"):
            if not row[field].strip():
                errors.append(f"{tid} empty required field: {field}")

    if checklist_text is not None:
        for line in _body_lines(checklist_text):
            if not CHECKLIST_RE.match(line):
                errors.append(f"unrecognized Checklist record; every current requirement must have a CL-ID and object: {line[:180]}")
        checklist=parse_checklist(checklist_text)
        if not checklist:
            errors.append("CHECKLIST.md has no parseable CL-ID records")
            return errors
        cl_by_id={x["id"]:x for x in checklist}
        if len(cl_by_id)!=len(checklist):
            errors.append("duplicate CL-ID in CHECKLIST.md")

        mapped=defaultdict(list)
        for row in tests:
            for cid in row["refs"]:
                if cid not in cl_by_id:
                    errors.append(f"{row['id']} references missing Checklist item: {cid}")
                else:
                    mapped[cid].append(row)

        for cid,item in cl_by_id.items():
            rows=mapped.get(cid,[])
            if not rows:
                errors.append(f"Checklist item has no TEST coverage: {cid}")
                continue
            if item["status"]=="已完成":
                active=[r for r in rows if r["status"]!="不适用"]
                if not active:
                    errors.append(f"completed Checklist item has no applicable TEST: {cid}")
                elif any(r["status"]!="PASS" for r in active):
                    states=", ".join(f"{r['id']}={r['status']}" for r in active)
                    errors.append(f"completed Checklist item has non-PASS current TEST: {cid}: {states}")

    return errors


def validate_file(test_path, checklist_path=None):
    test_path=Path(test_path)
    if not test_path.is_file():
        return [f"TEST.md missing: {test_path}"]
    checklist_text=None
    if checklist_path is not None:
        checklist_path=Path(checklist_path)
        if not checklist_path.is_file():
            return [f"CHECKLIST.md missing: {checklist_path}"]
        checklist_text=checklist_path.read_text(encoding="utf-8")
    return validate_text(test_path.read_text(encoding="utf-8"), checklist_text)


def summary_text(text):
    rows=parse_tests(text)
    return {
        "test_ids":len(rows),
        "statuses":dict(Counter(x["status"] for x in rows)),
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("test_file")
    ap.add_argument("--checklist")
    a=ap.parse_args()
    errors=validate_file(a.test_file, a.checklist)
    if errors:
        for e in errors:
            print("FAIL:",e)
        raise SystemExit(2)
    s=summary_text(Path(a.test_file).read_text(encoding="utf-8"))
    print(f"PASS: current-turn TEST form; {s['test_ids']} TEST-ID; statuses={s['statuses']}")

if __name__=="__main__":
    main()
