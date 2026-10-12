<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import ExplorePersonalPanel from '@/components/explore/ExplorePersonalPanel.vue';
import ParkingControls from '@/components/explore/ParkingControls.vue';
import ParkingRecordDialog from '@/components/explore/ParkingRecordDialog.vue';
import ApiUsageDialog from '@/components/explore/ApiUsageDialog.vue';
import { useApiUsage } from '@/composables/useApiUsage';
import { usePersonalPlaces } from './composables/usePersonalPlaces';
import type { SavedPlace } from './types/personal';
import type { ParkingLot } from './types/place';
import { getGoogleMapsNavigationUrl } from './utils/navigation';
import ExploreSidebar from '../../components/explore/ExploreSidebar.vue';
import ExploreMap from '../../components/explore/ExploreMap.vue';
import { useExplore } from './composables/useExplore';

const { blocked, dialogOpen, dialogMessage } = useApiUsage();
const {
  radius,
  expanding,
  parkingTotal,
  parkingSort,
  openSaved,
  destination,
  searching,
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
  locate,
} = useExplore();
const {
  favorites,
  recent,
  parked,
  storageMessage,
  toggleFavorite,
  removeFavorite,
  addRecent,
  clearRecent,
  saveParking,
  clearParking,
} = usePersonalPlaces();
watch(destination, (place) => {
  if (place && !place.id.startsWith('saved-parking:')) addRecent(place);
});
const recordPlace = shallowRef<SavedPlace | null>(null);
const recordNote = shallowRef('');
const recordParking = (place: ParkingLot) => {
  recordNote.value = '';
  recordPlace.value = {
    id: place.id,
    kind: place.kind,
    name: place.name,
    address: place.address,
    location: place.location,
    savedAt: Date.now(),
  };
};
const editParking = () => {
  if (!parked.value) return;
  recordNote.value = parked.value.note;
  recordPlace.value = parked.value.place;
};
const saveRecord = (note: string) => {
  if (recordPlace.value) saveParking(recordPlace.value, note);
  recordPlace.value = null;
};
const navigateTo = (place: Parameters<typeof select>[0]) => {
  select(place);
  window.open(
    getGoogleMapsNavigationUrl(place.location),
    '_blank',
    'noopener,noreferrer'
  );
};
</script>

<template>
  <main
    class="flex h-[100dvh] min-h-[0px] flex-col-reverse overflow-hidden md:flex-row"
  >
    <ExploreSidebar
      :searching="searching"
      :search-message="searchMessage"
      :notice-message="message === dialogMessage ? '' : message"
      :source="source"
      :parking-notice="parkingNotice"
      :suggestions="suggestions"
      :loading="loading || expanding"
      :blocked="blocked"
      :blocked-message="dialogMessage"
      :maps-configured="mapsConfigured"
      :active-kind="activeKind"
      :selected="selected"
      :places="places"
      :food-count="restaurants.length"
      :parking-count="parkingLots.length"
      :radius="radius"
      :expanding="expanding"
      :favorite-keys="favorites.map((item) => `${item.kind}-${item.id}`)"
      @input-search="inputSearch"
      @search="search"
      @choose-suggestion="chooseSuggestion"
      @refresh="refresh"
      @select="select"
      @switch-kind="switchKind"
      @navigate="navigateTo"
      @locate="locate"
      @favorite="toggleFavorite"
      @record-parking="recordParking"
    >
      <template #personal>
        <ExplorePersonalPanel
          :favorites="favorites"
          :recent="recent"
          :parked="parked"
          :message="storageMessage"
          :disabled="blocked || loading || expanding"
          @open="openSaved"
          @remove-favorite="removeFavorite"
          @clear-recent="clearRecent"
          @edit-parking="editParking"
          @clear-parking="clearParking"
        />
      </template>
      <template #parking-controls>
        <ParkingControls
          :sort="parkingSort"
          :disabled="loading || expanding || blocked"
          :total="parkingTotal"
          :count="parkingLots.length"
          @sort="parkingSort = $event"
        />
      </template>
    </ExploreSidebar>
    <ExploreMap
      :restaurants="restaurants"
      :parking-lots="parkingLots"
      :selected="selected"
      :blocked="blocked"
      @select="select"
    />
    <ParkingRecordDialog
      :place="recordPlace"
      :note="recordNote"
      @close="recordPlace = null"
      @save="saveRecord"
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
- 主要依賴：`ExploreSidebar`、`ExploreMap`、`useExplore`、`ExplorePersonalPanel`、`ParkingControls`、`ParkingRecordDialog`、`usePersonalPlaces`、Google Maps / Places 與各縣市停車 API。

