---
adapter:
  language: python
  display_name: "Python"
  version: "1.0"

  detection:
    files: [pyproject.toml, setup.py, requirements.txt, Pipfile]
    content_patterns:
      - file: "pyproject.toml"
        pattern: '\\[project\\]|\\[tool\\.poetry\\]'
    confidence: 0.90

  commands:
    build: null  # Python 通常不需要构建步骤
    test: "pytest"
    lint: "ruff check ."
    lint_arch: "python scripts/lint_deps.py src/"
    format: "ruff format ."
    start: null   # 从框架推断
    dev: null

  package_manager:
    detection:
      - lockfile: "poetry.lock"
        manager: "poetry"
      - lockfile: "uv.lock"
        manager: "uv"
      - lockfile: "Pipfile.lock"
        manager: "pipenv"
      - lockfile: "pdm.lock"
        manager: "pdm"
    default: "pip"
    install_command: "{manager} install"

  route_detection:
    server_indicators:
      - pattern: 'from fastapi|import fastapi|FastAPI\(\)'
        description: "FastAPI ASGI 框架"
        frameworks: ["fastapi"]
      - pattern: 'from flask|import flask|Flask\(__name__\)'
        description: "Flask WSGI 框架"
        frameworks: ["flask"]
      - pattern: 'from django|import django'
        description: "Django web 框架"
        frameworks: ["django"]
      - pattern: 'from aiohttp|import aiohttp\.web'
        description: "aiohttp 异步 web 框架"
        frameworks: ["aiohttp"]
      - pattern: 'from starlette|import starlette'
        description: "Starlette ASGI 框架"
        frameworks: ["starlette"]
      - pattern: 'from litestar|import litestar'
        description: "Litestar ASGI 框架"
        frameworks: ["litestar"]

    cli_indicators:
      - pattern: 'import click|from click'
        description: "Click CLI 框架"
        frameworks: ["click"]
      - pattern: 'import typer|from typer'
        description: "Typer CLI 框架"
        frameworks: ["typer"]
      - pattern: 'import argparse|from argparse'
        description: "标准库 argparse"
        frameworks: ["argparse"]
      - pattern: 'import fire|from fire'
        description: "Google Python Fire"
        frameworks: ["fire"]

    frontend_indicators: []  # Python 通常不用于前端

    patterns:
      # FastAPI
      - type: route
        regex: '@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*["\x27]([^"\x27]+)["\x27]'
        groups: [method, path]
        frameworks: ["fastapi", "starlette", "litestar"]
      # Flask
      - type: route
        regex: '@(?:app|bp|blueprint)\.(route)\s*\(\s*["\x27]([^"\x27]+)["\x27](?:.*methods\s*=\s*\[([^\]]+)\])?'
        groups: [_, path, method]
        frameworks: ["flask"]
      # Django URLs
      - type: route
        regex: 'path\s*\(\s*["\x27]([^"\x27]+)["\x27]'
        groups: [path]
        frameworks: ["django"]
      # Click
      - type: command
        regex: '@\w+\.command\s*\(\s*(?:name\s*=\s*)?["\x27]?([^"\x27\)]+)'
        groups: [command_name]
        frameworks: ["click"]
      # Typer
      - type: command
        regex: '@app\.command\s*\(\s*(?:name\s*=\s*)?["\x27]?([^"\x27\)]*)'
        groups: [command_name]
        frameworks: ["typer"]

  import_analysis:
    list_packages: null
    import_pattern: "^(?:from|import)\\s+([\\w.]+)"
    source_extensions: [".py"]
    module_root_file: "pyproject.toml"

  layer_conventions:
    patterns:
      - layer: 0
        paths: ["src/models", "src/schemas", "src/types", "models", "schemas"]
        description: "数据模型、Pydantic 模式、类型定义"
      - layer: 1
        paths: ["src/utils", "src/lib", "src/common", "utils", "lib"]
        description: "共享工具"
      - layer: 2
        paths: ["src/services", "src/core", "src/domain", "services", "core"]
        description: "业务逻辑、服务层"
      - layer: 3
        paths: ["src/api", "src/routes", "src/views", "src/handlers", "api", "routes"]
        description: "API 端点、请求处理器"
      - layer: 4
        paths: ["src/main.py", "src/app.py", "src/cli.py", "main.py", "app.py"]
        description: "应用入口点"

  dependency_detection:
    manifest_file: "pyproject.toml"
    databases:
      - pattern: "psycopg|asyncpg|sqlalchemy.*postgres|databases.*postgres"
        type: "postgres"
        default_port: 5432
      - pattern: "pymysql|aiomysql|mysqlclient"
        type: "mysql"
        default_port: 3306
      - pattern: "pymongo|motor"
        type: "mongodb"
        default_port: 27017
      - pattern: "redis|aioredis"
        type: "redis"
        default_port: 6379
      - pattern: "aiosqlite|sqlite3"
        type: "sqlite"
        default_port: 0
    services:
      - pattern: "confluent-kafka|aiokafka"
        type: "kafka"
        default_port: 9092
      - pattern: "pika|aio-pika"
        type: "rabbitmq"
        default_port: 5672
      - pattern: "elasticsearch|elastic-transport"
        type: "elasticsearch"
        default_port: 9200
    env_var_patterns:
      - pattern: 'os\.environ\.get\(\s*["\x27]([^"\x27]+)["\x27]'
      - pattern: 'os\.environ\[["\x27]([^"\x27]+)["\x27]\]'
      - pattern: 'os\.getenv\(\s*["\x27]([^"\x27]+)["\x27]'

  linter:
    template_section: "python-linter"
    script_extension: ".py"
    run_command: "python scripts/lint_deps.py src/"

  naming:
    file_pattern: "^[a-z][a-z0-9_]*\\.py$"
    test_pattern: "^test_[a-z][a-z0-9_]*\\.py$"
    directory_style: "snake_case"

  ci:
    github_actions:
      image: "python:3.12"
      setup_steps:
        - "uses: actions/setup-python@v5\n  with:\n    python-version: '3.12'"
      cache_paths: ["~/.cache/pip", ".venv"]
