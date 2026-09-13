import type { Timestamp } from '@bufbuild/protobuf/wkt';
import { timestampDate } from '@bufbuild/protobuf/wkt';

/**
 * 時:分。封盤時間、違規時間都在同一天的同一場活動裡,日期是噪音。
 * 用 zh-TW 的 24 小時制,與裁判台看到的一致。
 */
export function clock(ts: Timestamp): string {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestampDate(ts));
}
