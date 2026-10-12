<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItemIndicator,
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
} from 'reka-ui';
import type { ParkingSort } from '@/views/explore/types/personal';

const props = defineProps<{
  sort: ParkingSort[];
  disabled: boolean;
  total: number;
  count: number;
}>();
const emit = defineEmits<{ sort: [value: ParkingSort[]] }>();
const sorts: { value: ParkingSort; label: string }[] = [
  { value: 'spaces', label: '剩餘車位' },
  { value: 'distance', label: '距離目的地' },
  { value: 'price', label: '停車費' },
];
const open = shallowRef(false);
const choose = (value: ParkingSort) => {
  emit(
    'sort',
    props.sort.includes(value)
      ? props.sort.filter((item) => item !== value)
      : [...props.sort, value]
  );
};
const priority = (value: ParkingSort) =>
  ['①', '②', '③'][props.sort.indexOf(value)];
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) open.value = false;
  }
);
</script>

<template>
  <section
    class="line-primary relative mb-[16px] flex items-center justify-between gap-[8px] border-b-[1px] pb-[12px]"
    aria-label="停車場排序"
  >
    <p
      role="status"
      class="text-secondary text-[12px]"
    >
      顯示 {{ count }} / {{ total }} 個停車場
    </p>
    <DropdownMenuRoot
      v-model:open="open"
      :modal="false"
    >
      <DropdownMenuTrigger
        :disabled="disabled"
        aria-label="停車場排序"
        class="text-forest flex shrink-0 items-center gap-[6px] rounded-[6px] px-[8px] py-[8px] text-[12px] disabled:opacity-[0.5]"
      >
        {{
          sort.length === 1
            ? sorts.find((option) => option.value === sort[0])?.label
            : sort.length
              ? `排序（${sort.length}）`
              : '排序'
        }}
        <span
          aria-hidden="true"
          class="material-symbols-rounded text-[18px] transition-transform duration-[200ms] motion-reduce:transition-none"
          :class="open ? 'rotate-180' : ''"
        >
          expand_more
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          :side-offset="6"
          :collision-padding="16"
          class="bg-card line-primary z-[30] max-h-[60dvh] w-[220px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[10px] border-[1px] p-[10px] shadow-[0_4px_16px_var(--shadow-medium)]"
        >
          <div class="mb-[6px] flex items-center gap-[4px]">
            <p class="text-secondary text-[12px]">排序方式</p>
            <!-- ponytail: 不受控，下拉選單關閉時隨內容卸載自動重置 -->
            <PopoverRoot>
              <PopoverTrigger
                aria-label="排序說明"
                class="text-secondary flex h-[24px] w-[24px] cursor-pointer items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  class="material-symbols-rounded text-[14px]"
                >
                  error
                </span>
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverContent
                  side="top"
                  align="end"
                  :side-offset="8"
                  :collision-padding="8"
                  aria-label="排序說明"
                  class="bg-card text-secondary line-primary z-[50] max-h-[40dvh] w-[260px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-[8px] border-[1px] p-[12px] text-[12px] leading-[20px] shadow-[0_4px_16px_var(--shadow-medium)]"
                >
                  <p>
                    依勾選先後排序，相同時比較下一項；全部取消則依距離排序。
                  </p>
                  <p class="mt-[6px]">
                    停車費按一小時費用由低到高；條件不明的費率排在後方。
                  </p>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot>
          </div>
          <DropdownMenuCheckboxItem
            v-for="option in sorts"
            :key="option.value"
            :model-value="sort.includes(option.value)"
            :disabled="disabled"
            class="mb-[4px] flex cursor-pointer items-center gap-[8px] rounded-[6px] px-[10px] py-[9px] text-[14px] outline-none focus-visible:outline-[2px] focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--line-focus)]"
            :class="
              sort.includes(option.value)
                ? 'bg-available text-forest'
                : 'text-primary'
            "
            @select.prevent
            @update:model-value="choose(option.value)"
          >
            <span
              aria-hidden="true"
              class="line-primary flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[3px] border-[1px]"
            >
              <DropdownMenuItemIndicator>
                <span class="material-symbols-rounded text-[14px]">check</span>
              </DropdownMenuItemIndicator>
            </span>
            <span class="flex-1">{{ option.label }}</span>
            <span
              v-if="sort.includes(option.value)"
              class="text-forest font-[700]"
              :aria-label="`第 ${sort.indexOf(option.value) + 1} 優先`"
            >
              {{ priority(option.value) }}
            </span>
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </section>
</template>

<spec lang="md">
# ParkingControls

## 元件定位

- 停車場數量右側的客製下拉篩選與排序；子元件位於 src/components/explore。

## 公開介面

- Props：sort（勾選順序）、disabled、total、count。
- v-model：無。
- Emits：sort。
- 主要依賴：Vue、Reka UI DropdownMenu／Popover、views/explore/types/personal。

## 主要行為

- 提供剩餘車位、距離目的地、停車費三種多選排序，顯示①②③勾選順序；全部取消則距離由近到遠。
- 車位由多到少並排除未知、停一小時費用由低到高；依優先順序比較，相同時比較下一項。
- 點選或取消排序時維持展開；支援方向鍵、Escape、點擊外部關閉。
- 排序規則以排序方式旁的驚嘆號按鈕點擊展開浮動說明（Popover），再次點擊、Escape 或點擊外部關閉，下拉選單關閉時一併收起；由 Reka UI 計算位置並避開視窗邊緣，圖示僅有 cursor pointer，沒有 hover 動畫或變色。
- 下拉箭頭使用 200ms 旋轉動畫，減少動態效果偏好時停用動畫。
- 選項不使用 hover 背景效果；已勾選固定顯示綠色底，未勾選保持原底色，鍵盤聚焦以 outline 提示。

## 狀態與限制

- 查詢或配額封鎖時停用操作；不直接呼叫 API。
- 尺寸與效果使用 tag 上明確數值 Tailwind class；色值由 theme-color.scss 定義，variables.scss 提供普通顏色 class。
</spec>
