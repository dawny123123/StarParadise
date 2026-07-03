#!/usr/bin/env python3
"""Unified validation pipeline: build → lint-arch → test → verify.

This script runs all validation steps in order. Each step only runs
if the previous step passed. This is the single entry point for
"does this code work?".

Usage:
    python3 scripts/validate.py .
    python3 scripts/validate.py . --skip-verify   # Skip end-to-end verification
"""
import subprocess
import sys
import os

def run_step(name, command, cwd="."):
    """Run a validation step and return success."""
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}\n")
    result = subprocess.run(command, shell=True, cwd=cwd)
    if result.returncode != 0:
        print(f"\n✗ {name} FAILED (exit code {result.returncode})")
        return False
    print(f"\n✓ {name} PASSED")
    return True

def main():
    project_root = sys.argv[1] if len(sys.argv) > 1 else "."
    skip_verify = "--skip-verify" in sys.argv

    # Read commands from docs/DEVELOPMENT.md or Makefile
    steps = [
        ("Build", "make build"),
        ("Lint Architecture", "make lint-arch"),
        ("Test", "make test"),
    ]

    if not skip_verify and os.path.isdir(os.path.join(project_root, "scripts/verify")):
        steps.append(("Verify (end-to-end)", "make verify"))

    passed = 0
    failed = 0
    for name, cmd in steps:
        if run_step(name, cmd, cwd=project_root):
            passed += 1
        else:
            failed += 1
            print(f"\n⚠ Stopping: {name} failed. Fix this before proceeding.")
            sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  All {passed} validation steps passed ✓")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
