const getShortTermParkingFee = (description: string): string => {
  let longTerm = false;
  // 千分位逗號不切，避免 3,000 元被拆成兩段。
  const parts = description
    .split(/(?:[，；;。\n]|,(?!\d{3}))+/)
    .filter((part) => {
      if (
        /(?<!無)月租|月票|包月|每月|月繳|季[租票繳]|每季|年[租繳]|每年|學年|半年|每期|租約|個月|元\s*[／/]\s*[月季年]/.test(
          part
        )
      )
        longTerm = true;
      else if (
        /計時|計次|臨停|每(?:半)?小時|每\d+分鐘|元\s*[／/]\s*(?:時|小時|次)|每次|免費|不收費|未收費/.test(
          part
        )
      )
        longTerm = false;
      return !longTerm && part.trim().length > 0;
    });
  return parts.map((part) => part.trim()).join('；') || '臨停費率未提供';
};

interface FeeItem {
  kind: 'rate' | 'first' | 'entry';
  amount: number;
  minutes: number;
  day: string;
  band: string;
}

const amount = (name: string) => `(?<${name}>\\d+(?:\\.\\d+)?)`;
const unit = (name: string) =>
  `(?<${name}>半小時|半時|三十分鐘|\\d+分鐘?|\\d*小時|一小時|時|hr|h|天|日)`;
const band = (name: string) =>
  `\\((?<${name}>\\d{1,2}(?::?\\d{2})?時?[-~至](?:翌日|隔日)?\\d{1,2}(?::?\\d{2})?時?)\\)`;
const CURRENCY = '(?:新[台臺]幣|NT\\$|\\$)?';
// 依出現順序讀取：星期條件、上限、前 N 分鐘免費、首小時、時段費率與按次。
const FEE_TOKEN = new RegExp(
  [
    '(?<everyday>週一[至~-]週日|全日|全天|每日)',
    '(?<weekday>平日|週一[至~-]週五|星期一[至~-]星期五)',
    '(?<weekend>例?假日|週[六日末]|星期[六日])',
    `(?:上限|最高)(?:收費)?(?:上限)?${amount('cap')}元`,
    `24H${amount('cap24')}元`,
    '(?<freeMinutes>\\d+)分鐘(?:內|以下|以內)?(?:離場)?者?(?:免費|不收費)',
    `(?:首小時|第一小時|第1小時)${amount('first')}元`,
    `(?:${band('before')})?(?:\\$?${amount('amountA')}元?/${unit('unitA')}|每${unit('unitB')}(?:收費)?${CURRENCY}${amount('amountB')}元|(?<unitC>\\d+分鐘|半小時)${CURRENCY}${amount('amountC')}元|計時${amount('hourly')}元(?![/每]))(?:${band('after')})?`,
    `(?:每次|計次)${CURRENCY}${amount('entry')}元(?!/)|${amount('entryB')}元/次`,
  ].join('|'),
  'gi'
);

const unitMinutes = (text: string) => {
  if (['半小時', '半時', '三十分鐘'].includes(text)) return 30;
  if (text.includes('分')) return Number.parseInt(text, 10);
  if (['天', '日'].includes(text)) return 24 * 60;
  return (Number.parseInt(text, 10) || 1) * 60;
};

// 依前文判斷每段是否屬於小型車；未寫車種時沿用上一段，開頭預設小型車。
const isCarSegment = (part: string, previous: boolean) => {
  if (/小型車|汽車|小客車|小車/.test(part)) return true;
  if (/機車|大型車|大客車|大貨車|大車/.test(part)) return false;
  return previous;
};

// 依上限所在段落（含上一段，來源偶有斷行把「當日」切到前一段）判斷計算期間。
// 當日上限到固定時間歸零；24 小時等從進場起算的上限過午夜不歸零，兩者分開標示。
const capLabel = (context: string) => {
  const hours = context.match(
    /(\d+)(?:小時|HR?)內?(?:連續停放)?(?:收費)?(?:最高|上限)/i
  )?.[1];
  if (/當日|每日|單日|一日|\/日/.test(context)) return '當日上限';
  if (hours) return `${hours} 小時內上限`;
  if (/夜間/.test(context)) return '夜間上限';
  if (/時段/.test(context)) return '時段上限';
  if (/當次|單次/.test(context)) return '單次上限';
  return '上限';
};

