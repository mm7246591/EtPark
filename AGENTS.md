# Etpark Web Agent Rules

本檔案適用於整個專案。修改程式前，先確認現有資料流、API contract、路由、共用呼叫者與測試；不要只依需求文字猜測實作位置。

## 技術與基本原則

- 專案使用 Vue 3、Composition API、`<script setup lang="ts">`、Pinia、Vue Router、Vite、Vitest 與 Tailwind CSS。
- 優先沿用現有元件、composable、store、utility 與型別，不建立重複抽象。
- Route view 應以頁面組裝與流程協調為主；可獨立描述的 UI 區塊拆成子元件，具狀態、watch、生命週期、API 協調或副作用的邏輯拆成 composable。
- 不為了形式預先建立空資料夾或只有一個使用者的抽象；有實際拆分需求時才建立。
- Props 向下、events 向上；props 視為唯讀。跨功能共享狀態才使用既有 Pinia store。
- 衍生狀態使用 `computed`；`watch` 用於副作用，並處理非同步競態或清理。

## 探索與修改流程

- 專案已使用 codebase-memory-mcp；查找函式、元件、路由與依賴時，依序優先使用 `search_graph`、`trace_path`、`get_code_snippet`、`query_graph`。
- 搜尋文案、錯誤訊息、設定值、非程式碼檔案，或圖譜結果不足時，再使用 `rg`／`rg --files`。
- 修改前先確認目標檔案的呼叫者、被呼叫項目、同功能兄弟頁面與測試；共用邏輯要在共同根因處處理。

## 目錄配置

- 父元件／頁面放在 `src/views/`；View 檔名使用 PascalCase，原則上以 `View` 結尾。
- 子元件一律放在 `src/components/`，包括只供單一頁面使用的子元件；依功能分組，例如 `src/components/explore/`。
- 全局共用的 composables、constants、types 分別放在 `src/composables/`、`src/constants/`、`src/types/`。
- 只屬於父元件／單一頁面的 composables、constants、types、utils，放在 `src/views/<page>/` 的對應子資料夾，與父元件共置。
- 頁面資料夾使用 kebab-case。不預先建立沒有實際檔案的資料夾。
- 不在 `views` 下建立子元件的 `components/` 資料夾。
- 頁面專屬資料或型別若之後跨頁共用，再移到 `src` 對應的全局目錄。
- 搬動檔案時，同步更新所有 import、既有 router 引用與測試路徑；不要為目錄整理新增不必要的路由或依賴。

```text
src/
├── components/
│   └── explore/
│       ├── ExploreSidebar.vue
│       └── ExploreMap.vue
├── composables/             # 全局共用
├── constants/               # 全局共用
├── types/                   # 全局共用
└── views/
    └── explore/
        ├── ExploreView.vue
        ├── composables/     # 此頁專屬
        ├── constants/       # 此頁專屬
        └── types/           # 此頁專屬
```

## Composables、Types 與 Utils

- Composable 檔名與匯出函式使用 `useXxx`；只處理單一責任，回傳小而明確的 typed API。
- 純函式沒有 Vue reactivity 或生命週期需求時放在 `utils/`，不要包成 composable。
- `useXxx` 命名保留給 composable 與 Pinia store；`utils/` 的純函式不要用 `useXxx`，也不要用 `useXxx()` 工廠回傳一包函式當命名空間，直接 named export 即可。
- 型別集中放在所屬範圍的 `types/`。單一功能可沿用專案現有的 `types/interface.ts`；同一範圍有多組不同用途時，改用可辨識用途的檔名，例如 `invoice.ts`、`categoryResultTable.ts`，不要把所有型別持續塞進同一檔案。
- 僅供單一 `.vue` 檔使用的簡短 Props／Emits／local interface 可留在該 SFC；被其他檔案引用時才抽到 `types/`。
- 跨功能共用的 API contract 應放在對應 API、store 或既有全域 types 範圍，不複製到各 view。

## API 回應驗證（zod）

- 用 zod 檢查後端回應格式，一律 `import * as z from 'zod/mini'`，不要改用或混用 `zod`（mini 首屏較小，混用會把完整版也打包進來）。
- 要檢查回應的 API 函式，用 `src/apis/requestWithSchema.ts` 的 `requestWithSchema(schema, config)` 取代 `request<T>(config)`：
  - 格式不符時只 `console.warn('[schema] <url>', issues)`，標出哪支 API、哪個欄位與實際值；不可改成 `.parse()` 或丟錯，不能因格式不符影響使用者操作。
  - 不論驗證成敗都回傳原始資料，不使用 `safeParse` 的結果（它會剝掉 schema 沒宣告的欄位）。
  - API 本身回錯時照舊由 `request()` 丟出 RequestError，走既有錯誤處理。
- schema 照後端實際回傳的格式寫：可省略用 `z.optional`、可能為 null 用 `z.nullable`、型別不固定用 `z.union`。不要放 `coerce`、`default`、`catch`、`transform` 等轉換：回傳的是原始資料，轉換不會套用，推導出的型別反而跟實際資料不符；轉型與預設值留在 store 或使用端處理。
- 只驗證回應；請求參數維持 interface，Blob 等非 JSON 回應不驗證。
- 檔案位置：
  - schema 與 `z.infer` 推導的型別放 `src/apis/schemas/<同名>.ts`，檔名對應 `src/apis/<同名>.ts`。
  - `src/apis/types/` 只放 interface，不寫 zod；有 schema 的回應型別在檔尾以 `export type { ... } from '../schemas/<同名>'` 轉出，使用端一律從 `@/apis/types/...` import 型別。
  - 只 export API 函式用到的頂層 schema；巢狀 schema 不 export，推導出的型別都 export。
