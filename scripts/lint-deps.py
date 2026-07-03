#!/usr/bin/env python3
# scripts/lint-deps.py
#
# 验证包导入是否尊重层层次结构。
# 每个层只能导入较低的层。
#
# 用法：python3 scripts/lint-deps.py
import os
import re
import sys
from collections import defaultdict

# CUSTOMIZE: 定义你的层层次结构（较低索引 = 较低层）
# 基于 ARCHITECTURE.md 第 2.2 节
LAYERS = {
    # Layer 0: 数据层 —— 无项目内部依赖
    0: [
        "star-park/server/src/database",
        "star-park/server/src/seed",
    ],
    # Layer 1: 后端路由 —— 依赖 L0
    1: [
        "star-park/server/src/routes/children",
        "star-park/server/src/routes/tasks",
        "star-park/server/src/routes/checkins",
        "star-park/server/src/routes/rewards",
        "star-park/server/src/routes/stats",
        "star-park/server/src/routes/points",
    ],
    # Layer 2: 后端入口 —— 依赖 L0-L1
    2: [
        "star-park/server/src/index",
    ],
    # Layer 3: 前端 API/组件/路由/Store/样式 —— 仅依赖 npm 包
    3: [
        "star-park/miniprogram/src/api/index",
        "star-park/miniprogram/src/components/ChildCard",
        "star-park/miniprogram/src/components/TaskItem",
        "star-park/miniprogram/src/components/PointsModal",
        "star-park/pc-admin/src/api/index",
        "star-park/pc-admin/src/components/ChildCard",
        "star-park/pc-admin/src/components/Layout",
        "star-park/pc-admin/src/components/SideNav",
        "star-park/pc-admin/src/router/index",
        "star-park/pc-admin/src/stores/app",
        "star-park/pc-admin/src/styles/main",
    ],
    # Layer 4: 前端页面/视图 —— 依赖 L3
    4: [
        "star-park/miniprogram/src/pages/index/index",
        "star-park/miniprogram/src/pages/checkin/index",
        "star-park/miniprogram/src/pages/profile/index",
        "star-park/miniprogram/src/pages/records/index",
        "star-park/miniprogram/src/pages/rewards/index",
        "star-park/miniprogram/src/pages/wallet/index",
        "star-park/pc-admin/src/views/Dashboard",
        "star-park/pc-admin/src/views/Goals",
        "star-park/pc-admin/src/views/Checkin",
        "star-park/pc-admin/src/views/Tasks",
        "star-park/pc-admin/src/views/Balance",
        "star-park/pc-admin/src/views/Rewards",
        "star-park/pc-admin/src/views/Stats",
    ],
    # Layer 5: 前端入口 —— 依赖 L3-L4
    5: [
        "star-park/miniprogram/src/main",
        "star-park/miniprogram/src/App",
        "star-park/pc-admin/src/main",
        "star-park/pc-admin/src/App",
    ],
}

# 构建反向映射：模块路径 -> 层
MODULE_TO_LAYER = {}
for layer, modules in LAYERS.items():
    for mod in modules:
        MODULE_TO_LAYER[mod] = layer


# CUSTOMIZE: 禁止的跨子项目导入
# 前端不得直接导入后端代码
FORBIDDEN_IMPORTS = {
    (3, 0): "前端模块不得直接导入后端数据层（应通过 HTTP API 通信）",
    (3, 1): "前端模块不得直接导入后端路由（应通过 HTTP API 通信）",
    (3, 2): "前端模块不得直接导入后端入口（应通过 HTTP API 通信）",
    (4, 0): "前端视图不得直接导入后端代码（应通过 API 客户端）",
    (4, 1): "前端视图不得直接导入后端路由（应通过 API 客户端）",
    (4, 2): "前端视图不得直接导入后端入口（应通过 API 客户端）",
    (5, 0): "前端入口不得导入后端代码",
    (5, 1): "前端入口不得导入后端路由",
    (5, 2): "前端入口不得导入后端入口",
}


