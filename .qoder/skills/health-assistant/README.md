# 🏥 健康助手系统包

> 数据驱动的健康管理系统，支持饮食记录、营养分析、补剂管理、周报月报。

**最后更新：** 2026-08-05  
**版本：** 1.6.0

---

## 📦 文件结构

```
health-package/
├── README.md              ← 本文件
├── USER.md                ← 用户档案（身高/体重/目标）
├── MEMORY.md              ← 短期记忆索引
│
├── health-score-pro/      ← 核心 Skill 定义
│   ├── SKILL.md           ← 技能规范（含表格输出格式）
│   ├── assets/            ← 模板文件
│   ├── references/        ← 食物数据库、原则
│   ├── scripts/           ← 备份脚本
│   └── templates/         ← 引导流程
│
├── health-data/           ← 健康数据
│   ├── health_log.md      ← 唯一数据源（JSON Lines）
│   └── weekly-report-template.md
│
└── playbook/              ← 运行手册
    ├── preferences.md     ← 用户偏好、营养目标
    ├── pitfalls.md        ← 红线、教训
    └── strategies.md      ← 工作流程
```

---

## 🚀 快速启动

### 1. 当前状态（2026-08-05）

| 项目 | 数值 |
|------|------|
| 当前体重 | 84.6 kg |
| 目标体重 | 80 kg |
| TDEE | 2,863 kcal/天 |
| 每日热量 | 2,163 kcal（缺口700） |
| 蛋白质 | 170g（2.0g/kg） |
| 碳水 | 176g |
| 脂肪 | 85g |

### 2. 每日补剂（5种）

- 复合维生素
- 鱼油
- 辅酶Q10
- 胰激肽原酶片
- 叶黄素

### 3. 快速指令

| 说 | 做 |
|---|---|
| `84.5` | 记录体重 + 生成简报 |
| 发早餐/午餐/晚餐图片 | 自动识别并记录 |
| `补剂吃了` | 标记补剂完成 |
| `今日总结` | 查看当天营养汇总 |
| `周报` | 生成周度分析 |

---

## 📋 输出格式规范

**所有饮食记录必须包含3部分：**

### 1. 食物明细表

```
🍽️ **YYYY-MM-DD 餐次 · 时间 · 地点**

| 食物 | 重量 | 热量 | 蛋白 | 碳水 | 脂肪 |
|------|------|------|------|------|------|
| 食物1 | XXg | XXX kcal | XXg | XXg | XXg |
| **合计** | **~XXXg** | **XXX kcal** | **XXg** | **XXg** | **XXg** |
```

### 2. 今日累计进度表

```
📊 **今日累计进度**

| 营养素 | 已摄入 | 目标 | 进度 | 剩余 |
|--------|--------|------|------|------|
| 热量 | XXX kcal | X,XXX kcal | XX% | XXX kcal |
| 蛋白质 | XXg | XXXg | XX% | XXg |
| 碳水 | XXg | XXXg | XX% | XXg |
| 脂肪 | XXg | XXg | XX% | XXg |
```

### 3. 下餐建议

```
💡 **下餐建议（~XXX kcal）**
• 具体食物建议 + 预估营养
```

---

## 🚫 红线规则

| ❌ 禁止 | ✅ 正确 |
|---------|---------|
| 编造数据 | 用户没发就不记 |
| 凭记忆回复 | 必须查 health_log.md |
| 虚假标注 skill | 必须实际调用 |
| 整段重写文件 | 增量追加 |

---

## 🔧 关键文件说明

| 文件 | 用途 |
|------|------|
| `health_log.md` | 唯一数据源，JSON Lines 格式 |
| `SKILL.md` | Skill 规范定义 |
| `preferences.md` | 用户偏好、营养目标 |
| `pitfalls.md` | 踩坑记录、红线 |
| `strategies.md` | 工作流程、定时任务 |

---

## 📊 数据格式（JSON Lines）

```json
{"date": "2026-08-05", "type": "diet", "meal": "breakfast", "calories": 692, "protein_g": 32, "carbs_g": 65.5, "fat_g": 31.5, "items": [...]}
```

**格式要求：**
- 单行 JSON
- 冒号后加空格
- items 用数组
- 双引号

---

## 📚 参考资源

- `references/principles.md` — 十本书共识原则
- `references/food-database.md` — 食物数据库
- `references/chinese-food-database.md` — 中餐食物数据库
- `references/supplement-database.md` — 补剂数据库

---

## 📝 更新日志

| 日期 | 更新内容 |
|------|----------|
| 2026-08-05 | 强制表格输出格式、禁止编造数据 |
| 2026-04-23 | TDEE 月度复盘机制 |
| 2026-04-21 | Skill 调用验证机制 |
| 2026-04-20 | 数据记录规范（JSON Lines） |

---

*打包时间：2026-08-05 13:30*
