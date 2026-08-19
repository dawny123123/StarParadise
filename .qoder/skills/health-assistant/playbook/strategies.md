# 打法手册

_只追加新条目，过时条目整行删除，禁止合并压缩_

---

## 🏥 健康数据流程

- 单一数据源：health/health_log.md
- 回答前必须 grep 文件，禁止凭记忆
- 用户说"今天不XX" → 写入 skipped 标记
- 补剂状态：每日记录，午餐时服用

## 📊 饮食记录流程

- 图片优先读包装营养成分表（热量/蛋白/脂肪/碳水）
- 无包装食品用 LLM 估算，标注"估算"
- 用户未发图片的餐次，不记录
- 记录后简短确认（"✅ 已记录，XX kcal / XXg蛋白"）
- 简报在首次记录体重时或主动要求时发送

## 🔄 转发流程

- 必须用 exec openclaw agent --json
- 禁止用 sessions_send（sourceChannel=unknown 导致丢失）
- 转发后只等结果，不自己查数据

## ⏰ 定时任务

- 心跳间隔：60分钟
- 活跃时间：8:00-22:00 (Asia/Shanghai)
- 健康提醒由 cron 自动执行，main 不主动发提醒
- 周报：每周日 21:00（文字消息）
- 月报：每月最后一天 21:00（图片）

## 📁 关键文件

- 健康数据：health/health_log.md
- 路由规则：ROUTING.md
- 技能定义：skills/yan-health-pro/SKILL.md

---

_最后更新：2026-07-25_
