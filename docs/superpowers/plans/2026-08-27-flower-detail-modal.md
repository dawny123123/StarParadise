# 仪表盘红花发放明细弹窗实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PC 管理后台仪表盘点击成员卡片的红花余额时，弹出该成员的红花发放/扣减明细弹窗。

**Architecture:** 复用已有后端 `GET /api/flowers?child_id=X`，前端仅改动 `ChildCard.vue`（添加可点击事件）和 `Dashboard.vue`（新增弹窗与数据加载逻辑），保持与现有积分记录页面类似的展示风格。

**Tech Stack:** Vue 3 (Composition API + `<script setup>`), Element Plus, Axios, dayjs

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `star-park/pc-admin/src/components/ChildCard.vue` | 修改 | 红花统计行改为可点击，并向上 emit `show-flowers` 事件 |
| `star-park/pc-admin/src/views/Dashboard.vue` | 修改 | 引入 `getFlowers`，新增弹窗状态、加载方法、模板与样式 |

---

### Task 1: 让 `ChildCard.vue` 的红花数字可点击

**Files:**
- Modify: `star-park/pc-admin/src/components/ChildCard.vue:24-29`

**目标：** 将红花统计行变为可点击，点击后向父组件发送包含当前 `child` 对象的事件。

- [ ] **Step 1: 修改模板，为红花行添加点击事件与光标样式**

将原红花 `stat-row` 改为：

```html
<div class="stat-row flowers-row" @click="$emit('show-flowers', child)">
  <span class="stat-label">红花</span>
  <span class="stat-value flowers-value">
    {{ child.flowers_balance || 0 }}
  </span>
</div>
```

- [ ] **Step 2: 在 `<script setup>` 中声明 emit**

在 `defineProps` 之后添加：

```js
defineEmits(['show-flowers'])
```

- [ ] **Step 3: 添加 `.flowers-row` 样式**

在 `<style scoped>` 末尾追加：

```css
.flowers-row {
  cursor: pointer;
}
```

- [ ] **Step 4: 在 `Dashboard.vue` 中监听事件（为 Task 2 做连接）**

暂时先在 `Dashboard.vue` 的 `ChildCard` 使用处加上事件监听：

```html
<ChildCard
  v-for="child in children"
  :key="child.id"
  :child="child"
  :color="getChildColor(child.name)"
  @show-flowers="openFlowerDetailModal"
/>
```

- [ ] **Step 5: 验证与提交**

运行：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/pc-admin
npx eslint src/components/ChildCard.vue src/views/Dashboard.vue
```

Expected: 无 error（仅可能有 prettier/warn）。

提交：

```bash
git add star-park/pc-admin/src/components/ChildCard.vue star-park/pc-admin/src/views/Dashboard.vue
git commit -m "feat(pc-admin): make ChildCard flower count clickable"
```

---

### Task 2: 在 `Dashboard.vue` 中新增红花明细弹窗状态与方法

**Files:**
- Modify: `star-park/pc-admin/src/views/Dashboard.vue`

**目标：** 引入 `getFlowers`，新增弹窗控制与数据加载方法。

- [ ] **Step 1: 引入 `getFlowers`**

将：

```js
import { getDashboard, addFlowers } from '../api'
```

改为：

```js
import { getDashboard, addFlowers, getFlowers } from '../api'
```

- [ ] **Step 2: 新增响应式状态**

在 "红花发放相关" 注释块之后添加：

```js
// 红花明细弹窗相关
const flowerDetailVisible = ref(false)
const selectedFlowerChild = ref(null)
const flowerRecords = ref([])
const flowerLoading = ref(false)
```

- [ ] **Step 3: 新增打开、加载、关闭方法**

在 `submitFlowers` 函数之后、`onMounted` 之前添加：

```js
// 打开红花明细弹窗
const openFlowerDetailModal = (child) => {
  selectedFlowerChild.value = child
  flowerDetailVisible.value = true
  flowerRecords.value = []
  loadFlowerRecords(child.id)
}

// 加载红花记录
const loadFlowerRecords = async (childId) => {
  if (!childId) return
  flowerLoading.value = true
  try {
    const res = await getFlowers({ child_id: childId })
    flowerRecords.value = res?.records || []
  } catch (err) {
    ElMessage.error('加载红花记录失败')
    console.error('加载红花记录失败:', err)
  } finally {
    flowerLoading.value = false
  }
}

// 关闭红花明细弹窗
const closeFlowerDetailModal = () => {
  flowerDetailVisible.value = false
  selectedFlowerChild.value = null
  flowerRecords.value = []
}
```

- [ ] **Step 4: 验证与提交**

运行：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/pc-admin
npx eslint src/views/Dashboard.vue
```

Expected: 无 error。

提交：

```bash
git add star-park/pc-admin/src/views/Dashboard.vue
git commit -m "feat(pc-admin): add flower detail modal state and loader"
```

---

### Task 3: 在 `Dashboard.vue` 中添加红花明细弹窗模板与样式

