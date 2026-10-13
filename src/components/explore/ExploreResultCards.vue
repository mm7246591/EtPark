<script setup lang="ts">
import { computed, shallowRef, watch, nextTick } from 'vue';
import { TabsList, TabsTrigger, TabsContent, Toggle } from 'reka-ui';
import type {
  Place,
  PlaceKind,
  ParkingLot,
} from '../../views/explore/types/place';
import { formatParkingFee } from '../../views/explore/utils/parkingFee';

const props = defineProps<{
  noticeMessage: string;
  parkingNotice: string;
  activeKind: PlaceKind;
  selected: Place | null;
  loading: boolean;
  blocked: boolean;
  places: Place[];
  foodCount: number;
  favoriteKeys?: string[];
  radius?: number;
  expanding?: boolean;
}>();
const emit = defineEmits<{
  select: [place: Place];
  navigate: [place: Place];
  favorite: [place: ParkingLot];
  recordParking: [place: ParkingLot];
}>();
const isSelected = (place: Place) =>
  props.selected?.kind === place.kind && props.selected?.id === place.id;
const isFavorite = (place: Place) =>
  props.favoriteKeys?.includes(`${place.kind}-${place.id}`) ?? false;
const spacesBadge = (spaces: number | null) => {
  if (spaces === null)
    return { text: '車位未提供', class: 'bg-primary text-secondary' };
  if (spaces === 0) return { text: '已客滿', class: 'bg-full text-white' };
  if (spaces < 10)
    return { text: `剩 ${spaces} 位`, class: 'bg-few-light text-few-text' };
  return {
    text: `${spaces} 位`,
    class: 'bg-available text-[color:var(--brand-tertiary)]',
  };
};
const results = shallowRef<HTMLElement | null>(null);
// 手機抽屜是否展開；桌面面板一律顯示清單，不受影響。
const expanded = shallowRef(true);
// 還沒選目的地時不能收合，維持顯示搜尋提示。
const collapsed = computed(() => !expanded.value && props.foodCount > 0);
// 選取改變（含點地圖標記）時展開抽屜，並把對應卡片（含展開的操作列）捲進清單的可見範圍；切換分頁不改變開合。
watch(
  () => props.selected,
  async () => {
    expanded.value = true;
    await nextTick();
    results.value
      ?.querySelector('[aria-pressed="true"]')
      ?.closest('li')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
);
</script>

<template>
  <!-- 手機為底部抽屜；桌面為左側浮動面板的下半部，與搜尋列共用 ExploreView 的面板底板。 -->
  <section
    aria-label="搜尋結果"
    class="bg-card relative z-[10] flex max-h-[56dvh] min-h-[0px] min-w-[0px] flex-col rounded-t-[24px] shadow-[0_-8px_30px_var(--shadow-medium)] [grid-area:sheet] md:mx-[16px] md:mb-[36px] md:max-h-none md:rounded-[24px] md:rounded-t-[0px] md:shadow-none"
    :class="foodCount && !collapsed ? 'max-md:h-[56dvh]' : ''"
  >
    <button
      type="button"
      class="flex h-[24px] w-[100%] shrink-0 items-center justify-center rounded-t-[24px] md:hidden"
      :aria-label="collapsed ? '展開清單' : '收合清單'"
      :aria-expanded="!collapsed"
      aria-controls="results-panel"
      :disabled="!foodCount"
      @click="expanded = collapsed"
    >
      <span
        aria-hidden="true"
        class="h-[4px] w-[40px] rounded-[9999px] bg-[color:var(--line-control)]"
      ></span>
    </button>
    <div
      class="shrink-0 px-[16px] md:px-[20px]"
      :class="
        collapsed ? 'max-md:pb-[max(12px,env(safe-area-inset-bottom))]' : ''
      "
    >
      <TabsList
        class="bg-primary grid grid-cols-2 gap-[4px] rounded-[14px] p-[4px]"
        aria-label="搜尋類別"
      >
        <TabsTrigger
          value="food"
          class="text-secondary min-h-[40px] rounded-[10px] text-[14px] transition hover:text-[color:var(--text-primary)] data-[state=active]:bg-[color:var(--background-input)] data-[state=active]:font-[500] data-[state=active]:text-[color:var(--text-brand)] data-[state=active]:shadow-[0_2px_6px_var(--shadow-medium)]"
        >
          目的地
        </TabsTrigger>
        <TabsTrigger
          value="parking"
          class="text-secondary min-h-[40px] rounded-[10px] text-[14px] transition hover:text-[color:var(--text-primary)] data-[state=active]:bg-[color:var(--background-input)] data-[state=active]:font-[500] data-[state=active]:text-[color:var(--text-brand)] data-[state=active]:shadow-[0_2px_6px_var(--shadow-medium)]"
        >
          停車場
        </TabsTrigger>
      </TabsList>
      <div
        v-if="activeKind === 'parking' && (foodCount || expanding)"
        class="mt-[8px] flex min-h-[32px] items-center justify-between gap-[8px] md:mt-[10px]"
      >
        <!-- 兩段各自不換行，寬度不足時整段「實際費率…」換到第二行。 -->
        <p class="text-secondary min-w-[0px] text-[12px]">
          <span
            role="status"
            :aria-busy="expanding ?? false"
            class="whitespace-nowrap"
          >
            {{
              expanding
                ? '正在調整搜尋範圍…'
                : `搜尋範圍 ${(radius ?? 1000) / 1000} 公里 · ${places.length} 處`
            }}
          </span>
          <span
            v-if="!expanding && places.length"
            class="whitespace-nowrap"
          >
            · 實際費率以現場公告為準
          </span>
        </p>
        <slot name="parking-controls"></slot>
      </div>
      <!-- 目的地分頁收合時改顯示目的地名稱與地址，與停車場的搜尋範圍列同高，兩個分頁收合高度一致。 -->
      <p
        v-if="activeKind === 'food' && collapsed && places[0]"
        class="mt-[8px] flex min-h-[32px] items-center gap-[4px] md:hidden"
      >
        <span
          aria-hidden="true"
          class="material-symbols-rounded text-food-outline shrink-0 text-[18px]"
        >
          location_on
        </span>
        <span class="min-w-[0px] truncate text-[14px] font-[500]">
          {{ places[0].name }}
          <span class="text-secondary ml-[4px] text-[12px] font-[400]">
            {{ places[0].address }}
          </span>
        </span>
      </p>
    </div>
    <TabsContent
      :value="activeKind"
      as-child
    >
      <div
        id="results-panel"
        tabindex="0"
        class="min-h-[0px] flex-1 overflow-y-auto px-[16px] pb-[max(16px,env(safe-area-inset-bottom))] pt-[8px]"
        :class="collapsed ? 'max-md:hidden' : ''"
      >
        <p
          v-if="noticeMessage"
          role="status"
          class="text-secondary pb-[6px] text-[12px] leading-[20px]"
        >
          {{ noticeMessage }}
        </p>
        <p
          v-if="parkingNotice"
          role="status"
          class="text-secondary pb-[6px] text-[12px] leading-[20px]"
        >
          {{ parkingNotice }}
        </p>
        <p
          v-if="!blocked && loading && !expanding"
          role="status"
          class="text-secondary py-[8px] text-[14px]"
        >
          資料載入中…
        </p>
        <p
          v-else-if="!blocked && !loading && !places.length"
          class="text-secondary py-[8px] text-[14px]"
        >
          {{
            activeKind === 'food'
              ? '搜尋並選擇目的地，或使用目前位置。'
              : foodCount
                ? `目前 ${(radius ?? 1000) / 1000} 公里範圍與篩選條件下沒有停車場，可調整排序或更換目的地。`
                : '尚無附近停車場，請先選擇目的地。'
          }}
        </p>
        <ol
          v-if="places.length"
          ref="results"
          class="flex flex-col gap-[10px]"
        >
          <li
            v-for="place in places"
            :key="`${place.kind}-${place.id}`"
            class="bg-input rounded-[18px] transition"
            :class="
              isSelected(place)
                ? 'shadow-[0_0_0_2px_var(--line-selected),0_6px_18px_var(--shadow-medium)]'
                : 'shadow-[0_2px_10px_var(--shadow-soft)]'
            "
          >
            <button
              class="flex w-[100%] flex-col gap-[4px] px-[14px] pb-[10px] pt-[12px] text-left md:gap-[6px] md:px-[16px] md:pb-[12px] md:pt-[14px]"
              :aria-pressed="isSelected(place)"
              @click="emit('select', place)"
            >
              <span class="flex items-start justify-between gap-[8px]">
                <span
                  class="flex min-w-[0px] items-start gap-[4px] break-words text-[16px] font-[500] leading-[24px]"
                >
                  <span
                    v-if="place.kind === 'food'"
                    aria-hidden="true"
                    class="material-symbols-rounded text-food-outline mt-[2px] shrink-0 text-[18px]"
                  >
                    location_on
                  </span>
                  {{ place.name }}
                </span>
                <span
                  v-if="place.kind === 'parking'"
                  class="shrink-0 rounded-[9999px] px-[10px] text-[12px] font-[500] tabular-nums leading-[20px]"
                  :class="spacesBadge(place.spaces).class"
                >
                  {{ spacesBadge(place.spaces).text }}
                </span>
              </span>
              <template v-if="place.kind === 'parking'">
                <span class="text-secondary text-[12px] tabular-nums">
                  {{ place.distance }} m
                  <template v-if="place.drivingMinutes != null">
                    · 開車約 {{ place.drivingMinutes }} 分鐘
                  </template>
                </span>
                <span
                  v-if="place.price"
                  class="text-[14px] font-[500] leading-[22px] text-[color:var(--brand-tertiary)]"
                >
                  計費方式：{{ formatParkingFee(place.price) }}
                </span>
              </template>
              <template v-else>
                <span class="text-secondary text-[12px]">
                  {{ place.address }}
                </span>
                <span
                  v-for="credit in place.attributions"
                  :key="credit.provider"
                  class="text-secondary text-[12px]"
                >
                  資料提供：{{ credit.provider }}
                </span>
              </template>
            </button>
            <div
              v-if="isSelected(place)"
              class="px-[14px] pb-[12px]"
            >
              <p
                v-if="place.kind === 'parking'"
                class="text-secondary mb-[10px] hidden text-[12px] md:block"
              >
                {{ place.address }}
              </p>
              <div class="flex items-center gap-[8px]">
                <template v-if="place.kind === 'parking'">
                  <Toggle
                    :model-value="isFavorite(place)"
                    :aria-label="`${isFavorite(place) ? '取消收藏' : '收藏'}${place.name}`"
                    class="bg-card text-brand line-primary flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[9999px] border-[1px] hover:bg-[color:var(--background-available)] data-[state=on]:border-[color:var(--brand-primary)] data-[state=on]:bg-[color:var(--brand-primary)] data-[state=on]:text-[color:var(--text-inverse)]"
                    @update:model-value="emit('favorite', place)"
                  >
                    <span
                      aria-hidden="true"
                      class="material-symbols-rounded text-[18px]"
                    >
                      bookmark
                    </span>
                  </Toggle>
                  <button
                    type="button"
                    :aria-label="`記錄${place.name}車位`"
                    class="bg-card text-brand line-primary min-h-[44px] shrink-0 rounded-[9999px] border-[1px] px-[14px] text-[14px] hover:bg-[color:var(--background-available)]"
                    @click="emit('recordParking', place)"
                  >
                    記錄車位
                  </button>
                </template>
                <button
                  type="button"
                  class="bg-brand-primary text-inverse flex min-h-[44px] flex-1 items-center justify-center gap-[6px] rounded-[9999px] text-[14px] font-[500] hover:bg-[color:var(--brand-tertiary)]"
                  :aria-label="`導航前往${place.name}`"
                  @click="emit('navigate', place)"
                >
                  <!-- main.scss 的圖示 class 設了 display，手機隱藏需用 ! 覆蓋。 -->
                  <span
                    aria-hidden="true"
                    class="material-symbols-rounded text-[16px] max-md:!hidden"
                  >
                    navigation
                  </span>
                  開始導航
                </button>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </TabsContent>
  </section>
</template>

<spec lang="md">
# ExploreResultCards

## 元件定位

- 目的地／停車場分頁與直向結果清單；子元件位於 src/components/explore，以 grid-area:sheet 放進 ExploreView 的頁面格線。
- 手機為地圖下方的圓角底部抽屜，頂部把手可點擊開合；桌面為左側浮動面板的下半部，接在搜尋列下方。版面依設計稿配置 3（浮動卡片）。

## 公開介面

- Props：noticeMessage、parkingNotice、activeKind、selected（可為 null）、loading、blocked、places、foodCount、favoriteKeys、radius、expanding。
- v-model：無；分頁值由父頁面的 Reka TabsRoot 管理，須放在 TabsRoot 內。
- Emits：select、navigate、favorite、recordParking。
- Slots：parking-controls，由父頁面在停車場分頁放入排序，位於搜尋範圍文字右側。
- 主要依賴：views/explore/types/place、views/explore/utils/parkingFee、Vue、Reka UI Tabs／Toggle、Google Material Symbols Rounded、Tailwind CSS v3。

## 主要行為

- 手機點擊頂部把手開合抽屜，展開時顯示清單；收合時停車場分頁只留分頁與「搜尋範圍 · 排序」列，目的地分頁改顯示目的地名稱與地址列，兩者同高，讓出地圖空間。
- 尚未選擇目的地時把手停用、點擊無反應，維持顯示搜尋提示；搜尋或選取改變（含點地圖標記）時自動展開；切換分頁維持原本的開合狀態。
- 分頁為兩欄分段控制，支援方向鍵、Home 與 End；切換結果由父頁面 TabsRoot 回報。
- 停車場分頁在分頁下方顯示「搜尋範圍 N 公里 · M 處 · 實際費率以現場公告為準」與排序，寬度不足時費率提醒整段換行；沒有結果時不顯示費率提醒，自動擴大範圍時改為「正在調整搜尋範圍…」。
- 停車場卡片第一行為名稱與車位標籤：一般「N 位」、10 位以下改用琥珀色「剩 N 位」、滿位「已客滿」、未提供「車位未提供」；下方為距離與從目前位置出發的預估開車分鐘，缺少定位、查無路線或時間尚未取得時省略分鐘。
- 計費方式以無底色的藍染深色文字「計費方式：」顯示，與上方距離文字左側對齊，依原始單位顯示小型車臨停費率（60元/小時、50元/30分鐘、50元/次、首小時 20元 · 之後 40元/小時，上限同樣標示「元」），平日／假日與時段分開列出，超過兩段時同單位顯示區間（不同單位列最常見費率）並標示「多段費率」；上限依原文標示當日、N 小時內、夜間、時段或單次，附前 N 分鐘免費；機車費率多數停車場未提供，不顯示；月租、季租等長期費用不顯示，無法判讀時保留原文。
- 目的地卡片顯示名稱、地址與資料來源。
- 停車場與目的地名稱（卡片標題與收合時的目的地列）使用 16px／14px、字重 500。
- 點擊卡片選取；只有選取中的卡片展開操作列：停車場為收藏、記錄車位與開始導航，目的地只有開始導航；桌面另顯示停車場地址，開始導航前加導航圖示。
- 選取改變時（含點地圖標記），把對應卡片捲進清單可見範圍；選取中的卡片以藍染外框標示。
- 收藏與記錄車位保留含停車場名稱的 aria-label；收藏僅供停車場，已滿位不列入清單。

## 狀態與限制

- 處理載入、空清單及 nullable 選取狀態，不直接呼叫 API；查詢額度用盡時不顯示提示文字，由對話框說明。
- 手機抽屜在選定目的地後展開時固定 56dvh、收合時兩個分頁同高，切換分頁高度不變；尚未選擇目的地時依內容高度，上限 56dvh；清單區可捲動並保留 iPhone 安全區域；收合時以 max-md:hidden 隱藏清單區，桌面填滿面板剩餘高度且不受開合狀態影響。
- 把手為整列寬、24px 高的按鈕（間距與設計稿相同），帶 aria-expanded、aria-controls 與「收合清單／展開清單」aria-label；只支援點擊，不支援拖曳調整高度。
- 分頁與收藏的選取狀態使用 Reka data-state 搭配 Tailwind arbitrary value class 引用主題變數：選中分頁為白底藍染字，已收藏、選取外框與主要按鈕用藍染。
- 圖示字型 class 在 main.scss 設了 display，只在手機隱藏的圖示用 `max-md:!hidden` 覆蓋。
- 使用 Google Material Symbols Rounded，裝飾圖示設為 aria-hidden，操作保留文字或 aria-label。
- 尺寸與效果使用 tag 上明確數值 Tailwind class；顏色使用 variables.scss 的普通 class，色值集中 theme-color.scss。
- 字級一律為偶數、最低 12px，保留明確 px 寫法。
</spec>
