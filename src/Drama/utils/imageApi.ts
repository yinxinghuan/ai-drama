// Dev: proxied via Vite to avoid CORS; Prod: Cloudflare Worker proxy (HTTPS)
const IMAGE_API = import.meta.env.DEV
  ? '/api/image/genl_image'
  : 'https://ai-drama-image-proxy.xinghuan-yin.workers.dev';

const COOLDOWN_MS = 75_000;
let lastCallTime = 0;

// Pub-sub for cooldown remaining seconds (0 = ready)
type CooldownListener = (remaining: number) => void;
const cooldownListeners: CooldownListener[] = [];

export function subscribeCooldown(listener: CooldownListener): () => void {
  cooldownListeners.push(listener);
  return () => {
    const i = cooldownListeners.indexOf(listener);
    if (i >= 0) cooldownListeners.splice(i, 1);
  };
}

function notifyCooldown(remaining: number) {
  cooldownListeners.forEach(l => l(remaining));
}

async function waitForCooldown(): Promise<void> {
  const elapsed = Date.now() - lastCallTime;
  if (elapsed >= COOLDOWN_MS) return;

  let remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
  notifyCooldown(remaining);

  await new Promise<void>(resolve => {
    const interval = setInterval(() => {
      remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastCallTime)) / 1000);
      const left = Math.max(0, remaining);
      notifyCooldown(left);
      if (left <= 0) { clearInterval(interval); resolve(); }
    }, 1000);
  });
}

// Serial queue — only one request at a time
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.then(() => {}, () => {});
  return next;
}

/**
 * Generate a scene image (img2img with character as ref).
 * @param onQueued  called immediately when added to queue
 * @param onStart   called when this request actually begins executing
 */
export function generateSceneImage(
  prompt: string,
  refUrl: string,
  onQueued?: () => void,
  onStart?: () => void,
): Promise<string> {
  onQueued?.();
  return enqueue(async () => {
    await waitForCooldown();
    lastCallTime = Date.now();
    notifyCooldown(0);
    onStart?.();

    const res = await fetch(IMAGE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '',
        params: { url: refUrl, prompt, user_id: 618336286 },
      }),
      signal: AbortSignal.timeout(360_000),
    });

    if (!res.ok) throw new Error(`生图请求失败: ${res.status}`);
    const data = await res.json() as { code: number; url: string };
    if (data.code !== 200 || !data.url) throw new Error('生图失败，请重试');
    return data.url;
  });
}
