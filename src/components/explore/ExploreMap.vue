<script setup lang="ts">
import { computed, shallowRef, toRef } from 'vue';
import { useExploreMap } from '../../views/explore/composables/useExploreMap';
import type {
  Place,
  Restaurant,
  ParkingLot,
} from '../../views/explore/types/place';

const props = defineProps<{
  restaurants: Restaurant[];
  parkingLots: ParkingLot[];
  selected: Place | null;
  blocked: boolean;
}>();
const emit = defineEmits<{ select: [place: Place]; blankClick: [] }>();
const host = shallowRef<HTMLElement | null>(null);
const places = computed<Place[]>(() => [
  ...props.restaurants,
  ...props.parkingLots,
]);
// 點標記時 Google 也會發出地圖 click，且拿不到原本的點擊目標；
// 改記錄最近一次按下的位置是否在標記按鈕上，按在標記上就不算點空白處。
let pressedMarker = false;
const notePress = (event: PointerEvent) => {
  pressedMarker =
    event.target instanceof Element && Boolean(event.target.closest('button'));
};
const { markers, mapError, ready, tilesLoaded } = useExploreMap(
  host,
  places,
  toRef(props, 'selected'),
  () => {
    if (!pressedMarker) emit('blankClick');
  }
);
</script>

<template>
  <section
    aria-label="目的地與附近停車場地圖"
    class="bg-primary relative min-h-[0px] min-w-[0px] overflow-hidden [grid-area:1/1/4/2] md:[grid-area:1/1/-1/-1]"
    @pointerdown.capture="notePress"
  >
    <div
      ref="host"
      class="absolute inset-[0px] transition-opacity duration-[200ms] motion-reduce:transition-none"
      :class="tilesLoaded ? 'opacity-[1]' : 'opacity-[0]'"
    ></div>
    <div
      v-if="!ready"
      class="absolute inset-[0px] flex flex-col items-center justify-center gap-[12px] bg-[image:linear-gradient(90deg,var(--line-primary)_1px,transparent_1px),linear-gradient(var(--line-primary)_1px,transparent_1px)] bg-[size:100px_100px] px-[24px] text-center"
    >
      <template v-if="!blocked">
        <span
          aria-hidden="true"
          class="material-symbols-rounded shrink-0 text-[36px]"
        >
          map
        </span>
        <h2 class="text-[18px] font-[500]">{{ mapError || '地圖載入中…' }}</h2>
        <p class="text-secondary max-w-[360px] text-[14px] leading-[22px]">
          設定完成後會顯示真實 Google 地圖與停車場標記。請先設定
          key，再搜尋實際店名或地址。
        </p>
      </template>
    </div>
    <Teleport
      v-for="{ place, host: markerHost } in markers"
      :key="`${place.kind}-${place.id}`"
      :to="markerHost"
    >
      <!-- 目的地為圓形圖釘加下方名稱；名稱絕對定位，標記錨點（底部中央）只看圓形，再下移半個圓讓圓心落在實際位置。 -->
      <button
        v-if="place.kind === 'food'"
        class="bg-brand-secondary text-food-text line-inverse relative flex h-[36px] w-[36px] translate-y-[18px] items-center justify-center rounded-[9999px] border-[3px] shadow-[0_3px_12px_var(--shadow-medium)] md:h-[44px] md:w-[44px] md:translate-y-[22px] md:border-[4px]"
        :aria-label="`目的地：${place.name}`"
        :aria-pressed="selected?.id === place.id"
        @click="emit('select', place)"
      >
        <span
          aria-hidden="true"
          class="material-symbols-rounded text-[18px] md:text-[22px]"
        >
          location_on
        </span>
        <span
          class="bg-card text-primary absolute left-[50%] top-[calc(100%+2px)] translate-x-[-50%] whitespace-nowrap rounded-[9999px] px-[8px] text-[12px]/[20px] font-[500] shadow-[0_2px_6px_var(--shadow-medium)] md:top-[calc(100%+4px)] md:px-[10px] md:py-[2px]"
        >
          {{ place.name }}
        </span>
      </button>
      <button
        v-else
        class="flex items-center gap-[4px] whitespace-nowrap rounded-[9999px] text-[12px] font-[500] tabular-nums shadow-[0_3px_10px_var(--shadow-medium)]"
        :class="[
          selected?.id === place.id
            ? 'bg-brand-tertiary text-inverse line-inverse border-[3px] px-[12px] py-[5px] md:px-[14px] md:py-[7px]'
            : 'border-[1px] px-[9px] py-[2px] md:px-[10px] md:py-[3px]',
          selected?.id === place.id
            ? ''
            : place.spaces === null
              ? 'bg-card text-brand line-parking'
              : place.spaces === 0
                ? 'bg-full line-inverse text-white'
                : 'bg-brand-primary text-inverse line-parking',
        ]"
        :aria-label="`${place.name}，${place.spaces === null ? '車位未提供' : `剩餘 ${place.spaces} 位`}`"
        :aria-pressed="selected?.id === place.id"
        @click="emit('select', place)"
      >
        <!-- main.scss 的圖示 class 設了 display，手機隱藏需用 ! 覆蓋。 -->
        <span
          aria-hidden="true"
          class="material-symbols-rounded text-[14px] max-md:!hidden"
        >
          directions_car
        </span>
        {{
          place.spaces === null
            ? '未知'
            : place.spaces === 0
              ? '滿'
              : place.spaces
        }}
      </button>
    </Teleport>
  </section>
