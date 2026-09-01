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

// 历史数据兼容：修复前入库的 file_name 是 latin1 乱码（如「测试」存成
// 「æµ‹è¯•」）。读取时尝试 latin1→utf8 还原。判别依据：
// - 含码点 > 0xFF 的字符 => 已是正常解码文本（中文/emoji），原样返回
// - 纯 ASCII => 英文名，原样返回
// - 其余（字符全部落在 0x80–0xFF 高位区，典型乱码形态）=> 还原，
//   还原结果含替换符则放弃保持原样
function repairLegacyFileName(name) {
  if (!name || typeof name !== 'string') return name;
  if (/[^\x00-\xFF]/.test(name)) return name;
  if (!/[^\x00-\x7F]/.test(name)) return name;
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? name : decoded;
  } catch { /* v8 ignore next */
    return name;
  }
}

// multer 配置：文件保存到 uploads/ 目录
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(decodeOriginalName(file.originalname));
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

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
    // 兼容历史乱码数据：修复前入库的中文名附件，读取时还原（PONR-26）
    for (const row of rows) {
      row.file_name = repairLegacyFileName(row.file_name);
    }
    res.json(rows);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/best-practices - 创建最佳实践
router.post('/', (req, res) => {
  try {
    const { title, problem_description, key_points, file_url, file_name, notes } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title 为必填项' });
    }
    const result = db.prepare(
      `INSERT INTO best_practices (title, problem_description, key_points, file_url, file_name, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(title, problem_description || null, key_points || null, file_url || null, file_name || null, notes || null);
    const row = db.prepare('SELECT * FROM best_practices WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/best-practices/:id - 更新最佳实践（COALESCE 模式）
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM best_practices WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '最佳实践不存在' });
    }
    const { title, problem_description, key_points, file_url, file_name, notes } = req.body;
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
    const updated = db.prepare('SELECT * FROM best_practices WHERE id = ?').get(id);
    res.json(updated);
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

// POST /api/best-practices/upload - 文件上传
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }
    const file_url = `/uploads/${req.file.filename}`;
    const file_name = decodeOriginalName(req.file.originalname);
    res.json({ file_url, file_name });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
