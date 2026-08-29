const express = require('express');
const db = require('../database');
const router = express.Router();

// Qoder Cloud Agents Forward API 配置
// 令牌只保留在服务端，前端通过本路由代理触发，避免 PAT 进入浏览器
const BASE_URL = process.env.QODER_API_BASE_URL || 'https://api.qoder.com';
const TOKEN = process.env.QODER_FORWARD_TOKEN;
const IDENTITY_ID = process.env.QODER_FORWARD_IDENTITY_ID || 'idn_40351b70be50576e0c107f17';
const TEMPLATE_ID = process.env.QODER_FORWARD_TEMPLATE_ID || 'tmpl_6aa804df653ef220a520beb2';

// Forward Session 已结束、无需再轮询的状态
const TERMINAL_STATUSES = ['completed', 'terminated', 'failed'];

async function forwardRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE_URL}/api/v1/forward${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (err) { /* v8 ignore next */
    payload = null;
  }
  if (!res.ok) {
    const message = payload?.error?.message || text || `HTTP ${res.status}`;
    const err = new Error(`Forward API ${method} ${path} 失败 (${res.status}): ${message}`);
    err.status = res.status;
    throw err;
  }
  return payload;
}

// 从 Session Events 中提取 agent 产出文本、错误与结束原因
function summarizeEvents(events) {
  const messages = [];
  let error = null;
  let stopReason = null;
  for (const event of events) {
    if (event.type === 'agent.message') {
      const text = (event.content || [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
      if (text) messages.push(text);
    } else if (event.type === 'session.error') {
      error = typeof event.error === 'string' ? event.error : JSON.stringify(event.error);
    } else if (event.type === 'session.status_idle') {
      stopReason = event.stop_reason || null;
    }
  }
  return { result: messages.join('\n\n') || null, error, stopReason };
}

function selectRow(id) {
  return db.prepare('SELECT * FROM forward_deliveries WHERE id = ?').get(id);
}

// GET /api/forward-delivery - 交付记录列表
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM forward_deliveries ORDER BY id DESC').all();
    res.json(rows);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// GET /api/forward-delivery/config - 前端用于判断入口是否可用（不返回令牌）
router.get('/config', (req, res) => {
  res.json({
    configured: Boolean(TOKEN),
    template_id: TEMPLATE_ID,
    identity_id: IDENTITY_ID
  });
});

// POST /api/forward-delivery - 以需求描述触发「需求自主交付」模版
router.post('/', async (req, res) => {
  const { requirement, title, practice_id } = req.body || {};
  if (!requirement || !String(requirement).trim()) {
    return res.status(400).json({ error: 'requirement 为必填项' });
  }
  if (!TOKEN) {
    return res.status(503).json({
      error: '未配置 QODER_FORWARD_TOKEN，无法调用 Forward API'
    });
  }

  const sessionTitle = title || `需求自主交付 - ${String(requirement).trim().slice(0, 40)}`;
  try {
    const session = await forwardRequest('/sessions', {
      method: 'POST',
      body: {
        identity_id: IDENTITY_ID,
        template_id: TEMPLATE_ID,
        title: sessionTitle,
        metadata: { source: 'star-park-best-practices' }
      }
    });

    await forwardRequest(`/sessions/${session.id}/events`, {
      method: 'POST',
      body: {
        events: [
          { type: 'user.message', content: [{ type: 'text', text: String(requirement) }] }
        ]
      }
    });

    const result = db.prepare(
      `INSERT INTO forward_deliveries (requirement, title, practice_id, template_id, session_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(String(requirement), sessionTitle, practice_id || null, TEMPLATE_ID, session.id, 'running');
    return res.status(201).json(selectRow(result.lastInsertRowid));
  } catch (err) {
    const result = db.prepare(
      `INSERT INTO forward_deliveries (requirement, title, practice_id, template_id, status, error)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(String(requirement), sessionTitle, practice_id || null, TEMPLATE_ID, 'failed', err.message);
    return res.status(502).json({ error: err.message, delivery: selectRow(result.lastInsertRowid) });
  }
});

// GET /api/forward-delivery/:id - 读取单条记录，并按需从 Forward 刷新状态与产出
router.get('/:id', async (req, res) => {
  const row = selectRow(req.params.id);
  if (!row) {
    return res.status(404).json({ error: '交付记录不存在' });
  }
  if (!row.session_id || TERMINAL_STATUSES.includes(row.status) || !TOKEN) {
    return res.json(row);
  }

  try {
    const session = await forwardRequest(`/sessions/${row.session_id}`);
    const events = await forwardRequest(
      `/sessions/${row.session_id}/events?order=asc&limit=100&include_thinking=false&include_tool_calls=false`
    );
    const { result, error, stopReason } = summarizeEvents(events?.data || []);

    // Forward 的 idle 表示当轮结束；有产出即视为交付完成
    let status = session.status;
    if (session.status === 'idle' && (result || stopReason)) {
      status = 'completed';
    }

    db.prepare(
      `UPDATE forward_deliveries SET
        status = ?, stop_reason = ?, result = COALESCE(?, result), error = COALESCE(?, error),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?`
    ).run(status, stopReason, result, error, row.id);
    return res.json(selectRow(row.id));
  } catch (err) {
    return res.status(502).json({ error: err.message, delivery: row });
  }
});

module.exports = router;
