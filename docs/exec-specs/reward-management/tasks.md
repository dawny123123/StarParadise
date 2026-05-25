# 任务列表

## Task 1: rewards 表 schema 迁移
- [ ] `star-park/server/src/database.js`

rewards 表当前缺少 description、reward_unit、redeemed_at 三列。前端 Rewards.vue 已映射 description 字段（映射结果为空字符串因为 DB 无此列），reward_unit 硬编码为"元"，兑换时间无法记录。需要在 database.js 中使用已有的 try/catch ALTER TABLE 迁移模式添加这三列。

```javascript
// 迁移：给 rewards 表添加 description 字段
try {
  db.exec(`ALTER TABLE rewards ADD COLUMN description TEXT DEFAULT ''`);
} catch (err) {
  // 如果字段已存在会报错，忽略即可
}

// 迁移：给 rewards 表添加 reward_unit 字段
try {
  db.exec(`ALTER TABLE rewards ADD COLUMN reward_unit TEXT DEFAULT '元'`);
} catch (err) {
  // 如果字段已存在会报错，忽略即可
}

// 迁移：给 rewards 表添加 redeemed_at 字段（记录兑换时间）
try {
  db.exec(`ALTER TABLE rewards ADD COLUMN redeemed_at TEXT`);
} catch (err) {
  // 如果字段已存在会报错，忽略即可
}
```

## Task 2: 后端 rewards API 完善
- [ ] `star-park/server/src/routes/rewards.js`

当前 rewards.js 仅提供基础 CRUD，存在以下问题：(1) POST 创建时不支持 description 和 reward_unit 参数；(2) PUT 更新时不支持 description、reward_unit、redeemed_at；(3) 缺少兑换端点。需要完善 POST/PUT 并新增兑换端点 POST /api/rewards/:id/redeem。

POST 创建奖励时需要接收 description 和 reward_unit 参数：

```javascript
// POST /api/rewards - 创建奖励目标
router.post('/', (req, res) => {
  try {
    const { child_id, title, target_amount, description, reward_unit } = req.body;
    if (!child_id || !title || target_amount === undefined) {
      return res.status(400).json({ error: 'child_id、title 和 target_amount 为必填项' });
    }
    const unit = reward_unit || '元';
    const desc = description || '';
    const result = db.prepare(
      'INSERT INTO rewards (child_id, title, target_amount, current_amount, description, reward_unit) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(child_id, title, target_amount, 0, desc, unit);
    const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(reward);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

PUT 更新时支持 description、reward_unit、redeemed_at：

```javascript
// PUT /api/rewards/:id - 更新奖励目标
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '奖励目标不存在' });
    }
    const { title, target_amount, current_amount, is_achieved, description, reward_unit } = req.body;
    db.prepare(
      `UPDATE rewards SET
        title = COALESCE(?, title),
        target_amount = COALESCE(?, target_amount),
        current_amount = COALESCE(?, current_amount),
        is_achieved = COALESCE(?, is_achieved),
        description = COALESCE(?, description),
        reward_unit = COALESCE(?, reward_unit)
      WHERE id = ?`
    ).run(
      title ?? null,
      target_amount ?? null,
      current_amount ?? null,
      is_achieved ?? null,
      description ?? null,
      reward_unit ?? null,
      id
    );
    const updated = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

新增兑换端点，在事务中执行余额扣减逻辑：

