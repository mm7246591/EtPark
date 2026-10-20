<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import {
  ComboboxRoot,
  ComboboxInput,
  ComboboxContent,
  ComboboxItem,
} from 'reka-ui';
import type { SearchSuggestion } from '../../views/explore/types/place';

const props = defineProps<{
  searching: boolean;
  searchMessage: string;
  suggestions: SearchSuggestion[];
  loading: boolean;
  blocked: boolean;
  mapsConfigured: boolean;
}>();
const emit = defineEmits<{
  inputSearch: [query: string];
  search: [query: string];
  chooseSuggestion: [suggestion: SearchSuggestion];
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
// 同一關鍵字已有結果時頁面不重查，先展開候選，按 Escape 收起後再按搜尋仍看得到。
const submit = () => {
  showSuggestions.value = true;
  emit('search', query.value);
};
const ignoreEnter = (event: KeyboardEvent) => {
  if (event.isComposing || composing.value) return;
  event.preventDefault();
  event.stopPropagation();
};
</script>

<template>
  <!-- 手機：品牌與搜尋框合成一顆浮在地圖上的膠囊；桌面：放進左側浮動面板頂部，標題在上、搜尋框在下。 -->
  <header
    class="bg-card relative z-[30] mx-[12px] mt-[12px] grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-[6px] rounded-[26px] py-[4px] pl-[16px] pr-[4px] shadow-[0_6px_20px_var(--shadow-medium)] [grid-area:search] has-[input:focus-visible]:outline has-[input:focus-visible]:outline-[2px] has-[input:focus-visible]:outline-offset-[2px] has-[input:focus-visible]:outline-[color:var(--line-focus)] md:mx-[16px] md:mt-[16px] md:block md:rounded-[24px] md:rounded-b-[0px] md:px-[20px] md:pb-[12px] md:pt-[20px] md:shadow-none md:has-[input:focus-visible]:outline-none"
  >
    <h1
      class="text-brand mr-[4px] flex h-[44px] items-center text-[16px] font-[500] md:mb-[12px] md:mr-[0px] md:block md:h-auto md:text-[20px]/[30px]"
    >
      EtPark
    </h1>
    <ComboboxRoot
      class="min-w-[0px] md:relative"
      :open="showSuggestions && suggestions.length > 0"
      :ignore-filter="true"
      :reset-search-term-on-blur="false"
      :reset-search-term-on-select="false"
      :open-on-focus="true"
      @update:open="showSuggestions = $event"
    >
      <form
        class="flex items-center gap-[6px] md:rounded-[9999px] md:border-[1px] md:border-[color:var(--line-primary)] md:bg-[color:var(--background-primary)] md:py-[4px] md:pl-[16px] md:pr-[4px] md:has-[input:focus-visible]:outline md:has-[input:focus-visible]:outline-[2px] md:has-[input:focus-visible]:outline-offset-[2px] md:has-[input:focus-visible]:outline-[color:var(--line-focus)]"
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
          class="h-[44px] min-w-[0px] flex-1 bg-transparent text-[16px] focus-visible:outline-none"
          placeholder="輸入店名或地址"
          :disabled="blocked || loading || !mapsConfigured"
          @update:model-value="updateQuery"
          @compositionstart="composing = true"
          @compositionend="compositionEnd"
          @keydown.enter.capture="ignoreEnter"
        />
        <button
          type="button"
          aria-label="搜尋"
          title="搜尋"
          class="bg-brand-primary text-inverse flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[9999px] hover:bg-[color:var(--brand-tertiary)] disabled:opacity-[0.4] disabled:hover:bg-[color:var(--brand-primary)]"
          :disabled="blocked || loading || !mapsConfigured || !query.trim()"
          @click="submit"
        >
          <span
            aria-hidden="true"
            class="material-symbols-rounded text-[20px]"
          >
            search
          </span>
        </button>
      </form>
      <p
        v-if="!mapsConfigured"
        class="text-secondary pb-[8px] pr-[12px] text-[12px] md:pb-[0px] md:pt-[8px]"
      >
        尚未設定地圖 key，請先完成設定或使用裝置定位。
      </p>
      <p
        v-if="searching || searchMessage"
        role="status"
        class="text-secondary pb-[8px] pr-[12px] text-[12px] leading-[20px] md:pb-[0px] md:pt-[8px]"
      >
        {{ searching ? '搜尋建議中…' : searchMessage }}
      </p>
      <!-- 手機以整顆膠囊（header）為定位基準，候選清單與膠囊同寬；桌面以搜尋框為基準。 -->
      <ComboboxContent
        v-if="suggestions.length"
        id="destination-suggestions"
        class="bg-card line-primary absolute left-[0px] right-[0px] top-[calc(100%+8px)] z-[40] max-h-[280px] overflow-y-auto rounded-[16px] border-[1px] p-[6px] shadow-[0_8px_24px_var(--shadow-medium)]"
        aria-label="地點搜尋建議"
      >
        <ComboboxItem
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          :value="suggestion.id"
          :disabled="blocked || loading"
          class="line-primary block w-[100%] cursor-pointer rounded-[10px] border-b-[1px] px-[10px] py-[10px] text-left text-[14px] outline-none last:border-b-[0px] hover:bg-[color:var(--background-primary)] data-[highlighted]:bg-[color:var(--background-available)]"
          @select="choose(suggestion)"
        >
          <span class="text-primary font-[500]">{{ suggestion.name }}</span>
          <span
            class="text-secondary mt-[4px] block text-[12px] leading-[20px]"
          >
            {{ suggestion.address || suggestion.description }}
          </span>
        </ComboboxItem>
      </ComboboxContent>
    </ComboboxRoot>
  </header>
</template>

<spec lang="md">
# ExploreSearchBar

## 元件定位

- 品牌標題與目的地搜尋列；子元件位於 src/components/explore，以 grid-area:search 放進 ExploreView 的頁面格線。
- 手機為浮在地圖頂部的膠囊，品牌名稱放在搜尋框左側；桌面放進左側浮動面板頂部，標題在上、搜尋框在下。

## 公開介面

- Props：searching、searchMessage、suggestions、loading、blocked、mapsConfigured。
- v-model：無公開 v-model，query 為內部輸入狀態。
- Emits：inputSearch、search、chooseSuggestion。
- 主要依賴：views/explore/types/place、Vue、Reka UI Combobox、Google Material Symbols Rounded、Tailwind CSS v3。

## 主要行為

- 使用者直接輸入店名或地址，縣市由頁面流程自動判斷，不提供手動縣市選單。
- 中文組字完成後發出 inputSearch，由頁面延遲 400ms 查建議；點擊搜尋按鈕可立即搜尋，同一關鍵字查詢中或已有結果時不重送請求，只重新展開候選；搜尋框 Enter 僅確認組字，不搜尋或選店。
- 建議只呈現名稱與地址，不顯示距離或時間，也不查詢候選的行車時間；方向鍵移動候選高亮，點擊店家選取，Escape 關閉。
- 候選以浮動清單蓋在地圖上，不推擠版面；手機與整顆膠囊同寬，桌面與搜尋框同寬。
- 搜尋時由頁面自動取得定位；拒絕定位仍能搜尋，選擇建議時發出 chooseSuggestion。

## 狀態與限制

- 查詢中、配額封鎖或未設定 key 時停用輸入與搜尋；未設定 key 時顯示設定提示。
- 搜尋框聚焦時，手機以整顆膠囊、桌面以搜尋框外框顯示 focus outline，輸入框本身不另畫外框。
- 搜尋按鈕為 44px 圓形放大鏡圖示，保留 aria-label 與 title。
- 手機品牌名稱以固定 44px 高度置中，不靠行高：Android 系統字級放大（含 LINE 內建瀏覽器）會連同 px 行高一起放大，靠行高會撐高膠囊、與搜尋按鈕上下錯位。
- 輸入框字級 16px：iOS（含 LINE 內建瀏覽器）聚焦小於 16px 的輸入框會自動放大頁面，造成版面左右位移。
- 字體沿用全站 Noto Sans TC。
- 尺寸與效果使用 tag 上明確數值 Tailwind class；顏色使用 variables.scss 的普通 class，色值集中 theme-color.scss。
</spec>
