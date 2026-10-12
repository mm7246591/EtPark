import { expect, it } from 'vitest';
import {
  getOneHourParkingFee,
  getShortTermParkingFee,
} from '../../../../views/explore/utils/parkingFee';

it.each([
  ['每小時30元', 30],
  ['汽車：每小時 40 元', 40],
  ['每半小時20元', 40],
  ['每15分鐘10元', 40],
  ['30元/時', 30],
  ['20元／半小時', 40],
  ['每次50元', 50],
  ['免費', 0],
  ['每小時０元', 0],
  ['平日30元/時，假日50元/時', null],
  ['首小時30元，之後每小時40元', null],
  ['每小時30元，每日最高100元', null],
  ['依現場公告', null],
  ['機車每小時10元', null],
  ['每0分鐘20元', null],
  ['每小時30元起', null],
  ['月租3000元', null],
])('費率 %s 的一小時費用為 %s，無法確認的費率不猜測', (text, expected) => {
  expect(getOneHourParkingFee(text)).toBe(expected);
});

it.each([
  ['每小時30元；月租3000元', '每小時30元'],
  ['月租3000元，一般戶2500元；每小時40元', '每小時40元'],
  ['每半小時20元，包月2000元', '每半小時20元'],
  ['月票2000元', '臨停費率未提供'],
  [
    '平日每小時30元，假日每小時50元；月租3000元',
    '平日每小時30元；假日每小時50元',
  ],
])('臨停顯示移除月租內容：%s', (text, expected) => {
  expect(getShortTermParkingFee(text)).toBe(expected);
});
it('一小時費用排除月租金額，只比較明確臨停費率', () => {
  expect(getOneHourParkingFee('每小時30元；月租3000元')).toBe(30);
  expect(getOneHourParkingFee('月票2000元')).toBeNull();
});
