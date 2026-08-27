#!/bin/bash
source .qoderwake/cidRR7nMraPhZpgXUOuhARMxQ%3D%3D/yx_env.sh
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  echo "=== poll $i ==="
  date
  OUT=$(aliyun devops flow-get-pipeline-run --organization-id 625d2340cfea268afc2158c5 --pipeline-id 5212797 --pipeline-run-id 25 2>&1)
  echo "$OUT" | grep -E '"status"' | tail -5
  OVERALL=$(echo "$OUT" | grep '"status":' | tail -1 | tr -d ' ",')
  echo "overall raw: $OVERALL"
  if echo "$OVERALL" | grep -E 'SUCCESS|FAILED|ABORTED' > /dev/null; then
    echo "Final detected: $OVERALL"
    break
  fi
  sleep 20
done
