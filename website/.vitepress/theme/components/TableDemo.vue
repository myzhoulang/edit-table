<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';
import type { DemoHandle, DemoSetup } from '../../../demos/shared';
const props = defineProps<{ factory: () => Promise<DemoSetup>; height?: number }>();
const host = ref<HTMLElement>(),
  message = ref(''),
  actions = ref<DemoSetup['actions']>([]);
const { isDark } = useData();
let instance: DemoHandle | undefined;
let mounted = false;
onMounted(async () => {
  mounted = true;
  try {
    const setup = await props.factory();
    if (!mounted || !host.value) return;
    instance = setup.create(host.value, isDark.value ? 'dark' : 'light');
    actions.value = setup.actions;
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error);
  }
});
onBeforeUnmount(() => {
  mounted = false;
  instance?.destroy();
});
watch(isDark, (dark) => instance?.setTheme(dark ? 'dark' : 'light'));
async function run(action: NonNullable<DemoSetup['actions']>[number]): Promise<void> {
  try {
    const result = await action.run();
    if (result !== undefined)
      message.value = typeof result === 'string' ? result : JSON.stringify(result);
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error);
  }
}
</script>
<template>
  <div class="table-demo vp-raw">
    <div v-if="actions?.length" class="demo-actions">
      <button v-for="action in actions" :key="action.label" type="button" @click="run(action)">
        {{ action.label }}
      </button>
    </div>
    <div ref="host" :style="{ height: `${height ?? 420}px` }" />
    <pre v-if="message" class="demo-message" role="status">{{ message }}</pre>
  </div>
</template>
