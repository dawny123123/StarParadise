const { createAgent } = require('./helpers');

describe('Best Practices API', () => {
  let agent;

  beforeEach(() => {
    agent = createAgent();
  });

  describe('GET /api/best-practices', () => {
    it('初始应返回空数组', async () => {
      const res = await agent.get('/api/best-practices');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('应返回 attachments 数组', async () => {
      await agent.post('/api/best-practices').send({
        title: '实践A',
        attachments: [
          { file_url: '/uploads/a.pdf', file_name: 'a.pdf' },
          { file_url: '/uploads/b.png', file_name: 'b.png' }
        ]
      });
      const res = await agent.get('/api/best-practices');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].attachments).toHaveLength(2);
      expect(res.body[0].attachments[0].file_url).toBe('/uploads/a.pdf');
      expect(res.body[0].attachments[1].file_name).toBe('b.png');
    });

    it('旧单附件数据应兼容构造 attachments（向后兼容）', async () => {
      // 直接按旧契约创建（仅 file_url/file_name）
      await agent.post('/api/best-practices').send({
        title: '旧实践',
        file_url: '/uploads/legacy.pdf',
        file_name: 'legacy.pdf'
      });
      const res = await agent.get('/api/best-practices');
      expect(res.status).toBe(200);
      expect(res.body[0].attachments).toHaveLength(1);
      expect(res.body[0].attachments[0].file_url).toBe('/uploads/legacy.pdf');
      expect(res.body[0].attachments[0].file_name).toBe('legacy.pdf');
    });

    it('应按 keyword 搜索', async () => {
      await agent.post('/api/best-practices').send({ title: '部署手册', key_points: '含 Nginx 配置' });
      await agent.post('/api/best-practices').send({ title: '复盘模板' });
      const res = await agent.get('/api/best-practices?keyword=部署');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('部署手册');
    });
  });

  describe('POST /api/best-practices', () => {
    it('应成功创建含多个附件的实践（PONR-27）', async () => {
      const res = await agent.post('/api/best-practices').send({
        title: '多附件实践',
        problem_description: '问题描述',
        key_points: '关键点',
        attachments: [
          { file_url: '/uploads/方案.docx', file_name: '方案.docx' },
          { file_url: '/uploads/截图.png', file_name: '截图.png' },
          { file_url: '/uploads/参考材料.pdf', file_name: '参考材料.pdf' }
        ],
        notes: '备注'
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('多附件实践');
      expect(res.body.attachments).toHaveLength(3);
      expect(res.body.attachments[0].file_name).toBe('方案.docx');
      expect(res.body.attachments[1].file_url).toBe('/uploads/截图.png');
      expect(res.body.attachments[2].file_name).toBe('参考材料.pdf');
    });

    it('旧单附件字段创建时应同步写入 attachments', async () => {
      const res = await agent.post('/api/best-practices').send({
        title: '单附件实践',
        file_url: '/uploads/single.pdf',
        file_name: 'single.pdf'
      });
      expect(res.status).toBe(201);
      expect(res.body.file_url).toBe('/uploads/single.pdf');
      expect(res.body.attachments).toHaveLength(1);
      expect(res.body.attachments[0].file_url).toBe('/uploads/single.pdf');
    });

    it('缺少 title 应返回 400', async () => {
      const res = await agent.post('/api/best-practices').send({ key_points: '无标题' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/best-practices/:id', () => {
    it('应整体替换 attachments 数组', async () => {
      const created = await agent.post('/api/best-practices').send({
        title: '原实践',
        attachments: [
          { file_url: '/uploads/a.pdf', file_name: 'a.pdf' },
          { file_url: '/uploads/b.pdf', file_name: 'b.pdf' }
        ]
      });
      const res = await agent.put(`/api/best-practices/${created.body.id}`).send({
        attachments: [{ file_url: '/uploads/c.pdf', file_name: 'c.pdf' }]
      });
      expect(res.status).toBe(200);
      expect(res.body.attachments).toHaveLength(1);
      expect(res.body.attachments[0].file_url).toBe('/uploads/c.pdf');
    });

    it('不改动附件直接保存应保持附件不变（PONR-27 编辑场景）', async () => {
      const created = await agent.post('/api/best-practices').send({
        title: '原实践',
        attachments: [
          { file_url: '/uploads/a.pdf', file_name: 'a.pdf' },
          { file_url: '/uploads/b.pdf', file_name: 'b.pdf' }
        ]
      });
      const res = await agent.put(`/api/best-practices/${created.body.id}`).send({
        title: '只改标题'
      });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('只改标题');
      expect(res.body.attachments).toHaveLength(2);
      expect(res.body.attachments[0].file_url).toBe('/uploads/a.pdf');
    });

    it('显式传空 attachments 数组应清除全部附件', async () => {
      const created = await agent.post('/api/best-practices').send({
        title: '待清除',
        attachments: [
          { file_url: '/uploads/a.pdf', file_name: 'a.pdf' },
          { file_url: '/uploads/b.pdf', file_name: 'b.pdf' }
        ]
      });
      expect(created.body.attachments).toHaveLength(2);
      const res = await agent.put(`/api/best-practices/${created.body.id}`).send({ attachments: [] });
      expect(res.status).toBe(200);
      expect(res.body.attachments).toHaveLength(0);
      expect(res.body.file_url).toBeNull();
    });

    it('旧契约显式清除 file_url 应同步清空 attachments', async () => {
      const created = await agent.post('/api/best-practices').send({
        title: '旧契约实践',
        file_url: '/uploads/old.pdf',
        file_name: 'old.pdf'
      });
      expect(created.body.attachments).toHaveLength(1);
      const res = await agent.put(`/api/best-practices/${created.body.id}`).send({ file_url: null });
      expect(res.status).toBe(200);
      expect(res.body.attachments).toHaveLength(0);
    });

    it('不存在的实践应返回 404', async () => {
      const res = await agent.put('/api/best-practices/9999').send({ title: '更新' });
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/best-practices/:id', () => {
    it('应成功删除实践', async () => {
      const created = await agent.post('/api/best-practices').send({ title: '待删除' });
      const res = await agent.delete(`/api/best-practices/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const list = await agent.get('/api/best-practices');
      expect(list.body).toHaveLength(0);
    });

    it('不存在的实践应返回 404', async () => {
      const res = await agent.delete('/api/best-practices/9999');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/best-practices/upload', () => {
    it('应支持多文件上传（PONR-27）', async () => {
      const res = await agent
        .post('/api/best-practices/upload')
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

    it('中文文件名上传后不应乱码', async () => {
      const res = await agent
        .post('/api/best-practices/upload')
        .attach('files', Buffer.from('方案内容'), '实践方案文档.docx');
      expect(res.status).toBe(200);
      expect(res.body.files[0].file_name).toBe('实践方案文档.docx');
      expect(res.body.files[0].file_url).toMatch(/\.docx$/);
    });

    it('兼容旧的单文件字段名 file', async () => {
      const res = await agent
        .post('/api/best-practices/upload')
        .attach('file', Buffer.from('single content'), 'single.txt');
      expect(res.status).toBe(200);
      expect(res.body.files).toHaveLength(1);
      expect(res.body.files[0].file_name).toBe('single.txt');
      expect(res.body.file_url).toBe(res.body.files[0].file_url);
    });

    it('未上传文件应返回 400', async () => {
      const res = await agent.post('/api/best-practices/upload');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
