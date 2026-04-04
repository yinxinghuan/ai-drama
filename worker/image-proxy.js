const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const R2_ACCOUNT_ID = 'bdccd2c68ff0d2e622994d24dbb1bae3';
const R2_ACCESS_KEY = 'b203adb7561b4f8800cbc1fa02424467';
const R2_SECRET_KEY = 'e7926e4175b7a0914496b9c999afd914cd1e4af7db8f83e0cf2bfad9773fa2b0';
const R2_BUCKET = 'aigram';
const R2_PUBLIC = 'https://images.aiwaves.tech';
const R2_HOST = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

async function hmacSha256(key, msg) {
  const k = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(msg)));
}

async function sha256hex(data) {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toHex(arr) {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function uploadToR2(data, objKey, contentType) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const contentHash = await sha256hex(data);
  const canonUri = `/${R2_BUCKET}/${objKey}`;
  const canonHeaders = `content-type:${contentType}\nhost:${R2_HOST}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonReq = ['PUT', canonUri, '', canonHeaders, signedHeaders, contentHash].join('\n');
  const credScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, await sha256hex(canonReq)].join('\n');

  let k = await hmacSha256('AWS4' + R2_SECRET_KEY, dateStamp);
  k = await hmacSha256(k, 'auto');
  k = await hmacSha256(k, 's3');
  k = await hmacSha256(k, 'aws4_request');
  const sig = toHex(await hmacSha256(k, stringToSign));

  const auth = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;
  const url = `https://${R2_HOST}/${R2_BUCKET}/${objKey}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': contentHash,
      'x-amz-date': amzDate,
      'Authorization': auth,
      'Content-Length': String(data.byteLength),
    },
    body: data,
  });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
  return `${R2_PUBLIC}/${objKey}`;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // /rehost: fetch a temporary image URL and rehost it on R2
    if (url.pathname === '/rehost') {
      try {
        const { url: srcUrl } = await request.json();
        const imgRes = await fetch(srcUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!imgRes.ok) throw new Error(`fetch source failed: ${imgRes.status}`);
        const data = await imgRes.arrayBuffer();
        const ext = srcUrl.includes('.webp') ? 'webp' : 'png';
        const key = `drama/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const contentType = ext === 'webp' ? 'image/webp' : 'image/png';
        const stableUrl = await uploadToR2(data, key, contentType);
        return new Response(JSON.stringify({ url: stableUrl }), {
          headers: { 'Content-Type': 'application/json', ...CORS },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
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
