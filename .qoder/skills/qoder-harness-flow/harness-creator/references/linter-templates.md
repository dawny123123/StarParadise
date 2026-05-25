# Linter 模板 —— 标准化骨架

这些是**标准化骨架**。子代理必须逐字复制它们，并且只修改标记有 `// CUSTOMIZE` 的部分。不要重写脚本逻辑。

## 依赖方向 Linter

验证包导入是否尊重层层次结构。

```go
// scripts/lint-deps.go
//
// 验证包依赖是否遵循层层次结构。
// 每个层只能导入较低的层。
//
// 用法：go run scripts/lint-deps.go
package main

import (
	"fmt"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// CUSTOMIZE: 设置你的模块路径
const modulePath = "your-module-path"

// CUSTOMIZE: 定义你的层层次结构（较低索引 = 较低层）
var layers = [][]string{
	// Layer 0: 无内部依赖
	{"core/types"},
	// Layer 1: 依赖 Layer 0
	{"core/utils"},
	// Layer 2: 依赖 Layers 0-1
	{"core/config", "core/logging"},
	// Layer 3: 依赖 Layers 0-2
	{"core/business"},
	// Layer 4: 依赖 core/ 但不互相依赖
	{"ui", "sdk", "integrations"},
	// Layer 5: 可以依赖一切
	{"cmd"},
}

// CUSTOMIZE: 不能互相导入的包
var mutuallyExclusive = [][]string{
	{"ui", "sdk", "integrations"},
}

type Violation struct {
	File    string
	Package string
	Imports string
	Message string
}

func main() {
	violations := checkDependencies()

	if len(violations) == 0 {
		fmt.Println("✓ All package dependencies follow the layer hierarchy")
		os.Exit(0)
	}

	fmt.Printf("✗ Found %d dependency violations:\n\n", len(violations))
	for _, v := range violations {
		fmt.Printf("%s:\n  Package: %s\n  Imports: %s\n  Error: %s\n\n",
			v.File, v.Package, v.Imports, v.Message)
	}
	os.Exit(1)
}

func checkDependencies() []Violation {
	var violations []Violation
	layerMap := buildLayerMap()

	filepath.Walk(".", func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			if info != nil && info.IsDir() {
				name := info.Name()
				if strings.HasPrefix(name, ".") || name == "vendor" || name == "dist" {
					return filepath.SkipDir
				}
			}
			return nil
		}

		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}

		violations = append(violations, checkFile(path, layerMap)...)
		return nil
	})

	return violations
}

func buildLayerMap() map[string]int {
	m := make(map[string]int)
	for idx, pkgs := range layers {
		for _, pkg := range pkgs {
			m[pkg] = idx
		}
	}
	return m
}

func checkFile(path string, layerMap map[string]int) []Violation {
	var violations []Violation

	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
	if err != nil {
		return violations
	}

	dir := filepath.ToSlash(filepath.Dir(path))
	dir = strings.TrimPrefix(dir, "./")
	pkgLayer := findLayer(dir, layerMap)
	if pkgLayer < 0 {
		return violations
	}

	for _, imp := range node.Imports {
		importPath := strings.Trim(imp.Path.Value, `"`)
		if !strings.HasPrefix(importPath, modulePath) {
			continue
		}

		relImport := strings.TrimPrefix(importPath, modulePath+"/")
		importLayer := findLayer(relImport, layerMap)
		if importLayer < 0 {
			continue
		}

		if importLayer >= pkgLayer {
			// Check if same base package (allowed)
			if getBase(dir) == getBase(relImport) {
				continue
			}
			violations = append(violations, Violation{
				File: path, Package: dir, Imports: relImport,
				Message: fmt.Sprintf(
					"%s imports %s (Layer %d → Layer %d).\n"+
						"  Layer %d packages can only import from layers < %d.\n"+
						"\n"+
						"  Fix options:\n"+
						"  1. Move the needed functionality down to Layer %d or lower\n"+
						"  2. Pass the dependency as a parameter (dependency injection)\n"+
						"  3. Define an interface in Layer %d that Layer %d implements",
					dir, relImport, pkgLayer, importLayer,
					pkgLayer, pkgLayer,
					pkgLayer,
					pkgLayer, importLayer),
			})
		}
	}

	return violations
}