- schema 測試放 `src/__tests__/apis/schemas/<同名>.spec.ts`，用符合 API 文件的回應樣本（含可省略、null 等情境）確認 `safeParse` 成功。

## Export 風格

- 以下三類維持逐一 `export`（宣告前直接加 `export`）：
  - `src/apis/` 的 API 函式檔
  - composable 檔（匯出 `useXxx`，含 `src/composables/` 與各層就近放置的 `composables/`）
  - Pinia store 檔（匯出 `useXxxStore`）
- 其餘一律集中匯出：宣告時不加 `export`，檔尾以 `export { ... }` 列出值、`export type { ... }` 列出型別。適用於 `utils/`、`constants/`、`types/`、`apis/types/`、`apis/schemas/` 與其他非上述三類的檔案。
- `enum` 同時是值與型別，集中匯出時要放在 `export { ... }`，不可放進 `export type { ... }`，否則執行期取不到。
- `export * from` / `export { ... } from` 的 re-export 原樣保留，不受此規則影響。
- 集中匯出的清單依宣告順序排列，不另外排序，方便對照檔案內容。

## 函式寫法

- 函式一律使用箭頭函式，例如 `const handleClick = () => { ... };`，不使用 `function` 宣告。
- composable 與 API 函式維持逐一 export，例如 `export const useExplore = () => { ... };`。
- callback 與不依賴動態 `this` 的物件方法也使用箭頭函式。
- 箭頭函式不具備函式宣告的提升行為；被呼叫的函式需先完成宣告，並確認改寫不影響 `this`、`arguments` 或既有行為。

## Vue SFC 規範

- SFC 區塊順序為 `<script setup lang="ts">`、`<template>`、`<style scoped>`、既有的 `<spec lang="md">`。
- 元件檔名與 template tag 使用 PascalCase。
- 使用 typed `defineProps`、`defineEmits`；只有真正雙向綁定的公開 contract 才使用 `defineModel`／`v-model`。
- 列表必須使用穩定 primitive `:key`；不要在同一元素同時使用 `v-for` 與 `v-if`。
- 使用 Tailwind CSS v3，樣式優先直接寫在 template 的 HTML tag／元件 tag 的 `class`；只有 utility class 不適合表達的必要樣式才放在 `<style scoped>`。全域 token、reset 與共用基礎樣式放在 `src/assets/styles`。
- 新增或調整主要 view／元件時，維護 `<spec lang="md">`；使用 Markdown 格式：`# 元件名稱`，依序包含 `## 元件定位`、`## 公開介面`、`## 主要行為`、`## 狀態與限制`，各節以條列說明。公開介面列出 Props、v-model、Emits 與主要依賴；內容必須符合實際程式，不套用未實作的 API、路由或 loading 行為。

- Tailwind 固定間距、尺寸、圓角、字級與線寬使用明確數值，例如 `p-[10px]`、`rounded-[8px]`、`text-[14px]`；響應式比例保留 `%`／視窗單位。
- 色值只定義於 `src/assets/theme/theme-color.scss`；`variables.scss` 只逐一宣告 `text-*`、`bg-*`、`line-*` 等顏色 class，不使用 map、迴圈或 Tailwind 指令。
- hover、地圖格線、陰影與選取效果優先使用 tag 上的 Tailwind arbitrary value class，色值引用主題 CSS 變數，例如 `shadow-[0_0_10px_var(--shadow-location)]`。
- `src/assets/styles/main.scss` 只放 body、全域 focus 等必要全域樣式。主題 SCSS 與 Tailwind 分開載入，主題 SCSS 不使用 `@layer`、`@apply`、`@tailwind`、`--tw-*` 或 Tailwind variant。
- 元件 `<spec lang="md">` 的「狀態與限制」需依上述分工說明樣式規則；不要將一般 SCSS 顏色 class 說成 Tailwind utility。

## 測試與驗證

- 測試放在 `src/__tests__/`，路徑應鏡像來源結構；搬動來源檔案時同步搬動或更新測試。
- 修改後至少執行最相關的 Vitest；影響型別或跨檔案 contract 時執行 `npm run type-check`。
- 視範圍執行：
  - `npm test -- <相關測試檔>`
  - `npm run type-check`
  - `npm run format:check`
  - `npm run build:dev` 或 `npm run build:prod`
- 若因環境或既有錯誤無法完成驗證，要明確區分「未執行／環境失敗」與「功能測試失敗」，不可宣稱通過。

## 變更範圍

- 不主動重整不相關的既有資料夾；新規則套用於新增檔案，以及本次功能確實需要搬動的檔案。
- 修改共用元件、composable、store、API 或 router 前，先檢查所有呼叫者與兄弟頁面，避免只修單一路徑。
- 保留使用者工作樹中的其他變更；未明確要求時不要 commit、push、rebase 或刪除檔案。
