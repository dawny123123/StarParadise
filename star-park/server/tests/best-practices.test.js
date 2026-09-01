const { createAgent } = require('./helpers');


// multr 以 latin1 解码 multipart 文件名，本用例验证 best-practices 上传接口
// 已按 latin1→utf8 修复中文文件名乱码（PONR-26）
describe('Best Practices API', () => {
  let agent;

  beforeEach(() => {
    agent = createAgent();
  });

  describe('POST /api/best-practices/upload', () => {
    it('中文名文件上传后 file_name 应正确显示无乱码', async () => {
      const res = await agent
        .post('/api/best-practices/upload')
        .attach('file', Buffer.from('hello'), { filename: '测试报告.docx', contentType: 'application/octet-stream' });
      expect(res.status).toBe(200);
      expect(res.body.file_name).toBe('测试报告.docx');
      // 存储文件名应保留中文原扩展名
      expect(res.body.file_url).toMatch(/\.docx$/);
    });

    it('英文名文件上传后 file_name 无回归', async () => {
      const res = await agent
        .post('/api/best-practices/upload')
        .attach('file', Buffer.from('hello'), { filename: 'report.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(200);
      expect(res.body.file_name).toBe('report.pdf');
      expect(res.body.file_url).toMatch(/\.pdf$/);
    });

    it('中文名入库后列表展示的 file_name 应无乱码', async () => {
      const upload = await agent
        .post('/api/best-practices/upload')
        .attach('file', Buffer.from('hello'), { filename: '实践总结.md', contentType: 'text/markdown' });
      const res = await agent.post('/api/best-practices').send({
        title: '乱码验证实践',
        file_url: upload.body.file_url,
        file_name: upload.body.file_name
      });
      expect(res.status).toBe(201);
      expect(res.body.file_name).toBe('实践总结.md');

      const list = await agent.get('/api/best-practices?keyword=' + encodeURIComponent('乱码验证'));
      const item = list.body.find(i => i.id === res.body.id);
      expect(item.file_name).toBe('实践总结.md');
    });

    it('未选择文件应返回 400', async () => {
      const res = await agent.post('/api/best-practices/upload');
      expect(res.status).toBe(400);
    });
  });
});
