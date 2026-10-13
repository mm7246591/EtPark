<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import {
  ToggleGroupRoot,
  ToggleGroupItem,
  CollapsibleRoot,
  CollapsibleContent,
} from 'reka-ui';
import type { SavedPlace, ParkingRecord } from '@/views/explore/types/personal';

defineProps<{
  favorites: SavedPlace[];
  recent: SavedPlace[];
  parked: ParkingRecord | null;
  message: string;
  disabled: boolean;
}>();
const emit = defineEmits<{
  open: [place: SavedPlace];
  removeFavorite: [place: SavedPlace];
  clearRecent: [];
  editParking: [];
  clearParking: [];
  opened: [];
}>();
const tab = shallowRef('');
const root = shallowRef<ComponentPublicInstance | null>(null);
// 面板展開時，點面板以外（搜尋框、地圖、清單）或按 Escape 都會收起，不必再點一次同一顆按鈕。
// 用捕獲階段監聽，Google 地圖攔下事件前也能收到。
const closeOnOutside = (event: Event) => {
  if (
    !(root.value?.$el as HTMLElement | undefined)?.contains(
      event.target as Node
    )
  )
    tab.value = '';
};
const closeOnEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') tab.value = '';
};
watch(tab, (value, previous, onCleanup) => {
  if (!value) return;
  if (!previous) emit('opened');
  document.addEventListener('pointerdown', closeOnOutside, true);
  document.addEventListener('keydown', closeOnEscape);
  onCleanup(() => {
    document.removeEventListener('pointerdown', closeOnOutside, true);
    document.removeEventListener('keydown', closeOnEscape);
  });
});
const items = [
  { value: 'favorites', label: '收藏' },
  { value: 'recent', label: '最近搜尋' },
  { value: 'parked', label: '停車記錄' },
];
</script>

<template>
  <!-- 不設定位：浮動面板以父層 ExploreMapToolbar 外層為基準，不被橫向捲動區裁切。 -->
  <CollapsibleRoot
    ref="root"
    :open="Boolean(tab)"
    as="section"
    class="flex shrink-0"
    aria-label="我的地點與停車紀錄"
  >
    <ToggleGroupRoot
      v-model="tab"
      type="single"
      class="flex gap-[6px] md:gap-[4px] md:rounded-[9999px] md:bg-[color:var(--background-card)] md:p-[4px] md:shadow-[0_4px_14px_var(--shadow-medium)]"
      aria-label="我的地點類別"
    >
      <ToggleGroupItem
        v-for="item in items"
        :key="item.value"
        :value="item.value"
        class="bg-card text-primary flex min-h-[36px] shrink-0 items-center rounded-[9999px] px-[12px] text-[12px] shadow-[0_3px_10px_var(--shadow-medium)] hover:bg-[color:var(--background-primary)] data-[state=on]:bg-[color:var(--background-available)] data-[state=on]:font-[500] data-[state=on]:text-[color:var(--text-brand)] md:text-[14px] md:shadow-none"
      >
        {{ item.label }}
      </ToggleGroupItem>
    </ToggleGroupRoot>
    <CollapsibleContent
      class="bg-card line-primary absolute left-[12px] right-[12px] top-[100%] max-h-[50dvh] overflow-y-auto rounded-[20px] border-[1px] p-[16px] shadow-[0_8px_24px_var(--shadow-medium)] md:left-auto md:right-[20px] md:top-[calc(100%-12px)] md:w-[360px]"
    >
      <template v-if="tab === 'parked'">
        <template v-if="parked">
          <p class="text-[14px] font-[500]">{{ parked.place.name }}</p>
          <p
            class="text-secondary mt-[4px] whitespace-pre-wrap break-words text-[12px]"
          >
            {{ parked.note || '尚未填寫樓層、區域或車格。' }}
          </p>
          <div class="mt-[8px] flex gap-[12px] text-[12px]">
            <button
              class="text-brand py-[6px]"
              @click="emit('editParking')"
            >
              編輯記錄
            </button>
            <button
              class="text-secondary py-[6px]"
              @click="emit('clearParking')"
            >
              清除記錄
            </button>
          </div>
        </template>
      </template>
      <template v-else>
        <ul
          v-if="(tab === 'favorites' ? favorites : recent).length"
          class="space-y-[8px]"
        >
          <li
            v-for="item in tab === 'favorites' ? favorites : recent"
            :key="`${item.kind}-${item.id}`"
            class="line-primary flex items-start gap-[8px] border-b-[1px] pb-[8px]"
          >
            <button
              class="min-w-[0px] flex-1 text-left disabled:opacity-[0.5]"
              :disabled="disabled"
              @click="
                tab = '';
                emit('open', item);
              "
            >
              <span class="block break-words text-[14px] font-[500]">
                {{ item.name }}
              </span>
              <span
                class="text-secondary mt-[3px] block break-words text-[12px]"
              >
                {{ item.address }}
              </span>
            </button>
            <button
              v-if="tab === 'favorites'"
              :aria-label="`移除收藏${item.name}`"
              class="text-secondary px-[6px] py-[4px] text-[12px]"
              @click="emit('removeFavorite', item)"
            >
              移除
            </button>
          </li>
        </ul>
        <button
          v-if="tab === 'recent' && recent.length"
          class="text-secondary mt-[8px] py-[6px] text-[12px]"
          @click="emit('clearRecent')"
        >
          清除最近搜尋
        </button>
      </template>
      <p class="text-secondary mt-[8px] text-[12px] first:mt-[0px]">
        收藏與最近搜尋保留 30 天；停車記錄保留至清除。
      </p>
      <p
        v-if="message"
        role="status"
        class="text-secondary mt-[8px] text-[12px]"
      >
        {{ message }}
      </p>
    </CollapsibleContent>
    <p
      v-if="message && !tab"
      role="status"
      class="bg-card line-primary absolute left-[12px] right-[12px] top-[100%] rounded-[12px] border-[1px] px-[12px] py-[8px] text-[12px] shadow-[0_4px_16px_var(--shadow-medium)] md:left-auto md:right-[20px] md:top-[calc(100%-12px)] md:w-[360px]"
    >
      {{ message }}
    </p>
  </CollapsibleRoot>
