const getShortTermParkingFee = (description: string): string => {
  let monthly = false;
  const parts = description.split(/[，,；;。\n]+/).filter((part) => {
    if (/月租|月票|包月|每月|月繳/.test(part)) monthly = true;
    else if (
      /計時|臨停|每(?:半)?小時|每\d+分鐘|元\s*[／/]\s*(?:時|小時)|每次|免費/.test(
        part
      )
    )
      monthly = false;
    return !monthly && part.trim().length > 0;
  });
  return parts.map((part) => part.trim()).join('；') || '臨停費率未提供';
};

const getOneHourParkingFee = (description: string): number | null => {
  const text = getShortTermParkingFee(description)
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/^(?:汽車|小型車|小客車|自小客車)[:：]?/, '')
    .replace(/[。.]$/, '');
  // 只接受單一明確費率；條件式、累進或多車種費率不猜測。
  if (['免費', '免收費', '免費停車'].includes(text)) return 0;
  const unit = text.match(
    /^(?:每)?(小時|一小時|1小時|半小時|\d+分鐘)(?:新台幣|新臺幣|NT\$|\$)?(\d+(?:\.\d+)?)元$/
  );
  const reverse = text.match(
    /^(?:NT\$|\$)?(\d+(?:\.\d+)?)元\/(小時|時|半小時|\d+分鐘)$/
  );
  const flat = text.match(/^每次(?:新台幣|新臺幣)?(\d+(?:\.\d+)?)元$/);
  if (flat) return Number.isFinite(Number(flat[1])) ? Number(flat[1]) : null;
  const period = unit?.[1] ?? reverse?.[2];
  const amount = Number(unit?.[2] ?? reverse?.[1]);
  if (!period || !Number.isFinite(amount)) return null;
  let minutes = 60;
  if (period === '半小時') minutes = 30;
  else if (period.endsWith('分鐘')) minutes = Number.parseInt(period, 10);
  return Number.isFinite(minutes) && minutes > 0
    ? Math.ceil(60 / minutes) * amount
    : null;
};

export { getShortTermParkingFee, getOneHourParkingFee };
