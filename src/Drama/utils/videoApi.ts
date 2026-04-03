const API_URL = 'https://u545921-b746-8a491f44.westc.gpuhub.com:8443/video';
const COOLDOWN_MS = 100_000;

let lastVideoCallTime = 0;

/**
 * Wait until 100s has elapsed since last video call.
 * onTick is called every second with remaining seconds.
 */
export async function waitForVideoCooldown(onTick: (remaining: number) => void): Promise<void> {
  const elapsed = Date.now() - lastVideoCallTime;
  if (elapsed >= COOLDOWN_MS) return;

  let remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
  onTick(remaining);

  await new Promise<void>(resolve => {
    const interval = setInterval(() => {
      remaining--;
      onTick(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });
}

export function markVideoCallStart() {
  lastVideoCallTime = Date.now();
}

/**
 * Generate video using prompt_group for A→B→A (10s) motion.
 * Only start frame (imageUrl) is needed; no end frame.
 */
export async function generateVideo(
  prompt: string,
  imageUrl: string,
): Promise<string> {
  const id = 'drama_' + Math.random().toString(36).slice(2, 10);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '',
      params: {
        prompt_group: { '888': prompt },
        env: 'test',
        id,
        image_url: imageUrl,
        end_image_url: '',
        oss_url: '',
      },
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) throw new Error(`视频生成请求失败: ${res.status}`);
  const data = await res.json() as { Flag: boolean; File: string };
  if (!data.Flag || !data.File) throw new Error('生成失败，请重试');
  return data.File;
}
