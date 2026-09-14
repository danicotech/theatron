/**
 * 首頁這一側對素材清冊的入口。
 *
 * 查表本身住在 `lib/world` —— 賽事系統也查同一份,一個概念不該有兩個家。
 * 這一個檔存在只是為了讓首頁的元件不必知道自己在專案樹的哪一層。
 */
export { findWorldAsset, inkTitleProps, worldAsset, type WorldAsset } from '../../lib/world';
