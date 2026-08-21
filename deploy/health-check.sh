#!/usr/bin/env bash
# 健康检查：轮询 /api/health 直到通过或超时
# 用法: health-check.sh [PORT] [RETRIES] [INTERVAL_SEC]
set -uo pipefail

PORT="${1:-${PORT:-3002}}"
RETRIES="${2:-30}"
INTERVAL="${3:-2}"
URL="http://127.0.0.1:${PORT}/api/health"

for i in $(seq 1 "$RETRIES"); do
  body=$(curl -fsS -m 5 "$URL" 2>/dev/null) && {
    case "$body" in
      *'"status":"ok"'*)
        echo "[health] OK (attempt ${i}/${RETRIES}): ${body}"
        exit 0
        ;;
    esac
    echo "[health] 响应异常 (attempt ${i}/${RETRIES}): ${body}"
  }
  [ "$i" -lt "$RETRIES" ] && sleep "$INTERVAL"
done

echo "[health] 失败：${URL} 在 $((RETRIES * INTERVAL))s 内未返回 status=ok" >&2
exit 1
