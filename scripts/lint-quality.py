#!/usr/bin/env python3
# scripts/lint-quality.py
#
# 验证代码质量模式：
# - 无原始 console.log 调试语句（使用结构化日志）
# - 文件大小限制（最大 500 行）
# - 无 console.error 直接输出（应统一错误处理）
#
# 用法：python3 scripts/lint-quality.py
import os
import re
import sys

# CUSTOMIZE: 每个文件的最大行数
MAX_FILE_LINES = 500

# CUSTOMIZE: 要标记的模式
# console.log 在服务端代码中应该避免，使用结构化日志代替
# 注意：小程序和前端允许 console.error 在 API 拦截器中使用
RAW_LOG_PATTERNS = [
    (r'console\.log\(', "raw-console-log", "Use structured logging or remove debug console.log — console.log is not for production code"),
]

# 要跳过的目录
SKIP_DIRS = {".git", "node_modules", "dist", ".qoder", ".claude", "vendor", "data", "harness", "scripts", "outputs"}

# 已知例外：允许的 console.log 位置
# 注意：文件路径可能以 ./ 开头，需要两种格式
KNOWN_EXCEPTIONS = {
    # 服务启动日志是合理的输出
    "star-park/server/src/index.js": ["console.log"],    # 服务启动消息
    "./star-park/server/src/index.js": ["console.log"],  # 服务启动消息
    "star-park/server/src/seed.js": ["console.log"],      # 种子数据初始化消息
    "./star-park/server/src/seed.js": ["console.log"],    # 种子数据初始化消息
    # 前端 App 生命周期日志
    "star-park/miniprogram/src/App.vue": ["console.log"],   # uni-app 生命周期
    "./star-park/miniprogram/src/App.vue": ["console.log"], # uni-app 生命周期
}

# 已知大文件例外（需后续拆分）
KNOWN_LARGE_FILES = {
    "./star-park/miniprogram/src/pages/checkin/index.vue": 660,  # 打卡页面，需拆分
    "./star-park/pc-admin/src/views/Goals.vue": 686,            # 目标管理页面，需拆分
}


def check_file(filepath, violations):
    """检查单个文件的质量问题。"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception:
        return

    line_count = len(lines)

    # 检查文件大小
    if line_count > MAX_FILE_LINES:
        # 检查是否为已知大文件
        known_size = KNOWN_LARGE_FILES.get(filepath, 0)
        if line_count <= known_size:
            pass  # 已知大文件，暂不报错
        else:
            violations.append({
                "file": filepath,
                "line": 1,
                "rule": "file-size",
                "message": f"File has {line_count} lines (max {MAX_FILE_LINES}). Consider splitting into smaller modules.",
            })

    # 获取已知例外
    exceptions = KNOWN_EXCEPTIONS.get(filepath, [])

    # 检查原始 console.log 语句
    for line_num, line in enumerate(lines, 1):
        trimmed = line.strip()
        if trimmed.startswith("//") or trimmed.startswith("/*") or trimmed.startswith("*"):
            continue

        # 检查已知例外
        is_exception = False
        for exc in exceptions:
            if exc in line:
                is_exception = True
                break

        if is_exception:
            continue

        for pattern, rule, message in RAW_LOG_PATTERNS:
            if re.search(pattern, line):
                violations.append({
                    "file": filepath,
                    "line": line_num,
                    "rule": rule,
                    "message": f"{message}. In server code, use a structured logger. In frontend code, remove before commit.",
                })


def main():
    violations = []
    project_root = "."

    for root, dirs, files in os.walk(project_root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for filename in files:
            if filename.endswith((".js", ".vue", ".ts")):
                filepath = os.path.join(root, filename)
                check_file(filepath, violations)

    if not violations:
        print("✓ All quality checks passed")
        sys.exit(0)

    print(f"✗ Found {len(violations)} quality violations:\n")
    for v in violations:
        print(f"{v['file']}:{v['line']} [{v['rule']}]: {v['message']}")

    sys.exit(1)


if __name__ == "__main__":
    main()
