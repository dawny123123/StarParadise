#!/usr/bin/env bash
# 手动回滚 star-park-server 到指定或上一个版本
# 用法: rollback.sh [RELEASE_ID]     不传则回滚到上一个可用版本
set -Eeuo pipefail

APP_NAME="star-park-server"
APP_ROOT="/opt/star-park"
RELEASES_DIR="${APP_ROOT}/releases"
CURRENT_LINK="${APP_ROOT}/current"
APP_PORT="${APP_PORT:-3002}"

log() { echo "[rollback] $*"; }
fail() { echo "[rollback][ERROR] $*" >&2; exit 1; }

CURRENT="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
TARGET_ID="${1:-}"

if [ -z "$TARGET_ID" ]; then
  TARGET="$(ls -1dt "${RELEASES_DIR}"/*/ 2>/dev/null | sed 's:/*$::' \
            | grep -vxF "$CURRENT" | head -1 || true)"
  [ -n "$TARGET" ] || fail "没有可回滚的历史版本"
else
  TARGET="${RELEASES_DIR}/${TARGET_ID}"
  [ -d "$TARGET" ] || fail "版本不存在: ${TARGET}"
fi

log "当前: ${CURRENT:-<无>}"
log "回滚目标: ${TARGET}"

ln -sfn "$TARGET" "${CURRENT_LINK}.tmp"
mv -Tf "${CURRENT_LINK}.tmp" "$CURRENT_LINK"
systemctl restart "$APP_NAME"

if bash "${TARGET}/deploy/health-check.sh" "$APP_PORT" 30 2; then
  log "回滚成功 -> $(basename "$TARGET")"
else
  echo "[rollback][CRITICAL] 回滚后健康检查失败，需人工介入" >&2
  journalctl -u "$APP_NAME" -n 50 --no-pager >&2 || true
  exit 1
fi

log "可用版本列表:"
ls -1dt "${RELEASES_DIR}"/*/ | sed 's:/*$::' | xargs -n1 basename
log "数据库备份目录: ${APP_ROOT}/backups"
