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
