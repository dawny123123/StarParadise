<template>
  <div class="page-container fade-in-up">
    <h1 class="page-title">📊 数据统计</h1>

    <div class="child-selector">
      <el-radio-group v-model="selectedChildId" @change="fetchStatsData">
        <el-radio-button
          v-for="child in children"
          :key="child.id"
          :value="child.id"
        >
          {{ child.name }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <div v-loading="loading">
      <!-- 日历热力图 -->
      <div class="chart-card card">
        <h3 class="section-title">最近30天打卡热力图</h3>
        <div ref="heatmapRef" class="chart-container"></div>
      </div>

      <!-- 完成率趋势 -->
      <div class="chart-card card">
        <h3 class="section-title">完成率趋势</h3>
        <div class="trend-controls">
          <el-radio-group v-model="trendMode" size="small" @change="updateTrendChart">
            <el-radio-button value="week">按周</el-radio-button>
            <el-radio-button value="month">按月</el-radio-button>
          </el-radio-group>
        </div>
        <div ref="trendRef" class="chart-container"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { useAppStore } from '../stores/app'
import { getStats } from '../api'

const store = useAppStore()
const loading = ref(false)
const selectedChildId = ref(null)
const trendMode = ref('week')
const statsData = ref(null)

const heatmapRef = ref(null)
const trendRef = ref(null)
let heatmapChart = null
let trendChart = null

const children = computed(() => store.children)

const getChildColor = (name) => {
  const colorMap = {
    '甜甜': '#FF6B6B',
    '甄甄': '#4ECDC4',
    '欣甜': '#FFD93D'
  }
  return colorMap[name] || '#19C8B9'
}

const fetchStatsData = async () => {
  if (!selectedChildId.value) return
  loading.value = true
  try {
    const data = await getStats(selectedChildId.value)
    statsData.value = data
    await nextTick()
    renderHeatmap()
    renderTrend()
  } catch (err) {
    console.error('获取统计数据失败:', err)
  } finally {
    loading.value = false
  }
}

// 渲染日历热力图
const renderHeatmap = () => {
  if (!heatmapRef.value) return
  if (!heatmapChart) {
    heatmapChart = echarts.init(heatmapRef.value)
  }

  const child = children.value.find(c => c.id === selectedChildId.value)
  const color = getChildColor(child?.name)

  // 生成最近30天数据
  const heatmapData = []
  const today = dayjs()
  for (let i = 29; i >= 0; i--) {
    const date = today.subtract(i, 'day')
    const dateStr = date.format('YYYY-MM-DD')
    // 从统计数据中获取打卡数，默认0
    const count = statsData.value?.heatmap?.[dateStr] || 0
    heatmapData.push([dateStr, count])
  }

  const option = {
    tooltip: {
      formatter: (params) => {
        return `${params.value[0]}<br/>打卡次数: ${params.value[1]}`
      }
    },
    grid: {
      top: 10,
      bottom: 30,
      left: 50,
      right: 20
    },
    xAxis: {
      type: 'category',
      data: heatmapData.map(d => dayjs(d[0]).format('MM/DD')),
      axisLabel: {
        fontSize: 11,
        color: '#A89880',
        rotate: 45
      },
      axisLine: { lineStyle: { color: '#E8E4DC' } }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#A89880' },
      splitLine: { lineStyle: { color: '#F0EDE6' } }
    },
    series: [{
      type: 'bar',
      data: heatmapData.map(d => d[1]),
      itemStyle: {
        color: (params) => {
          const val = params.value
          if (val === 0) return '#F0EDE6'
          if (val === 1) return color + '60'
          if (val === 2) return color + '90'
          return color
        },
        borderRadius: [4, 4, 0, 0]
      },
      barWidth: '60%'
    }]
  }

  heatmapChart.setOption(option, true)
}

// 渲染完成率趋势图
const renderTrend = () => {
  if (!trendRef.value) return
  if (!trendChart) {
    trendChart = echarts.init(trendRef.value)
  }
  updateTrendChart()
}

const updateTrendChart = () => {
  if (!trendChart) return

  const child = children.value.find(c => c.id === selectedChildId.value)
  const color = getChildColor(child?.name)

  const trend = statsData.value?.trend || {}
  const isWeek = trendMode.value === 'week'
  const data = isWeek ? (trend.weekly || []) : (trend.monthly || [])

  // 生成默认数据
  const labels = []
  const values = []
  if (data.length > 0) {
    data.forEach(d => {
      labels.push(d.label || d.date || '')
      values.push(d.rate || 0)
    })
  } else {
    // 生成示例标签
    const count = isWeek ? 8 : 6
    for (let i = count - 1; i >= 0; i--) {
      const unit = isWeek ? 'week' : 'month'
      labels.push(dayjs().subtract(i, unit).format(isWeek ? 'MM/DD' : 'YYYY/MM'))
      values.push(0)
    }
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: '{b}<br/>完成率: {c}%'
    },
    grid: {
      top: 20,
      bottom: 30,
      left: 50,
      right: 20
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#A89880', fontSize: 11 },
      axisLine: { lineStyle: { color: '#E8E4DC' } },
      boundaryGap: false
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: {
        color: '#A89880',
        formatter: '{value}%'
      },
      splitLine: { lineStyle: { color: '#F0EDE6' } }
    },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: {
        width: 3,
        color: color
      },
      itemStyle: {
        color: color,
        borderWidth: 2,
        borderColor: '#fff'
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: color + '40' },
          { offset: 1, color: color + '05' }
        ])
      }
    }]
  }

  trendChart.setOption(option, true)
}

// 窗口大小变化时重绘
const handleResize = () => {
  heatmapChart?.resize()
  trendChart?.resize()
}

onMounted(async () => {
  await store.fetchChildren()
  if (children.value.length > 0) {
    selectedChildId.value = children.value[0].id
    await fetchStatsData()
  }
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  heatmapChart?.dispose()
  trendChart?.dispose()
})
</script>

<style scoped>
.child-selector {
  margin-bottom: 24px;
}

.chart-card {
  background: #fff;
}

.section-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 16px;
}

.chart-container {
  width: 100%;
  height: 300px;
}

.trend-controls {
  margin-bottom: 12px;
}
</style>
