<template>
  <div class="layout">
    <SideNav />
    <main class="layout-main">
      <router-view :key="$route.fullPath" />
    </main>
  </div>
</template>

<script setup>
import SideNav from './SideNav.vue'
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.layout-main {
  flex: 1;
  margin-left: var(--sidebar-width);
  min-width: 0;
  background: var(--bg);
  overflow-y: auto;
  height: 100vh;
}
</style>
