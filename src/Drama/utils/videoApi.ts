const API_URL = 'https://u545921-b746-8a491f44.westc.gpuhub.com:8443/video';
const COOLDOWN_MS = 100_000;

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
 * Generate video.
 * - With endImageUrl: explicit start→end frame mode (prompt + image_url + end_image_url)
 * - Without endImageUrl: prompt_group A→B→A auto mode (only start frame needed)
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

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '', params }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) throw new Error(`视频生成请求失败: ${res.status}`);
  const data = await res.json() as { Flag: boolean; File: string | Record<string, string> };
  if (!data.Flag || !data.File) throw new Error('生成失败，请重试');

  // prompt_group mode returns File as {"888": "url"}, plain mode returns string
  const fileUrl = typeof data.File === 'string' ? data.File : data.File['888'];
  if (!fileUrl) throw new Error('视频 URL 解析失败');
  return fileUrl;
}
