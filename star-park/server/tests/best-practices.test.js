const { createAgent } = require('./helpers');

describe('Best Practices API', () => {
  let agent;

  beforeEach(() => {
    agent = createAgent();
  });

  describe('GET /api/best-practices', () => {
    it('initially returns empty array', async () => {
      const res = await agent.get('/api/best-practices');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns attachments array', async () => {
      await agent.post('/api/best-practices').send({
        title: 'Practice A',
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

    it('backwards compatible: legacy single attachment data constructs attachments array', async () => {
      await agent.post('/api/best-practices').send({
        title: 'Legacy practice',
        file_url: '/uploads/legacy.pdf',
        file_name: 'legacy.pdf'
      });
      const res = await agent.get('/api/best-practices');
      expect(res.status).toBe(200);
      expect(res.body[0].attachments).toHaveLength(1);
      expect(res.body[0].attachments[0].file_url).toBe('/uploads/legacy.pdf');
      expect(res.body[0].attachments[0].file_name).toBe('legacy.pdf');
    });

    it('searches by keyword', async () => {
      await agent.post('/api/best-practices').send({ title: 'Deployment guide', key_points: 'Includes Nginx config' });
      await agent.post('/api/best-practices').send({ title: 'Review template' });
      const res = await agent.get('/api/best-practices?keyword=Deployment');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Deployment guide');
    });
  });

  describe('POST /api/best-practices', () => {
    it('creates practice with multiple attachments (PONR-27)', async () => {
      const res = await agent.post('/api/best-practices').send({
        title: 'Multi-attachment practice',
        problem_description: 'Problem description',
        key_points: 'Key points',
        attachments: [
          { file_url: '/uploads/plan.docx', file_name: 'plan.docx' },
          { file_url: '/uploads/screenshot.png', file_name: 'screenshot.png' },
          { file_url: '/uploads/reference.pdf', file_name: 'reference.pdf' }
        ],
        notes: 'Notes'
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Multi-attachment practice');
      expect(res.body.attachments).toHaveLength(3);
      expect(res.body.attachments[0].file_name).toBe('plan.docx');
      expect(res.body.attachments[1].file_url).toBe('/uploads/screenshot.png');
      expect(res.body.attachments[2].file_name).toBe('reference.pdf');
    });

    it('legacy single attachment fields sync to attachments', async () => {
      const res = await agent.post('/api/best-practices').send({
        title: 'Single attachment practice',
        file_url: '/uploads/single.pdf',
        file_name: 'single.pdf'
      });
      expect(res.status).toBe(201);
      expect(res.body.file_url).toBe('/uploads/single.pdf');
      expect(res.body.attachments).toHaveLength(1);
      expect(res.body.attachments[0].file_url).toBe('/uploads/single.pdf');
    });

    it('returns 400 when title is missing', async () => {
      const res = await agent.post('/api/best-practices').send({ key_points: 'No title' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/best-practices/:id', () => {
    it('replaces attachments array entirely', async () => {
      const created = await agent.post('/api/best-practices').send({
        title: 'Original practice',
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

    it('preserves attachments when saving without touching them (PONR-27 edit scenario)', async () => {
      const created = await agent.post('/api/best-practices').send({
        title: 'Original practice',
        attachments: [
          { file_url: '/uploads/a.pdf', file_name: 'a.pdf' },
          { file_url: '/uploads/b.pdf', file_name: 'b.pdf' }
        ]
      });
      const res = await agent.put(`/api/best-practices/${created.body.id}`).send({
        title: 'Title only change'
      });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Title only change');
      expect(res.body.attachments).toHaveLength(2);
      expect(res.body.attachments[0].file_url).toBe('/uploads/a.pdf');
    });

    it('clears all attachments when passing empty array', async () => {
      const created = await agent.post('/api/best-practices').send({
        title: 'To be cleared',
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

    it('legacy contract: explicitly clearing file_url syncs clearing attachments', async () => {
      const created = await agent.post('/api/best-practices').send({
        title: 'Legacy contract practice',
        file_url: '/uploads/old.pdf',
        file_name: 'old.pdf'
      });
      expect(created.body.attachments).toHaveLength(1);
      const res = await agent.put(`/api/best-practices/${created.body.id}`).send({ file_url: null });
      expect(res.status).toBe(200);
      expect(res.body.attachments).toHaveLength(0);
    });

    it('returns 404 for non-existent practice', async () => {
      const res = await agent.put('/api/best-practices/9999').send({ title: 'Update' });
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/best-practices/:id', () => {
    it('deletes practice successfully', async () => {
      const created = await agent.post('/api/best-practices').send({ title: 'To delete' });
      const res = await agent.delete(`/api/best-practices/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const list = await agent.get('/api/best-practices');
      expect(list.body).toHaveLength(0);
    });

    it('returns 404 for non-existent practice', async () => {
      const res = await agent.delete('/api/best-practices/9999');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/best-practices/upload', () => {
    it('supports multi-file upload (PONR-27)', async () => {
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

    it('Chinese filename displays correctly after upload', async () => {
      const res = await agent
        .post('/api/best-practices/upload')
        .attach('files', Buffer.from('plan content'), 'practice plan document.docx');
      expect(res.status).toBe(200);
      expect(res.body.files[0].file_name).toBe('practice plan document.docx');
      expect(res.body.files[0].file_url).toMatch(/\.docx$/);
    });

    it('backwards compatible with legacy single file field name', async () => {
      const res = await agent
        .post('/api/best-practices/upload')
        .attach('file', Buffer.from('single content'), 'single.txt');
      expect(res.status).toBe(200);
      expect(res.body.files).toHaveLength(1);
      expect(res.body.files[0].file_name).toBe('single.txt');
      expect(res.body.file_url).toBe(res.body.files[0].file_url);
    });

    it('returns 400 when no file uploaded', async () => {
      const res = await agent.post('/api/best-practices/upload');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/best-practices legacy filename repair (PONR-26)', () => {
    it('restores latin1-garbled file_name stored before the fix', async () => {
      const db = require('../src/database');
      const legacyName = Buffer.from('历史需求文档.pdf', 'utf8').toString('latin1');
      const result = db.prepare(
        'INSERT INTO best_practices (title, file_url, file_name) VALUES (?, ?, ?)'
      ).run('Legacy garbled practice', '/uploads/legacy.pdf', legacyName);
      const res = await agent.get('/api/best-practices');
      const item = res.body.find(i => i.id === Number(result.lastInsertRowid));
      expect(item.file_name).toBe('历史需求文档.pdf');
    });

    it('does not affect normal Chinese or English file_name', async () => {
      const db = require('../src/database');
      db.prepare(
        'INSERT INTO best_practices (title, file_url, file_name) VALUES (?, ?, ?)'
      ).run('Normal practice A', '/uploads/a.pdf', '正常文档.pdf');
      db.prepare(
        'INSERT INTO best_practices (title, file_url, file_name) VALUES (?, ?, ?)'
      ).run('Normal practice B', '/uploads/b.pdf', 'report.pdf');
      const res = await agent.get('/api/best-practices');
      const a = res.body.find(i => i.title === 'Normal practice A');
      const b = res.body.find(i => i.title === 'Normal practice B');
      expect(a.file_name).toBe('正常文档.pdf');
      expect(b.file_name).toBe('report.pdf');
    });
  });
});