---

# Python 适配器

## 服务器启动命令推断

1. `verify.json` → `server.start`
2. 检测到 FastAPI → `python -m uvicorn {module}:app --port 8080`
   - 模块从主应用文件位置推断
3. 检测到 Flask → `python -m flask run --port 8080`
4. 检测到 Django → `python manage.py runserver 8080`
5. 存在 `main.py` → `python main.py`

## 虚拟环境检测

适配器按以下顺序检查虚拟环境：
1. `.venv/` 目录 → `source .venv/bin/activate`
2. `venv/` 目录 → `source venv/bin/activate`
3. `poetry.lock` → `poetry shell` 或前缀 `poetry run`
4. `uv.lock` → 前缀 `uv run`
5. `Pipfile.lock` → 前缀 `pipenv run`

## 框架特定说明

### FastAPI
- 装饰器路由：`@app.get("/path")`, `@router.post("/path")`
- 通过 `Depends()` 进行依赖注入
- 在 `/docs` 和 `/redoc` 自动生成 OpenAPI 文档
- 使用 uvicorn 启动：`uvicorn app.main:app --reload`

### Flask
- 装饰器路由：`@app.route("/path", methods=["GET"])`
- Blueprints 用于模块化路由
- 启动方式：`flask run` 或 `python -m flask run`

### Django
- `urls.py` 中的 URL 配置：`path("api/", include("app.urls"))`
- 基于类的视图和基于函数的视图
- 启动方式：`python manage.py runserver`
- 迁移：`python manage.py migrate`

### Click / Typer（CLI）
- Click：`@cli.command()` 装饰器模式
- Typer：`@app.command()` 装饰器模式，自动生成帮助

## 类型检查

Python 项目可能使用类型检查器：
- `mypy` — 最常见，配置在 `pyproject.toml` 或 `mypy.ini`
- `pyright` — Microsoft 的类型检查器，常通过 Pylance 使用
- `pytype` — Google 的类型检查器

检测：检查 `pyproject.toml` 中 `[tool.mypy]` 或 `mypy.ini` 是否存在。
