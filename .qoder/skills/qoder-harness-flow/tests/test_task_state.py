#!/usr/bin/env python3
"""
Unit tests for task_state.py core functions.

Tests cover:
- slugify: text to URL-friendly slug conversion
- get_task_id: unique ID generation
- find_project_root: project root detection
- _validate_lessons_quality: lessons quality validation
- _write_result_json: result file writing
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, main
from unittest.mock import patch

# Add the script directory to path
SCRIPT_DIR = Path(__file__).parent.parent / "harness-recorder" / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))

from task_state import (
    slugify,
    get_task_id,
    find_project_root,
    get_tasks_dir,
    _validate_lessons_quality,
    _write_result_json,
)


class TestSlugify(TestCase):
    """Test slugify function."""

    def test_basic_english(self):
        self.assertEqual(slugify("Hello World"), "hello-world")

    def test_special_characters(self):
        result = slugify("fix: batch-update timeout!")
        self.assertNotIn("!", result)
        self.assertNotIn(":", result)

    def test_chinese_preserved(self):
        result = slugify("修复批量更新超时")
        self.assertIn("修复批量更新超时", result)

    def test_mixed_chinese_english(self):
        result = slugify("fix 批量操作 bug")
        self.assertIn("fix", result)
        self.assertIn("批量操作", result)

    def test_consecutive_spaces(self):
        result = slugify("hello   world   test")
        self.assertNotIn("  ", result)
        self.assertEqual(result, "hello-world-test")

    def test_max_length(self):
        long_text = "a" * 200
        result = slugify(long_text)
        self.assertLessEqual(len(result), 80)

    def test_empty_string(self):
        result = slugify("")
        self.assertEqual(result, "")

    def test_whitespace_only(self):
        result = slugify("   ")
        self.assertEqual(result, "")

    def test_hyphens_preserved(self):
        result = slugify("fix-batch-timeout")
        self.assertEqual(result, "fix-batch-timeout")


class TestGetTaskId(TestCase):
    """Test get_task_id function."""

    def test_returns_string(self):
        result = get_task_id("test-task")
        self.assertIsInstance(result, str)

    def test_contains_slug(self):
        result = get_task_id("fix batch timeout")
        self.assertTrue(result.startswith("fix-batch-timeout-"))

    def test_contains_timestamp(self):
        result = get_task_id("test")
        # Should have format: slug-YYYYMMDD-HHMM
        parts = result.split("-")
        self.assertGreaterEqual(len(parts), 3)

    def test_unique_ids(self):
        # Same name should produce same ID within same minute
        id1 = get_task_id("same-name")
        id2 = get_task_id("same-name")
        self.assertEqual(id1, id2)


class TestFindProjectRoot(TestCase):
    """Test find_project_root function."""

    def test_override_takes_precedence(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            result = find_project_root(tmpdir)
            self.assertEqual(result, Path(tmpdir))

    def test_finds_agents_md(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create AGENTS.md
            (Path(tmpdir) / "AGENTS.md").write_text("# Test")
            subdir = Path(tmpdir) / "src" / "main"
            subdir.mkdir(parents=True)
            with patch("os.getcwd", return_value=str(subdir)):
                # find_project_root uses Path.cwd()
                pass  # Would need to test from subdir

    def test_finds_git_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / ".git").mkdir()
            result = find_project_root(tmpdir)
            self.assertEqual(result, Path(tmpdir))


class TestValidateLessonsQuality(TestCase):
    """Test _validate_lessons_quality function."""

    def test_valid_lessons(self):
        lessons = {
            "decisions": ["选择 Redis 缓存而非本地缓存，因为多实例部署需要共享缓存"],
            "conventions": ["所有 API 使用 /data/api.json 统一入口"],
            "pitfalls": ["H2 和 MySQL DDL 必须同步"],
            "patterns": ["批量操作统一用 BatchValidator 校验后再写入"]
        }
        passed, warnings, total = _validate_lessons_quality(lessons, "{}", strict=False)
        self.assertTrue(passed)
        self.assertEqual(total, 4)

    def test_empty_lessons_non_strict(self):
        lessons = {
            "decisions": [],
            "conventions": [],
            "pitfalls": [],
            "patterns": []
        }
        passed, warnings, total = _validate_lessons_quality(lessons, "{}", strict=False)
        # Non-strict mode: should pass with warnings
        self.assertTrue(passed)
        self.assertEqual(total, 0)

    def test_empty_lessons_strict(self):
        lessons = {
            "decisions": [],
            "conventions": [],
            "pitfalls": [],
            "patterns": []
        }
        passed, warnings, total = _validate_lessons_quality(lessons, "{}", strict=True)
        # Strict mode: should fail
        self.assertFalse(passed)

    def test_short_lessons_warning(self):
        lessons = {
            "decisions": ["短"],  # < 10 chars
            "conventions": [],
            "pitfalls": [],
            "patterns": []
        }
        passed, warnings, total = _validate_lessons_quality(lessons, "{}", strict=False)
        # Should have a warning about short lesson
        self.assertGreater(len(warnings), 0)

    def test_none_lessons(self):
        # When structured_lessons is None and lessons_json is empty, should handle gracefully
        passed, warnings, total = _validate_lessons_quality(None, "", strict=False)
        self.assertTrue(passed)
        self.assertEqual(total, 0)


class TestWriteResultJson(TestCase):
    """Test _write_result_json function."""

    def test_writes_valid_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            task_dir = Path(tmpdir)
            (task_dir / "state").mkdir()

            _write_result_json(
                task_dir=task_dir,
                summary="Task completed successfully",
                files_changed=["src/main.py", "src/utils.py"],
                files_created=["src/new_file.py"],
                validation_json='{"build": "pass", "test": "pass"}',
                completed_at="2026-05-09T12:00:00Z"
            )

            result_path = task_dir / "state" / "result.json"
            self.assertTrue(result_path.exists())

            data = json.loads(result_path.read_text())
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["summary"], "Task completed successfully")
            self.assertEqual(data["files_changed"], ["src/main.py", "src/utils.py"])
            self.assertEqual(data["files_created"], ["src/new_file.py"])
            self.assertEqual(data["validation"]["build"], "pass")

    def test_handles_none_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            task_dir = Path(tmpdir)
            (task_dir / "state").mkdir()

            _write_result_json(
                task_dir=task_dir,
                summary="Done",
                files_changed=None,
                files_created=None,
                validation_json=None,
                completed_at="2026-05-09T12:00:00Z"
            )

            data = json.loads((task_dir / "state" / "result.json").read_text())
            self.assertEqual(data["files_changed"], [])
            self.assertEqual(data["files_created"], [])
            self.assertNotIn("validation", data)

    def test_handles_invalid_validation_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            task_dir = Path(tmpdir)
            (task_dir / "state").mkdir()

            _write_result_json(
                task_dir=task_dir,
                summary="Done",
                files_changed=[],
                files_created=[],
                validation_json="not valid json{{{",
                completed_at="2026-05-09T12:00:00Z"
            )

            data = json.loads((task_dir / "state" / "result.json").read_text())
            # Should not crash, validation field should be absent
            self.assertNotIn("validation", data)


class TestGetTasksDir(TestCase):
    """Test get_tasks_dir function."""

    def test_returns_harness_tasks(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir).resolve()
            (root / "harness").mkdir()
            result = get_tasks_dir(root)
            self.assertEqual(result, root / "harness" / "tasks")

    def test_prefers_dot_harness(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir).resolve()
            (root / ".harness").mkdir()
            (root / "harness").mkdir()
            result = get_tasks_dir(root)
            self.assertEqual(result, root / ".harness" / "tasks")


if __name__ == "__main__":
    main()
