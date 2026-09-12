// 測試專用進入點(`@theatron/ui/testing`)。
//
// 存在的理由是位置要對得上:package.json 的 exports 與 tsconfig 的 paths
// (`@theatron/ui/*` → `packages/ui/src/*`)必須指到同一個檔案,否則
// 型別與執行期會各自解析到不同的東西,而那種不一致只在某一邊壞掉時才會被發現。
export { expectNoAxeViolations } from './test/axe';