```javascript
// POST /api/rewards/:id/redeem - 兑换奖励（家长操作）
router.post('/:id/redeem', (req, res) => {
  try {
    const { id } = req.params;
    const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
    if (!reward) {
      return res.status(404).json({ error: '奖励目标不存在' });
    }
    if (reward.is_achieved !== 1) {
      return res.status(400).json({ error: '奖励目标尚未达成，无法兑换' });
    }
    if (reward.redeemed_at) {
      return res.status(400).json({ error: '奖励已兑换，不能重复兑换' });
    }

    const redeemAmount = reward.current_amount;
    const unit = reward.reward_unit || '元';

    const transaction = db.transaction(() => {
      if (unit === '元') {
        // 查询孩子金钱余额
        const balanceRow = db.prepare(
          `SELECT COALESCE(SUM(CASE WHEN type='earn' THEN amount ELSE 0 END), 0) -
                  COALESCE(SUM(CASE WHEN type='redeem' THEN amount ELSE 0 END), 0) as balance
           FROM transactions WHERE child_id = ?`
        ).get(reward.child_id);

        if (balanceRow.balance < redeemAmount) {
          throw new Error('余额不足，无法兑换');
        }

        // 标记兑换时间
        db.prepare('UPDATE rewards SET redeemed_at = datetime("now", "localtime") WHERE id = ?').run(id);

        // 创建 redeem 交易记录（扣减余额）
        db.prepare(
          'INSERT INTO transactions (child_id, type, amount, description) VALUES (?, ?, ?, ?)'
        ).run(reward.child_id, 'redeem', redeemAmount, `兑换奖励「${reward.title}」`);

      } else if (unit === '星星') {
        // 查询孩子积分余额
        const pointsRow = db.prepare(
          'SELECT COALESCE(SUM(amount), 0) as total_points FROM points WHERE child_id = ?'
        ).get(reward.child_id);

        // 获取 children 表的 points_balance
        const child = db.prepare('SELECT points_balance FROM children WHERE id = ?').get(reward.child_id);

        if ((child?.points_balance || 0) < redeemAmount) {
          throw new Error('积分余额不足，无法兑换');
        }

        // 标记兑换时间
        db.prepare('UPDATE rewards SET redeemed_at = datetime("now", "localtime") WHERE id = ?').run(id);

        // 扣减积分余额
        db.prepare(
          'UPDATE children SET points_balance = points_balance - ? WHERE id = ?'
        ).run(redeemAmount, reward.child_id);

        // 创建积分兑换记录
        db.prepare(
          'INSERT INTO points (child_id, amount, reason) VALUES (?, ?, ?)'
        ).run(reward.child_id, -redeemAmount, `兑换奖励「${reward.title}」`);

      } else {
        throw new Error(`不支持的奖励单位: ${unit}`);
      }

      return db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
    });

    const redeemed = transaction();
    res.json(redeemed);
  } catch (err) {
    if (err.message.includes('余额不足') || err.message.includes('积分余额不足') || err.message.includes('不支持的奖励单位')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});
```

## Task 3: 管理后台 API 客户端更新
- [ ] `star-park/pc-admin/src/api/index.js`

当前 api/index.js 中奖励部分缺少 redeemReward 函数，且 createReward 的参数传递不完整（不传 description/reward_unit）。需要新增 redeemReward 导出函数。

```javascript
// ========== 奖励相关 ==========
export const getRewards = (params) => api.get('/rewards', { params })
export const createReward = (data) => api.post('/rewards', data)
export const updateReward = (id, data) => api.put(`/rewards/${id}`, data)
export const deleteReward = (id) => api.delete(`/rewards/${id}`)
export const redeemReward = (id) => api.post(`/rewards/${id}/redeem`)
```

## Task 4: 管理后台 Rewards.vue 全面重写
- [ ] `star-park/pc-admin/src/views/Rewards.vue`

当前 Rewards.vue 功能不完整：仅有新增和删除，缺少编辑、兑换、孩子筛选、达成状态区分。description 字段映射错误（后端无此列导致始终为空），奖励单位硬编码为"元"。需要全面重写为功能完整的奖励管理页面。

Rewards.vue 重写后的核心结构：