</template>

<spec lang="md">
# ExplorePersonalPanel

## 元件定位

- 收藏、最近搜尋與停車記錄的膠囊選單；由父頁面放進 ExploreMapToolbar 的 slot：手機接在定位與更新車位後方、可橫向捲動，桌面為地圖右上角的一組膠囊。子元件位於 src/components/explore。

## 公開介面

- Props：favorites、recent、parked、message、disabled。
- v-model：無。
- Emits：open、removeFavorite、clearRecent、editParking、clearParking、opened（從收起變成展開時發出，父頁面據此收合下方清單）。
- 主要依賴：Vue、Reka UI ToggleGroup／Collapsible、views/explore/types/personal。

## 主要行為

- 選擇收藏、最近搜尋或停車記錄時，在膠囊列下方展開浮動面板：手機左右滿版，桌面靠右寬 360px；再點同一項目、點面板以外的地方（搜尋框、地圖、清單）或按 Escape 收起。
- 從收起變成展開時發出 opened，由父頁面收合下方停車場／目的地清單，避免面板與清單互相遮擋。
- 由父頁面處理重開地點、刪除收藏與停車記錄編輯；不顯示過去保存的車位數。
- 點選收藏或最近搜尋項目後自動收起，避免結果被面板遮住。
- 儲存提示在面板收起時以浮動提示顯示，展開時改列在面板內。

## 狀態與限制

- 根節點不設定位，面板與提示以 ExploreMapToolbar 外層為定位基準，浮在地圖與清單上方，不改變版面高度，也不被膠囊列的橫向捲動裁切。
- 選取中的膠囊使用 Reka data-state 搭配 Tailwind arbitrary value class 引用主題變數。
- 紀錄僅保存在此瀏覽器；面板高度上限 50dvh 並可捲動。
- 尺寸與效果使用 tag 上明確數值 Tailwind class；顏色 class 為 variables.scss 普通 class，色值位於 theme-color.scss。
</spec>
