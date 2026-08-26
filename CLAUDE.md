# theatron

活動前端 + 共用元件庫。θέατρον —— 「觀看的地方」。

## 視覺規範

`.claude/skills/tournament-design-system` 是唯一權威。**視覺方向已經決定,不要重新發想** —— 工作是套用,不是選擇。

四條硬規則(節錄,細節看 skill):

1. 元件只能用**語意 slot**(`--surface-*`、`--text-*`、`--accent-*`、`--state-*`)
2. **禁止一次性 hex 值與原始色階**。這條是 CI 檢查,不靠自律
3. 主題是**存 DB 的資料**,不重新部署即可換
4. 禁止手寫 API 型別,只能 import 生成的 client

## 手機版不是把桌機縮小

| 元件 | 手機版做法 |
|---|---|
| 賽程樹 | **分輪檢視**,不是縮小的完整樹 |
| 投注單 | 底部抽屜 |
| 管理介面 | 現實是管理員多半用桌機,但**開賽當下常常在手機上** —— 關鍵操作要能單手完成 |

斷點:**版面用 media query,元件用 container query**。

## 元件檢視

用一個路由(如 `/_components`),**不要用 Storybook** —— 多一套建置與相依。

## Landing page

狀態驅動首屏,**純 2D 先上線**。3D 是選配,排最後。要做 2D/3D 混合時走 **R3F**(react-three-fiber),不是 iframe 也不是全 canvas。

## 相關 skill(已安裝)

- 3D/動畫:`react-three-fiber`、`threejs-webgl`、`gsap-scrolltrigger`、`web3d-integration-patterns`、`blender-web-pipeline`
- 2D 動態:`motion-framer`、`lottie-animations`、`lightweight-3d-effects`、`animated-component-libraries`
- React/Next:`vercel-react-best-practices`、`vercel-composition-patterns`、`vercel-react-view-transitions`、`web-design-guidelines`
- 響應式:`responsive-ui`

**注意**:通用視覺 skill(`frontend-design`、`modern-web-design`)刻意沒裝 —— 會跟 tournament-design-system 打架。
