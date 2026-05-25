# CLI 测试 Mixin

此 mixin 为验证器添加 CLI 工具测试能力。

## 何时包含

在以下情况包含此 mixin：
- `app_type` 为 `cli` 或 `hybrid`
- 项目有 CLI 命令（cobra、click、argparse 等）
- 任务特定场景涉及 CLI 命令验证

## 额外上下文

你正在测试一个命令行工具。应用程序从终端调用。

## CLI 特定协议

### 构建 CLI

如果 CLI 需要编译：
1. 检查二进制文件是否存在于预期路径
2. 如果不存在，从适配器运行构建命令
3. 验证二进制文件可执行

常见二进制文件位置：
- Go: `bin/{name}`、`./cmd/{name}/{name}`
- Node: `dist/cli.js`、`bin/cli`
- Python: `src/cli.py`、模块调用 `python -m {package}`

### 命令执行

对于每个 CLI 测试：

```python
# 命令执行的伪代码
command = {
    "binary": cli_binary,
    "args": test["args"],
    "stdin": test.get("stdin"),
    "env": {**os.environ, **test.get("env", {})}
}

result = subprocess.run(
    [command["binary"]] + command["args"],
    input=command["stdin"],
    env=command["env"],
    capture_output=True,
    timeout=30
)

assertions = []
if "exit_code" in test:
    assertions.append(check_exit_code(result, test["exit_code"]))
if "stdout_contains" in test:
    assertions.append(check_stdout_contains(result, test["stdout_contains"]))
if "stdout_matches" in test:
    assertions.append(check_stdout_regex(result, test["stdout_matches"]))
if "file_created" in test:
    assertions.append(check_file_created(test["file_created"]))
```

### 常见断言

**退出码：**
```json
{"type": "exit_code", "expected": 0, "actual": 0, "passed": true}
```

**Stdout 包含：**
```json
{"type": "stdout_contains", "expected": "Success", "found": true, "passed": true}
```

**Stdout 正则匹配：**
```json
{"type": "stdout_matches", "pattern": "Created user \\w+", "matched": true, "passed": true}
```

**文件创建：**
```json
{"type": "file_created", "path": "output.json", "exists": true, "passed": true}
```

### 标准测试

始终包含以下基础测试：

| 测试 | 命令 | 预期 |
|------|------|------|
| 帮助 | `--help` | 退出码 0，显示用法 |
| 版本 | `--version` | 退出码 0，显示版本 |
| 无参数 | （无） | 退出码 0 或显示帮助 |
| 无效标志 | `--invalid-flag` | 非零退出码，错误信息 |

### 副作用验证

对于修改文件或状态的命令：

1. **文件创建：**
   ```json
   {
     "side_effect": "file_created",
     "path": "output/report.json",
     "verified_by": "文件存在且为有效 JSON",
     "passed": true
   }
   ```

2. **文件修改：**
   ```json
   {
     "side_effect": "file_modified",
     "path": "config.yaml",
     "verified_by": "文件中存在 new_field",
     "passed": true
   }
   ```

3. **数据库变更：**
   ```json
   {
     "side_effect": "record_created",
     "verified_by": "SELECT 返回 1 行",
     "passed": true
   }
   ```

### 交互式 CLI 测试

对于带提示的命令：
1. 通过 stdin 提供输入
2. 如果可用，使用 `--yes` 或 `--no-interactive` 标志
3. 设置 `CI=true` 环境变量

### 错误测试

测试错误场景：

| 场景 | 预期 |
|------|------|
| 缺少必需参数 | 退出码 1，错误信息 |
| 参数值无效 | 退出码 1，验证错误 |
| 文件未找到 | 退出码 1，文件错误 |
| 权限被拒绝 | 退出码 1，权限错误 |
| 配置无效 | 退出码 1，配置错误 |

### 超时处理

- 默认命令超时：30 秒
- 长时间操作（导出、导入）：120 秒
- 通过测试中的 `timeout` 字段设置

### 环境变量

常见测试环境设置：
```json
{
  "env": {
    "CI": "true",
    "NO_COLOR": "1",
    "TERM": "dumb"
  }
}
```

## 框架特定说明

### Cobra (Go)
- 子命令：`cli subcommand --flag`
- 父命令上的持久标志
- `--help` 自动生成

### Click (Python)
- 子命令：`cli subcommand --flag`
- `@click.option` 用于标志
- `@click.argument` 用于位置参数

### Commander (Node)
- 子命令：`cli subcommand --flag`
- `.option()` 用于标志
- `.argument()` 用于位置参数
