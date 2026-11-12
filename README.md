## Features
- 基于交易所公共 API（OKX / Hyperliquid）
- 永续合约关键数据聚合展示：价格、资金费率、RSI、MA Flow 等
- 只跟踪市值前 50 的币 + 股票永续
- 行情在浏览器直连交易所；市值、BTC 占比走 Cloudflare Workers 上的轻量代理（`/api/*`）

## Live
https://perp-board.inveilapp.workers.dev

## Deployment
推送到 `main` 后由 GitHub Actions 自动构建并部署到 Cloudflare Workers，
见 `.github/workflows/deploy.yml`。仓库 secrets 需要 `CLOUDFLARE_API_TOKEN`
和 `CLOUDFLARE_ACCOUNT_ID`。

## Development
本地开发是可选的，改代码不需要 clone 到本机。

```bash
npm install
npm run dev      # 本地开发 http://localhost:3000
npm run deploy   # 手动部署，需先 npx wrangler login
```

## UI system

Flat, data-first. Chrome is neutral grey / white; colour is reserved for data.

- **Tokens** live in `app/globals.css` (`:root` for light, `.dark` for dark) and are exposed to Tailwind in `tailwind.config.js`. Change a value there, not in a component.
  - Surfaces: `background` (ground), `card` (panels), `fill` (control fill), `separator` (1px hairlines).
  - Text: `foreground`, `muted-foreground`, `faint`.
  - Data only: `up` / `down` (price direction, live state), `cold` / `hot` (RSI oversold / overbought). Use the `-ink` variant for text.
- **Type**: Geist for UI text, Geist Mono for numbers. Any element with `tabular-nums` renders in the mono face — put it on every numeric value.
- **Shape**: 4px grid; radius 6 (controls), 8 (inputs), 10 (panels), full (chips). No shadows — regions are separated by `hairline-b` / `hairline-t` / `hairline-r`.
- **Building blocks**:
  - `label-caps` — small caps label for column headers, panel titles, stat captions.
  - `surface-card` — a panel; inside `.flat-panels` it drops its chrome and is divided by hairlines.
  - `PillButtonGroup` — segmented control (`variant="segmented"`) and filter chips (`variant="chips"`).
  - `TabContainer variant="sidebar"` — underline tabs.
  - `SmallWidget` — insight panel shell (caps title, subtitle, info toggle).
  - `ChangePill`, `RsiReading`, `ZoneGauge` (`components/ui/Metrics.tsx`) — numeric readouts.
- **Layout**: mobile is one section at a time (Markets / Insights / Watchlist) switched from the bottom navigation, with a three-stat summary above the list; from `lg` up it is a fixed two-column frame, Insights left and the table right.
