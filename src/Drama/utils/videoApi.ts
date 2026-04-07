const WORKER = 'https://ai-drama-image-proxy.xinghuan-yin.workers.dev';
const VIDEO_API = `${WORKER}/video`;
const TASK_API  = `${WORKER}/video_task`;

const COOLDOWN_MS   = 100_000;  // between submissions (server rate limit)
const POLL_GAP      = 7_000;    // 7s between any two poll requests globally (~8.5 req/min, under 10/min limit)
const POLL_TIMEOUT  = 600_000;  // 10 min total

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
 * Call pollVideoTask(taskId) separately to wait for the result.
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

/** Submit and poll — convenience wrapper */
export async function generateVideo(
  prompt: string,
  startImageUrl: string,
  endImageUrl?: string,
): Promise<string> {
  const taskId = await submitVideo(prompt, startImageUrl, endImageUrl);
  return pollVideoTask(taskId);
}

/**
 * Shared poll queue — all concurrent pollVideoTask calls go through this queue
 * so that globally only one poll request fires every POLL_GAP ms.
 * This prevents hitting the server's 10 req/min rate limit when polling multiple shots.
 */
let pollQueue: Promise<void> = Promise.resolve();

type PollResult = { done: false } | { done: true; url: string } | { done: true; failed: true; error: string };

function enqueuePoll(taskId: string): Promise<PollResult> {
  return new Promise<PollResult>((resolve) => {
    pollQueue = pollQueue.then(async () => {
      await new Promise(r => setTimeout(r, POLL_GAP));
      try {
        const res = await fetch(TASK_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '', params: { task_id: taskId } }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          if (res.status === 429) await new Promise(r => setTimeout(r, 10_000)); // extra backoff on rate limit
          resolve({ done: false });
          return;
        }
        const data = await res.json() as { Flag?: boolean; File?: string; status?: string; Log?: string };
        if (data.Flag && data.File && typeof data.File === 'string') {
          resolve({ done: true, url: data.File });
        } else if (data.status === 'failed') {
          resolve({ done: true, failed: true, error: data.Log ?? '视频生成失败' });
        } else {
          resolve({ done: false });
        }
      } catch {
        resolve({ done: false }); // network hiccup, retry next round
      }
    });
  });
}

export async function pollVideoTask(taskId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT;

  while (Date.now() < deadline) {
    const result = await enqueuePoll(taskId);
    if (result.done) {
      if ('failed' in result) throw new Error(result.error);
      return result.url;
    }
  }

  throw new Error('视频生成超时（10分钟）');
}
