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
const emit = defineEmits<{ select: [place: Place] }>();
const host = shallowRef<HTMLElement | null>(null);
const places = computed<Place[]>(() => [
  ...props.restaurants,
  ...props.parkingLots,
]);
const { markers, mapError, ready } = useExploreMap(
  host,
  places,
  toRef(props, 'selected')
);
</script>

<template>
  <section
    aria-label="目的地與附近停車場地圖"
    class="bg-brand-secondary relative h-[28dvh] min-h-[160px] w-[100%] shrink-0 overflow-hidden md:h-[100%] md:min-h-[0px] md:min-w-[0px] md:flex-1"
  >
    <div
      ref="host"
      class="absolute inset-[0px]"
    ></div>
    <div
      v-if="!ready"
      class="absolute inset-[0px] flex flex-col items-center justify-center gap-[12px] bg-[image:linear-gradient(90deg,var(--background-primary)_2px,transparent_2px),linear-gradient(var(--background-primary)_2px,transparent_2px)] bg-[size:100px_100px] px-[24px] text-center"
    >
      <span
        aria-hidden="true"
        class="material-symbols-rounded shrink-0 text-[36px]"
      >
        map
      </span>
      <h2 class="text-[18px] font-[700]">{{ mapError || '地圖載入中…' }}</h2>
      <p
        v-if="!blocked"
        class="text-secondary max-w-[360px] text-[14px] leading-[22px]"
      >
        設定完成後會顯示真實 Google 地圖與停車場標記。請先設定
        key，再搜尋實際店名或地址。
      </p>
    </div>
    <p
      v-if="selected"
      role="status"
      class="bg-card pointer-events-none absolute left-[16px] top-[16px] flex max-w-[80%] items-center gap-[6px] rounded-[8px] px-[12px] py-[8px] text-[14px] shadow-[0_1px_2px_0_var(--shadow-soft)]"
    >
      <span
        aria-hidden="true"
        class="material-symbols-rounded shrink-0 text-[18px]"
      >
        location_on
      </span>
      <span>{{ selected.name }}</span>
    </p>
    <Teleport
      v-for="{ place, host: markerHost } in markers"
      :key="`${place.kind}-${place.id}`"
      :to="markerHost"
    >
      <button
        class="line-inverse flex min-h-[40px] items-center gap-[4px] whitespace-nowrap rounded-[9999px] border-[2px] px-[10px] py-[6px] text-[12px] font-[700] shadow-[0_4px_6px_-1px_var(--shadow-medium)]"
        :class="[
          place.kind === 'food'
            ? 'bg-brand-secondary text-food-text'
            : place.spaces === 0
              ? 'bg-full text-white'
              : 'bg-brand-tertiary text-white',
          selected?.id === place.id
            ? 'outline outline-[2px] outline-offset-[2px] outline-[color:var(--line-focus)]'
            : '',
        ]"
        :aria-label="
          place.kind === 'food'
            ? `目的地：${place.name}`
            : `${place.name}，${place.spaces === null ? '車位未提供' : `剩餘 ${place.spaces} 位`}`
        "
        :aria-pressed="selected?.id === place.id"
        @click="emit('select', place)"
      >
        <template v-if="place.kind === 'food'">
          <span
            aria-hidden="true"
            class="material-symbols-rounded shrink-0 text-[18px]"
          >
            location_on
          </span>
          {{ place.name }}
        </template>
        <template v-else>
          <span
            aria-hidden="true"
            class="material-symbols-rounded shrink-0 text-[18px]"
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
        </template>
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
- Emits：select(place)。
- 主要依賴：useExploreMap、Google Maps JavaScript API、Vue Teleport。

## 主要行為

- useExploreMap 只初始化一個地圖，以實際經緯度建立 Advanced Marker。
- Vue Teleport 將 template 按鈕放入標記內容，點擊回報頁面更新選取。
- 清單改變時更新標記與範圍；選取改變時平移地圖。
- 未設定 key、載入失敗或載入中時呈現明確提示，不顯示假座標。

## 狀態與限制

- 使用 Google Material Symbols Rounded，裝飾圖示設為 aria-hidden，操作保留文字或 aria-label。

- 未設定 key 時呈現設定提示；Google 地圖與搜尋需要有效 key。
- 卸載後清除標記與地圖事件，非同步初始化忽略已卸載元件。
- 尺寸、陰影與選取效果使用 tag 上明確數值 Tailwind class；顏色為 variables.scss 的普通 class，色值位於 theme-color.scss。
- 手機地圖為 28dvh、最小 160px，清單使用剩餘高度；桌面採左右欄。
- 保留 Google 地圖原有來源標示與控制項；不呼叫 Nearby Search。
</spec>
