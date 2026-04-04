const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

async function readJsonFromOSS(objKey, keyId, secret) {
  const date = new Date().toUTCString();
  const canonResource = `/${OSS_BUCKET}/${objKey}`;
  const stringToSign = `GET\n\n\n${date}\n${canonResource}`;
  const sig = await hmacSha1Base64(secret, stringToSign);
  const auth = `OSS ${keyId}:${sig}`;

  const res = await fetch(`https://${OSS_BUCKET}.${OSS_ENDPOINT}/${objKey}`, {
    method: 'GET',
    headers: { 'Date': date, 'Authorization': auth },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OSS read failed: ${res.status}`);
  return res.json();
}

async function writeJsonToOSS(objKey, value, keyId, secret) {
  const data = new TextEncoder().encode(JSON.stringify(value));
  await uploadToOSS(data, objKey, 'application/json', keyId, secret);
}

function worksKey(uid) {
  return `prod/drama/works/${uid}.json`;
}

function jsonResp(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // ── /works: cloud draft storage ───────────────────────────────────────────
    if (url.pathname === '/works') {
      // Validate uid: must be numeric telegram_id
      const uid = request.method === 'GET'
        ? url.searchParams.get('uid')
        : (await request.clone().json().catch(() => ({}))).uid;

      if (!uid || !/^\d+$/.test(String(uid))) {
        return jsonResp({ error: 'invalid uid' }, 400);
      }

      const key = worksKey(uid);

      // GET /works?uid=xxx → load works list
      if (request.method === 'GET') {
        try {
          const works = await readJsonFromOSS(key, env.OSS_KEY_ID, env.OSS_SECRET);
          return jsonResp(works ?? []);
        } catch (e) {
          return jsonResp({ error: String(e) }, 500);
        }
      }

      // POST /works { uid, work } → upsert one work
      if (request.method === 'POST') {
        try {
          const { work } = await request.json();
          let works = await readJsonFromOSS(key, env.OSS_KEY_ID, env.OSS_SECRET) ?? [];
          const idx = works.findIndex(w => w.id === work.id);
          if (idx >= 0) works[idx] = work;
          else works.unshift(work);
          works = works.slice(0, 30); // keep newest 30
          await writeJsonToOSS(key, works, env.OSS_KEY_ID, env.OSS_SECRET);
          return jsonResp({ ok: true });
        } catch (e) {
          return jsonResp({ error: String(e) }, 500);
        }
      }

      // DELETE /works { uid, work_id } → remove one work
      if (request.method === 'DELETE') {
        try {
          const { work_id } = await request.json();
          let works = await readJsonFromOSS(key, env.OSS_KEY_ID, env.OSS_SECRET) ?? [];
          works = works.filter(w => w.id !== work_id);
          await writeJsonToOSS(key, works, env.OSS_KEY_ID, env.OSS_SECRET);
          return jsonResp({ ok: true });
        } catch (e) {
          return jsonResp({ error: String(e) }, 500);
        }
      }
    }

    // ── /upload: accept raw image body and upload to OSS ─────────────────────
    if (url.pathname === '/upload') {
      try {
        const contentType = request.headers.get('Content-Type') || 'image/png';
        const data = await request.arrayBuffer();
        const ext = contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
        const key = `prod/video/drama/upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const stableUrl = await uploadToOSS(data, key, contentType, env.OSS_KEY_ID, env.OSS_SECRET);
        return jsonResp({ url: stableUrl });
      } catch (e) {
        return jsonResp({ error: String(e) }, 500);
      }
    }

    // ── /rehost: fetch a temporary image URL and rehost it on OSS ────────────
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
        return jsonResp({ url: stableUrl });
      } catch (e) {
        return jsonResp({ error: String(e) }, 500);
      }
    }

    // ── /video: proxy to video generation API ────────────────────────────────
    if (url.pathname === '/video') {
      const body = await request.text();
      const res = await fetch('https://u545921-b746-8a491f44.westc.gpuhub.com:8443/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await res.text();
      return new Response(data, {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // ── Default: proxy to image generation API ───────────────────────────────
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
