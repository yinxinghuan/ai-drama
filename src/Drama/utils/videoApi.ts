const VIDEO_API = 'https://u545921-b746-8a491f44.westc.gpuhub.com:8443/video';
const TASK_API  = 'https://u545921-b746-8a491f44.westc.gpuhub.com:8443/video_task';

const COOLDOWN_MS   = 100_000;  // between submissions (server rate limit)
const POLL_INTERVAL = 6_000;    // 6s per poll = 10 queries/min max
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
 * Submit video generation job and poll until complete.
 * - With endImageUrl: explicit start→end frame mode
 * - Without endImageUrl: prompt_group A→B→A auto mode
 */
export async function generateVideo(
  prompt: string,
  startImageUrl: string,
  endImageUrl?: string,
): Promise<string> {
  const id = 'drama_' + Math.random().toString(36).slice(2, 10);

  const params = endImageUrl
    ? { prompt, env: 'test', id, image_url: startImageUrl, end_image_url: endImageUrl, oss_url: '' }
    : { prompt_group: { '888': prompt }, env: 'test', id, image_url: startImageUrl, end_image_url: '', oss_url: '' };

  // Step 1: Submit job — returns immediately with task_id
  const submitRes = await fetch(VIDEO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '', params }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!submitRes.ok) throw new Error(`视频提交失败: ${submitRes.status}`);

  const submitData = await submitRes.json() as { task_id?: string; Flag?: boolean; Log?: string };
  if (!submitData.task_id) throw new Error(submitData.Log ?? '未获取到 task_id');

  // Step 2: Poll until done
  return pollVideoTask(submitData.task_id);
}

export async function pollVideoTask(taskId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    let data: { Flag?: boolean; File?: string | Record<string, string>; status?: string; Log?: string };
    try {
      const res = await fetch(TASK_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '', params: { task_id: taskId } }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue; // transient error, retry
      data = await res.json();
    } catch {
      continue; // network hiccup, retry
    }

    if (data.Flag && data.File) {
      const fileUrl = typeof data.File === 'string' ? data.File : data.File['888'];
      if (fileUrl) return fileUrl;
    }

    if (data.status === 'failed') throw new Error(data.Log ?? '视频生成失败');
    // status pending/processing → keep polling
  }

  throw new Error('视频生成超时（10分钟）');
}
