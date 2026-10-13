<script setup lang="ts">
defineProps<{
  loading: boolean;
  blocked: boolean;
  foodCount: number;
}>();
const emit = defineEmits<{
  locate: [];
  refresh: [];
}>();
</script>

<template>
  <!-- 外層負責定位、內層負責橫向捲動：slot 內個人選單的浮動面板以外層為基準，不會被捲動區裁切。 -->
  <!-- 圖示只在桌面顯示；main.scss 的圖示 class 設了 display，手機隱藏需用 ! 覆蓋。 -->
  <div class="relative z-[20] min-w-[0px] self-start [grid-area:chips]">
    <div
      class="flex gap-[6px] overflow-x-auto px-[12px] py-[8px] [scrollbar-width:none] md:flex-wrap md:justify-between md:gap-[8px] md:overflow-visible md:p-[20px]"
    >
      <div class="flex shrink-0 gap-[6px] md:gap-[8px]">
        <button
          type="button"
          class="bg-card text-brand flex min-h-[36px] shrink-0 items-center gap-[4px] rounded-[9999px] px-[12px] text-[12px] font-[500] shadow-[0_3px_10px_var(--shadow-medium)] hover:bg-[color:var(--background-available)] disabled:text-[color:var(--line-control)] disabled:hover:bg-[color:var(--background-card)] md:min-h-[44px] md:gap-[6px] md:px-[16px] md:text-[14px]"
          :disabled="blocked || loading"
          @click="emit('locate')"
        >
          <span
            aria-hidden="true"
            class="material-symbols-rounded text-[18px] max-md:!hidden"
          >
            my_location
          </span>
          目前位置
        </button>
        <button
          type="button"
          class="bg-card text-brand flex min-h-[36px] shrink-0 items-center gap-[4px] rounded-[9999px] px-[12px] text-[12px] font-[500] shadow-[0_3px_10px_var(--shadow-medium)] hover:bg-[color:var(--background-available)] disabled:text-[color:var(--line-control)] disabled:hover:bg-[color:var(--background-card)] md:min-h-[44px] md:gap-[6px] md:px-[16px] md:text-[14px]"
          :disabled="blocked || loading || !foodCount"
          @click="emit('refresh')"
        >
          <span
            aria-hidden="true"
            class="material-symbols-rounded text-[18px] max-md:!hidden"
          >
            refresh
          </span>
          更新車位
        </button>
      </div>
      <slot></slot>
    </div>
  </div>
</template>

<spec lang="md">
# ExploreMapToolbar

## 元件定位

- 浮在地圖上的膠囊操作列：目前位置、更新車位，以及父頁面放入的個人選單；子元件位於 src/components/explore，以 grid-area:chips 放進 ExploreView 的頁面格線。
- 手機在搜尋膠囊下方排成一列、可橫向捲動；桌面位於地圖右上角，定位與更新靠左、個人選單靠右，寬度不足時換行。

## 公開介面

- Props：loading、blocked、foodCount。
- v-model：無。
- Emits：locate、refresh。
- Slots：default，由父頁面放入 ExplorePersonalPanel。
- 主要依賴：Vue、Google Material Symbols Rounded、Tailwind CSS v3。

## 主要行為

- 目前位置與更新車位為膠囊按鈕：手機只有文字，桌面加上圖示；定位與更新由父元件處理。
- 查詢中或配額封鎖時停用；尚未選擇目的地時停用更新車位。

## 狀態與限制

- 外層 relative 作為個人選單浮動面板的定位基準，內層才設 overflow 捲動並隱藏捲軸，避免面板被捲動區裁切；外層只佔按鈕列高度，不擋住地圖拖曳。
- 停用時膠囊底色維持不透明、只把文字與圖示調淡，避免地圖透出。
- 使用 Google Material Symbols Rounded，裝飾圖示設為 aria-hidden；main.scss 的圖示 class 設了 display，手機隱藏以 `max-md:!hidden` 覆蓋。
- 尺寸與效果使用 tag 上明確數值 Tailwind class；顏色使用 variables.scss 的普通 class，色值集中 theme-color.scss。
</spec>
