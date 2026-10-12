<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui';
import type { SavedPlace } from '@/views/explore/types/personal';

const props = defineProps<{ place: SavedPlace | null; note: string }>();
const emit = defineEmits<{ close: []; save: [note: string] }>();
const input = shallowRef<HTMLTextAreaElement | null>(null);
const draft = shallowRef('');
const returnFocus = shallowRef<HTMLElement | null>(null);
const focusInput = () => {
  returnFocus.value = document.activeElement as HTMLElement | null;
  input.value?.focus();
};
watch(
  () => props.place,
  (place) => {
    if (place) draft.value = props.note;
  },
  { immediate: true }
);
</script>

<template>
  <DialogRoot
    :open="Boolean(place)"
    @update:open="
      (value) => {
        if (!value) emit('close');
      }
    "
  >
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-[0px] z-[60] bg-[color:var(--mask-dialog)]"
      />
      <DialogContent
        class="bg-card text-primary line-primary fixed left-[50%] top-[50%] z-[60] w-[calc(100%-32px)] max-w-[380px] translate-x-[-50%] translate-y-[-50%] rounded-[16px] border-[1px] p-[24px] shadow-[0_10px_30px_var(--shadow-medium)]"
        @open-auto-focus.prevent="focusInput"
        @close-auto-focus.prevent="returnFocus?.focus()"
        @interact-outside.prevent
      >
        <form @submit.prevent="emit('save', draft)">
          <DialogTitle class="text-[18px] font-[700]">記錄停車位置</DialogTitle>
          <DialogDescription
            class="text-secondary mt-[8px] break-words text-[14px]"
          >
            {{ place?.name }}
          </DialogDescription>
          <label
            for="parking-note"
            class="mt-[16px] block text-[14px]"
          >
            樓層、區域或車格
          </label>
          <textarea
            id="parking-note"
            ref="input"
            v-model="draft"
            maxlength="160"
            rows="3"
            placeholder="例如：B2／C 區／125 號車格"
            class="bg-primary line-primary mt-[6px] w-[100%] resize-none rounded-[8px] border-[1px] p-[10px] text-[14px]"
          ></textarea>
          <div class="mt-[16px] flex justify-end gap-[8px]">
            <DialogClose
              class="bg-card line-control rounded-[8px] border-[1px] px-[16px] py-[10px] text-[14px]"
            >
              取消
            </DialogClose>
            <button
              type="submit"
              class="bg-brand-primary rounded-[8px] px-[16px] py-[10px] text-[14px] text-white hover:bg-[color:var(--brand-tertiary)]"
            >
              儲存記錄
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<spec lang="md">
# ParkingRecordDialog

## 元件定位

- 置中輸入停車場內的樓層、區域或車格；子元件位於 src/components/explore。

## 公開介面

- Props：place（null 關閉）、note。
- v-model：無。
- Emits：close、save(note)。
- 主要依賴：Vue、Reka UI Dialog、views/explore/types/personal。

## 主要行為

- 開啟時帶入既有備註並聚焦輸入；儲存由父頁面處理。
- 取消按鈕使用 DialogClose，與 Escape 同樣經 Dialog 關閉後 emit close。

## 狀態與限制

- Reka UI modal 提供焦點限制，Escape 可關閉；遮罩使用 `--mask-dialog`，外框與 ApiUsageDialog 一致；備註最多 160 字，不呼叫 API。
- 尺寸與陰影使用 tag 上明確數值 Tailwind class；顏色引用主題 CSS 變數及 variables.scss 普通 class。
</spec>
