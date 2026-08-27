#!/bin/bash
source .qoderwake/cidRR7nMraPhZpgXUOuhARMxQ%3D%3D/yx_env.sh
for i in 1 2 3 4 5 6 7 8 9 10; do
  echo "=== poll $i ==="
  date
  aliyun devops flow-get-pipeline-run --organization-id 625d2340cfea268afc2158c5 --pipeline-id 5212797 --pipeline-run-id 25 2>&1 | grep -E '"status"' | tail -5
  sleep 20
done
