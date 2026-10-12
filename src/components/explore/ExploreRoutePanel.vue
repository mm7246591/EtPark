<script setup lang="ts">
import { onMounted, shallowRef, nextTick } from 'vue';
import type { RoutePreview } from '../../views/explore/types/routes';

defineProps<{
  preview: RoutePreview | null;
  loading: boolean;
  notice: string;
}>();
const panel = shallowRef<HTMLElement | null>(null);
onMounted(async () => {
  await nextTick();
  panel.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
const emit = defineEmits<{ close: [] }>();
const distance = (meters: number) =>
  meters < 1000
    ? `${Math.round(meters)} 公尺`
    : `${(meters / 1000).toFixed(1)} 公里`;
const duration = (millis: number) =>
  `${Math.max(1, Math.ceil(millis / 60000))} 分鐘`;
</script>
<template>
  <section
    ref="panel"
    aria-label="開車路線預覽"
    class="bg-card line-primary mb-[16px] rounded-[12px] border-[1px] p-[16px]"
  >
    <div class="flex items-center justify-between gap-[12px]">
      <h2 class="text-[16px] font-[700]">開車路線</h2>
      <button
        type="button"
        aria-label="關閉路線預覽"
        class="text-secondary flex min-h-[44px] min-w-[44px] items-center justify-center"
        @click="emit('close')"
      >
        <span
          aria-hidden="true"
          class="material-symbols-rounded text-[20px]"
        >
          close
        </span>
      </button>
    </div>
    <p
      v-if="loading"
      role="status"
      class="text-secondary text-[14px]"
    >
      取得定位與規劃路線中…
    </p>
    <p
      v-if="notice"
      role="status"
      class="text-secondary text-[14px]"
    >
      {{ notice }}
    </p>
    <template v-if="preview">
      <p class="mt-[8px] flex items-start gap-[8px] text-[13px]">
        <span
          aria-hidden="true"
          class="material-symbols-rounded text-[20px] text-[color:var(--location-primary)]"
        >
          directions_car
        </span>
        目前位置 → {{ preview.placeName }}
      </p>
      <p class="mt-[8px] text-[18px] font-[700]">
        {{ distance(preview.driving.distanceMeters) }} · 約
        {{ duration(preview.driving.durationMillis) }}
      </p>
      <p
        v-for="(warning, index) in preview.driving.warnings"
        :key="index"
        class="text-secondary mt-[4px] text-[12px]"
      >
        {{ warning }}
      </p>
      <p class="text-secondary mt-[12px] text-[12px] leading-[20px]">
        藍色實線為開車路線。時間未包含即時路況；此為路線預覽。
      </p>
    </template>
  </section>
</template>
<spec lang="md">
# ExploreRoutePanel

## 元件定位

- 呈現目前位置到選定停車場或店家的開車路線摘要。

## 公開介面

- Props：preview、loading、notice。
- v-model：無。
- Emits：close。
- 主要依賴：RoutePreview。

## 主要行為

- 顯示道路距離、預估分鐘與 Google 回傳的路線警告。
- 定位或路線查詢時顯示載入提示，可關閉預覽。

## 狀態與限制

- 時間未包含即時交通，不提供步行路線或逐路口即時導航。
- 尺寸與間距使用 tag 上明確數值的 Tailwind class；普通顏色 class 由 variables.scss 宣告，色值位於 theme-color.scss。
</spec>
