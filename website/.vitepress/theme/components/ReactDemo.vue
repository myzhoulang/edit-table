<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
const host = ref<HTMLElement>();
let dispose: (() => void) | undefined;
let dead = false;
onMounted(async () => {
  try {
    const { mountReactDemo } = await import('../../../../examples/react');
    if (!dead && host.value) dispose = mountReactDemo(host.value);
  } catch (error) {
    if (host.value)
      host.value.textContent = `React 演示加载失败：${error instanceof Error ? error.message : String(error)}`;
  }
});
onBeforeUnmount(() => {
  dead = true;
  dispose?.();
});
</script>
<template><div ref="host" class="react-demo vp-raw" /></template>
<style scoped>
.react-demo {
  margin: 24px 0;
}
</style>