```vue
<template>
  <div class="page-container fade-in-up">
    <div class="page-header">
      <h1 class="page-title">🎁 奖励管理</h1>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        新增奖励
      </el-button>
    </div>

    <!-- 孩子筛选 tabs -->
    <div class="child-tabs">
      <el-tag
        v-for="tab in childTabs"
        :key="tab.id"
        :type="activeChildId === tab.id ? 'primary' : ''"
        :effect="activeChildId === tab.id ? 'dark' : 'plain'"
        class="child-tab"
        @click="activeChildId = tab.id"
      >
        {{ tab.name }}
      </el-tag>
      <el-tag
        :type="activeChildId === null ? 'primary' : ''"
        :effect="activeChildId === null ? 'dark' : 'plain'"
        class="child-tab"
        @click="activeChildId = null"
      >
        全部
      </el-tag>
    </div>

    <!-- 奖励卡片网格 -->
    <div v-loading="loading" class="rewards-grid">
      <div
        v-for="reward in filteredRewards"
        :key="reward.id"
        :class="['reward-card', 'card', { 'is-achieved': reward.isAchieved, 'is-redeemed': reward.redeemedAt }]"
        :style="getCardStyle(reward)"
      >
        <!-- 已兑换灰化遮罩 -->
        <div v-if="reward.redeemedAt" class="redeemed-badge">
          <el-tag type="info" size="small">已兑换 {{ formatDate(reward.redeemedAt) }}</el-tag>
        </div>
        <!-- 已达成未兑换庆祝标识 -->
        <div v-if="reward.isAchieved && !reward.redeemedAt" class="achieved-badge">
          <el-tag type="success" size="small">🎉 已达成</el-tag>
        </div>
        <div class="reward-header">
          <span class="reward-name">{{ reward.name }}</span>
          <div class="header-actions">
            <el-tag size="small" :type="reward.childName === '老四' ? 'warning' : 'primary'">
              {{ reward.childName }}
            </el-tag>
            <el-button type="primary" size="small" text @click="openDialog(reward)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button type="danger" size="small" text @click="handleDelete(reward)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div class="reward-unit-tag">
          <el-tag size="small" :type="reward.rewardUnit === '星星' ? 'warning' : ''">
            {{ reward.rewardUnit }}
          </el-tag>
        </div>
        <div class="reward-target" v-if="reward.targetAmount">
          <span class="target-label">目标</span>
          <span class="target-value">{{ reward.targetAmount }} {{ reward.rewardUnit }}</span>
        </div>
        <div class="reward-progress" v-if="reward.targetAmount">
          <el-progress
            :percentage="getProgress(reward)"
            :stroke-width="12"
            :color="getProgressColor(reward)"
            :format="(p) => p + '%'"
          />
        </div>
        <div class="reward-current" v-if="reward.currentAmount !== undefined">
          <span class="current-label">已攒</span>
          <span class="current-value" :style="{ color: getProgressColor(reward) }">
            {{ reward.currentAmount || 0 }} {{ reward.rewardUnit }}
          </span>
        </div>
        <div class="reward-desc" v-if="reward.description">
          {{ reward.description }}
        </div>
        <!-- 兑换按钮（仅已达成且未兑换时显示） -->
        <el-button
          v-if="reward.isAchieved && !reward.redeemedAt"
          type="success"
          size="small"
          class="redeem-btn"
          @click="handleRedeem(reward)"
        >
          🎁 确认兑换
        </el-button>
      </div>

      <el-empty v-if="!loading && filteredRewards.length === 0" description="暂无奖励目标" />
    </div>

    <!-- 新增/编辑奖励对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingReward ? '编辑奖励目标' : '新增奖励目标'"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-width="90px" label-position="right">
        <el-form-item label="所属孩子" required>
          <el-select v-model="form.childId" placeholder="选择孩子" style="width: 100%;">
            <el-option v-for="child in children" :key="child.id" :label="child.name" :value="child.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="奖励名称" required>
          <el-input v-model="form.name" placeholder="如：新玩具、游乐园门票" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="奖励描述" />
        </el-form-item>
        <el-form-item label="目标金额" required>
          <el-input-number v-model="form.targetAmount" :min="1" :step="10" />
        </el-form-item>
        <el-form-item label="奖励单位">
          <el-select v-model="form.rewardUnit" style="width: 120px;">
            <el-option label="元" value="元" />
            <el-option label="星星" value="星星" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>
```

script setup 部分关键逻辑：