**Files:**
- Modify: `star-park/pc-admin/src/views/Dashboard.vue:95` 附近（在发放红花弹窗 `</el-dialog>` 之后）

**目标：** 渲染弹窗表格，展示时间、数量、说明三列，并区分正负金额颜色。

- [ ] **Step 1: 在模板中新增弹窗**

在现有发放红花弹窗的 `</el-dialog>` 之后、最外层 `</div>` 之前插入：

```html
<!-- 红花明细弹窗 -->
<el-dialog
  v-model="flowerDetailVisible"
  :title="`${selectedFlowerChild?.name || ''} 的红花记录`"
  width="520px"
  center
  @closed="closeFlowerDetailModal"
>
  <div v-loading="flowerLoading">
    <el-table :data="flowerRecords" stripe style="width: 100%;" empty-text="暂无红花记录">
      <el-table-column label="时间" width="160">
        <template #default="{ row }">
          {{ formatFlowerTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="数量" width="100" align="center">
        <template #default="{ row }">
          <span :class="row.amount > 0 ? 'flower-amount--positive' : 'flower-amount--negative'">
            {{ row.amount > 0 ? '+' : '' }}{{ row.amount }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="说明" min-width="180" show-overflow-tooltip />
    </el-table>
  </div>
</el-dialog>
```

- [ ] **Step 2: 添加时间格式化函数**

在 `todayStr` computed 之后添加：

```js
const formatFlowerTime = (time) => {
  return time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-'
}
```

- [ ] **Step 3: 添加数量颜色样式**

在 `<style scoped>` 末尾追加：

```css
.flower-amount--positive {
  color: #67C23A;
  font-weight: 600;
}

.flower-amount--negative {
  color: #F56C6C;
  font-weight: 600;
}
```

- [ ] **Step 4: 验证与提交**

运行：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/pc-admin
npx eslint src/views/Dashboard.vue
npm run build
```

Expected:
- eslint 无 error
- `npm run build` 成功退出（dist 目录更新）

提交：

```bash
git add star-park/pc-admin/src/views/Dashboard.vue
git commit -m "feat(pc-admin): render flower detail modal table and styles"
```

---

### Task 4: 端到端验证

**Files:**
- 无需修改文件

**目标：** 在本地启动前后端，手动验证功能是否符合设计文档中的验收标准。

- [ ] **Step 1: 启动后端服务**

在终端 1 运行：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/server
npm run dev
```

Expected: 服务监听 `http://localhost:3001`。

- [ ] **Step 2: 启动 PC 管理后台开发服务器**

在终端 2 运行：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/pc-admin
npm run dev
```

Expected: 服务启动并打印本地访问地址（通常为 `http://localhost:5173`）。

- [ ] **Step 3: 准备测试数据**

通过浏览器或 curl 调用已有 API 创建至少一个孩子并发放红花：

```bash
curl -X POST http://localhost:3001/api/children \
  -H "Content-Type: application/json" \
  -d '{"name":"测试孩子","age":8}'

# 假设返回 child_id 为 1
curl -X POST http://localhost:3001/api/flowers \
  -H "Content-Type: application/json" \
  -d '{"child_id":1,"amount":5,"reason":"测试发放"}'

curl -X POST http://localhost:3001/api/flowers \
  -H "Content-Type: application/json" \
  -d '{"child_id":1,"amount":-2,"reason":"测试扣减"}'
```

- [ ] **Step 4: 在浏览器中验证**

打开 PC 管理后台地址，执行以下检查：

1. 仪表盘 `ChildCard` 的红花数字可点击，鼠标悬停显示手型光标。
2. 点击后弹出标题为「测试孩子 的红花记录」的弹窗。
3. 弹窗表格展示两行：
   - 时间列：`YYYY-MM-DD HH:mm` 格式
   - 数量列：`+5` 为绿色，`-2` 为红色
   - 说明列：分别显示「测试发放」、「测试扣减」
4. 关闭弹窗后，再次点击另一个孩子（如有），弹窗标题与记录正确切换，不残留上一个孩子的数据。
5. 将孩子所有记录删除（或新建无记录的孩子）后点击红花数字，表格显示「暂无红花记录」。

- [ ] **Step 5: 运行后端测试与 lint**

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/server
npx vitest run tests/flowers.test.js
```

Expected: 全部通过。

再运行：

```bash
cd /Users/yuxiao/Downloads/StarParadise
make lint
```

Expected: 无新增 lint 错误。

- [ ] **Step 6: 提交验证结果或最终提交**

如果验证过程中无代码改动，无需额外提交。若有微调，按改动原子提交。

---

## 验收标准

- [ ] 仪表盘每个 `ChildCard` 的红花数字可点击。
- [ ] 点击后弹出该成员的红花明细弹窗。
- [ ] 弹窗展示时间、数量（带正负号与颜色）、说明三列。
- [ ] 空记录时显示「暂无红花记录」。
- [ ] 关闭弹窗后状态被清空，不会保留上一个孩子的数据。
- [ ] `make lint` 与后端 `flowers.test.js` 通过。