func findLayer(pkg string, layerMap map[string]int) int {
	if layer, ok := layerMap[pkg]; ok {
		return layer
	}
	for key, layer := range layerMap {
		if strings.HasPrefix(pkg, key+"/") {
			return layer
		}
	}
	return -1
}

func getBase(pkg string) string {
	parts := strings.SplitN(pkg, "/", 3)
	if len(parts) >= 2 {
		return parts[0] + "/" + parts[1]
	}
	return parts[0]
}
```

## 质量 Linter

验证黄金原则，如结构化日志、文件大小和命名。

```go
// scripts/lint-quality.go
//
// 验证黄金原则：
// - 无原始 log.Printf（使用结构化日志）
// - 文件大小限制（最大 1000 行）
// - 无硬编码品牌字符串
//
// 用法：go run scripts/lint-quality.go
package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const maxFileLines = 1000

// CUSTOMIZE: 要标记的模式
var rawLogPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\blog\.Printf\b`),
	regexp.MustCompile(`\blog\.Println\b`),
	regexp.MustCompile(`\blog\.Fatalf\b`),
}

// CUSTOMIZE: 要跳过的目录
var skipDirs = map[string]bool{
	".git": true, "dist": true, "vendor": true,
}

type Violation struct {
	File    string
	Line    int
	Rule    string
	Message string
}

func main() {
	var violations []Violation

	walkGoFiles(func(path string, content []byte) {
		if strings.HasSuffix(path, "_test.go") {
			return
		}

		// 检查结构化日志
		lines := strings.Split(string(content), "\n")
		for lineNum, line := range lines {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "//") {
				continue
			}
			for _, pattern := range rawLogPatterns {
				if pattern.MatchString(line) {
					violations = append(violations, Violation{
						File: path, Line: lineNum + 1,
						Rule:    "structured-logging",
						Message: "Use structured logging instead of raw log calls",
					})
				}
			}
		}

		// 检查文件大小
		scanner := bufio.NewScanner(strings.NewReader(string(content)))
		lineCount := 0
		for scanner.Scan() {
			lineCount++
		}
		if lineCount > maxFileLines {
			violations = append(violations, Violation{
				File: path, Rule: "file-size",
				Message: fmt.Sprintf("File has %d lines (max %d)", lineCount, maxFileLines),
			})
		}
	})

	if len(violations) == 0 {
		fmt.Println("✓ All quality checks passed")
		os.Exit(0)
	}

	fmt.Printf("✗ Found %d quality violations:\n\n", len(violations))
	for _, v := range violations {
		fmt.Printf("%s:%d [%s]: %s\n", v.File, v.Line, v.Rule, v.Message)
	}
	os.Exit(1)
}

func walkGoFiles(fn func(path string, content []byte)) {
	filepath.Walk(".", func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			if info != nil && info.IsDir() && skipDirs[filepath.Base(path)] {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		fn(path, content)
		return nil
	})
}
```

## 模板 Linter

验证模板文件（.tpl）有效且被引用。

