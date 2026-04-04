const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Credentials injected via Cloudflare Worker Secrets (not stored in code)
const OSS_BUCKET  = 'aigram-jp';
const OSS_ENDPOINT = 'oss-ap-northeast-1.aliyuncs.com';
const CDN_HOST    = 'https://cdn.aiwaves.tech';

async function hmacSha1Base64(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function uploadToOSS(data, objKey, contentType, keyId, secret) {
  const date = new Date().toUTCString();
  const canonResource = `/${OSS_BUCKET}/${objKey}`;
  const stringToSign = `PUT\n\n${contentType}\n${date}\n${canonResource}`;
  const sig = await hmacSha1Base64(secret, stringToSign);
  const auth = `OSS ${keyId}:${sig}`;

  const res = await fetch(`https://${OSS_BUCKET}.${OSS_ENDPOINT}/${objKey}`, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Date': date,
      'Authorization': auth,
      'Content-Length': String(data.byteLength),
    },
    body: data,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OSS upload failed: ${res.status} ${text}`);
  }
  return `${CDN_HOST}/${objKey}`;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // /rehost: fetch a temporary image URL and rehost it on OSS
    // POST { "url": "https://cdn.aiwaves.tech/..." }
    // Returns { "url": "https://cdn.aiwaves.tech/prod/video/drama/..." }
    if (url.pathname === '/rehost') {
      try {
        const { url: srcUrl } = await request.json();
        const imgRes = await fetch(srcUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!imgRes.ok) throw new Error(`fetch source image failed: ${imgRes.status}`);
        const data = await imgRes.arrayBuffer();

        const now = new Date();
        const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
        const rand = Math.random().toString(36).slice(2, 7);
        const ext = srcUrl.includes('.webp') ? 'webp' : 'png';
        const contentType = ext === 'webp' ? 'image/webp' : 'image/png';
        const objKey = `prod/video/drama/${ts}_${rand}_0.${ext}`;

        const stableUrl = await uploadToOSS(data, objKey, contentType, env.OSS_KEY_ID, env.OSS_SECRET);
        return new Response(JSON.stringify({ url: stableUrl }), {
          headers: { 'Content-Type': 'application/json', ...CORS },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS },
        });
      }
    }

    // Default: proxy to image generation API
    const body = await request.text();
    const res = await fetch('http://aiservice.wdabuliu.com:8019/genl_image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.text();
    return new Response(data, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  },
};
