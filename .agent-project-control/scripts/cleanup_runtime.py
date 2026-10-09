# APCF-META {"schema":1,"visibility":"public"}
import argparse
import shutil
import stat
import time
from common import FRAMEWORK_ROOT

SCAFFOLD = {"testbed", "runs", "downloads", "tmp", "cache", "large", "distribution"}


def remove_readonly(func, path, exc):
    if not isinstance(exc[1], PermissionError):
        raise exc[1]
    from pathlib import Path
    Path(path).chmod(stat.S_IWRITE | stat.S_IREAD)
    func(path)


def main():
    ap = argparse.ArgumentParser()
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true")
    group.add_argument("--older-than-hours", type=float)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    runtime = (FRAMEWORK_ROOT / "runtime").resolve()
    if not runtime.is_relative_to(FRAMEWORK_ROOT.resolve()) or runtime == FRAMEWORK_ROOT.resolve():
        raise SystemExit("FAIL: unsafe runtime root")
    if args.all:
        targets = []
        for entry in runtime.iterdir():
            if entry.name == ".apcf-dir.yaml":
                continue
            if entry.is_dir() and entry.name in SCAFFOLD:
                targets.extend(p for p in entry.iterdir() if p.name != ".apcf-dir.yaml")
            else:
                targets.append(entry)
    else:
        now = time.time()
        targets = [p for p in runtime.rglob("*") if p.is_file() and p.name != ".apcf-dir.yaml"
                   and now - p.stat().st_mtime >= args.older_than_hours * 3600]
    # Validate every absolute target and descendant before any deletion.
    for target in targets:
        resolved = target.resolve()
        if target.is_symlink() or not resolved.is_relative_to(runtime) or resolved == runtime:
            raise SystemExit("FAIL: unsafe cleanup target: " + str(target))
        for child in target.rglob("*") if target.is_dir() else []:
            if child.is_symlink() or not child.resolve().is_relative_to(resolved):
                raise SystemExit("FAIL: escaped cleanup child: " + str(child))
    for target in targets:
        print(("DELETE " if args.apply else "DRY-RUN ") + str(target))
        if args.apply:
            if target.is_dir():
                shutil.rmtree(target, onerror=remove_readonly)
            else:
                target.unlink(missing_ok=True)
    print(f"PASS: {len(targets)} candidate objects")


if __name__ == "__main__":
    main()
