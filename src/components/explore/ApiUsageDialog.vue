<script setup lang="ts">
import { shallowRef } from 'vue';
import {
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from 'reka-ui';

defineProps<{ open: boolean; message: string }>();
const emit = defineEmits<{ close: [] }>();
const returnFocus = shallowRef<HTMLElement | null>(null);
const rememberFocus = () => {
  returnFocus.value = document.activeElement as HTMLElement | null;
};
</script>

<template>
  <AlertDialogRoot
    :open="open"
    @update:open="
      (value) => {
        if (!value) emit('close');
      }
    "
  >
    <AlertDialogPortal>
      <AlertDialogOverlay
        class="fixed inset-[0px] z-[60] bg-[color:var(--mask-dialog)]"
      />
      <AlertDialogContent
        class="bg-card text-primary line-primary fixed left-[50%] top-[50%] z-[60] w-[calc(100%-32px)] max-w-[360px] translate-x-[-50%] translate-y-[-50%] rounded-[16px] border-[1px] p-[24px] text-center shadow-[0_10px_30px_var(--shadow-medium)]"
        @open-auto-focus="rememberFocus"
        @close-auto-focus.prevent="returnFocus?.focus()"
      >
        <AlertDialogTitle class="text-[18px] font-[700]">
          查詢暫停
        </AlertDialogTitle>
        <AlertDialogDescription class="text-secondary mt-[12px] text-[14px]">
          {{ message }}
        </AlertDialogDescription>
        <AlertDialogAction
          class="bg-brand-primary mt-[24px] min-h-[44px] w-[100%] rounded-[8px] px-[16px] py-[10px] text-[14px] text-white hover:bg-[color:var(--brand-tertiary)]"
        >
          確定
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<spec lang="md">
# ApiUsageDialog

## 元件定位

- 顯示探索頁 API 配額、網路或其他服務異常時的置中提示。

## 公開介面

- Props：open、message。
- v-model：無。
- Emits：close()。
- 主要依賴：Reka UI AlertDialog。

## 主要行為

- open 為 true 時由 Reka UI 開啟畫面中央視窗，隔離背景操作並限制鍵盤焦點。
- 顯示傳入的提示文案：網路異常顯示「網路連線異常，請確認連線後再試。」；配額錯誤顯示「今日免費查詢額度已達上限，請明日再試！」；停車資料 TDX 每分鐘上限顯示「停車資料查詢太頻繁，請稍候約一分鐘再試。」；其他異常顯示「目前無法查詢，請稍後再試。」。
- 確定或 Escape 通知父元件關閉提示。

## 狀態與限制

- 關閉只隱藏提示；配額錯誤不解除封鎖，停車資料每分鐘上限、網路與服務異常可在恢復後重試。
- Google 配額錯誤不一定能區分每分鐘與每日上限，文案依產品指定呈現。
- 尺寸、間距、圓角及陰影直接使用 tag 上明確數值的 Tailwind class。
- 主題色值位於 theme-color.scss，普通顏色 class 由 variables.scss 宣告；背景遮罩引用主題變數。
</spec>
