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
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// 解析 attachments JSON 字段，兼容旧的 file_url/file_name 单附件
function parseAttachments(practice) {
  let attachments = [];
  if (practice.attachments) {
    try {
      const parsed = JSON.parse(practice.attachments);
      if (Array.isArray(parsed)) {
        attachments = parsed;
      }
    } catch (err) { /* v8 ignore next */
      // 兼容脏数据：忽略解析失败
    }
  }
  // 向后兼容：如果 attachments 为空但旧字段有值，从旧字段构造
  if (attachments.length === 0 && practice.file_url) {
    attachments = [{ file_url: practice.file_url, file_name: practice.file_name || practice.file_url }];
  }
  // 在响应中附加 attachments 数组
  const { attachments: _omit, ...rest } = practice;
  return { ...rest, attachments };
}

// GET /api/best-practices - 获取全部最佳实践（支持 ?keyword= 搜索）
router.get('/', (req, res) => {
  try {
    const { keyword } = req.query;
    let rows;
    if (keyword) {
      const like = `%${keyword}%`;
      rows = db.prepare(
        'SELECT * FROM best_practices WHERE title LIKE ? OR key_points LIKE ? ORDER BY id DESC'
      ).all(like, like);
    } else {
      rows = db.prepare('SELECT * FROM best_practices ORDER BY id DESC').all();
    }
    res.json(rows.map(parseAttachments));
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/best-practices - 创建最佳实践
router.post('/', (req, res) => {
  try {
    const { title, problem_description, key_points, file_url, file_name, attachments, notes } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title 为必填项' });
    }
    // 构造 attachments JSON 字符串（多附件支持，PONR-27），兼容旧的 file_url/file_name 单附件
    let attachmentsJson = null;
    if (Array.isArray(attachments) && attachments.length > 0) {
      attachmentsJson = JSON.stringify(attachments.map(a => ({
        file_url: a.file_url,
        file_name: a.file_name || a.file_url
      })));
    } else if (file_url) {
      attachmentsJson = JSON.stringify([{ file_url, file_name: file_name || file_url }]);
    }
    // 旧单附件字段取第一个附件，保持列表页标签兼容
    const legacyUrl = attachmentsJson ? JSON.parse(attachmentsJson)[0].file_url : null;
    const legacyName = attachmentsJson ? JSON.parse(attachmentsJson)[0].file_name : null;
    const result = db.prepare(
      `INSERT INTO best_practices (title, problem_description, key_points, file_url, file_name, attachments, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(title, problem_description || null, key_points || null, legacyUrl, legacyName, attachmentsJson, notes || null);
    const row = db.prepare('SELECT * FROM best_practices WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(parseAttachments(row));
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/best-practices/:id - 更新最佳实践
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM best_practices WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '最佳实践不存在' });
    }
    const { title, problem_description, key_points, file_url, file_name, attachments, notes } = req.body;
    db.prepare(
      `UPDATE best_practices SET
        title = COALESCE(?, title),
        problem_description = COALESCE(?, problem_description),
        key_points = COALESCE(?, key_points),
        file_url = COALESCE(?, file_url),
        file_name = COALESCE(?, file_name),
        notes = COALESCE(?, notes),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?`
    ).run(
      title ?? null,
      problem_description ?? null,
      key_points ?? null,
      file_url ?? null,
      file_name ?? null,
      notes ?? null,
      id
    );
    // attachments 数组字段（多附件支持，PONR-27）：显式传入即整体替换
    if ('attachments' in req.body) {
      const atts = req.body.attachments;
      let attachmentsJson = null;
      if (Array.isArray(atts) && atts.length > 0) {
        attachmentsJson = JSON.stringify(atts.map(a => ({
          file_url: a.file_url,
          file_name: a.file_name || a.file_url
        })));
        // 同步旧字段，保持列表页标签兼容
        db.prepare(
          `UPDATE best_practices SET file_url = ?, file_name = ? WHERE id = ?`
        ).run(atts[0].file_url, atts[0].file_name || atts[0].file_url, id);
      } else {
        // 清空附件时同步清除旧字段
        db.prepare(
          `UPDATE best_practices SET file_url = NULL, file_name = NULL WHERE id = ?`
        ).run(id);
      }
      db.prepare(`UPDATE best_practices SET attachments = ? WHERE id = ?`).run(attachmentsJson, id);
    } else if ('file_url' in req.body) {
      // 向后兼容：显式更新/清除旧单附件字段时同步 attachments（PONR-27）
      const singleUrl = req.body.file_url || null;
      const singleName = req.body.file_name || null;
      const attachmentsJson = singleUrl
        ? JSON.stringify([{ file_url: singleUrl, file_name: singleName || singleUrl }])
        : null;
      db.prepare(
        `UPDATE best_practices SET file_url = ?, file_name = ?, attachments = ? WHERE id = ?`
      ).run(singleUrl, singleName || singleUrl, attachmentsJson, id);
    }
    const updated = db.prepare('SELECT * FROM best_practices WHERE id = ?').get(id);
    res.json(parseAttachments(updated));
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/best-practices/:id - 删除最佳实践
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM best_practices WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '最佳实践不存在' });
    }
    db.prepare('DELETE FROM best_practices WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/best-practices/upload - 附件上传（支持多文件，PONR-27）
router.post('/upload', (req, res) => {
  upload.fields([{ name: 'files', maxCount: 10 }, { name: 'file', maxCount: 1 }])(req, res, err => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      // 兼容旧的单文件字段名 'file'
      const files = [...(req.files.files || []), ...(req.files.file || [])];
      if (files.length === 0) {
        return res.status(400).json({ error: '请选择要上传的文件' });
      }
      const result = files.map(f => ({
        file_url: `/uploads/${f.filename}`,
        file_name: decodeOriginalName(f.originalname)
      }));
      res.json({ files: result, file_url: result[0].file_url, file_name: result[0].file_name });
    } catch (uploadError) { /* v8 ignore next */
      res.status(400).json({ error: uploadError.message });
    }
  });
});

module.exports = router;
