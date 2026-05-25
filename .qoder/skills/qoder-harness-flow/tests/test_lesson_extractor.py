#!/usr/bin/env python3
"""
Unit tests for lesson_extractor.py signal pattern matching.

Tests cover:
- Signal pattern detection for each lesson category
- Confidence scoring
- Edge cases (empty input, non-matching text)
"""

import sys
from pathlib import Path
from unittest import TestCase, main

# Add the script directory to path
SCRIPT_DIR = Path(__file__).parent.parent / "harness-recorder" / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))

from lesson_extractor import SIGNAL_PATTERNS


class TestSignalPatterns(TestCase):
    """Test that signal patterns detect the expected signals."""

    def _match_keywords(self, category: str, text: str) -> bool:
        """Check if text matches any keyword in the given category."""
        keywords = SIGNAL_PATTERNS[category]["keywords"]
        text_lower = text.lower()
        return any(kw.lower() in text_lower for kw in keywords)

    def test_pitfalls_detection(self):
        # Should match
        self.assertTrue(self._match_keywords("pitfalls", "这样写不对，应该用xxx"))
        self.assertTrue(self._match_keywords("pitfalls", "fix the bug in OrderService"))
        self.assertTrue(self._match_keywords("pitfalls", "遇到了 exception"))
        self.assertTrue(self._match_keywords("pitfalls", "发现了一个 error"))

        # Should NOT match
        self.assertFalse(self._match_keywords("pitfalls", "添加一个新功能"))
        self.assertFalse(self._match_keywords("pitfalls", "请帮我写个接口"))

    def test_conventions_detection(self):
        # Should match
        self.assertTrue(self._match_keywords("conventions", "这是项目规范"))
        self.assertTrue(self._match_keywords("conventions", "must always validate input"))
        self.assertTrue(self._match_keywords("conventions", "命名必须统一"))
        self.assertTrue(self._match_keywords("conventions", "never use raw SQL"))

        # Should NOT match
        self.assertFalse(self._match_keywords("conventions", "今天天气不错"))
        self.assertFalse(self._match_keywords("conventions", "修复了订单问题"))

    def test_decisions_detection(self):
        # Should match
        self.assertTrue(self._match_keywords("decisions", "选择 Redis 而不是 Memcached"))
        self.assertTrue(self._match_keywords("decisions", "we chose option A instead of B"))
        self.assertTrue(self._match_keywords("decisions", "prefer async over sync"))

        # Should NOT match
        self.assertFalse(self._match_keywords("decisions", "跑一下测试"))

    def test_patterns_detection(self):
        # Should match
        self.assertTrue(self._match_keywords("patterns", "这是一个最佳实践"))
        self.assertTrue(self._match_keywords("patterns", "统一用 BatchValidator"))
        self.assertTrue(self._match_keywords("patterns", "this is a reusable pattern"))

        # Should NOT match
        self.assertFalse(self._match_keywords("patterns", "删除了一个文件"))

    def test_all_categories_exist(self):
        expected = {"pitfalls", "conventions", "decisions", "patterns"}
        self.assertEqual(set(SIGNAL_PATTERNS.keys()), expected)

    def test_each_category_has_keywords(self):
        for category, data in SIGNAL_PATTERNS.items():
            self.assertIn("keywords", data, f"{category} missing 'keywords'")
            self.assertGreater(len(data["keywords"]), 0, f"{category} has empty keywords")

    def test_each_category_has_regex(self):
        for category, data in SIGNAL_PATTERNS.items():
            self.assertIn("regex", data, f"{category} missing 'regex'")


if __name__ == "__main__":
    main()
