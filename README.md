# Etpark

Etpark 是結合地點搜尋與停車資訊的網站。使用者輸入店名或地址後，可以查看目的地附近的停車場、剩餘車位與收費資訊，並預覽從目前位置出發的開車路線。

## 主要功能

- 搜尋台灣店家或地址，提供候選地點與地址資訊。
- 取得定位後，候選地點依可用的直線距離由近到遠排序。
- 查詢目的地所在縣市、距離一公里內的停車場。
- 停車場依有車位、車位未知、已滿位分組，各組再依距離排序。
- 顯示停車場地址、來源提供的收費資訊與剩餘車位。
- 在網站地圖預
覽開車路線，顯示道路距離與預估時間。
- 支援桌面及手機版面。

停車資料來自台北市、新北市政府開放資料及交通部 TDX。資料涵蓋程度與即時車位依來源而異；未提供的車位顯示為未知。開車路線是預覽功能，不提供即時交通或語音導航。

## 技術

| 項目           | 使用技術                                      |
| -------------- | --------------------------------------------- |
| 前端           | Vue 3、TypeScript、Composition API            |
| 建置           | Vite                                          |
| 樣式           | Tailwind CSS v3、SCSS                         |
| 地圖與地點     | Google Maps JavaScript API、Places API（New） |
| 開車路線       | Google Routes API                             |
| 停車資料處理   | Node.js、Netlify Functions、proj4             |
| 回應格式檢查   | Zod Mini                                      |
| 測試與品質檢查 | Vitest、ESLint、Prettier                      |

## 本機開發

建議使用 Node.js 24 與 npm。

```sh
npm ci
npm run dev
```

開啟終端機顯示的網址。本機停車 API 由 Vite middleware 提供，不需要另外啟動後端。

## 環境變數

在專案根目錄建立 `.env.local`：

```dotenv
VITE_GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_MAPS_MAP_ID=
TDX_CLIENT_ID=
TDX_CLIENT_SECRET=
```

| 變數                       | 用途                                            |
| -------------------------- | ----------------------------------------------- |
| `VITE_GOOGLE_MAPS_API_KEY` | Google 地圖、地點搜尋及開車路線使用的瀏覽器金鑰 |
| `VITE_GOOGLE_MAPS_MAP_ID`  | Google 地圖 ID；本機可使用 `DEMO_MAP_ID`        |
| `TDX_CLIENT_ID`            | TDX 伺服器端驗證識別碼                          |
| `TDX_CLIENT_SECRET`        | TDX 伺服器端驗證密鑰                            |

Google 專案需啟用 Maps JavaScript API、Places API（New）與 Routes API，金鑰需允許對應服務及網站網域。TDX 變數供後端使用，不得加上 `VITE_` 前綴。`.env.local` 不提交至 Git。

## 目錄結構

```text
EtPark/
├── src/
│   ├── apis/                         # 前端 API 呼叫
│   │   ├── googleMaps.ts             # Google SDK 載入
│   │   ├── nationalParking.ts        # 停車資料查詢
│   │   ├── routes.ts                 # 開車路線查詢
│   │   ├── requestWithSchema.ts      # HTTP 請求與回應格式檢查
│   │   ├── schemas/                  # API 回應 schema
│   │   └── types/                    # API 型別
│   ├── assets/
│   │   ├── styles/main.scss          # 全域樣式
│   │   └── theme/
│   │       ├── theme-color.scss      # 主題色變數
│   │       └── variables.scss        # 共用顏色 class
│   ├── components/explore/           # 探索頁子元件
│   │   ├── ExploreSidebar.vue        # 搜尋與清單
│   │   ├── ExploreMap.vue            # 地圖與標記
│   │   ├── ExploreRoutePanel.vue     # 開車路線摘要
│   │   └── ApiUsageDialog.vue        # API 錯誤提示
│   ├── composables/
│   │   └── useApiUsage.ts            # 共用 API 錯誤與提示狀態
│   ├── views/explore/
│   │   ├── ExploreView.vue           # 頁面組裝
│   │   ├── composables/              # 搜尋、地圖與路線邏輯
│   │   ├── constants/                # 縣市對照資料
│   │   ├── types/                    # 頁面專屬型別
│   │   └── utils/                    # 距離與停車資料工具
│   ├── __tests__/                    # 前端及 Function 測試
│   ├── App.vue                      # 應用程式根元件
│   └── main.ts                      # 前端入口
├── server/
│   ├── national-parking.mjs          # 市府與 TDX 資料整合
│   ├── national-parking.test.mjs     # 停車資料處理測試
│   └── parking.mjs                   # 獨立 Node.js API 入口
├── netlify/functions/
│   └── parking.mjs                   # Netlify 停車 API 入口
├── netlify.toml                      # Netlify 建置與 API 轉送設定
├── vite.config.ts                   # Vite 與本機 API 設定
├── tailwind.config.js                # Tailwind 設定
├── package.json                      # 套件與指令
└── README.md
```

頁面元件放在 `src/views`，子元件放在 `src/components`；頁面專屬的邏輯、型別及常數與頁面共置，共用邏輯則放在 `src` 對應目錄。

## 常用指令

| 指令                   | 用途                             |
| ---------------------- | -------------------------------- |
| `npm run dev`          | 啟動本機開發服務                 |
| `npm run build`        | 型別檢查並建置至 `dist`          |
| `npm run preview`      | 預覽前端建置產物，不包含停車 API |
| `npm run api`          | 啟動獨立停車 API，預設埠為 3001  |
| `npm test`             | 執行測試                         |
| `npm run type-check`   | 檢查 TypeScript 型別             |
| `npm run lint`         | 檢查程式碼規範                   |
| `npm run lint:fix`     | 自動修正可處理的規範問題         |
| `npm run format:check` | 檢查格式                         |
| `npm run format`       | 格式化 src 檔案                  |

## 部署

專案使用 Netlify Hosting 與 Functions。連接 GitHub repository 後，由 `netlify.toml` 設定建置指令 `npm run build`、發布目錄 `dist` 及 Function 目錄 `netlify/functions`。

正式環境需在 Netlify 設定相同的環境變數：`VITE_` 變數供建置使用，TDX 變數供 Functions 使用。前端與 Functions 必須一起部署；僅拖曳上傳 `dist` 不會部署停車 API。
