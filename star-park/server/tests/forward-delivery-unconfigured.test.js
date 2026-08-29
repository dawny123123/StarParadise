// 显式清空令牌：验证未配置 Forward 凭据时入口应优雅降级而非报错
delete process.env.QODER_FORWARD_TOKEN;

const { createAgent, seedTestData } = require('./helpers');
const db = require('../src/database');

describe('需求自主交付 API（未配置令牌）', () => {
  let agent;

  beforeEach(() => {
    seedTestData();
    agent = createAgent();
  });

  it('config 应报告未配置，前端据此禁用入口', async () => {
    const res = await agent.get('/api/forward-delivery/config');
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
  });

  it('触发交付应返回 503 且不产生任何记录', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const res = await agent.post('/api/forward-delivery').send({ requirement: '任意需求' });

    expect(res.status).toBe(503);
    expect(res.body.error).toContain('QODER_FORWARD_TOKEN');
    expect(fetchMock).not.toHaveBeenCalled();

    const list = await agent.get('/api/forward-delivery');
    expect(list.body).toEqual([]);
    vi.restoreAllMocks();
  });

  it('读取已有记录时应直接返回，不请求上游', async () => {
    db.prepare(
      `INSERT INTO forward_deliveries (requirement, session_id, status) VALUES (?, ?, ?)`
    ).run('历史需求', 'sess_legacy', 'running');
    const fetchMock = vi.spyOn(global, 'fetch');

    const res = await agent.get('/api/forward-delivery/1');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('running');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
