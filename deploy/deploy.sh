#!/usr/bin/env bash
# star-park 主机部署脚本（由云效 Flow「主机部署」在目标 ECS 上以 root 执行）
#
# 前置：Flow 已将制品包下载到 ${PACKAGE_PATH}
# 特性：版本目录 + current 原子软链 + SQLite 持久化/备份 + 健康检查 + 失败自动回滚
#
# 环境变量：
#   BUILD_NUMBER   版本号（Flow 注入；缺省用时间戳）
#   APP_PORT       监听端口，默认 3002（3001 已被无关线上应用 game-guess 占用，勿改回）
#   PACKAGE_PATH   制品包路径，默认 /opt/star-park/package.tgz
set -Eeuo pipefail

APP_NAME="star-park-server"
APP_ROOT="/opt/star-park"
APP_PORT="${APP_PORT:-3002}"
PACKAGE_PATH="${PACKAGE_PATH:-${APP_ROOT}/package.tgz}"
RELEASE_ID="${BUILD_NUMBER:-$(date +%Y%m%d%H%M%S)}"

RELEASES_DIR="${APP_ROOT}/releases"
SHARED_DIR="${APP_ROOT}/shared"
BACKUP_DIR="${APP_ROOT}/backups"
CURRENT_LINK="${APP_ROOT}/current"
RELEASE_DIR="${RELEASES_DIR}/${RELEASE_ID}"
ENV_FILE="${SHARED_DIR}/star-park.env"
LOG_DIR="/var/log/star-park"
KEEP_RELEASES=5

log() { echo "[deploy][$(date +%H:%M:%S)] $*"; }
fail() { echo "[deploy][ERROR] $*" >&2; exit 1; }

PREVIOUS_RELEASE=""
[ -L "$CURRENT_LINK" ] && PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK" || true)"

rollback() {
  echo "[deploy][ERROR] 部署失败，开始回滚" >&2
  if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
    ln -sfn "$PREVIOUS_RELEASE" "${CURRENT_LINK}.tmp"
    mv -Tf "${CURRENT_LINK}.tmp" "$CURRENT_LINK"
    systemctl restart "$APP_NAME" || true
    if bash "${PREVIOUS_RELEASE}/deploy/health-check.sh" "$APP_PORT" 20 2; then
      echo "[deploy] 已回滚到 ${PREVIOUS_RELEASE} 并通过健康检查" >&2
    else
      echo "[deploy][CRITICAL] 回滚后健康检查仍失败，需人工介入" >&2
      journalctl -u "$APP_NAME" -n 50 --no-pager >&2 || true
    fi
  else
    echo "[deploy] 无历史版本可回滚（首次部署），停止服务避免半上线状态" >&2
    systemctl stop "$APP_NAME" || true
  fi
  rm -rf "$RELEASE_DIR"
  exit 1
}

# ---------- 0. 端口占用守卫：绝不抢占无关线上应用 ----------
guard_port() {
  local holder
  holder="$(ss -ltnpH "sport = :${APP_PORT}" 2>/dev/null | head -1 || true)"
  [ -z "$holder" ] && return 0
  if echo "$holder" | grep -q "$APP_NAME\|node.*src/index.js"; then
    log "端口 ${APP_PORT} 由本服务持有，继续"
    return 0
  fi
  systemctl is-active --quiet "$APP_NAME" && return 0
  fail "端口 ${APP_PORT} 被无关进程占用，拒绝部署以免影响线上服务: ${holder}"
}

log "=== 部署 ${APP_NAME} release=${RELEASE_ID} port=${APP_PORT} ==="
guard_port

# ---------- 1. 目录准备 ----------
mkdir -p "$RELEASES_DIR" "$SHARED_DIR/data" "$SHARED_DIR/uploads" "$BACKUP_DIR" "$LOG_DIR"

# ---------- 2. SQLite 备份（部署前必做） ----------
DB_FILE="${SHARED_DIR}/data/star-park.db"
if [ -f "$DB_FILE" ]; then
  BACKUP_FILE="${BACKUP_DIR}/star-park.db.${RELEASE_ID}"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_FILE" ".backup '${BACKUP_FILE}'" || cp -f "$DB_FILE" "$BACKUP_FILE"
  else
    cp -f "$DB_FILE" "$BACKUP_FILE"
  fi
  log "已备份数据库 -> ${BACKUP_FILE}"
  ls -1t "${BACKUP_DIR}"/star-park.db.* 2>/dev/null | tail -n +11 | xargs -r rm -f
else
  log "首次部署，无既有数据库"
fi

# ---------- 3. 解包（自适应归档布局：server/ 可能在根，也可能嵌套一层） ----------
[ -f "$PACKAGE_PATH" ] || fail "制品包不存在: ${PACKAGE_PATH}"
UNPACK_DIR="$(mktemp -d "${APP_ROOT}/.unpack.XXXXXX")"
trap 'rm -rf "$UNPACK_DIR"' EXIT
tar -xzf "$PACKAGE_PATH" -C "$UNPACK_DIR"

