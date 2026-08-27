# 仪表盘红花发放明细弹窗设计

## 背景

PC 管理后台的仪表盘（`Dashboard.vue`）通过 `ChildCard.vue` 展示每个成员的红花余额，但当前该数字为只读展示，无法查看红花的发放与扣减历史。运营者（家长）需要快速回顾某成员的红花来源与用途。

## 目标

在 PC 管理后台仪表盘上，点击任意成员卡片中的红花余额，弹出该成员的红花发放明细记录弹窗。

## 范围

- **前端**：`star-park/pc-admin`
- **后端**：复用已有 `GET /api/flowers?child_id=X`，无需新增接口或改表结构
- **平台**：仅 PC 管理后台；小程序暂不需要

## 设计

### 交互流程

1. 用户在仪表盘看到每个孩子的 `ChildCard`。
2. 点击卡片中的红花数字（或红花整行），触发 `openFlowerDetailModal(child)`。
3. 弹出 `el-dialog` 标题为「{childName} 的红花记录」。
4. 弹窗内展示 `el-table`：
   - 时间：`created_at` 格式化为 `YYYY-MM-DD HH:mm`
   - 数量：正数显示 `+N`，负数显示 `-N`；正数绿色，负数红色
   - 说明：`reason`，超长用 `show-overflow-tooltip`
5. 列表为空时展示 `empty-text="暂无红花记录"`。
6. 关闭弹窗后回到仪表盘，状态清空。

### 数据流

```
ChildCard.vue 点击 flowers_balance
  → emit('show-flowers', child)
  → Dashboard.vue 打开 dialog，调用 getFlowers({ child_id: child.id })
  → GET /api/flowers?child_id=X
  → 后端查询 flowers 表，返回 { records, balance }
  → Dashboard.vue 渲染表格
```

### API 复用

已有接口 `GET /api/flowers?child_id=X` 返回：

```json
{
  "records": [
    {
      "id": 1,
      "child_id": 1,
      "child_name": "Alice",
      "amount": 5,
      "reason": "特殊红花奖励",
      "created_at": "2026-08-27 10:30:00"
    }
  ],
  "balance": 10
}
```

字段已足够，无需后端改动。

### 组件改动

#### `star-park/pc-admin/src/components/ChildCard.vue`

- 在红花统计行添加 `cursor: pointer` 与点击事件。
- 新增事件：`show-flowers`，payload 为整个 `child` 对象。

```vue
<div class="stat-row flowers-row" @click="$emit('show-flowers', child)">
  <span class="stat-label">红花</span>
  <span class="stat-value flowers-value">{{ child.flowers_balance || 0 }}</span>
</div>
```

#### `star-park/pc-admin/src/views/Dashboard.vue`

- 引入 `getFlowers`（已在 `api/index.js` 导出，当前未使用）。
- 新增响应式状态：
  - `flowerDetailVisible: false`
  - `selectedFlowerChild: null`
  - `flowerRecords: []`
  - `flowerLoading: false`
- 新增方法：
  - `openFlowerDetailModal(child)`：设置选中孩子，打开弹窗，调用 `loadFlowerRecords(child.id)`。
  - `loadFlowerRecords(childId)`：设置 loading，调用 `getFlowers`，保存 records，catch 错误用 ElMessage.error。
  - `closeFlowerDetailModal()`：关闭弹窗并清空 selectedFlowerChild / flowerRecords。
- 在 `ChildCard` 使用处监听 `@show-flowers="openFlowerDetailModal"`。
- 在模板底部新增 `el-dialog`（紧邻现有发放红花 dialog 之后），宽度 `520px`，顶部居中。

### 样式

- 弹窗表格复用 Element Plus 默认样式，无需自定义主题。
- 数量列：
  - `.flower-amount--positive { color: #67C23A; }`
  - `.flower-amount--negative { color: #F56C6C; }`
- 保持与 `Balance.vue` 的 earn/spend 颜色语义一致。

### 错误处理

- API 失败：用 `ElMessage.error('加载红花记录失败')`。
- Loading：表格使用 `v-loading="flowerLoading"`。
- 空记录：使用 `el-table` 的 `empty-text`。

### 测试

- 在 `star-park/server/tests/flowers.test.js` 中已有 `GET /api/flowers?child_id=X` 的测试，无需新增后端测试。
- 前端：在 `Dashboard.vue` 相关测试中（如有）或手动验证：
  1. 点击红花数字弹出弹窗。
  2. 弹窗标题显示正确孩子姓名。
  3. 表格列与返回记录一致。
  4. 空记录时显示空状态。
  5. 关闭弹窗后可再次点击另一个孩子。

## 不做的范围

- 不新增后端接口、表、字段。
- 不在小程序端实现。
- 不实现分页（当前 flowers 记录量预期不大，可后续按需扩展）。
- 不实现按时间筛选或导出。

## 验收标准

- [ ] 仪表盘每个 `ChildCard` 的红花数字可点击。
- [ ] 点击后弹出该成员的红花明细弹窗。
- [ ] 弹窗展示时间、数量（带正负号与颜色）、说明三列。
- [ ] 空记录时显示「暂无红花记录」。
- [ ] 关闭弹窗后状态被清空，不会保留上一个孩子的数据。