```javascript
const activeChildId = ref(null)
const editingReward = ref(null)

const childTabs = computed(() => store.children)

const filteredRewards = computed(() => {
  if (activeChildId.value === null) return rewards.value
  return rewards.value.filter(r => r.childId === activeChildId.value)
})

const openDialog = (reward = null) => {
  editingReward.value = reward
  if (reward) {
    form.value = {
      childId: reward.childId,
      name: reward.name,
      description: reward.description || '',
      targetAmount: reward.targetAmount,
      rewardUnit: reward.rewardUnit || '元'
    }
  } else {
    form.value = {
      childId: children.value[0]?.id || '',
      name: '',
      description: '',
      targetAmount: 50,
      rewardUnit: '元'
    }
  }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.value.name || !form.value.childId || !form.value.targetAmount) {
    ElMessage.warning('请填写必填项')
    return
  }
  submitting.value = true
  try {
    const payload = {
      child_id: form.value.childId,
      title: form.value.name,
      target_amount: form.value.targetAmount,
      description: form.value.description,
      reward_unit: form.value.rewardUnit
    }
    if (editingReward.value) {
      await updateReward(editingReward.value.id, payload)
      ElMessage.success('奖励目标更新成功')
    } else {
      await createReward(payload)
      ElMessage.success('奖励目标创建成功')
    }
    dialogVisible.value = false
    await fetchRewards()
  } catch (err) {
    ElMessage.error(editingReward.value ? '更新失败，请重试' : '创建失败，请重试')
  } finally {
    submitting.value = false
  }
}

const handleRedeem = async (reward) => {
  try {
    await ElMessageBox.confirm(
      `确认兑换奖励"${reward.name}"？将扣减${reward.childName}的${reward.currentAmount}${reward.rewardUnit}余额。`,
      '兑换确认',
      { confirmButtonText: '确认兑换', cancelButtonText: '取消', type: 'success' }
    )
    await redeemReward(reward.id)
    ElMessage.success('兑换成功！')
    await fetchRewards()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '兑换失败，请重试')
    }
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return dateStr.substring(0, 10)
}
```

fetchRewards 中字段映射需要包含新列：

```javascript
const fetchRewards = async () => {
  loading.value = true
  try {
    const data = await getRewards()
    const rawRewards = Array.isArray(data) ? data : (data.data || [])
    const childrenList = children.value
    rewards.value = rawRewards.map(r => {
      const child = childrenList.find(c => c.id === r.child_id)
      return {
        id: r.id,
        name: r.title,
        childId: r.child_id,
        childName: child?.name || '未知',
        targetAmount: r.target_amount,
        currentAmount: r.current_amount,
        rewardUnit: r.reward_unit || '元',
        isAchieved: r.is_achieved,
        redeemedAt: r.redeemed_at,
        description: r.description || ''
      }
    })
  } catch (err) {
    console.error('获取奖励失败:', err)
  } finally {
    loading.value = false
  }
}
```

CSS 新增样式：

```css
.is-achieved {
  border-color: #67C23A;
  background: linear-gradient(135deg, #f0f9eb 0%, #ffffff 100%);
}

.is-redeemed {
  opacity: 0.6;
  background: #f5f5f5;
}

.redeemed-badge {
  position: absolute;
  top: 12px;
  right: 12px;
}

.achieved-badge {
  margin-bottom: 8px;
}

.redeem-btn {
  width: 100%;
  margin-top: 8px;
}

.child-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.child-tab {
  cursor: pointer;
}

.reward-unit-tag {
  margin-bottom: 4px;
}
```

## Task 5: 小程序 API + 奖励查看页面
- [ ] `star-park/miniprogram/src/api/index.js` — (MODIFY)
- [ ] `star-park/miniprogram/src/pages/rewards/index.vue` — (NEW FILE)
- [ ] `star-park/miniprogram/src/pages.json` — (MODIFY)

小程序 api/index.js 当前仅有 getRewards 定义，缺少 createReward、deleteReward、updateReward、redeemReward（小程序暂不需兑换，但需完整的 API 定义以备后续扩展）。本次新增 createReward 和 deleteReward 供小程序端备用，核心功能是让孩子查看奖励进度。

小程序 API 补充：

```javascript
// 获取奖励记录
getRewards: (params) => request({ url: '/rewards', data: params }),

// 创建奖励目标
createReward: (data) => request({ url: '/rewards', method: 'POST', data }),

// 删除奖励目标
deleteReward: (id) => request({ url: `/rewards/${id}`, method: 'DELETE' }),
```

小程序奖励查看页面 pages/rewards/index.vue：