</template>

<spec lang="md">
# ExploreMap

## 元件定位

- 顯示 Google 地圖、目的地與停車場標記。
- 子元件位於 src/components/explore。

## 公開介面

- Props：restaurants、parkingLots、selected（可為 null）、blocked。
- v-model：無。
- Emits：select(place)、blankClick（點地圖空白處，拖曳不算；點標記不觸發）。
- 主要依賴：useExploreMap、Google Maps JavaScript API、Vue Teleport。

## 主要行為

- useExploreMap 只初始化一個地圖，以實際經緯度建立 Advanced Marker。
- Vue Teleport 將 template 按鈕放入標記內容，點擊回報頁面更新選取。
- 清單改變時更新標記與範圍；選取改變時平移地圖。
- 未設定 key、載入失敗或載入中時呈現明確提示，不顯示假座標；查詢額度用盡時只由對話框提示，地圖區只留空白格線。

## 狀態與限制

- 使用 Google Material Symbols Rounded，裝飾圖示設為 aria-hidden，操作保留文字或 aria-label。

- 未設定 key 時呈現設定提示；Google 地圖與搜尋需要有效 key。
- 卸載後清除標記與地圖事件，非同步初始化忽略已卸載元件。
- 第一次圖磚載入完成（tilesloaded）前地圖保持透明，只露出頁面底色，完成後 200ms 淡入，避免閃出 Google 未套用樣式的預覽圖；減少動態效果偏好時不淡入。
- 地圖深淺色以 colorScheme 跟隨系統，只在建立地圖時決定；開著頁面切換系統深淺色時，頁面顏色立即切換，地圖重新整理後才會跟上。
- 停車場標記為車位數膠囊（桌面前方加車子圖示）：有車位為藍染底白字、未提供為白底藍框「未知」、滿位為紅底「滿」，選取中加深並加粗白框；目的地標記為弁柄紅圓形圖釘（白框、定位圖示），名稱以白底膠囊標在下方，圓心對準實際位置；手機圖釘 36px、桌面 44px；載入前顯示紙色格線底。
- 尺寸、陰影與選取效果使用 tag 上明確數值 Tailwind class；顏色為 variables.scss 的普通 class，色值位於 theme-color.scss。
- 手機佔頁面格線第 1～3 列（搜尋膠囊與操作列浮在上方），底部抽屜接在下方、不蓋住地圖底部，保留 Google 標誌；桌面鋪滿整頁，左側浮動面板疊在上方。選取名稱由清單卡片外框呈現，地圖上不另外顯示。
- 保留 Google 標誌、地圖資料版權與條款連結（服務條款要求）；關閉縮放鈕與「鍵盤快速鍵」，地圖不支援方向鍵平移與 +/- 縮放，改用手勢或滑鼠；不呼叫 Nearby Search。
</spec>
