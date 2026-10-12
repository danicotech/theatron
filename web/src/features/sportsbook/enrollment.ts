import type { Character, EnrollmentProfile } from './model';
export const blankProfile: EnrollmentProfile = {
  server: '',
  discord: '',
  selfRank: '待評估',
  experience: '',
  availability: '',
  notes: '',
};
export const selfRanks = ['待評估', '開山', '斷水', '飛花', '無我'] as const;
export const blankCharacter: Character = { style: '', weapon: '', equipment: '', arts: '' };
export type EnrollmentValues = {
  gameId: string;
  name: string;
  character: Character;
  profile: EnrollmentProfile;
  rulesAccepted: boolean;
};
export type EnrollmentErrors = Partial<
  Record<keyof Character | keyof EnrollmentProfile | 'gameId' | 'name' | 'rulesAccepted', string>
>;
export function enrollmentErrors(v: EnrollmentValues, step: number): EnrollmentErrors {
  const errors: EnrollmentErrors = {};
  if (step === 0 && !v.rulesAccepted) errors.rulesAccepted = '請先閱讀並確認賽制與讓武原則。';
  if (step === 1) {
    if (!v.gameId.trim()) errors.gameId = '請填寫遊戲 ID，方便大會核對。';
    if (!v.name.trim()) errors.name = '請填寫公開顯示的角色姓名。';
    if (!v.profile.experience.trim())
      errors.experience = '請簡述對戰經驗；未接觸過也可以直接填寫。';
    if (!v.profile.availability.trim())
      errors.availability = '請說明可參賽時段；尚未確定可填待公告後確認。';
  }
  if (step === 2)
    for (const [key, label] of Object.entries({
      style: '流派',
      weapon: '武器',
      equipment: '裝備',
      arts: '武學與配裝說明',
    })) {
      const value = v.character[key as keyof Character];
      if (!value.trim()) errors[key as keyof Character] = `請填寫${label}。`;
      else if (value.length > 4000)
        errors[key as keyof Character] = `${label}請控制在 4,000 字內。`;
    }
  return errors;
}
export function normalizeProfile(p: EnrollmentProfile): EnrollmentProfile {
  const limits: Record<keyof EnrollmentProfile, number> = {
    server: 80,
    discord: 80,
    selfRank: 20,
    experience: 2000,
    availability: 1000,
    notes: 2000,
  };
  const profile = { ...blankProfile };
  for (const key of Object.keys(limits) as (keyof EnrollmentProfile)[]) {
    if (typeof p[key] !== 'string') throw new Error('報名補充資料格式不正確。');
    profile[key] = p[key].trim();
    if (profile[key].length > limits[key]) throw new Error('報名補充資料超出字數限制。');
  }
  if (!selfRanks.some((r) => r === profile.selfRank)) throw new Error('請選擇有效的自評段位。');
  return profile;
}