PKG_MANIFEST="$(find "$UNPACK_DIR" -maxdepth 3 -type f -path '*/server/package.json' -print -quit)"
[ -n "$PKG_MANIFEST" ] || fail "制品包结构异常：未找到 server/package.json"
PKG_ROOT="$(cd "$(dirname "$PKG_MANIFEST")/.." && pwd)"
[ -d "${PKG_ROOT}/server" ] || fail "制品包结构异常：${PKG_ROOT} 下缺少 server/"
[ -f "${PKG_ROOT}/deploy/${APP_NAME}.service" ] \
  || fail "制品包结构异常：缺少 deploy/${APP_NAME}.service"

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
cp -a "${PKG_ROOT}/." "$RELEASE_DIR/"
log "解包完成（制品根 ${PKG_ROOT#$UNPACK_DIR/}） -> ${RELEASE_DIR}"

trap rollback ERR

# ---------- 4. 数据与上传目录软链到 shared（版本切换不丢数据） ----------
rm -rf "${RELEASE_DIR}/server/data" "${RELEASE_DIR}/uploads"
ln -sfn "${SHARED_DIR}/data" "${RELEASE_DIR}/server/data"
ln -sfn "${SHARED_DIR}/uploads" "${RELEASE_DIR}/uploads"

# ---------- 5. 安装生产依赖 ----------
# 目标机没有 g++，better-sqlite3 一旦回退源码编译必然失败，
# 因此失败时改用预编译产物（ABI 与 CI 构建机一致，均为 Node 20 / ABI 115）。
log "安装生产依赖..."
cd "${RELEASE_DIR}/server"

BS3_MIRROR="https://registry.npmmirror.com/-/binary/better-sqlite3"

install_bs3_prebuild() {
  local abi bsv url
  abi="$(node -p 'process.versions.modules')"
  bsv="$(node -p "require('./node_modules/better-sqlite3/package.json').version")"
  url="${BS3_MIRROR}/v${bsv}/better-sqlite3-v${bsv}-node-v${abi}-linux-x64.tar.gz"
  log "获取 better-sqlite3 预编译产物: ${url}"
  curl -fsSL --retry 3 --retry-delay 2 -o "${UNPACK_DIR}/bs3.tar.gz" "$url" \
    || fail "预编译产物下载失败，且目标机无编译工具链: ${url}"
  tar -xzf "${UNPACK_DIR}/bs3.tar.gz" -C node_modules/better-sqlite3
}

if ! npm ci --omit=dev --no-audit --no-fund; then
  log "npm ci 失败（大概率为原生模块编译），改用 --ignore-scripts + 预编译产物"
  rm -rf node_modules
  npm ci --omit=dev --no-audit --no-fund --ignore-scripts
  install_bs3_prebuild
fi
node -e "require('better-sqlite3'); console.log('better-sqlite3 原生模块加载 OK')" \
  || fail "better-sqlite3 无法加载，中止部署"

# ---------- 6. 环境变量文件（首次生成，后续保留人工修改） ----------
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'ENVEOF'
NODE_ENV=production
PORT=3002
STATIC_DIR=/opt/star-park/current/pc-admin
# ── Qoder 需求自主交付（ForwardDelivery）──────────────────────────
# 配置后「需求自主交付」按钮将可用；留空则按钮显示为灰色不可点击。
# 获取途径：Qoder 控制台 → 个人设置 → Personal Access Token
QODER_FORWARD_TOKEN=
# 以下两项有内置默认值，通常无需修改
# QODER_FORWARD_IDENTITY_ID=idn_40351b70be50576e0c107f17
# QODER_FORWARD_TEMPLATE_ID=tmpl_6aa804df653ef220a520beb2
ENVEOF
  # 用实际端口替换占位符
  sed -i "s/^PORT=.*/PORT=${APP_PORT}/" "$ENV_FILE"
  sed -i "s|^STATIC_DIR=.*|STATIC_DIR=${CURRENT_LINK}/pc-admin|" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  log "已生成 ${ENV_FILE}"
  log "⚠️  QODER_FORWARD_TOKEN 未配置 — 请编辑 ${ENV_FILE} 填入 Token 后重启服务，否则「需求自主交付」按钮将保持灰色不可用"
else
  log "复用既有 ${ENV_FILE}"
fi
# 检查关键 Token 是否已配置（非阻断，仅提醒）
if ! grep -q "^QODER_FORWARD_TOKEN=.\+" "$ENV_FILE" 2>/dev/null; then
  log "⚠️  WARNING: ${ENV_FILE} 中 QODER_FORWARD_TOKEN 为空，「需求自主交付」功能将不可用"
fi

# ---------- 7. 安装 systemd unit ----------
install -m 644 "${RELEASE_DIR}/deploy/${APP_NAME}.service" "/etc/systemd/system/${APP_NAME}.service"
systemctl daemon-reload
systemctl enable "$APP_NAME" >/dev/null 2>&1 || true

# ---------- 8. 原子切换 current ----------
ln -sfn "$RELEASE_DIR" "${CURRENT_LINK}.tmp"
mv -Tf "${CURRENT_LINK}.tmp" "$CURRENT_LINK"
log "current -> ${RELEASE_DIR}"

# ---------- 9. 重启并健康检查 ----------
systemctl restart "$APP_NAME"
bash "${RELEASE_DIR}/deploy/health-check.sh" "$APP_PORT" 30 2

trap - ERR

# ---------- 10. 清理旧版本 ----------
ls -1dt "${RELEASES_DIR}"/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
log "=== 部署成功 release=${RELEASE_ID} http://127.0.0.1:${APP_PORT}/api/health ==="
