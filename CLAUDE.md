# AI 短剧导演 — 项目说明

Telegram miniapp，用户选角色 → 写分镜 → AI 生成关键帧 + 视频 → 看短剧。

## 关键路径

- **前端**: `src/Drama/` — React + TypeScript + Less + Vite
- **代理层**: `worker/image-proxy.js` — Cloudflare Worker，已部署
- **部署**: GitHub Pages，base = `/ai-drama/`，GitHub Actions 自动构建

## 页面流

`setup` → `script` → `generating` → `theater` / `works`

## Cloudflare Worker 端点

部署地址：`ai-drama-image-proxy.xinghuan-yin.workers.dev`

| 路由 | 用途 |
|------|------|
| 默认 | 代理图像生成 API |
| `/enhance` | GLM prompt 优化 |
| `/upload` | 用户上传图片 → OSS |
| `/rehost` | 临时图片转存 OSS |
| `/video` | 代理视频生成 API |
| `/works` | 作品云存档（GET/POST/DELETE） |

Worker Secrets（wrangler secret put 配置，不在代码里）：`GLM_API_KEY`, `OSS_KEY_ID`, `OSS_SECRET`

## 生成冷却

- 图像生成：20s 冷却（`imageApi.ts` COOLDOWN_MS）
- 视频生成：100s 冷却（`videoApi.ts` COOLDOWN_MS）

## 作品存档

- 点"开拍"立即保存草稿，每个镜头完成后增量更新
- 云端路径：`prod/drama/works/<telegram_id>.json`（OSS，CDN: cdn.aiwaves.tech）
- `workId` 用 `useRef` 保证同一会话 ID 稳定

## 待确认（需问同事）

1. **`prompt_group` 多 key 能否多场景**：`{'1': p1, '2': p2}` 一次生成多镜头视频？
   → 若支持，同时解决音乐重复 + A→B→A 循环 + 视频接缝
2. **GPU 服务器能否加任务队列接口**：用于实现"关闭 app 后继续生成"

## 已知问题

- **音乐重复**：每段视频独立生成，模型对相近 prompt 输出同款 BGM，根治需多镜头单视频
- **A→B→A 循环**：无尾帧时视频回到起点，已加 prompt hint 缓解但不稳定

## 部署命令

```bash
# 前端
npm run build
git push  # GitHub Actions 自动部署

# Worker
cd worker && npx wrangler deploy
```
