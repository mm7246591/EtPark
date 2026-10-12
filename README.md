# EtPark

EtPark 是結合地點搜尋與停車資訊的網站。使用者輸入店名或地址後，可以查看目的地附近的停車場、剩餘車位與收費資訊，並開啟 Google Maps 開車導航。

## 主要功能

- 搜尋台灣店家或地址，提供候選地點與地址資訊。
- 取得定位後，候選地點依可用的直線距離由近到遠排序。
- 查詢目的地所在縣市、距離一公里內的停車場。
- 停車場依有車位、車位未知、已滿位分組，各組再依距離排序。
- 顯示停車場地址、來源提供的收費資訊與剩餘車位。
- 定位後顯示目前位置到停車場的預估開車分鐘（不含即時路況）。
- 點擊開始導航，開啟 Google Maps 導航至目的地或停車場。
- 支援桌面及手機版面。

## 技術

| 項目           | 使用技術                                      |
| -------------- | --------------------------------------------- |
| 前端           | Vue 3、TypeScript、Composition API            |
| 建置           | Vite                                          |
| 樣式           | Tailwind CSS v3、SCSS                         |
| 地圖與地點     | Google Maps JavaScript API、Places API（New） |
| 行車時間       | Google Routes API（Route Matrix）             |
| 停車資料處理   | Node.js、Netlify Functions、proj4             |
| 回應格式檢查   | Zod Mini                                      |
| 測試與品質檢查 | Vitest、ESLint、Prettier                      |

## 目錄結構

```text
EtPark/
├── src/
│   ├── apis/                         # 前端 API 呼叫
│   │   ├── googleMaps.ts             # Google SDK 載入
│   │   ├── nationalParking.ts        # 停車資料查詢
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
│   │   └── ApiUsageDialog.vue        # API 錯誤提示
│   ├── composables/
│   │   └── useApiUsage.ts            # 共用 API 錯誤與提示狀態
│   ├── views/explore/
│   │   ├── ExploreView.vue           # 頁面組裝
│   │   ├── composables/              # 搜尋與地圖邏輯
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

## 部署

專案使用 Netlify Hosting 與 Functions。連接 GitHub repository 後，由 `netlify.toml` 設定建置指令 `npm run build`、發布目錄 `dist` 及 Function 目錄 `netlify/functions`。

正式環境需在 Netlify 設定相同的環境變數：`VITE_` 變數供建置使用，TDX 變數供 Functions 使用。前端與 Functions 必須一起部署；僅拖曳上傳 `dist` 不會部署停車 API。

行車時間需啟用 Routes API 並加入 Google API 金鑰的 API 限制。Route Matrix 按起點與終點組合的元素數計算用量，需另外設定配額；既有 Maps／Places 配額不包含此服務。