```vue
<template>
  <view class="page-rewards">
    <!-- 孩子选择器 -->
    <view class="child-selector">
      <view
        v-for="child in children"
        :key="child.id"
        class="child-tab"
        :class="{ 'child-tab--active': activeChildId === child.id }"
        :style="activeChildId === child.id ? { backgroundColor: child.color, borderColor: child.color } : {}"
        @tap="selectChild(child)"
      >
        <text class="child-tab__text" :class="{ 'child-tab__text--active': activeChildId === child.id }">{{ child.name }}</text>
      </view>
    </view>

    <!-- 奖励列表 -->
    <view v-if="activeRewards.length > 0" class="rewards-list">
      <view
        v-for="reward in activeRewards"
        :key="reward.id"
        :class="['reward-item', { 'reward-item--achieved': reward.isAchieved && !reward.redeemedAt, 'reward-item--redeemed': reward.redeemedAt }]"
      >
        <!-- 已兑换标识 -->
        <view v-if="reward.redeemedAt" class="redeemed-tag">
          <text class="redeemed-tag__text">已兑换 ✓</text>
        </view>
        <!-- 已达成标识 -->
        <view v-if="reward.isAchieved && !reward.redeemedAt" class="achieved-tag">
          <text class="achieved-tag__text">🎉 已达成！</text>
        </view>

        <view class="reward-item__header">
          <text class="reward-item__name">{{ reward.title }}</text>
          <text class="reward-item__unit">{{ reward.rewardUnit }}</text>
        </view>

        <view class="reward-item__progress">
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: getProgressPercent(reward) + '%', backgroundColor: activeChild?.color || '#19C8B9' }"></view>
          </view>
          <text class="progress-text">{{ reward.currentAmount || 0 }}/{{ reward.targetAmount }} {{ reward.rewardUnit }}</text>
        </view>

        <view v-if="reward.description" class="reward-item__desc">
          <text class="reward-item__desc-text">{{ reward.description }}</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!loading" class="empty">
      <text class="empty__text">暂无奖励目标</text>
    </view>

    <!-- 统计信息 -->
    <view v-if="activeChild" class="stats-card">
      <view class="stats-card__row">
        <view class="stats-card__col">
          <text class="stats-card__label">进行中</text>
          <text class="stats-card__value">{{ activeRewards.filter(r => !r.isAchieved).length }}</text>
        </view>
        <view class="stats-card__col">
          <text class="stats-card__label">已达成</text>
          <text class="stats-card__value stats-card__value--success">{{ activeRewards.filter(r => r.isAchieved && !r.redeemedAt).length }}</text>
        </view>
        <view class="stats-card__col stats-card__col--right">
          <text class="stats-card__label">已兑换</text>
          <text class="stats-card__value">{{ activeRewards.filter(r => r.redeemedAt).length }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '@/api/index.js'

const children = ref([])
const activeChildId = ref(null)
const rewards = ref([])
const loading = ref(false)

const activeChild = computed(() => children.value.find(c => c.id === activeChildId.value) || null)

const activeRewards = computed(() => {
  if (!activeChildId.value) return []
  return rewards.value.filter(r => r.child_id === activeChildId.value)
})

const getProgressPercent = (reward) => {
  if (!reward.targetAmount) return 0
  const current = reward.currentAmount || 0
  return Math.min(Math.round((current / reward.targetAmount) * 100), 100)
}

const selectChild = (child) => {
  activeChildId.value = child.id
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await api.getChildren()
    if (res && res.length) {
      children.value = res.map(c => ({
        id: c.id,
        name: c.name,
        color: c.avatar_color || ['#FF6B6B', '#4ECDC4', '#FFD93D'][c.id - 1] || '#19C8B9',
      }))
      if (!activeChildId.value && children.value.length) {
        activeChildId.value = children.value[0].id
      }
    }
    const rewardsData = await api.getRewards()
    rewards.value = Array.isArray(rewardsData) ? rewardsData : []
  } catch (err) {
    console.error('加载奖励数据失败', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => loadData())
onShow(() => loadData())
</script>
```

pages.json 中注册 rewards 页面路由：

```json
{
  "path": "pages/rewards/index",
  "style": {
    "navigationBarTitleText": "奖励目标"
  }
}
```

## 涉及文件汇总

| 操作 | 文件 |
|------|------|
| 修改 | `star-park/server/src/database.js` |
| 修改 | `star-park/server/src/routes/rewards.js` |
| 修改 | `star-park/pc-admin/src/api/index.js` |
| 修改 | `star-park/pc-admin/src/views/Rewards.vue` |
| 修改 | `star-park/miniprogram/src/api/index.js` |
| 新建 | `star-park/miniprogram/src/pages/rewards/index.vue` |
| 修改 | `star-park/miniprogram/src/pages.json` |