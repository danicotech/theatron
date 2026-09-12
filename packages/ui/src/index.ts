// packages/ui 的對外出口。
//
// primitives/ 與 patterns/ 的元件從這裡 re-export,web/ 只認這一個入口。
// 這樣元件的內部路徑可以隨便重排,不會變成跨套件的破壞性改動。
//
// 這一層不 import API 型別、不呼叫 fetch、不知道賽事規則。它只收 props。

export * from './patterns/index';
export * from './primitives/index';
export * from './theme/index';
export {
  formatAmount,
  sumAmounts,
  toAmount,
  toMachineAmount,
  type FormatAmountOptions,
  type MoneyValue,
} from './format/money';
