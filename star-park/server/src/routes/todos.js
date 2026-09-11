const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const router = express.Router();

// 确保 uploads 目录存在
const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// multer 默认以 latin1 解码 multipart 文件名，对于中文名会产生乱码，
// 因此需要转换回 utf8（浏览器发送的 filename 实际为 utf8 字节）。
function decodeOriginalName(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

// multer 配置：文件保存到 uploads/ 目录
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const originalname = decodeOriginalName(file.originalname);
    const ext = path.extname(originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});
// 单个附件文件大小上限（PONR-28：目标管理任务附件支持 100M）
const MAX_FILE_SIZE_MB = 100;
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 } });

// 解析 attachments JSON 字段，兼容旧的 file_url/file_name 单附件
function parseAttachments(todo) {
  let attachments = [];
  if (todo.attachments) {
    try {
      const parsed = JSON.parse(todo.attachments);
      if (Array.isArray(parsed)) {
        attachments = parsed;
      }
    } catch {
      // JSON 解析失败，忽略
    }
  }
  // 向后兼容：如果 attachments 为空但旧字段有值，从旧字段构造
  if (attachments.length === 0 && todo.file_url) {
    attachments = [{ file_url: todo.file_url, file_name: todo.file_name || todo.file_url }];
  }
  // 在响应中附加 attachments 数组
  const { attachments: _omit, ...rest } = todo;
  return { ...rest, attachments };
}

// GET /api/todos?child_id=x&goal_id=y&parent_id=z - 获取待办列表(可筛选)
router.get('/', (req, res) => {
  try {
    const { child_id, goal_id, parent_id } = req.query;
    const conditions = [];
    const params = [];
    if (child_id) {
      conditions.push('child_id = ?');
      params.push(child_id);
    }
    if (goal_id) {
      conditions.push('goal_id = ?');
      params.push(goal_id);
    }
    if (parent_id !== undefined) {
      if (parent_id === 'null') {
        conditions.push('parent_id IS NULL');
      } else {
        conditions.push('parent_id = ?');
        params.push(parent_id);
      }
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const todos = db.prepare(`SELECT * FROM todos${where} ORDER BY id ASC`).all(...params);
    res.json(todos.map(parseAttachments));
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/todos - 创建待办
router.post('/', (req, res) => {
  try {
    const { goal_id, child_id, title, creator, priority, expected_points, planned_date, description, completed, parent_id, file_url, file_name, attachments } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title 为必填项' });
    }
    // 父任务验证
    let resolvedChildId = child_id;
    if (parent_id) {
      const parent = db.prepare('SELECT * FROM todos WHERE id = ?').get(parent_id);
      if (!parent) {
        return res.status(400).json({ error: '父任务不存在' });
      }
      if (parent.parent_id !== null) {
        return res.status(400).json({ error: '不支持多级嵌套，子任务不能再有子任务' });
      }
      // 子任务自动继承父任务的 child_id
      resolvedChildId = parent.child_id;
    }
    // 构造 attachments JSON 字符串（多附件支持，PONR-14）
    let attachmentsJson = null;
    if (Array.isArray(attachments) && attachments.length > 0) {
      attachmentsJson = JSON.stringify(attachments.map(a => ({
        file_url: a.file_url || a.fileUrl || null,
        file_name: a.file_name || a.fileName || null
      })).filter(a => a.file_url));
    } else if (file_url) {
      // 向后兼容：旧的单附件字段
      attachmentsJson = JSON.stringify([{ file_url, file_name: file_name || file_url }]);
    }
    const result = db.prepare(
      `INSERT INTO todos (goal_id, child_id, title, creator, priority, expected_points, planned_date, description, completed, parent_id, file_url, file_name, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      goal_id ?? null,
      resolvedChildId ?? null,
      title,
      creator || null,
      priority || 'medium',
      expected_points ?? 0,
      planned_date || null,
      description || null,
      completed ? 1 : 0,
      parent_id ?? null,
      file_url || null,
      file_name || null,
      attachmentsJson
    );
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(parseAttachments(todo));
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/todos/:id - 更新待办
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '待办不存在' });
    }
    const { title, creator, priority, attachments } = req.body;
    let sql = `UPDATE todos SET
        title = COALESCE(?, title),
        creator = COALESCE(?, creator),
        priority = COALESCE(?, priority)`;
    const params = [title ?? null, creator ?? null, priority ?? null];
    // 以下字段需区分"未传"(保持原值)与"显式传 null/0"(清空或置零)，不能用 COALESCE
    const nullableFields = ['goal_id', 'child_id', 'planned_date', 'description', 'parent_id', 'file_url', 'file_name'];
    for (const field of nullableFields) {
      if (field in req.body) {
        sql += `, ${field} = ?`;
        params.push(req.body[field] ?? null);
      }
    }
    // 向后兼容：显式清除 file_url 时同步清除 attachments（PONR-14）
    if ('file_url' in req.body && !req.body.file_url && !('attachments' in req.body)) {
      sql += `, attachments = ?`;
      params.push(null);
    }
    // attachments 数组字段（多附件支持，PONR-14）
    if ('attachments' in req.body) {
      const atts = req.body.attachments;
      const attachmentsJson = Array.isArray(atts) && atts.length > 0
        ? JSON.stringify(atts.map(a => ({
            file_url: a.file_url || a.fileUrl || null,
            file_name: a.file_name || a.fileName || null
          })).filter(a => a.file_url))
        : null;
      sql += `, attachments = ?`;
      params.push(attachmentsJson);
    }
    if ('expected_points' in req.body) {
      sql += `, expected_points = ?`;
      params.push(req.body.expected_points ?? 0);
    }
    if ('completed' in req.body) {
      sql += `, completed = ?`;
      params.push(req.body.completed ? 1 : 0);
    }
    sql += ` WHERE id = ?`;
    db.prepare(sql).run(...params, id);
    const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    res.json(parseAttachments(updated));
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/:id - 删除待办（级联删除子任务）
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '待办不存在' });
    }
    // 级联删除子任务
    const childResult = db.prepare('DELETE FROM todos WHERE parent_id = ?').run(id);
    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    res.json({ message: '待办已删除', children_deleted: childResult.changes });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/todos/upload - 待办描述附件上传（支持多文件，PONR-14）
router.post('/upload', upload.array('files', 10), (req, res) => {
  try {
    // 兼容旧的单文件字段名 'file'
    let files = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }
    const result = files.map(f => ({
      file_url: `/uploads/${f.filename}`,
      file_name: decodeOriginalName(f.originalname)
    }));
    res.json({ files: result });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// multer 上传错误统一处理：超限等错误返回明确提示，不静默失败（PONR-28）
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `单个文件大小不能超过 ${MAX_FILE_SIZE_MB}MB` });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: '单次最多上传 10 个文件' });
    }
    return res.status(400).json({ error: `上传失败：${err.message}` });
  }
  next(err);
});

module.exports = router;
