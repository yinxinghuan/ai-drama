// GPU server supports CORS natively — call directly, skip Worker proxy (was causing 502/522)
const GPU_SERVER = 'https://u545921-b746-8a491f44.westc.gpuhub.com:8443';
const VIDEO_API = `${GPU_SERVER}/video`;
const TASK_API  = `${GPU_SERVER}/video_task`;

const COOLDOWN_MS     = 100_000;  // between submissions (server rate limit)
const POLL_INITIAL    = 30_000;   // wait 30s before first poll (video needs time to generate)
const POLL_INTERVAL   = 7_000;    // ~8.5 req/min, safely under 10/min limit
const POLL_TIMEOUT    = 600_000;  // 10 min total

let lastVideoCallTime = 0;

export async function waitForVideoCooldown(onTick: (remaining: number) => void): Promise<void> {
  const elapsed = Date.now() - lastVideoCallTime;
  if (elapsed >= COOLDOWN_MS) return;

  let remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
  onTick(remaining);

  await new Promise<void>(resolve => {
    const interval = setInterval(() => {
      remaining--;
      onTick(remaining);
      if (remaining <= 0) { clearInterval(interval); resolve(); }
    }, 1000);
  });
}

export function markVideoCallStart() {
  lastVideoCallTime = Date.now();
}

/**
 * Submit a video generation job — returns task_id immediately.
 */
export async function submitVideo(
  prompt: string,
  startImageUrl: string,
  endImageUrl?: string,
): Promise<string> {
  const id = 'drama_' + Math.random().toString(36).slice(2, 10);

  const params: Record<string, unknown> = { prompt, env: 'test', id };
  if (startImageUrl) params.image_url = startImageUrl;
  if (endImageUrl) params.end_image_url = endImageUrl;

  const res = await fetch(VIDEO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '', params }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`视频提交失败: ${res.status}`);
  const data = await res.json() as { task_id?: string; Flag?: boolean; Log?: string };
  if (!data.task_id) throw new Error(data.Log ?? '未获取到 task_id');
  return data.task_id;
}

/**
 * Poll a video task until it completes or fails.
 * Only one pollVideoTask should run at a time (server doesn't support concurrent tasks).
 */
export async function pollVideoTask(taskId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT;

  // Wait 30s before first poll — video generation needs time
  await new Promise(r => setTimeout(r, POLL_INITIAL));

  while (Date.now() < deadline) {
    let data: { status?: string; url?: string; log?: string; Log?: string };
    try {
      const res = await fetch(TASK_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '', params: { task_id: taskId } }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        if (res.status === 429) await new Promise(r => setTimeout(r, 10_000));
        else await new Promise(r => setTimeout(r, POLL_INTERVAL));
        continue;
      }
      data = await res.json();
    } catch {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      continue;
    }

    if (data.status === 'success' && data.url) {
      return data.url;
    }
    if (data.status === 'failed') {
      throw new Error(data.log ?? data.Log ?? '视频生成失败');
    }
    // status processing → wait then poll again
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }

  throw new Error('视频生成超时（10分钟）');
}
