<script setup lang="ts">
import ApiUsageDialog from '@/components/explore/ApiUsageDialog.vue';
import { useApiUsage } from '@/composables/useApiUsage';
import ExploreSidebar from '../../components/explore/ExploreSidebar.vue';
import ExploreMap from '../../components/explore/ExploreMap.vue';
import { useExplore } from './composables/useExplore';

const { blocked, dialogOpen, dialogMessage } = useApiUsage();
const {
  searching,
  origin,
  searchMessage,
  inputSearch,
  source,
  parkingNotice,
  restaurants,
  parkingLots,
  suggestions,
  loading,
  mapsConfigured,
  search,
  chooseSuggestion,
  refresh,
  activeKind,
  selected,
  message,
  places,
  select,
  switchKind,
  navigate,
  locate,
} = useExplore();
</script>

<template>
  <main
    class="flex h-[100dvh] min-h-[0px] flex-col-reverse overflow-hidden md:flex-row"
  >
    <ExploreSidebar
      :searching="searching"
      :has-origin="Boolean(origin)"
      :search-message="searchMessage"
      :notice-message="message === dialogMessage ? '' : message"
      :source="source"
      :parking-notice="parkingNotice"
      :suggestions="suggestions"
      :loading="loading"
      :blocked="blocked"
      :blocked-message="dialogMessage"
      :maps-configured="mapsConfigured"
      :active-kind="activeKind"
      :selected="selected"
      :places="places"
      :food-count="restaurants.length"
      :parking-count="parkingLots.length"
      @input-search="inputSearch"
      @search="search"
      @choose-suggestion="chooseSuggestion"
      @refresh="refresh"
      @select="select"
      @switch-kind="switchKind"
      @navigate="navigate"
      @locate="locate"
    />
    <ExploreMap
      :restaurants="restaurants"
      :parking-lots="parkingLots"
      :selected="selected"
      :blocked="blocked"
      @select="select"
    />
    <ApiUsageDialog
      :open="dialogOpen"
      :message="dialogMessage"
      @close="dialogOpen = false"
    />
  </main>
</template>

<spec lang="md">
# ExploreView

## 元件定位

- 組裝周邊美食清單與 Google 地圖，協調分頁、選取與提示。
- 使用範圍：探索頁，父元件位於 `src/views/explore`。

## 公開介面

- Props：無公開 props。
- v-model：無。
- Emits：無。
- 主要依賴：`ExploreSidebar`、`ExploreMap`、`useExplore`、Google Maps / Places 與各縣市停車 API。

## 主要行為

- 將目前分頁、清單與選取項目傳給子元件。
- 點擊清單或地圖標記時，同步更新選取項目與所屬分頁。
- 處理定位、導航與關閉提示事件。
- 輸入至少兩字並停頓 400ms 後查 Google 建議；首次搜尋自動請求定位，候選依可用直線距離排序；拒絕定位時保留 Google 候選順序。
- 停車場有車位優先、車位未知其次、滿位最後；各組依目的地直線距離排序。
- 桌面使用左右欄配置；手機使用上方地圖、下方清單。

## 狀態與限制

- 固定尺寸、間距、圓角、字級與線寬使用 tag 上明確數值的 Tailwind class；比例保留 `%`／視窗單位。
- 色值定義於 `theme-color.scss`；`variables.scss` 只逐一宣告 `text-*`、`bg-*`、`line-*` 等顏色 class，不使用 Tailwind 指令或迴圈。
- 陰影、格線、hover 與選取效果直接寫在 tag 的 Tailwind class，涉及色值時引用主題 CSS 變數。
- `main.scss` 只保留 body、鍵盤 focus 等必要全域樣式；必要且 Tailwind 不適合表達的元件樣式才使用 scoped。
- 地點使用 Google 搜尋；搜尋開放台灣，停車場位置、費率與車位依縣市使用市府或 TDX 資料，距離為一公里內直線距離。
- 收到供應商的明確配額錯誤時顯示置中 dialog，阻擋後續 Google／停車 API；關閉 dialog 不解除配額封鎖。
- 網路、逾時與其他服務異常依原因顯示 dialog，恢復後可重試；不在網站預先檢查或計數 API 用量。
- Google 配額錯誤顯示「今日免費查詢額度已達上限，請明日再試！」；錯誤可能來自每分鐘或每日上限，並不代表費用報表的免費額度已用完。
- 處理 loading、空結果與 API 失敗；Google key 由 .env.local 提供，缺少時顯示設定提示。
- 裝置定位不需要 Google key；導航另開 Google Maps 網頁。
- 頁面專屬 composables、constants、types 位於 `views/explore`；子元件位於 `src/components/explore`。
</spec>
