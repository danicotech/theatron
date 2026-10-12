import type { Command } from './model';

export function confirmLabel(c: Command): string {
  switch (c.type) {
    case 'reseed':
      return '套用籤位';
    case 'market-admin':
      return c.enabled === false ? '暫停投注' : '儲存盤口設定';
    case 'raffle':
      return '抽取並保存';
    case 'award':
      return '登錄獎項';
    case 'ceremony-deliver':
      return '確認標記頒發';
    case 'ticket':
    case 'bet':
      return '確認扣點下注';
    case 'redeem':
      return '確認扣點兌換';
    case 'start':
      return '開始比賽並封盤';
    case 'settle':
      return '結算並派彩';
    case 'void':
      return '作廢並退款';
    case 'publish-roster':
      return '發布對局';
    case 'redemption':
      return c.status === 'cancelled' ? '取消並退回點數' : '確認標記已發放';
    default:
      return '確認儲存';
  }
}
export function isDangerous(c: Command): boolean {
  return (
    c.type === 'void' || c.type === 'start' || (c.type === 'redemption' && c.status === 'cancelled')
  );
}
export function commandFeedback(c: Command): string {
  switch (c.type) {
    case 'reseed':
      return '籤位已套用，對戰名單與盤口已更新；原有投票與讓武選擇已清除。';
    case 'market-admin':
      return c.enabled === false
        ? c.kind
          ? '已暫停此類型，後續輪次也保持關閉。'
          : '盤口已暫停，既有注單仍依賽果結算。'
        : c.enabled === true
          ? '未開賽項目已開放投注。'
          : '盤口名稱已更新。';
    case 'raffle':
      return '抽獎結果已保存，已保留一份獎品庫存。';
    case 'award':
      return '獎項已登錄頒獎名冊，等待現場頒發。';
    case 'ceremony-deliver':
      return '已標記頒發完成。';
    case 'vote':
      return '投票已更新，同盤改票會取代原選擇。';
    case 'draft':
      return '逐局賽果草稿已儲存；尚未結算或派彩。';
    case 'start':
      return '比賽已開始，本場與名次盤已封盤。';
    case 'settle':
      return '賽果已結算，點數紀錄已更新。';
    case 'void':
      return '盤口已作廢，相關注單已重新計算。';
    case 'ticket':
    case 'bet':
      return '注單已成立，可在我的注單查看。';
    case 'publish-roster':
      return '對局已發布，參賽者可查看賽程。';
    case 'activity-create':
    case 'create':
      return '新活動已建立，請繼續設定名單與對局。';
    case 'activity-update':
      return c.open ? '活動設定已儲存，報名開放中。' : '活動設定已儲存，報名已關閉。';
    case 'enroll':
      return c.complete ? '報名資料已儲存。' : '報名變更已儲存。';
    case 'configure':
      return '盤口設定已儲存。';
    case 'prize':
      return '示範獎品設定已儲存。';
    case 'redeem':
      return '兌換申請已送出，等待管理者審核。';
    case 'redemption':
      return c.status === 'cancelled'
        ? '申請已取消，點數與庫存已退回。'
        : c.status === 'approved'
          ? '申請已核准，等待模擬發放。'
          : '已標記模擬發放完成。';
    default:
      return '已儲存在此瀏覽器。';
  }
}
