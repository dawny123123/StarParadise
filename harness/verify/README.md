# Harness Verify

End-to-end verification scenarios for the project.

## Adding Verification Scenarios

1. Create a shell script in this directory (e.g., `health-check.sh`)
2. The script should exit 0 on success, non-zero on failure
3. Run all scenarios: `make verify`

## Convention

- Each script is self-contained (no external dependencies beyond the project)
- Scripts are idempotent (safe to run multiple times)
- Scripts clean up after themselves
