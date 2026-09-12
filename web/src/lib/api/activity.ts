// 活動層 API(《百業試鋒》)的 client。
//
// 與 client.ts 同一個 transport、同一條同源代理 —— 分成兩個檔案是因為
// 兩層的生命週期不同:平台層長壽,活動層逐活動汰換(見 CLAUDE.md 的四 repo 表)。
// 第二個活動要換掉的是這一份,不是 client.ts。
//
// 型別與 service 描述全部來自 gen/,這裡不宣告任何 request / response 形狀
// (專案鐵則 6:契約自動生成,禁止手寫共用型別)。

import { createClient, type Client } from '@connectrpc/connect';

import { platformTransport } from './client';
import { BettingService } from './gen/hestia/activity/v1/betting_pb';
import { HandicapService } from './gen/hestia/activity/v1/handicap_pb';
import { JudgeService } from './gen/hestia/activity/v1/judge_pb';
import { SignupService } from './gen/hestia/activity/v1/signup_pb';
import { TournamentService } from './gen/hestia/activity/v1/tournament_pb';
import { WatchService } from './gen/hestia/activity/v1/watch_pb';

export const activityApi: {
  signup: Client<typeof SignupService>;
  tournament: Client<typeof TournamentService>;
  handicap: Client<typeof HandicapService>;
  betting: Client<typeof BettingService>;
  judge: Client<typeof JudgeService>;
  watch: Client<typeof WatchService>;
} = {
  signup: createClient(SignupService, platformTransport),
  tournament: createClient(TournamentService, platformTransport),
  handicap: createClient(HandicapService, platformTransport),
  betting: createClient(BettingService, platformTransport),
  judge: createClient(JudgeService, platformTransport),
  watch: createClient(WatchService, platformTransport),
};
