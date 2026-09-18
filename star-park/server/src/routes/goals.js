const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function decodeOriginalName(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const originalname = decodeOriginalName(file.originalname);
    const ext = path.extname(originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const upload = multer({ storage, limits: { files: 10 } });

function serializeAttachments(attachments) {
  if (!Array.isArray(attachments)) return null;
  const normalized = attachments.map(attachment => ({
    file_url: attachment.file_url || attachment.fileUrl || null,
    file_name: attachment.file_name || attachment.fileName || null
  })).filter(attachment => attachment.file_url);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

function parseAttachments(goal) {
  let attachments = [];
  if (goal.attachments) {
    try {
      const parsed = JSON.parse(goal.attachments);
      if (Array.isArray(parsed)) attachments = parsed;
    } catch {
      attachments = [];
    }
  }
  const { attachments: _omit, ...rest } = goal;
  return { ...rest, attachments };
}

// GET /api/goals?child_id=x - 获取目标列表(可按孩子筛选)
router.get('/', (req, res) => {
  try {
    const { child_id } = req.query;
    const goals = child_id
      ? db.prepare('SELECT * FROM goals WHERE child_id = ? ORDER BY id ASC').all(child_id)
      : db.prepare('SELECT * FROM goals ORDER BY id ASC').all();
    res.json(goals.map(parseAttachments));
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals - 创建目标
router.post('/', (req, res) => {
  try {
    const { child_id, title, status, progress, target, description, attachments } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title 为必填项' });
    }
    const result = db.prepare(
      'INSERT INTO goals (child_id, title, status, progress, target, description, attachments) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      child_id ?? null,
      title,
      status || 'todo',
      progress ?? 0,
      target ?? 1,
      description ?? '',
      serializeAttachments(attachments)
    );
    const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(parseAttachments(goal));
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals/upload - 目标描述附件上传（最多10个文件，不设单文件业务大小限制）
router.post('/upload', upload.array('files', 10), (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }
    res.json({
      files: files.map(file => ({
        file_url: `/uploads/${file.filename}`,
        file_name: decodeOriginalName(file.originalname)
      }))
    });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/goals/:id - 更新目标
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '目标不存在' });
    }
    const { child_id, title, status, progress, target, description } = req.body;
    let sql = `UPDATE goals SET
        title = COALESCE(?, title),
        status = COALESCE(?, status),
        progress = COALESCE(?, progress),
        target = COALESCE(?, target),
        description = COALESCE(?, description)`;
    const params = [title ?? null, status ?? null, progress ?? null, target ?? null, description ?? null];
    if ('child_id' in req.body) {
      sql += ', child_id = ?';
      params.push(child_id ?? null);
    }
    if ('attachments' in req.body) {
      sql += ', attachments = ?';
      params.push(serializeAttachments(req.body.attachments));
    }
    sql += ' WHERE id = ?';
    db.prepare(sql).run(...params, id);
    const updated = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    res.json(parseAttachments(updated));
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/goals/:id - 删除目标(同时解除待办的关联)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '目标不存在' });
    }
    const deleteTransaction = db.transaction(() => {
      db.prepare('UPDATE todos SET goal_id = NULL WHERE goal_id = ?').run(id);
      db.prepare('DELETE FROM goals WHERE id = ?').run(id);
    });
    deleteTransaction();
    res.json({ message: '目标已删除' });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: '单次最多上传 10 个文件' });
    }
    return res.status(400).json({ error: `上传失败：${err.message}` });
  }
  next(err);
});

module.exports = router;
