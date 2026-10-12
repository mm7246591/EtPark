<script setup lang="ts">
import { shallowRef, watch, nextTick } from 'vue';
import {
  ComboboxRoot,
  ComboboxInput,
  ComboboxContent,
  ComboboxItem,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  Toggle,
} from 'reka-ui';
import type {
  Place,
  PlaceKind,
  SearchSuggestion,
  ParkingLot,
} from '../../views/explore/types/place';

const props = defineProps<{
  searching: boolean;
  searchMessage: string;
  noticeMessage: string;
  source: string;
  parkingNotice: string;
  activeKind: PlaceKind;
  selected: Place | null;
  suggestions: SearchSuggestion[];
  loading: boolean;
  blocked: boolean;
  blockedMessage: string;
  mapsConfigured: boolean;
  places: Place[];
  foodCount: number;
  parkingCount: number;
  favoriteKeys?: string[];
  radius?: number;
  expanding?: boolean;
}>();
const emit = defineEmits<{
  inputSearch: [query: string];
  search: [query: string];
  chooseSuggestion: [suggestion: SearchSuggestion];
  refresh: [];
  select: [place: Place];
  switchKind: [kind: PlaceKind];
  navigate: [place: Place];
  locate: [];
  favorite: [place: ParkingLot];
  recordParking: [place: ParkingLot];
}>();
const query = shallowRef('');
const composing = shallowRef(false);
const showSuggestions = shallowRef(true);
watch(
  () => props.suggestions,
  () => {
    showSuggestions.value = true;
  }
);
const choose = (suggestion: SearchSuggestion) => {
  query.value = suggestion.name;
  showSuggestions.value = false;
  emit('chooseSuggestion', suggestion);
};
const input = () => {
  if (!composing.value) emit('inputSearch', query.value);
};
const compositionEnd = (event: CompositionEvent) => {
  composing.value = false;
  query.value = (event.target as HTMLInputElement).value;
  input();
};
const updateQuery = (value: string) => {
  query.value = value;
  input();
};
const ignoreEnter = (event: KeyboardEvent) => {
  if (event.isComposing || composing.value) return;
  event.preventDefault();
  event.stopPropagation();
};
const results = shallowRef<HTMLElement | null>(null);
watch(
  () => props.loading,
  async (loading, previous) => {
    if (
      !loading &&
      previous &&
      props.places.length &&
      window.matchMedia('(max-width: 767px)').matches
    ) {
      await nextTick();
      results.value?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }
);
</script>

<template>
  <TabsRoot
    :model-value="activeKind"
    as-child
    @update:model-value="(value) => emit('switchKind', value as PlaceKind)"
  >
    <aside
      class="bg-card z-[10] flex min-h-[0px] w-[100%] flex-1 flex-col overflow-y-auto shadow-[0_-1px_0_var(--line-primary)] md:h-[100%] md:w-[380px] md:flex-none md:shrink-0 md:overflow-hidden md:shadow-[1px_0_0_var(--line-primary)]"
      aria-label="周邊美食與停車場"
    >
      <header
        class="flex shrink-0 items-baseline justify-between gap-[12px] px-[16px] pb-[10px] pt-[14px] md:px-[20px] md:pb-[12px] md:pt-[20px]"
      >
        <h1 class="text-forest text-[24px] font-[700]">EtPark</h1>
        <p class="text-secondary text-[12px]">找到目的地，也找到停車位</p>
      </header>
      <div class="shrink-0 px-[16px] pb-[12px] md:px-[20px]">
        <ComboboxRoot
          :open="showSuggestions && suggestions.length > 0"
          :ignore-filter="true"
          :reset-search-term-on-blur="false"
          :reset-search-term-on-select="false"
          :open-on-focus="true"
          @update:open="showSuggestions = $event"
        >
          <form
            class="flex gap-[8px]"
            @submit.prevent
          >
            <label
              for="destination-query"
              class="sr-only"
            >
              店名或地址
            </label>
            <ComboboxInput
              id="destination-query"
              v-model="query"
              class="line-control bg-card min-w-[0px] flex-1 rounded-[10px] border-[1px] px-[12px] py-[10px] text-[14px]"
              placeholder="輸入台灣店名或地址"
              :disabled="blocked || loading || !mapsConfigured"
              @update:model-value="updateQuery"
              @compositionstart="composing = true"
              @compositionend="compositionEnd"
              @keydown.enter.capture="ignoreEnter"
            />
            <button
              type="button"
              class="bg-brand-primary text-inverse flex items-center gap-[4px] rounded-[10px] px-[14px] text-[14px] font-[500] hover:bg-[color:var(--brand-tertiary)] disabled:opacity-[0.4] disabled:hover:bg-[color:var(--brand-primary)]"
              :disabled="blocked || loading || !mapsConfigured || !query.trim()"
              @click="emit('search', query)"
            >
              <span
                aria-hidden="true"
                class="material-symbols-rounded shrink-0 text-[18px]"
              >
                search
              </span>
              <span>搜尋</span>
            </button>
          </form>
          <p
            v-if="!mapsConfigured"
            class="text-secondary mt-[8px] text-[12px]"
          >
            尚未設定地圖 key，請先完成設定或使用裝置定位。
          </p>
          <p
            v-if="searching || searchMessage"
            role="status"
            class="text-secondary mt-[8px] text-[12px] leading-[20px]"
          >
            {{ searching ? '搜尋建議中…' : searchMessage }}
          </p>
          <ComboboxContent
            v-if="suggestions.length"
            id="destination-suggestions"
            class="mt-[8px] max-h-[280px] overflow-y-auto"
            aria-label="地點搜尋建議"
          >
            <ComboboxItem
              v-for="suggestion in suggestions"
              :key="suggestion.id"
              :value="suggestion.id"
              :disabled="blocked || loading"
              class="line-primary block w-[100%] cursor-pointer rounded-[8px] border-b-[1px] px-[10px] py-[10px] text-left text-[14px] outline-none last:border-b-[0px] hover:bg-[color:var(--background-primary)] data-[highlighted]:bg-[color:var(--background-available)]"
              @select="choose(suggestion)"
            >
              <span class="text-primary font-[700]">{{ suggestion.name }}</span>
              <span
                class="text-secondary mt-[4px] block text-[12px] leading-[20px]"
              >
                {{ suggestion.address || suggestion.description }}
              </span>
            </ComboboxItem>
          </ComboboxContent>
        </ComboboxRoot>
        <div class="ml-[-8px] mt-[8px] flex flex-wrap gap-[4px]">
          <button
            class="text-forest inline-flex items-center gap-[4px] rounded-[8px] px-[8px] py-[6px] text-[14px] font-[500] hover:bg-[color:var(--background-available)] disabled:opacity-[0.4] disabled:hover:bg-transparent"
            :disabled="blocked || loading"
            @click="emit('locate')"
          >
            <span
              aria-hidden="true"
              class="material-symbols-rounded shrink-0 text-[18px]"
            >
              my_location
            </span>
            <span>目前位置</span>
          </button>
          <button
            class="text-forest inline-flex items-center gap-[4px] rounded-[8px] px-[8px] py-[6px] text-[14px] font-[500] hover:bg-[color:var(--background-available)] disabled:opacity-[0.4] disabled:hover:bg-transparent"
            :disabled="blocked || loading || !foodCount"
            @click="emit('refresh')"
          >
            <span
              aria-hidden="true"
              class="material-symbols-rounded shrink-0 text-[18px]"
            >
              refresh
            </span>
            <span>更新車位</span>
          </button>
        </div>
        <slot name="personal"></slot>
      </div>
      <TabsList
        class="line-primary flex shrink-0 border-b-[1px] px-[8px] md:px-[12px]"
        aria-label="搜尋類別"
      >
        <TabsTrigger
          value="food"
          class="text-secondary mb-[-1px] flex flex-1 items-center justify-center gap-[6px] border-b-[2px] border-transparent p-[12px] text-[14px]/[20px] font-[700] tabular-nums transition hover:text-[color:var(--text-primary)] data-[state=active]:border-[color:var(--line-food)] data-[state=active]:text-[color:var(--text-food-outline)]"
        >
          <span
            aria-hidden="true"
            class="material-symbols-rounded shrink-0 text-[18px]"
          >
            location_on
          </span>
          <span>目的地 ({{ foodCount }})</span>
        </TabsTrigger>
        <TabsTrigger
          value="parking"
          class="text-secondary mb-[-1px] flex flex-1 items-center justify-center gap-[6px] border-b-[2px] border-transparent p-[12px] text-[14px]/[20px] font-[700] tabular-nums transition hover:text-[color:var(--text-primary)] data-[state=active]:border-[color:var(--line-parking)] data-[state=active]:text-[color:var(--text-forest)]"
        >
          <span
            aria-hidden="true"
            class="material-symbols-rounded shrink-0 text-[18px]"
          >
            local_parking
          </span>
          <span>找車位 ({{ parkingCount }})</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent
        :value="activeKind"
        as-child
      >
        <div
          id="results-panel"
          ref="results"
          tabindex="0"
          class="bg-primary flex-1 shrink-0 p-[16px] md:min-h-[0px] md:overflow-y-auto"
        >
          <slot
            v-if="activeKind === 'parking' && foodCount"
            name="parking-controls"
          ></slot>
          <p
            v-if="activeKind === 'parking' && foodCount"
            role="status"
            :aria-busy="expanding ?? false"
            class="text-secondary mb-[12px] flex items-center gap-[6px] text-[12px]"
          >
            <span
              aria-hidden="true"
              class="material-symbols-rounded text-[18px]"
              :class="
                expanding ? 'animate-pulse motion-reduce:animate-none' : ''
              "
            >
              radar
            </span>
            <span>
              {{
                expanding
                  ? '正在調整搜尋範圍…'
                  : `搜尋範圍 ${(radius ?? 1000) / 1000} 公里`
              }}
            </span>
          </p>
          <p
            v-if="noticeMessage"
            role="status"
            class="text-secondary mb-[12px] text-[12px] leading-[20px]"
          >
            {{ noticeMessage }}
          </p>
          <p
            v-if="parkingNotice"
            role="status"
            class="text-secondary mb-[12px] text-[12px] leading-[20px]"
          >
            {{ parkingNotice }}
          </p>
          <p
            v-if="blocked"
            role="status"
            class="text-secondary p-[24px] text-center text-[14px]"
          >
            {{ blockedMessage }}
          </p>
          <p
            v-else-if="loading && !expanding"
            role="status"
            class="text-secondary mb-[12px] text-[14px]"
          >
            資料載入中…
          </p>
          <p
            v-else-if="!loading && !places.length"
            class="text-secondary mb-[12px] text-[14px]"
          >
            {{
              activeKind === 'food'
                ? '搜尋並選擇目的地，或使用目前位置。'
                : foodCount
                  ? `目前 ${(radius ?? 1000) / 1000} 公里範圍與篩選條件下沒有停車場，可調整排序或更換目的地。`
                  : '尚無附近停車場，請先選擇目的地。'
            }}
          </p>
          <article
            v-for="place in places"
            :key="`${place.kind}-${place.id}`"
            class="bg-card mb-[10px] rounded-[14px] border-[1px] p-[16px] transition"
            :class="
              selected?.kind === place.kind && selected?.id === place.id
                ? 'line-selected ring-[1px] ring-[color:var(--line-selected)]'
                : 'line-primary hover:border-[color:var(--line-control)]'
            "
          >
            <button
              class="block w-[100%] text-left"
              :aria-pressed="
                selected?.kind === place.kind && selected?.id === place.id
              "
              @click="emit('select', place)"
            >
              <span class="flex items-start justify-between gap-[12px]">
                <span class="min-w-[0px]">
                  <span
                    class="flex items-center gap-[4px] text-[16px]/[24px] font-[700]"
                  >
                    <span
                      v-if="place.kind === 'food'"
                      aria-hidden="true"
                      class="material-symbols-rounded text-food-outline shrink-0 text-[18px]"
                    >
                      location_on
                    </span>
                    {{ place.name }}
                  </span>
                  <span
                    v-if="place.kind === 'parking'"
                    class="text-secondary mt-[2px] block text-[12px] tabular-nums"
                  >
                    {{ place.distance }} m
                    <template v-if="place.drivingMinutes != null">
                      · 開車約 {{ place.drivingMinutes }} 分鐘
                    </template>
                  </span>
                </span>
                <span
                  v-if="place.kind === 'parking'"
                  class="shrink-0 text-right"
                >
                  <span
                    v-if="place.spaces !== null"
                    class="block text-[24px]/[28px] font-[700] tabular-nums"
                    :class="
                      place.spaces === 0
                        ? 'text-[color:var(--status-full)]'
                        : place.spaces <= 5
                          ? 'text-few-text'
                          : 'text-forest'
                    "
                  >
                    {{ place.spaces === 0 ? '滿' : place.spaces }}
                  </span>
                  <span class="text-secondary block text-[12px]">
                    {{
                      place.spaces === null
                        ? '車位未提供'
                        : place.spaces === 0
                          ? '已客滿'
                          : '剩餘車位'
                    }}
                  </span>
                </span>
              </span>
              <span
                class="text-secondary mt-[8px] block text-[14px] leading-[22px]"
              >
                {{ place.address }}
              </span>
              <span
                v-if="place.kind === 'food'"
                class="text-secondary mt-[4px] block text-[12px]"
              >
                <span
                  v-for="credit in place.attributions"
                  :key="credit.provider"
                  class="block"
                >
                  資料提供：{{ credit.provider }}
                </span>
              </span>
              <span
                v-else-if="place.price"
                class="text-secondary line-primary mt-[10px] block border-t-[1px] pt-[10px] text-[12px] leading-[20px]"
              >
                {{ place.price }}
              </span>
            </button>
            <div class="mt-[12px] flex items-center justify-end gap-[4px]">
              <Toggle
                v-if="place.kind === 'parking'"
                :model-value="
                  favoriteKeys?.includes(`${place.kind}-${place.id}`) ?? false
                "
                :aria-label="`${favoriteKeys?.includes(`${place.kind}-${place.id}`) ? '取消收藏' : '收藏'}${place.name}`"
                class="text-forest rounded-[8px] px-[10px] py-[8px] text-[14px] hover:bg-[color:var(--background-available)] data-[state=on]:bg-[color:var(--background-available)] data-[state=on]:font-[700]"
                @update:model-value="emit('favorite', place)"
              >
                {{
                  favoriteKeys?.includes(`${place.kind}-${place.id}`)
                    ? '已收藏'
                    : '收藏'
                }}
              </Toggle>
              <button
                v-if="place.kind === 'parking'"
                class="text-forest rounded-[8px] px-[10px] py-[8px] text-[14px] hover:bg-[color:var(--background-available)]"
                @click="emit('recordParking', place)"
              >
                記錄車位
              </button>
              <button
                class="bg-brand-primary text-inverse ml-[4px] inline-flex items-center gap-[6px] rounded-[8px] px-[14px] py-[8px] text-[14px] font-[500] hover:bg-[color:var(--brand-tertiary)]"
                :aria-label="`導航前往${place.name}`"
                @click="emit('navigate', place)"
              >
                <span
                  aria-hidden="true"
                  class="material-symbols-rounded shrink-0 text-[18px]"
                >
                  navigation
                </span>
                <span>開始導航</span>
              </button>
            </div>
          </article>
        </div>
      </TabsContent>
    </aside>
  </TabsRoot>
</template>

<spec lang="md">
# ExploreSidebar

## 元件定位

- 呈現目的地搜尋、候選地點、目的地與附近停車場清單。
- 子元件位於 src/components/explore。

## 公開介面

- Props：searching、searchMessage、noticeMessage、source、parkingNotice、activeKind、selected（可為 null）、places、foodCount、parkingCount、suggestions、loading、blocked、blockedMessage、mapsConfigured、favoriteKeys、radius、expanding。
- v-model：無公開 v-model，query 為內部輸入狀態。
- Emits：inputSearch、search、chooseSuggestion、refresh、select、switchKind、navigate、locate、favorite、recordParking。
- 主要依賴：views/explore/types/place、Vue、Reka UI Combobox／Tabs／Toggle、Tailwind CSS v3。

## 主要行為

- 搜尋候選只顯示店名與地址，不顯示距離或時間，也不查詢候選的行車時間。
- 停車場名稱下方顯示距離與從目前位置出發的預估開車分鐘，右側以大數字顯示剩餘車位，5 位以下改用琥珀色；缺少定位、查無路線或時間尚未取得時省略分鐘。
- 點擊開始導航向父頁面回報 navigate，以開啟 Google Maps 開車導航。
- 自動擴大時以 radar 圖示及「正在調整搜尋範圍…」顯示狀態，完成後顯示目前範圍；期間停用搜尋避免重複請求。
- personal 與 parking-controls slot 由父頁面提供紀錄與篩選介面；卡片回報收藏、取消收藏與記錄車位事件。

- 使用者直接輸入店名或地址，縣市由頁面流程自動判斷，不提供手動縣市選單。
- 中文組字完成後發出 inputSearch，由頁面延遲 400ms 查建議；點擊搜尋按鈕可立即搜尋；搜尋框 Enter 僅確認組字，不搜尋或選店。
- 建議只呈現名稱與地址；方向鍵移動候選高亮，點擊店家選取，Escape 關閉。
- 搜尋時由頁面自動取得定位；拒絕定位仍能搜尋，選擇建議時發出 chooseSuggestion。
- 顯示地址、臨停收費說明、距離（X m）與車位；收藏僅供停車場，已滿位不列入清單。
- 分頁支援方向鍵、Home 與 End；清單使用穩定 id。
- 定位、導航與更新操作由父元件處理。

## 狀態與限制

- 使用 Google Material Symbols Rounded，裝飾圖示設為 aria-hidden，操作保留文字或 aria-label。

- 手機版整個清單欄可捲動，操作區不固定占用結果高度；桌面保留清單獨立捲動。
- 處理載入、未設定 key、空清單及 nullable 選取狀態，不直接呼叫 API。
- 尺寸與效果使用 tag 上明確數值 Tailwind class；顏色使用 variables.scss 的普通 class，色值集中 theme-color.scss。
- 分頁與收藏的選取狀態使用 Reka data-state 搭配 Tailwind arbitrary value class 引用主題變數；目的地用陶土橘，找車位與主要按鈕用森林綠。
- 文字最低 12px，依 Tailwind v3 字級採用 12、14、16、18、20、24px 等級距，保留明確 px 寫法。
- 全域必要樣式位於 main.scss；頁面專屬型別位於 views/explore/types。
</spec>
