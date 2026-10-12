<script setup lang="ts">
import { shallowRef, watch, nextTick } from 'vue';
import type {
  Place,
  PlaceKind,
  SearchSuggestion,
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
}>();
const query = shallowRef('');
const composing = shallowRef(false);
const showSuggestions = shallowRef(true);
const activeSuggestion = shallowRef(-1);
watch(
  () => props.suggestions,
  () => {
    activeSuggestion.value = -1;
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
const suggestionKey = (event: KeyboardEvent) => {
  if (event.isComposing || composing.value) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    return;
  }
  if (event.key === 'Escape') {
    showSuggestions.value = false;
    activeSuggestion.value = -1;
    return;
  }
  if (!props.suggestions.length || !showSuggestions.value) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (activeSuggestion.value < 0)
      activeSuggestion.value =
        event.key === 'ArrowDown' ? 0 : props.suggestions.length - 1;
    else
      activeSuggestion.value =
        (activeSuggestion.value +
          (event.key === 'ArrowDown' ? 1 : -1) +
          props.suggestions.length) %
        props.suggestions.length;
  }
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
const moveTab = (event: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  let kind: PlaceKind = props.activeKind === 'food' ? 'parking' : 'food';
  if (event.key === 'Home') kind = 'food';
  if (event.key === 'End') kind = 'parking';
  emit('switchKind', kind);
  const tabs = event.currentTarget as HTMLElement;
  tabs.querySelector<HTMLButtonElement>(`#${kind}-tab`)?.focus();
};
</script>

<template>
  <aside
    class="bg-card z-[10] flex min-h-[0px] w-[100%] flex-1 flex-col overflow-y-auto shadow-[0_10px_15px_-3px_var(--shadow-medium),0_4px_6px_-4px_var(--shadow-medium)] md:h-[100%] md:w-[380px] md:flex-none md:shrink-0 md:overflow-hidden"
    aria-label="周邊美食與停車場"
  >
    <header
      class="bg-brand-primary text-inverse shrink-0 px-[16px] py-[10px] md:px-[20px] md:py-[20px]"
    >
      <h1 class="text-[22px] font-[700]">EtPark</h1>
      <p class="mt-[4px] text-[13px]">找到目的地，也找到停車位</p>
    </header>
    <div
      class="line-primary shrink-0 border-b-[1px] px-[16px] py-[10px] md:px-[20px] md:py-[12px]"
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
        <input
          id="destination-query"
          v-model="query"
          class="line-primary bg-primary min-w-[0px] flex-1 rounded-[8px] border-[1px] px-[10px] py-[10px] text-[14px]"
          placeholder="輸入台灣店名或地址"
          :disabled="blocked || loading || !mapsConfigured"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="destination-suggestions"
          :aria-expanded="showSuggestions && suggestions.length > 0"
          :aria-activedescendant="
            activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : undefined
          "
          @input="input"
          @compositionstart="composing = true"
          @compositionend="compositionEnd"
          @keydown="suggestionKey"
          @focus="showSuggestions = true"
        />
        <button
          type="button"
          class="bg-brand-tertiary flex items-center gap-[4px] rounded-[8px] px-[12px] text-[14px] text-white disabled:opacity-[0.5]"
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
      <ul
        v-if="showSuggestions && suggestions.length"
        id="destination-suggestions"
        role="listbox"
        class="mt-[8px] max-h-[280px] overflow-y-auto"
        aria-label="地點搜尋建議"
      >
        <li
          v-for="(suggestion, index) in suggestions"
          :key="suggestion.id"
          role="presentation"
        >
          <button
            :id="`suggestion-${index}`"
            type="button"
            role="option"
            :aria-selected="activeSuggestion === index"
            class="line-primary w-[100%] rounded-[6px] border-b-[1px] px-[8px] py-[10px] text-left text-[13px] hover:bg-[color:var(--background-primary)]"
            :class="activeSuggestion === index ? 'bg-available' : ''"
            :disabled="blocked || loading"
            @click="choose(suggestion)"
          >
            <span class="flex items-start justify-between gap-[8px]">
              <span class="text-primary font-[700]">{{ suggestion.name }}</span>
            </span>
            <span
              class="text-secondary mt-[4px] block text-[12px] leading-[20px]"
            >
              {{ suggestion.address || suggestion.description }}
            </span>
          </button>
        </li>
      </ul>
      <div class="mt-[10px] flex flex-wrap gap-[8px]">
        <button
          class="bg-primary inline-flex items-center gap-[6px] rounded-[6px] px-[10px] py-[8px] text-[12px] disabled:opacity-[0.5]"
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
          class="bg-primary inline-flex items-center gap-[6px] rounded-[6px] px-[10px] py-[8px] text-[12px] disabled:opacity-[0.5]"
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
    </div>
    <div
      class="line-primary flex shrink-0 border-b-[1px]"
      role="tablist"
      aria-label="搜尋類別"
      @keydown="moveTab"
    >
      <button
        id="food-tab"
        role="tab"
        aria-controls="results-panel"
        :aria-selected="activeKind === 'food'"
        :tabindex="activeKind === 'food' ? 0 : -1"
        class="flex flex-1 items-center justify-center gap-[6px] border-b-[3px] p-[12px] text-[14px]/[20px] font-[700] transition"
        :class="
          activeKind === 'food'
            ? 'line-food bg-food-active text-food-outline'
            : 'text-secondary border-transparent hover:bg-[color:var(--background-primary)]'
        "
        @click="emit('switchKind', 'food')"
      >
        <span
          aria-hidden="true"
          class="material-symbols-rounded shrink-0 text-[18px]"
        >
          location_on
        </span>
        <span>目的地 ({{ foodCount }})</span>
      </button>
      <button
        id="parking-tab"
        role="tab"
        aria-controls="results-panel"
        :aria-selected="activeKind === 'parking'"
        :tabindex="activeKind === 'parking' ? 0 : -1"
        class="flex flex-1 items-center justify-center gap-[6px] border-b-[3px] p-[12px] text-[14px]/[20px] font-[700] transition"
        :class="
          activeKind === 'parking'
            ? 'line-parking bg-available text-forest'
            : 'text-secondary border-transparent hover:bg-[color:var(--background-primary)]'
        "
        @click="emit('switchKind', 'parking')"
      >
        <span
          aria-hidden="true"
          class="material-symbols-rounded shrink-0 text-[18px]"
        >
          local_parking
        </span>
        <span>找車位 ({{ parkingCount }})</span>
      </button>
    </div>
    <div
      id="results-panel"
      ref="results"
      role="tabpanel"
      :aria-labelledby="`${activeKind}-tab`"
      tabindex="0"
      class="bg-primary flex-1 shrink-0 p-[16px] md:min-h-[0px] md:overflow-y-auto"
    >
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
        v-else-if="loading"
        role="status"
        class="text-secondary mb-[12px] text-[14px]"
      >
        資料載入中…
      </p>
      <p
        v-else-if="!places.length"
        class="text-secondary mb-[12px] text-[14px]"
      >
        {{
          activeKind === 'food'
            ? '搜尋並選擇目的地，或使用目前位置。'
            : foodCount
              ? '此地點一公里內沒有可顯示的停車資料。'
              : '尚無附近停車場，請先選擇目的地。'
        }}
      </p>
      <article
        v-for="place in places"
        :key="`${place.kind}-${place.id}`"
        class="bg-card mb-[12px] rounded-[12px] border-[1px] p-[16px] shadow-[0_1px_2px_0_var(--shadow-soft)] transition hover:shadow-[0_4px_6px_-1px_var(--shadow-medium),0_2px_4px_-2px_var(--shadow-medium)]"
        :class="
          selected?.kind === place.kind && selected?.id === place.id
            ? 'line-selected ring-[1px] ring-[color:var(--line-selected)]'
            : 'line-primary'
        "
      >
        <button
          class="block w-[100%] text-left"
          :aria-pressed="
            selected?.kind === place.kind && selected?.id === place.id
          "
          @click="emit('select', place)"
        >
          <span class="flex items-start justify-between gap-[8px]">
            <span class="text-[16px]/[24px] font-[700] leading-[24px]">
              {{ place.name }}
            </span>
            <span
              v-if="place.kind === 'parking'"
              class="flex shrink-0 flex-col items-end gap-[6px]"
            >
              <span
                class="shrink-0 rounded-[6px] px-[8px] py-[4px] text-[12px]/[16px] font-[700]"
                :class="
                  place.spaces === null
                    ? 'bg-primary text-secondary'
                    : place.spaces === 0
                      ? 'bg-full text-white'
                      : place.spaces <= 5
                        ? 'bg-few text-few-text'
                        : 'bg-available text-forest'
                "
              >
                {{
                  place.spaces === null
                    ? '車位未提供'
                    : place.spaces === 0
                      ? '已客滿'
                      : `剩餘車位：${place.spaces}`
                }}
              </span>
              <span
                v-if="place.drivingMinutes != null"
                class="text-forest text-[12px] font-[500]"
              >
                約 {{ place.drivingMinutes }} 分鐘
              </span>
            </span>
          </span>
          <span
            class="text-secondary mt-[8px] block text-[13px] leading-[24px]"
          >
            <template v-if="place.kind === 'food'">
              {{ place.address }}
              <span
                v-for="credit in place.attributions"
                :key="credit.provider"
                class="mt-[4px] block text-[11px]"
              >
                資料提供：{{ credit.provider }}
              </span>
            </template>
            <template v-else>
              {{ place.address }}
              <br />
              直線距離 {{ place.distance }}m
              <br />
              {{ place.price }}
            </template>
          </span>
        </button>
        <div class="mt-[12px] flex flex-wrap justify-end gap-[8px]">
          <button
            class="bg-primary inline-flex items-center gap-[6px] rounded-[6px] px-[12px] py-[8px] text-[12px]/[16px] font-[500] hover:bg-[color:var(--brand-secondary)]"
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
  </aside>
</template>

<spec lang="md">
# ExploreSidebar

## 元件定位

- 呈現目的地搜尋、候選地點、目的地與附近停車場清單。
- 子元件位於 src/components/explore。

## 公開介面

- Props：searching、searchMessage、noticeMessage、source、parkingNotice、activeKind、selected（可為 null）、places、foodCount、parkingCount、suggestions、loading、blocked、blockedMessage、mapsConfigured。
- v-model：無公開 v-model，query 為內部輸入狀態。
- Emits：inputSearch、search、chooseSuggestion、refresh、select、switchKind、navigate、locate。
- 主要依賴：views/explore/types/place、Vue、Tailwind CSS v3。

## 主要行為

- 搜尋候選只顯示店名與地址，不顯示距離或時間，也不查詢候選的行車時間。
- 停車場剩餘車位下方顯示從目前位置出發的預估開車分鐘；缺少定位、查無路線或時間尚未取得時省略。
- 點擊開始導航向父頁面回報 navigate，以開啟 Google Maps 開車導航。

- 使用者直接輸入店名或地址，縣市由頁面流程自動判斷，不提供手動縣市選單。
- 中文組字完成後發出 inputSearch，由頁面延遲 400ms 查建議；點擊搜尋按鈕可立即搜尋；搜尋框 Enter 僅確認組字，不搜尋或選店。
- 建議呈現名稱與地址；啟用定位後才顯示直線距離，方向鍵移動候選高亮，點擊店家選取，Escape 關閉。
- 搜尋時由頁面自動取得定位；拒絕定位仍能搜尋，選擇建議時發出 chooseSuggestion。
- 顯示地址、來源收費說明、直線距離與車位；未知、滿位與少量車位以文字區分。
- 分頁支援方向鍵、Home 與 End；清單使用穩定 id。
- 定位、導航與更新操作由父元件處理。

## 狀態與限制

- 使用 Google Material Symbols Rounded，裝飾圖示設為 aria-hidden，操作保留文字或 aria-label。

- 手機版整個清單欄可捲動，操作區不固定占用結果高度；桌面保留清單獨立捲動。
- 處理載入、未設定 key、空清單及 nullable 選取狀態，不直接呼叫 API。
- 尺寸與效果使用 tag 上明確數值 Tailwind class；顏色使用 variables.scss 的普通 class，色值集中 theme-color.scss。
- 全域必要樣式位於 main.scss；頁面專屬型別位於 views/explore/types。
</spec>