## 主要行為

- 將目前分頁、清單與選取項目傳給子元件。
- 點擊清單或地圖標記時，同步更新選取項目與所屬分頁。
- 處理定位、導航與關閉提示事件。
- 輸入至少兩字並停頓 400ms 後查 Google 建議；首次搜尋自動請求定位，候選依可用直線距離排序；拒絕定位時保留 Google 候選順序。
- 停車場排除滿位，預設依目的地直線距離排序；可切換剩餘車位由多到少或停一小時費用由低到高。
- 停車場收藏與最近搜尋保存於瀏覽器，重開地點時重新查詢；停車記錄可保存樓層、區域或車格。
- 預設搜尋 1 公里；範圍內沒有確定有空位的停車場，自動逐步擴大至 2／3 公里，最多 3 公里；調整狀態會呈現在清單，沿用同一份停車資料及五分鐘時間暫存。
- 多選排序依勾選先後決定優先順序；勾選剩餘車位時排除未知，全部取消則恢復目的地距離排序；費用只比較可明確推算的一小時費率，條件不明的放在後方。
- 桌面使用左右欄配置；手機使用上方地圖、下方清單。

## 狀態與限制

- 固定尺寸、間距、圓角、字級與線寬使用 tag 上明確數值的 Tailwind class；比例保留 `%`／視窗單位。
- 色值定義於 `theme-color.scss`；`variables.scss` 只逐一宣告 `text-*`、`bg-*`、`line-*` 等顏色 class，不使用 Tailwind 指令或迴圈。
- 陰影、格線、hover 與選取效果直接寫在 tag 的 Tailwind class，涉及色值時引用主題 CSS 變數。
- `main.scss` 只保留 body、鍵盤 focus 等必要全域樣式；必要且 Tailwind 不適合表達的元件樣式才使用 scoped。
- 地點使用 Google 搜尋；搜尋開放台灣，停車場位置、費率與車位依縣市使用市府或 TDX 資料（雙北與新竹市用市府資料，其餘縣市用 TDX），預設 1 公里，沒有可確認的空位時自動擴大至最多 3 公里，距離為目的地到停車場的直線距離；只查所在縣市。
- 收到 Google 的明確配額錯誤時顯示置中 dialog，阻擋後續 Google／停車 API；關閉 dialog 不解除配額封鎖。
- 停車 API 回傳 429（TDX 每分鐘呼叫上限）時只提示稍候約一分鐘，不封鎖後續查詢。
- 網路、逾時與其他服務異常依原因顯示 dialog，恢復後可重試；不在網站預先檢查或計數 API 用量。
- Google 配額錯誤顯示「今日免費查詢額度已達上限，請明日再試！」；錯誤可能來自每分鐘或每日上限，並不代表費用報表的免費額度已用完。
- 處理 loading、空結果與 API 失敗；Google key 由 .env.local 提供，缺少時顯示設定提示。
- 點擊開始導航，以目的地座標開啟 Google Maps 開車導航；導航起點與定位由 Google Maps 處理。
- 停車場的行車時間使用 Routes API Route Matrix，只查基本開車時間，不含即時路況；每個終點計算一個用量元素，同一起終點暫存 5 分鐘，未定位不查詢。
- 頁面專屬 composables、constants、types 位於 `views/explore`；子元件位於 `src/components/explore`。
</spec>