```go
// scripts/lint-prompts.go
//
// 验证模板文件：可解析、被引用、无孤立。
//
// 用法：go run scripts/lint-prompts.go
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"text/template"
)

// CUSTOMIZE: 包含模板文件的目录
var templateDirs = []string{"templates", "prompts"}

func main() {
	var violations int

	for _, dir := range templateDirs {
		filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() || !strings.HasSuffix(path, ".tpl") {
				return nil
			}

			content, err := os.ReadFile(path)
			if err != nil {
				fmt.Printf("%s: cannot read: %v\n", path, err)
				violations++
				return nil
			}

			_, err = template.New(filepath.Base(path)).
				Option("missingkey=zero").
				Parse(string(content))
			if err != nil {
				fmt.Printf("%s: invalid template: %v\n", path, err)
				violations++
			}

			return nil
		})
	}

	// 检查孤立模板
	embedPattern := regexp.MustCompile(`//go:embed\s+(\S+\.tpl)`)
	tplFiles := make(map[string]bool)

	for _, dir := range templateDirs {
		filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			if !info.IsDir() && strings.HasSuffix(path, ".tpl") {
				tplFiles[filepath.Base(path)] = false
			}
			return nil
		})
	}

	filepath.Walk(".", func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}
		content, _ := os.ReadFile(path)
		for _, match := range embedPattern.FindAllSubmatch(content, -1) {
			tplFiles[string(match[1])] = true
		}
		return nil
	})

	for name, referenced := range tplFiles {
		if !referenced {
			fmt.Printf("WARNING: %s may be orphaned\n", name)
		}
	}

	if violations == 0 {
		fmt.Printf("✓ All template files are valid\n")
		os.Exit(0)
	}
	os.Exit(1)
}
```

## Makefile 集成

```makefile
# 架构检查
.PHONY: lint-arch
lint-arch:
	@echo "Checking architecture constraints..."
	@go run scripts/lint-deps.go
	@go run scripts/lint-tools.go
	@go run scripts/lint-prompts.go
	@go run scripts/lint-quality.go
	@echo "✓ Architecture checks passed"

# 组合 lint
.PHONY: lint
lint: lint-arch
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run; \
	fi
```

## Java/Maven 项目 —— 依赖方向 Linter

对于 Java 项目（无 Go 运行时可用），使用基于 Python 的 linter。

```python
# scripts/lint-deps.py
#
# 验证 Java 包导入是否尊重层层次结构。
# 每个层只能导入较低的层。
#
# 用法：python3 scripts/lint-deps.py
import os
import re
import sys
from collections import defaultdict

# CUSTOMIZE: 定义你的层层次结构（较低索引 = 较低层）
# 仅使用以下命令找到的包：grep -rh "^package " --include="*.java" . | sed 's/package //;s/;//' | sort -u
LAYERS = {
    # Layer 0: 类型定义 —— 无内部依赖
    0: [
        "com.example.project.api.dto",
        "com.example.project.api.enums",
    ],
    # Layer 1: 工具 —— 仅依赖 L0
    1: [
        "com.example.project.infra.util",
        "com.example.project.infra.helper",
    ],
    # Layer 2: 核心业务 —— 依赖 L0-L1
    2: [
        "com.example.project.application",
        "com.example.project.domain.entity",
        "com.example.project.infra.mapper",
    ],
    # Layer 3: 入口点 —— 依赖 L0-L2
    3: [
        "com.example.project.web.controller",
        "com.example.project.adapt",
    ],
    # Layer 4: 引导 —— 可以依赖所有层
    4: [
        "com.example.project.starter",
    ],
}

# 构建反向映射：包 -> 层
PKG_TO_LAYER = {}
for layer, pkgs in LAYERS.items():
    for pkg in pkgs:
        PKG_TO_LAYER[pkg] = layer


def find_layer(pkg_name):
    """查找包的层。如果未找到则返回 -1。"""
    if pkg_name in PKG_TO_LAYER:
        return PKG_TO_LAYER[pkg_name]
    for pkg, layer in PKG_TO_LAYER.items():
        if pkg_name.startswith(pkg + "."):
            return layer
    return -1


def extract_imports(content):
    """从 Java 文件提取所有导入语句。"""
    imports = []
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("import ") and line.endswith(";"):
            # 移除 "import " 前缀和 ";" 后缀，处理静态导入
            imp = line[7:-1].strip()
            if imp.startswith("static "):
                imp = imp[7:].strip()
            imports.append(imp)
    return imports


