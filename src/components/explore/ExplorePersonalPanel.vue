<script setup lang="ts">
import { shallowRef } from 'vue';
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
}>();
const tab = shallowRef('');
</script>

<template>
  <CollapsibleRoot
    :open="Boolean(tab)"
    as="section"
    class="mt-[12px]"
    aria-label="我的地點與停車紀錄"
  >
    <ToggleGroupRoot
      v-model="tab"
      type="single"
      class="grid grid-cols-3 gap-[6px] text-[12px]"
      aria-label="我的地點類別"
    >
      <ToggleGroupItem
        value="favorites"
        class="rounded-[6px] px-[6px] py-[8px]"
        :class="tab === 'favorites' ? 'bg-available text-forest' : 'bg-primary'"
        aria-controls="personal-content"
      >
        收藏
      </ToggleGroupItem>
      <ToggleGroupItem
        value="recent"
        class="rounded-[6px] px-[6px] py-[8px]"
        :class="tab === 'recent' ? 'bg-available text-forest' : 'bg-primary'"
        aria-controls="personal-content"
      >
        最近搜尋
      </ToggleGroupItem>
      <ToggleGroupItem
        value="parked"
        class="rounded-[6px] px-[6px] py-[8px]"
        :class="tab === 'parked' ? 'bg-available text-forest' : 'bg-primary'"
        aria-controls="personal-content"
      >
        停車記錄
      </ToggleGroupItem>
    </ToggleGroupRoot>
    <CollapsibleContent
      id="personal-content"
      class="bg-primary mt-[8px] max-h-[240px] overflow-y-auto rounded-[8px] p-[10px]"
    >
      <template v-if="tab === 'parked'">
        <template v-if="parked">
          <p class="text-[14px] font-[700]">{{ parked.place.name }}</p>
          <p
            class="text-secondary mt-[4px] whitespace-pre-wrap break-words text-[12px]"
          >
            {{ parked.note || '尚未填寫樓層、區域或車格。' }}
          </p>
          <div class="mt-[8px] flex gap-[12px] text-[12px]">
            <button
              class="text-forest py-[6px]"
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
        <p
          v-else
          class="text-secondary text-[12px]"
        >
          停好車後，點停車場卡片的「記錄車位」。
        </p>
      </template>
      <template v-else>
        <ul class="space-y-[8px]">
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
              <span class="block break-words text-[14px] font-[700]">
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
        <p
          v-if="!(tab === 'favorites' ? favorites : recent).length"
          class="text-secondary text-[12px]"
        >
          {{
            tab === 'favorites'
              ? '還沒有收藏，點停車場卡片上的收藏即可加入。'
              : '選擇店家後，會出現在最近搜尋。'
          }}
        </p>
        <button
          v-if="tab === 'recent' && recent.length"
          class="text-secondary mt-[8px] py-[6px] text-[12px]"
          @click="emit('clearRecent')"
        >
          清除最近搜尋
        </button>
      </template>
      <p class="text-secondary mt-[8px] text-[12px]">
        收藏與最近搜尋保留 30 天；停車記錄保留至清除。
      </p>
    </CollapsibleContent>
    <p
      v-if="message"
      role="status"
      class="text-secondary mt-[8px] text-[12px]"
    >
      {{ message }}
    </p>
  </CollapsibleRoot>
</template>

<spec lang="md">
# ExplorePersonalPanel

## 元件定位

- 以可展開區塊呈現收藏、最近搜尋與停車記錄；子元件位於 src/components/explore。

## 公開介面

- Props：favorites、recent、parked、message、disabled。
- v-model：無。
- Emits：open、removeFavorite、clearRecent、editParking、clearParking。
- 主要依賴：Vue、Reka UI ToggleGroup／Collapsible、views/explore/types/personal。

## 主要行為

- 由父頁面處理重開地點、刪除收藏與停車記錄編輯；不顯示過去保存的車位數。
- 點選收藏或最近搜尋項目後自動收起，避免手機版結果被推出首屏。

## 狀態與限制

- 紀錄僅保存在此瀏覽器；展開內容高度有限並可捲動。
- 尺寸與效果使用 tag 上明確數值 Tailwind class；顏色 class 為 variables.scss 普通 class，色值位於 theme-color.scss。
</spec>