// 解析小型車臨停費率；機車、大型車與「起」價不列入。
const parseParkingFee = (description: string) => {
  const items: FeeItem[] = [];
  let cap = '';
  let freeMinutes: number | undefined;
  let free = false;
  let day = '';
  let car = true;
  const parts = getShortTermParkingFee(description)
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .split(';') // NFKC 會把全形；轉成半形
    .filter((part) => {
      car = isCarSegment(part, car);
      return car && !/\d元起/.test(part);
    });
  parts.forEach((part, index) => {
    if (/免費|未收費|不收費|免收費/.test(part) && !/\d/.test(part)) free = true;
    [...part.matchAll(FEE_TOKEN)].forEach(({ groups = {} }) => {
      if (groups.everyday) day = '';
      else if (groups.weekday) day = '平日';
      else if (groups.weekend) day = '假日';
      else if (groups.cap || groups.cap24) {
        const label = groups.cap24
          ? '24 小時內上限'
          : capLabel(`${parts[index - 1] ?? ''};${part}`);
        cap = cap || `${label} ${groups.cap || groups.cap24}元`;
      } else if (groups.freeMinutes)
        freeMinutes = freeMinutes ?? Number(groups.freeMinutes);
      else if (groups.first)
        items.push({
          kind: 'first',
          amount: Number(groups.first),
          minutes: 60,
          day,
          band: '',
        });
      else if (groups.entry || groups.entryB)
        items.push({
          kind: 'entry',
          amount: Number(groups.entry || groups.entryB),
          minutes: 0,
          day,
          band: '',
        });
      else {
        const minutes = groups.hourly
          ? 60
          : unitMinutes(groups.unitA || groups.unitB || groups.unitC);
        if (minutes > 0)
          items.push({
            kind: 'rate',
            amount: Number(
              groups.amountA ||
                groups.amountB ||
                groups.amountC ||
                groups.hourly
            ),
            minutes,
            day,
            band: (groups.before || groups.after || '')
              .replace(/時|翌日|隔日/g, '')
              .replace(/[~至]/, '-'),
          });
      }
    });
  });
  return { items, cap, freeMinutes, free, text: parts.join('；') };
};

const periodText = (minutes: number) => {
  if (minutes === 24 * 60) return '天';
  if (minutes === 60) return '小時';
  return minutes % 60 === 0 ? `${minutes / 60}小時` : `${minutes}分鐘`;
};

const itemText = (item: FeeItem) => {
  if (item.kind === 'first') return `首小時 ${item.amount}元`;
  if (item.kind === 'entry') return `${item.amount}元/次`;
  const time = item.band ? `(${item.band})` : '';
  return `${item.amount}元/${periodText(item.minutes)}${time}`;
};

// 依原始計費單位顯示，例如 60元/小時、50元/30分鐘、50元/次；超過兩段時同單位顯示區間，否則列最常見的費率。
const formatParkingFee = (description: string): string => {
  const { items, cap, freeMinutes, free, text } = parseParkingFee(description);
  if (!items.length) {
    if (free) return '免費';
    // 看不懂的寫法保留小型車相關原文；只有長期租金或其他車種時顯示未提供。
    return (
      text
        .replace('臨停費率未提供', '')
        .replace(/(?:汽車|小型車|小客車):/g, '') || '未提供'
    );
  }
  const unique: FeeItem[] = [];
  items.forEach((item) => {
    const same = unique.find((kept) => itemText(kept) === itemText(item));
    if (!same) unique.push({ ...item });
    else if (same.day !== item.day) same.day = '';
  });
  let rates = unique.map((item, index) => {
    const previous = unique[index - 1];
    const label = item.day && item.day !== previous?.day ? `${item.day} ` : '';
    const after = previous?.kind === 'first' ? '之後 ' : '';
    return `${label}${after}${itemText(item)}`;
  });
  const periods = new Set(
    unique.map((item) => (item.kind === 'rate' ? item.minutes : 0))
  );
  if (unique.length > 2 && !periods.has(0) && periods.size === 1) {
    const amounts = unique.map((item) => item.amount);
    const low = Math.min(...amounts);
    const high = Math.max(...amounts);
    const period = periodText(unique[0].minutes);
    rates =
      low === high
        ? [`${low}元/${period}`]
        : [`${low}–${high}元/${period}`, '多段費率'];
  } else if (unique.length > 2) {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const key = itemText({ ...item, band: '' });
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const [main] = [...counts].reduce((best, entry) =>
      entry[1] > best[1] ? entry : best
    );
    rates = [main, '多段費率'];
  }
  return [...rates, cap, freeMinutes && `前 ${freeMinutes} 分鐘免費`]
    .filter(Boolean)
    .join(' · ');
};

const getOneHourParkingFee = (description: string): number | null => {
  const { items, free } = parseParkingFee(description);
  // 只接受單一明確費率；日夜、平假日或多種收費方式不猜測。
  const unique = [
    ...new Map(items.map((item) => [itemText(item), item])).values(),
  ];
  if (unique.length > 1) return null;
  const [item] = unique;
  if (!item) return free ? 0 : null;
  if (item.kind !== 'rate') return item.amount;
  return Math.ceil(60 / item.minutes) * item.amount;
};

export { getShortTermParkingFee, formatParkingFee, getOneHourParkingFee };
