# End-to-End Verification Scripts

This directory contains functional verification scripts that test the
application from a user's perspective (not unit tests).

## How to Add a Scenario

1. Create a script: `verify/{scenario-name}.sh` or `verify/{scenario-name}.py`
2. The script should:
   - Start the application (or assume it's running)
   - Execute a user-visible operation
   - Verify the outcome
   - Exit 0 on success, non-zero on failure
3. Add it to the Makefile `verify` target

## Example

```bash
#!/bin/bash
# verify/health-check.sh
curl -sf http://localhost:${PORT:-8080}/health | grep -q '"status":"ok"'
```