def find_layer(file_path):
    """查找文件的层级。如果未找到则返回 -1。"""
    # 标准化路径
    normalized = file_path.replace("\\", "/")
    # 移除扩展名
    for ext in [".js", ".vue", ".ts"]:
        if normalized.endswith(ext):
            normalized = normalized[:-len(ext)]
            break
    # 移除 ./
    if normalized.startswith("./"):
        normalized = normalized[2:]

    # 精确匹配
    if normalized in MODULE_TO_LAYER:
        return MODULE_TO_LAYER[normalized]

    # 前缀匹配
    for mod_path, layer in MODULE_TO_LAYER.items():
        if normalized.startswith(mod_path + "/") or normalized == mod_path:
            return layer

    return -1


def extract_imports(content, file_path):
    """从文件中提取导入语句。"""
    imports = []
    # JavaScript require()
    for match in re.finditer(r"require\(['\"]([^'\"]+)['\"]\)", content):
        imports.append(match.group(1))
    # JavaScript import from
    for match in re.finditer(r"from\s+['\"]([^'\"]+)['\"]", content):
        imports.append(match.group(1))
    return imports


def resolve_import(import_path, file_dir):
    """将相对导入解析为项目相对路径。"""
    if not import_path.startswith("."):
        return None  # 忽略 npm 包导入

    # 解析相对路径
    parts = file_dir.split("/")
    for part in import_path.split("/"):
        if part == "..":
            parts.pop()
        elif part != ".":
            parts.append(part)

    resolved = "/".join(parts)
    # 添加项目根前缀
    if not resolved.startswith("star-park/"):
        return None
    return resolved


# 要跳过的目录
SKIP_DIRS = {".git", "node_modules", "dist", ".qoder", ".claude", "vendor", "data", "harness", "scripts"}


def check_file(file_path, violations):
    """检查单个文件的层违反。"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        return

    # 确定当前模块的层级
    current_layer = find_layer(file_path)
    if current_layer < 0:
        return  # 未知模块，跳过

    # 跳过测试文件
    if ".test." in file_path or ".spec." in file_path:
        return

    file_dir = os.path.dirname(file_path).replace("\\", "/")
    if file_dir.startswith("./"):
        file_dir = file_dir[2:]

    imports = extract_imports(content, file_path)

    for imp in imports:
        resolved = resolve_import(imp, file_dir)
        if resolved is None:
            continue  # npm 包或无法解析

        import_layer = find_layer(resolved)
        if import_layer < 0:
            continue  # 未知模块

        # 检查层规则
        if import_layer > current_layer:
            violations.append({
                "file": file_path,
                "module": file_dir,
                "imports": resolved,
                "current_layer": current_layer,
                "import_layer": import_layer,
                "message": (
                    f"{file_dir} (Layer {current_layer}) imports {resolved} (Layer {import_layer}).\n"
                    f"  Layer {current_layer} modules can only import from layers < {current_layer}.\n"
                    f"\n"
                    f"  Fix options:\n"
                    f"  1. Move the needed functionality down to Layer {current_layer} or lower\n"
                    f"  2. Pass the dependency as a parameter (dependency injection)\n"
                    f"  3. Define an interface in Layer {current_layer} that Layer {import_layer} implements"
                ),
            })

        # 检查禁止的导入
        key = (current_layer, import_layer)
        if key in FORBIDDEN_IMPORTS:
            violations.append({
                "file": file_path,
                "module": file_dir,
                "imports": resolved,
                "current_layer": current_layer,
                "import_layer": import_layer,
                "message": (
                    f"FORBIDDEN: {file_dir} (Layer {current_layer}) → {resolved} (Layer {import_layer})\n"
                    f"  {FORBIDDEN_IMPORTS[key]}\n"
                    f"\n"
                    f"  Fix: Use HTTP API client instead of direct import"
                ),
            })


def main():
    violations = []
    project_root = "."

    for root, dirs, files in os.walk(project_root):
        # 跳过指定目录
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for filename in files:
            if filename.endswith((".js", ".vue", ".ts")):
                filepath = os.path.join(root, filename)
                check_file(filepath, violations)

    if not violations:
        print("✓ All package dependencies follow the layer hierarchy")
        sys.exit(0)

    print(f"✗ Found {len(violations)} dependency violations:\n")
    for v in violations:
        print(f"{v['file']}:")
        print(f"  {v['message']}")
        print()

    sys.exit(1)


if __name__ == "__main__":
    main()
