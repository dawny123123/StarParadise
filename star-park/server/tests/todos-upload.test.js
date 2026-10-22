const fs = require('fs');
const path = require('path');
const { createAgent, seedTestData } = require('./helpers');

function removeUploadedFile(fileUrl) {
  const filename = fileUrl.replace('/uploads/', '');
  fs.rmSync(path.join(__dirname, '..', '..', 'uploads', filename), { force: true });
}

describe('Todos Upload API', () => {
  let agent;

  beforeEach(() => {
    seedTestData();
    agent = createAgent();
  });

  it('应上传附件并返回 file_url 与 file_name', async () => {
    const res = await agent
      .post('/api/todos/upload')
      .attach('files', Buffer.from('todo attachment content'), 'todo-note.txt');
    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].file_url).toMatch(/^\/uploads\/[\d]+-[a-z0-9]+\.txt$/);
    expect(res.body.files[0].file_name).toBe('todo-note.txt');
  });

  it('中文文件名上传后不应乱码', async () => {
    const res = await agent
      .post('/api/todos/upload')
      .attach('files', Buffer.from('pptx content'), '南大交流材料准备.pptx');
    expect(res.status).toBe(200);
    expect(res.body.files[0].file_name).toBe('南大交流材料准备.pptx');
  });

  it('应支持多文件上传', async () => {
    const res = await agent
      .post('/api/todos/upload')
      .attach('files', Buffer.from('file1 content'), 'file1.txt')
      .attach('files', Buffer.from('file2 content'), 'file2.txt')
      .attach('files', Buffer.from('file3 content'), 'file3.txt');
    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(3);
    expect(res.body.files[0].file_name).toBe('file1.txt');
    expect(res.body.files[1].file_name).toBe('file2.txt');
    expect(res.body.files[2].file_name).toBe('file3.txt');
    expect(res.body.files.every(f => f.file_url.match(/^\/uploads\/[\d]+-[a-z0-9]+\.txt$/))).toBe(true);
  });

  it('未上传文件应返回 400', async () => {
    const res = await agent.post('/api/todos/upload');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('超过 100MB 的单文件应上传成功，不再限制大小（PONR-36）', async () => {
    const oversized = Buffer.alloc(100 * 1024 * 1024 + 1);
    const res = await agent
      .post('/api/todos/upload')
      .attach('files', oversized, 'big-file.bin');
    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].file_name).toBe('big-file.bin');
    removeUploadedFile(res.body.files[0].file_url);
  });

  it('单次上传超过 10 个文件应返回数量超限错误（数量限制保留）', async () => {
    let req = agent.post('/api/todos/upload');
    for (let i = 1; i <= 11; i++) {
      req = req.attach('files', Buffer.from(`file${i} content`), `file${i}.txt`);
    }
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('单次最多上传 10 个文件');
  });
});
