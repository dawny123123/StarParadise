# 垃圾回收模板

> "文档熵会累积。一条过时的注释就会侵蚀对所有文档的信任。"

自动化文档卫生模板 — 在文档腐烂侵蚀 agent 信任之前，检测陈旧文档、断链、接口漂移和其他形式的文档腐烂。

## 目录

- [为何垃圾回收](#为何垃圾回收)
- [陈旧文档检测器](#1-陈旧文档检测器)
- [断链检查器](#2-断链检查器)
- [接口漂移检测器](#3-接口漂移检测器)
- [统一 GC 运行器](#4-统一-gc-运行器)
- [CI 集成](#5-ci-集成)
- [调度指南](#6-调度指南)

---

## 为何垃圾回收

每条过时的文档都是 agent 的陷阱。当 agent 读取陈旧的架构文档时，它基于虚构做出决策 — 然后验证在 30 个工具调用后才捕捉到不匹配，浪费 token 和时间。主动垃圾回收通过在源头捕捉文档腐烂来防止这种情况。

| 问题 | 对 Agent 的影响 | 检测方法 |
|---------|-----------------|------------------|
| 陈旧文档（代码变了，文档没变） | 基于过时架构做决策 | 比较时间戳 |
| 断链（目标移动/删除） | 死胡同导航，浪费上下文 | 爬取内部链接 |
| 接口漂移（文档说 X，代码做 Y） | 针对错误接口写代码 | 解析代码 vs 文档 |
| 孤儿文档（无代码引用） | 杂乱上下文，浪费 token | 反向引用检查 |

---

## 1. 陈旧文档检测器

比较文档时间戳与所描述代码的时间戳。如果代码在文档上次更新后发生了显著变化，则文档可能已过时。

```python
#!/usr/bin/env python3
"""
scripts/gc-stale-docs.py

检测相对于所描述代码可能已过时的文档。

Usage:
    python3 scripts/gc-stale-docs.py .
    python3 scripts/gc-stale-docs.py . --json
    python3 scripts/gc-stale-docs.py . --threshold 30  # 天数
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple


def get_git_last_modified(filepath: str) -> Optional[datetime]:
    """获取文件的最后 git 提交日期。"""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%aI", "--", filepath],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            return datetime.fromisoformat(result.stdout.strip())
    except Exception:
        pass
    return None


def extract_code_references(doc_path: str) -> List[str]:
    """从 Markdown 文档中提取引用的文件路径。

    查找以下模式：
    - `internal/core/service.go`
    - `internal/core/service.go:25-48`
    - [link text](../internal/core/service.go)
    - Sources: [`internal/types/token.go:10-15`]()
    """
    references = []
    try:
        content = Path(doc_path).read_text()
    except Exception:
        return references

    # 匹配反引号引用的文件路径
    backtick_pattern = r'`([a-zA-Z0-9_./\-]+\.(go|ts|tsx|js|jsx|py|rs))(?::\d+(?:-\d+)?)?`'
    references.extend(m[0] for m in re.findall(backtick_pattern, content))

    # 匹配 Markdown 链接目标
    link_pattern = r'\]\((?:\.\.?/)*([a-zA-Z0-9_./\-]+\.(go|ts|tsx|js|jsx|py|rs))(?::\d+(?:-\d+)?)?\)'
    references.extend(m[0] for m in re.findall(link_pattern, content))

    # 去重，去除行号
    cleaned = set()
    for ref in references:
        clean = re.sub(r':\d+(-\d+)?$', '', ref)
        cleaned.add(clean)
    return list(cleaned)


def find_doc_to_code_mapping(project_root: Path) -> Dict[str, List[str]]:
    """将每个文档文件映射到它引用的代码文件。"""
    mapping = {}
    doc_dirs = ["docs", "docs/design-docs", "docs/references"]
    doc_files = []

    for d in doc_dirs:
        doc_dir = project_root / d
        if doc_dir.exists():
            for f in doc_dir.glob("*.md"):
                doc_files.append(f)

    # 同时检查 AGENTS.md
    agents_md = project_root / "AGENTS.md"
    if agents_md.exists():
        doc_files.append(agents_md)

    for doc_file in doc_files:
        refs = extract_code_references(str(doc_file))
        if refs:
            rel_doc = str(doc_file.relative_to(project_root))
            mapping[rel_doc] = refs

    return mapping


def check_staleness(
    project_root: Path,
    threshold_days: int = 14
) -> List[Dict]:
    """检查所有文档相对于引用代码的过时程度。"""
    mapping = find_doc_to_code_mapping(project_root)
    threshold = timedelta(days=threshold_days)
    findings = []

    for doc_path, code_refs in mapping.items():
        doc_modified = get_git_last_modified(doc_path)
        if not doc_modified:
            continue

        stale_refs = []
        for code_ref in code_refs:
            code_path = str(project_root / code_ref)
            if not os.path.exists(code_path):
                stale_refs.append({
                    "file": code_ref,
                    "reason": "file_deleted",
                    "detail": f"引用的文件已不存在"
                })
                continue

            code_modified = get_git_last_modified(code_ref)
            if code_modified and code_modified > doc_modified + threshold:
                days_behind = (code_modified - doc_modified).days
                stale_refs.append({
                    "file": code_ref,
                    "reason": "code_newer",
                    "detail": f"代码在文档后 {days_behind} 天更新",
                    "code_date": code_modified.isoformat(),
                    "doc_date": doc_modified.isoformat()
                })

        if stale_refs:
            findings.append({
                "doc": doc_path,
                "doc_last_modified": doc_modified.isoformat(),
                "stale_references": stale_refs,
                "severity": "high" if any(r["reason"] == "file_deleted" for r in stale_refs) else "medium"
            })

    return findings


def main():
    parser = argparse.ArgumentParser(description="检测陈旧文档")
    parser.add_argument("project_root", help="项目根目录")
    parser.add_argument("--threshold", type=int, default=14,
                        help="过时阈值天数（默认：14）")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出")
    args = parser.parse_args()

    project_root = Path(args.project_root).resolve()
    findings = check_staleness(project_root, args.threshold)

    if args.json:
        print(json.dumps({"stale_docs": findings, "threshold_days": args.threshold}, indent=2))
    else:
        if not findings:
            print("✓ 未检测到陈旧文档")
            return

        print(f"⚠ 发现 {len(findings)} 个可能陈旧的文档：\n")
        for f in findings:
            severity_icon = "🔴" if f["severity"] == "high" else "🟡"
            print(f"{severity_icon} {f['doc']} (最后更新: {f['doc_last_modified'][:10]})")
            for ref in f["stale_references"]:
                if ref["reason"] == "file_deleted":
                    print(f"   ✗ {ref['file']} — 已删除（引用已断）")
                else:
                    print(f"   ✗ {ref['file']} — {ref['detail']}")
            print()

    sys.exit(1 if findings else 0)


if __name__ == "__main__":
    main()
```

---

## 2. 断链检查器

验证所有内部 Markdown 链接（指向其他文档、代码文件、锚点）仍然有效。

```python
#!/usr/bin/env python3
"""
scripts/gc-broken-links.py

检查所有 Markdown 文件中的内部断链。

Usage:
    python3 scripts/gc-broken-links.py .
    python3 scripts/gc-broken-links.py . --json
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List


def find_markdown_files(root: Path) -> List[Path]:
    """查找项目中的所有 Markdown 文件。"""
    md_files = []
    for pattern in ["*.md", "docs/**/*.md"]:
        md_files.extend(root.glob(pattern))
    return sorted(set(md_files))


def extract_links(md_path: Path) -> List[Dict]:
    """从 Markdown 文件中提取所有内部链接。"""
    content = md_path.read_text()
    links = []

    # [text](target) — 跳过外部 URL
    link_pattern = r'\[([^\]]*)\]\(([^)]+)\)'
    for match in re.finditer(link_pattern, content):
        target = match.group(2)
        if target.startswith(("http://", "https://", "mailto:")):
            continue
        line_num = content[:match.start()].count('\n') + 1
        links.append({
            "text": match.group(1),
            "target": target,
            "line": line_num
        })

    return links


def resolve_link(md_path: Path, target: str, project_root: Path) -> Dict:
    """检查链接目标是否有效。返回状态字典。"""
    # 从路径中分离锚点
    if "#" in target:
        path_part, anchor = target.rsplit("#", 1)
    else:
        path_part, anchor = target, None

    if not path_part:
        # 纯锚点链接（#section）— 检查当前文件
        if anchor:
            return check_anchor(md_path, anchor)
        return {"valid": True}

    # 从 Markdown 文件所在目录解析相对路径
    resolved = (md_path.parent / path_part).resolve()

    if not resolved.exists():
        return {
            "valid": False,
            "reason": "file_not_found",
            "resolved_path": str(resolved.relative_to(project_root))
        }

    if anchor and resolved.suffix == ".md":
        return check_anchor(resolved, anchor)

    return {"valid": True}


def check_anchor(md_path: Path, anchor: str) -> Dict:
    """检查锚点是否存在于 Markdown 文件中。"""
    try:
        content = md_path.read_text()
    except Exception:
        return {"valid": False, "reason": "cannot_read_file"}

    # 从标题生成锚点（GitHub 风格）
    headings = re.findall(r'^#{1,6}\s+(.+)$', content, re.MULTILINE)
    anchors = set()
    for h in headings:
        slug = re.sub(r'[^\w\s-]', '', h.lower())
        slug = re.sub(r'[\s]+', '-', slug).strip('-')
        anchors.add(slug)

    if anchor.lower() in anchors:
        return {"valid": True}
    return {
        "valid": False,
        "reason": "anchor_not_found",
        "anchor": anchor,
        "available_anchors": sorted(anchors)[:10]
    }


def check_all_links(project_root: Path) -> List[Dict]:
    """检查所有 Markdown 文件中的所有内部链接。"""
    findings = []
    md_files = find_markdown_files(project_root)

    for md_file in md_files:
        links = extract_links(md_file)
        broken = []
        for link in links:
            result = resolve_link(md_file, link["target"], project_root)
            if not result["valid"]:
                broken.append({**link, **result})

        if broken:
            findings.append({
                "file": str(md_file.relative_to(project_root)),
                "broken_links": broken
            })

    return findings


def main():
    parser = argparse.ArgumentParser(description="检查内部断链")
    parser.add_argument("project_root", help="项目根目录")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出")
    args = parser.parse_args()

    project_root = Path(args.project_root).resolve()
    findings = check_all_links(project_root)

    if args.json:
        print(json.dumps({"broken_links": findings}, indent=2))
    else:
        if not findings:
            print("✓ 未发现内部断链")
            return

        total = sum(len(f["broken_links"]) for f in findings)
        print(f"✗ 在 {len(findings)} 个文件中发现 {total} 个断链：\n")
        for f in findings:
            print(f"  {f['file']}:")
            for link in f["broken_links"]:
                print(f"    第 {link['line']} 行: [{link['text']}]({link['target']})")
                print(f"      → {link['reason']}")
            print()

    sys.exit(1 if findings else 0)


if __name__ == "__main__":
    main()
```

---

## 3. 接口漂移检测器

检测文档化的接口不再匹配实际代码时 — 最阴险的文档腐烂形式，因为文档看起来合法但会误导 agent。

```python
#!/usr/bin/env python3
"""
scripts/gc-interface-drift.py

检测文档化接口与实际代码定义之间的漂移。

Usage:
    python3 scripts/gc-interface-drift.py .
    python3 scripts/gc-interface-drift.py . --json
    python3 scripts/gc-interface-drift.py . --doc docs/ARCHITECTURE.md
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set


def extract_documented_interfaces(doc_path: Path) -> List[Dict]:
    """从文档中提取提及的接口/类型名称。"""
    content = doc_path.read_text()
    interfaces = []

    # 匹配带文件引用的反引号类型名称
    # 模式：`TypeName` ... `file.go:line`
    type_pattern = r'`([A-Z][a-zA-Z0-9]+(?:Interface|Service|Provider|Handler|Repository|Store|Manager|Client)?)`'
    for match in re.finditer(type_pattern, content):
        name = match.group(1)
        line_num = content[:match.start()].count('\n') + 1
        interfaces.append({
            "name": name,
            "doc_file": str(doc_path),
            "doc_line": line_num
        })

    return interfaces


def find_type_in_code_go(project_root: Path, type_name: str) -> Optional[Dict]:
    """在代码中查找 Go 类型/接口定义。"""
    try:
        result = subprocess.run(
            ["grep", "-rn", f"type {type_name} ", "--include=*.go",
             str(project_root)],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            first_match = result.stdout.strip().split('\n')[0]
            parts = first_match.split(':', 2)
            if len(parts) >= 2:
                return {
                    "file": str(Path(parts[0]).relative_to(project_root)),
                    "line": int(parts[1]),
                    "definition": parts[2].strip() if len(parts) > 2 else ""
                }
    except Exception:
        pass
    return None


def find_type_in_code_ts(project_root: Path, type_name: str) -> Optional[Dict]:
    """在代码中查找 TypeScript 接口/类/类型定义。"""
    try:
        patterns = [
            f"(export )?interface {type_name}",
            f"(export )?class {type_name}",
            f"(export )?type {type_name}"
        ]
        for pattern in patterns:
            result = subprocess.run(
                ["grep", "-rn", "-E", pattern, "--include=*.ts", "--include=*.tsx",
                 str(project_root)],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                first_match = result.stdout.strip().split('\n')[0]
                parts = first_match.split(':', 2)
                if len(parts) >= 2:
                    return {
                        "file": str(Path(parts[0]).relative_to(project_root)),
                        "line": int(parts[1]),
                        "definition": parts[2].strip() if len(parts) > 2 else ""
                    }
    except Exception:
        pass
    return None


def find_type_in_code_py(project_root: Path, type_name: str) -> Optional[Dict]:
    """在代码中查找 Python 类定义。"""
    try:
        result = subprocess.run(
            ["grep", "-rn", f"class {type_name}", "--include=*.py",
             str(project_root)],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            first_match = result.stdout.strip().split('\n')[0]
            parts = first_match.split(':', 2)
            if len(parts) >= 2:
                return {
                    "file": str(Path(parts[0]).relative_to(project_root)),
                    "line": int(parts[1]),
                    "definition": parts[2].strip() if len(parts) > 2 else ""
                }
    except Exception:
        pass
    return None


def detect_project_lang(project_root: Path) -> str:
    """自动检测项目语言。"""
    if (project_root / "go.mod").exists():
        return "go"
    if (project_root / "package.json").exists():
        return "ts"
    if (project_root / "pyproject.toml").exists() or (project_root / "requirements.txt").exists():
        return "py"
    return "go"  # 默认


def check_interface_drift(project_root: Path, doc_path: Optional[str] = None) -> List[Dict]:
    """检查文档与代码之间的接口漂移。"""
    lang = detect_project_lang(project_root)
    finder = {"go": find_type_in_code_go, "ts": find_type_in_code_ts, "py": find_type_in_code_py}[lang]

    # 收集要检查的文档
    if doc_path:
        doc_files = [project_root / doc_path]
    else:
        doc_files = []
        for pattern in ["docs/*.md", "docs/**/*.md", "AGENTS.md"]:
            doc_files.extend(project_root.glob(pattern))

    findings = []
    seen_types: Set[str] = set()

    for df in doc_files:
        if not df.exists():
            continue
        documented = extract_documented_interfaces(df)

        for iface in documented:
            if iface["name"] in seen_types:
                continue
            seen_types.add(iface["name"])

            code_loc = finder(project_root, iface["name"])
            if not code_loc:
                findings.append({
                    "type_name": iface["name"],
                    "documented_in": str(df.relative_to(project_root)),
                    "doc_line": iface["doc_line"],
                    "status": "not_found_in_code",
                    "severity": "high",
                    "suggestion": f"类型 '{iface['name']}' 在文档中引用但在代码中未找到。"
                                  f"它可能已被重命名、删除，或文档已过时。"
                })

    return findings


def main():
    parser = argparse.ArgumentParser(description="检测文档与代码之间的接口漂移")
    parser.add_argument("project_root", help="项目根目录")
    parser.add_argument("--doc", help="仅检查特定文档文件")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出")
    args = parser.parse_args()

    project_root = Path(args.project_root).resolve()
    findings = check_interface_drift(project_root, args.doc)

    if args.json:
        print(json.dumps({"interface_drift": findings}, indent=2))
    else:
        if not findings:
            print("✓ 未检测到接口漂移")
            return

        print(f"⚠ 发现 {len(findings)} 个潜在接口漂移问题：\n")
        for f in findings:
            icon = "🔴" if f["severity"] == "high" else "🟡"
            print(f"{icon} {f['type_name']}")
            print(f"   文档位置: {f['documented_in']}:{f['doc_line']}")
            print(f"   状态: {f['status']}")
            print(f"   → {f['suggestion']}")
            print()

    sys.exit(1 if findings else 0)


if __name__ == "__main__":
    main()
```

---

## 4. 统一 GC 运行器

一次性运行所有垃圾回收检查。生成组合报告。

```python
#!/usr/bin/env python3
"""
scripts/gc-docs.py

统一文档垃圾回收运行器。
运行陈旧文档检测、断链检查和接口漂移检测。

Usage:
    python3 scripts/gc-docs.py .
    python3 scripts/gc-docs.py . --json
    python3 scripts/gc-docs.py . --checks stale,links  # 选择性检查
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

# 导入单个检查器（作为统一运行器使用时，
# 这些会在同一 scripts/ 目录中）
# 为模板目的，展示集成模式：


def run_gc(project_root: Path, checks: list, threshold_days: int = 14) -> dict:
    """运行选定的垃圾回收检查。"""
    report = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "project_root": str(project_root),
        "checks_run": checks,
        "results": {},
        "summary": {"total_issues": 0, "high": 0, "medium": 0, "low": 0}
    }

    if "stale" in checks:
        # 运行陈旧文档检测
        from gc_stale_docs import check_staleness
        stale = check_staleness(project_root, threshold_days)
        report["results"]["stale_docs"] = stale
        for item in stale:
            report["summary"]["total_issues"] += 1
            report["summary"][item.get("severity", "medium")] += 1

    if "links" in checks:
        # 运行断链检测
        from gc_broken_links import check_all_links
        broken = check_all_links(project_root)
        report["results"]["broken_links"] = broken
        for item in broken:
            count = len(item.get("broken_links", []))
            report["summary"]["total_issues"] += count
            report["summary"]["high"] += count  # 断链始终是高严重性

    if "drift" in checks:
        # 运行接口漂移检测
        from gc_interface_drift import check_interface_drift
        drift = check_interface_drift(project_root)
        report["results"]["interface_drift"] = drift
        for item in drift:
            report["summary"]["total_issues"] += 1
            report["summary"][item.get("severity", "medium")] += 1

    return report


def main():
    parser = argparse.ArgumentParser(description="文档垃圾回收")
    parser.add_argument("project_root", help="项目根目录")
    parser.add_argument("--checks", default="stale,links,drift",
                        help="要运行的逗号分隔检查（默认：全部）")
    parser.add_argument("--threshold", type=int, default=14,
                        help="过时阈值天数")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("-o", "--output", help="将报告写入文件")
    args = parser.parse_args()

    project_root = Path(args.project_root).resolve()
    checks = [c.strip() for c in args.checks.split(",")]
    report = run_gc(project_root, checks, args.threshold)

    output = json.dumps(report, indent=2) if args.json else format_report(report)

    if args.output:
        Path(args.output).write_text(output)
        print(f"报告已写入 {args.output}")
    else:
        print(output)

    sys.exit(1 if report["summary"]["total_issues"] > 0 else 0)


def format_report(report: dict) -> str:
    """人类可读报告格式。"""
    lines = []
    s = report["summary"]
    total = s["total_issues"]

    if total == 0:
        return "✓ 文档干净 — 未发现问题"

    lines.append(f"文档 GC 报告 — {report['timestamp'][:10]}")
    lines.append(f"{'=' * 50}")
    lines.append(f"总问题数: {total} (🔴 {s['high']} 高, 🟡 {s['medium']} 中, 🟢 {s['low']} 低)")
    lines.append("")

    for check_name, results in report["results"].items():
        if results:
            lines.append(f"## {check_name.replace('_', ' ').title()}")
            lines.append(f"   发现 {len(results)} 个问题")
            lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    main()
```

---

## 5. CI 集成

### GitHub Actions

```yaml
# .github/workflows/doc-gc.yml
name: Documentation GC
on:
  push:
    branches: [main]
    paths: ['docs/**', 'AGENTS.md', '*.md']
  schedule:
    - cron: '0 9 * * 1'  # 每周一上午 9 点

jobs:
  doc-gc:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 需要完整历史记录用于 git log 日期

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Run documentation GC
        run: python3 scripts/gc-docs.py . --json -o gc-report.json

      - name: Upload report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: doc-gc-report
          path: gc-report.json
```

### Makefile 目标

```makefile
.PHONY: gc-docs
gc-docs:
	@echo "Running documentation garbage collection..."
	@python3 scripts/gc-docs.py . || true
	@echo ""
	@echo "To fix: review stale docs and update or delete them"
```

---

## 6. 调度指南

| 检查 | 频率 | 触发器 | 理由 |
|-------|-----------|---------|-----------|
| 断链 | 每次提交（CI） | 推送到 main | 立即捕捉重命名/删除 |
| 陈旧文档 | 每周 | 定时 CI | 平衡信号与噪音 |
| 接口漂移 | 每次 PR | PR 检查 | 防止漂移进入 main |
| 完整 GC | 每周 + 按需 | 手动或定时 | 全面健康检查 |

### 从 Harness Executor 运行

完成创建或修改代码的任务后，executor 可以运行快速 GC 检查：

```bash
# 快速任务后检查 — 仅检查变更文档的断链
python3 scripts/gc-broken-links.py . --json | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['broken_links']:
    print('⚠ 任务可能引入了文档断链 — 提交前审查')
"
```

### 从 Harness Creator（改进模式）运行

在 harness 审计期间，运行完整 GC 套件评估文档健康：

```bash
python3 scripts/gc-docs.py . --json -o harness/trace/gc-report.json
```

GC 报告汇入审计分数（文档维度）并帮助优先修复哪些文档。
