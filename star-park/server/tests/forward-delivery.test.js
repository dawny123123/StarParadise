// 必须在 require app 之前注入令牌：路由模块在加载时读取 process.env
process.env.QODER_FORWARD_TOKEN = 'pt-test-token';
process.env.QODER_FORWARD_IDENTITY_ID = 'idn_test';
process.env.QODER_FORWARD_TEMPLATE_ID = 'tmpl_test';

const { createAgent, seedTestData } = require('./helpers');

const SESSION_ID = 'sess_test_001';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  };
}

describe('需求自主交付 API（已配置令牌）', () => {
  let agent;

  beforeEach(() => {
    seedTestData();
    agent = createAgent();
    vi.restoreAllMocks();
  });

  describe('GET /api/forward-delivery/config', () => {
    it('应报告已配置并回显模版与 Identity，且不泄露令牌', async () => {
      const res = await agent.get('/api/forward-delivery/config');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        configured: true,
        template_id: 'tmpl_test',
        identity_id: 'idn_test'
      });
      expect(JSON.stringify(res.body)).not.toContain('pt-test-token');
    });
  });

  describe('POST /api/forward-delivery', () => {
    it('缺少 requirement 时应返回 400', async () => {
      const res = await agent.post('/api/forward-delivery').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('requirement');
    });

    it('requirement 为空白字符时应返回 400', async () => {
      const res = await agent.post('/api/forward-delivery').send({ requirement: '   ' });
      expect(res.status).toBe(400);
    });

    it('应创建 Forward 会话、投递用户消息并落库', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ id: SESSION_ID, status: 'idle' }))
        .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'evt_1', type: 'user.message' }] }));

      const res = await agent.post('/api/forward-delivery').send({ requirement: '给沉淀页加导出功能' });

      expect(res.status).toBe(201);
      expect(res.body.session_id).toBe(SESSION_ID);
      expect(res.body.status).toBe('running');
      expect(res.body.template_id).toBe('tmpl_test');
      expect(res.body.requirement).toBe('给沉淀页加导出功能');

      // 第一次调用：创建会话
      const [createUrl, createInit] = fetchMock.mock.calls[0];
      expect(createUrl).toBe('https://api.qoder.com/api/v1/forward/sessions');
      expect(createInit.method).toBe('POST');
      expect(createInit.headers.Authorization).toBe('Bearer pt-test-token');
      expect(JSON.parse(createInit.body)).toMatchObject({
        identity_id: 'idn_test',
        template_id: 'tmpl_test'
      });

      // 第二次调用：投递需求描述
      const [eventsUrl, eventsInit] = fetchMock.mock.calls[1];
      expect(eventsUrl).toBe(`https://api.qoder.com/api/v1/forward/sessions/${SESSION_ID}/events`);
      expect(JSON.parse(eventsInit.body)).toEqual({
        events: [{ type: 'user.message', content: [{ type: 'text', text: '给沉淀页加导出功能' }] }]
      });
    });

    it('应支持关联已有实践', async () => {
      const practice = await agent.post('/api/best-practices').send({ title: '被关联的实践' });
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ id: SESSION_ID, status: 'idle' }))
        .mockResolvedValueOnce(jsonResponse({ data: [] }));

      const res = await agent
        .post('/api/forward-delivery')
        .send({ requirement: '关联需求', practice_id: practice.body.id });

      expect(res.status).toBe(201);
      expect(res.body.practice_id).toBe(practice.body.id);
    });

    it('上游失败时应返回 502 并记录失败原因', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        jsonResponse({ error: { message: 'template_access_denied' } }, { ok: false, status: 403 })
      );

      const res = await agent.post('/api/forward-delivery').send({ requirement: '越权需求' });

      expect(res.status).toBe(502);
      expect(res.body.error).toContain('template_access_denied');
      expect(res.body.delivery.status).toBe('failed');

      const list = await agent.get('/api/forward-delivery');
      expect(list.body).toHaveLength(1);
      expect(list.body[0].status).toBe('failed');
      expect(list.body[0].session_id).toBeNull();
    });

    it('上游返回非 JSON 时也应给出可读错误', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => 'Bad Gateway'
      });

      const res = await agent.post('/api/forward-delivery').send({ requirement: '网关异常' });
      expect(res.status).toBe(502);
      expect(res.body.error).toContain('Bad Gateway');
    });
  });

  describe('GET /api/forward-delivery', () => {
    it('初始应返回空数组', async () => {
      const res = await agent.get('/api/forward-delivery');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/forward-delivery/:id', () => {
    async function createRunningDelivery() {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ id: SESSION_ID, status: 'idle' }))
        .mockResolvedValueOnce(jsonResponse({ data: [] }));
      const res = await agent.post('/api/forward-delivery').send({ requirement: '待刷新需求' });
      vi.restoreAllMocks();
      return res.body;
    }

    it('不存在的记录应返回 404', async () => {
      const res = await agent.get('/api/forward-delivery/9999');
      expect(res.status).toBe(404);
    });

    it('会话结束且有产出时应标记为已完成并提取文本', async () => {
      const created = await createRunningDelivery();
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ id: SESSION_ID, status: 'idle' }))
        .mockResolvedValueOnce(jsonResponse({
          data: [
            { id: 'evt_1', type: 'agent.thinking', thinking: '忽略我' },
            { id: 'evt_2', type: 'agent.message', content: [{ type: 'text', text: '需求已创建' }] },
            { id: 'evt_3', type: 'agent.message', content: [{ type: 'image' }, { type: 'text', text: '流水线已触发' }] },
            { id: 'evt_4', type: 'session.status_idle', stop_reason: 'end_turn' }
          ]
        }));

      const res = await agent.get(`/api/forward-delivery/${created.id}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
      expect(res.body.stop_reason).toBe('end_turn');
      expect(res.body.result).toBe('需求已创建\n\n流水线已触发');
    });

    it('会话仍在运行时应保持运行中状态', async () => {
      const created = await createRunningDelivery();
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ id: SESSION_ID, status: 'running' }))
        .mockResolvedValueOnce(jsonResponse({ data: [] }));

      const res = await agent.get(`/api/forward-delivery/${created.id}`);
      expect(res.body.status).toBe('running');
      expect(res.body.result).toBeNull();
    });

    it('应记录 session.error 事件', async () => {
      const created = await createRunningDelivery();
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ id: SESSION_ID, status: 'terminated' }))
        .mockResolvedValueOnce(jsonResponse({
          data: [{ id: 'evt_1', type: 'session.error', error: { code: 'runtime_failed' } }]
        }));

      const res = await agent.get(`/api/forward-delivery/${created.id}`);
      expect(res.body.status).toBe('terminated');
      expect(res.body.error).toContain('runtime_failed');
    });

    it('已到终态的记录不应再请求上游', async () => {
      const created = await createRunningDelivery();
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ id: SESSION_ID, status: 'idle' }))
        .mockResolvedValueOnce(jsonResponse({
          data: [{ id: 'evt_1', type: 'session.status_idle', stop_reason: 'end_turn' }]
        }));
      await agent.get(`/api/forward-delivery/${created.id}`);
      vi.restoreAllMocks();

      const fetchMock = vi.spyOn(global, 'fetch');
      const res = await agent.get(`/api/forward-delivery/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('刷新时上游失败应返回 502 并附带当前记录', async () => {
      const created = await createRunningDelivery();
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        jsonResponse({ error: { message: 'session_not_found' } }, { ok: false, status: 404 })
      );

      const res = await agent.get(`/api/forward-delivery/${created.id}`);
      expect(res.status).toBe(502);
      expect(res.body.error).toContain('session_not_found');
      expect(res.body.delivery.id).toBe(created.id);
    });
  });
});