def check_file(filepath, violations):
    """检查单个 Java 文件的层违反。"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        return

    # 跳过测试文件
    if "Test.java" in filepath or filepath.endswith("Tests.java"):
        return

    imports = extract_imports(content)

    # 确定当前包
    pkg_match = re.search(r"package\s+([\w.]+)\s*;", content)
    if not pkg_match:
        return

    current_pkg = pkg_match.group(1)
    current_layer = find_layer(current_pkg)

    if current_layer < 0:
        return  # 未知包，跳过

    # CUSTOMIZE: 设置你的项目的根包前缀用于过滤
    PROJECT_ROOT_PKG = "com.example.project"

    for imp in imports:
        if not imp.startswith(PROJECT_ROOT_PKG):
            continue

        imp_layer = find_layer(imp)
        if imp_layer < 0:
            continue

        if imp_layer > current_layer:
            if imp.startswith(current_pkg + "."):
                continue
            violations.append({
                "file": filepath,
                "package": current_pkg,
                "imports": imp,
                "current_layer": current_layer,
                "import_layer": imp_layer,
            })


def main():
    violations = []
    project_root = "."

    for root, dirs, files in os.walk(project_root):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "target"]
        for filename in files:
            if filename.endswith(".java"):
                filepath = os.path.join(root, filename)
                check_file(filepath, violations)

    if not violations:
        print("✓ All package dependencies follow the layer hierarchy")
        sys.exit(0)

    print(f"✗ Found {len(violations)} dependency violations:\n")
    for v in violations:
        print(f"{v['file']}:")
        print(f"  Package: {v['package']} (Layer {v['current_layer']})")
        print(f"  Imports: {v['imports']} (Layer {v['import_layer']})")
        print(f"  Error: Layer {v['current_layer']} → Layer {v['import_layer']} is not allowed.")
        print(f"  Layer {v['current_layer']} packages can only import from layers < {v['current_layer']}.")
        print()
        print("  Fix options:")
        print("  1. Move the dependency to a lower layer")
        print("  2. Create an interface in the current layer that the dependency implements")
        print("  3. Refactor to use dependency injection")
        print()

    sys.exit(1)


if __name__ == "__main__":
    main()
```

## Java/Maven 项目 —— 质量 Linter

```python
# scripts/lint-quality.py
#
# 验证 Java 项目的代码质量模式：
# - 无原始 print 语句（使用结构化日志）
# - 文件大小限制（最大 500 行）
# - 无 printStackTrace() 调用
#
# 用法：python3 scripts/lint-quality.py
import os
import re
import sys

# CUSTOMIZE: 每个文件的最大行数
MAX_FILE_LINES = 500

# CUSTOMIZE: 要标记为违反的模式
RAW_LOG_PATTERNS = [
    (r'System\.out\.print', "raw-print", "Use structured logging (log.info, log.error) instead of System.out.print"),
    (r'System\.err\.print', "raw-print", "Use structured logging instead of System.err.print"),
    (r'printStackTrace\(\)', "raw-exception", "Use log.error(msg, exception) instead of printStackTrace()"),
]

# 要跳过的目录
SKIP_DIRS = {".git", "target", "node_modules", ".idea", ".qoder", ".claude"}


def check_file(filepath, violations):
    """检查单个文件的质量问题。"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception:
        return

    # 检查文件大小
    line_count = len(lines)
    if line_count > MAX_FILE_LINES:
        violations.append({
            "file": filepath,
            "line": 1,
            "rule": "file-size",
            "message": f"File has {line_count} lines (max {MAX_FILE_LINES}). Consider splitting.",
        })

    # 检查原始 print/log 语句
    for line_num, line in enumerate(lines, 1):
        trimmed = line.strip()
        if trimmed.startswith("//") or trimmed.startswith("/*") or trimmed.startswith("*"):
            continue
        for pattern, rule, message in RAW_LOG_PATTERNS:
            if re.search(pattern, line):
                violations.append({
                    "file": filepath,
                    "line": line_num,
                    "rule": rule,
                    "message": message,
                })


def main():
    violations = []
    project_root = "."

    for root, dirs, files in os.walk(project_root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for filename in files:
            if filename.endswith(".java"):
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
```

## 适配说明

### TypeScript 项目

用 ESLint 规则替换 Go linter：
```js
// .eslintrc.js - 导入限制
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['../ui/*'], message: 'Core cannot import UI' },
        { group: ['../cmd/*'], message: 'Core cannot import CLI' },
      ]
    }]
  }
};
```

### Python 项目

使用自定义 pylint 检查器或 ruff 规则：
```python
# scripts/lint_deps.py
import ast, sys, pathlib

LAYER_ORDER = {
    'models': 0,
    'utils': 1,
    'services': 2,
    'api': 3,
    'cli': 4,
}
# ... 根据层顺序验证导入
```
