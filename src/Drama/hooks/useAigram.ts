import { useState, useEffect } from 'react';
import type { Character } from '../types';
import { fetchPublicUserByName } from '../utils/aigramPublicApi';

const R2 = 'https://images.aiwaves.tech/mymeme/avatars';

const DEMO_CONTACTS: Character[] = [
  { telegram_id: '1',   name: 'Algram',    head_url: `${R2}/algram.png`,     avatar_describe: 'young stylish man' },
  { telegram_id: '2',   name: 'Jenny',     head_url: `${R2}/jenny.png`,      avatar_describe: 'young woman with long hair' },
  { telegram_id: '3',   name: 'ghostpixel',head_url: `${R2}/ghostpixel.png`, avatar_describe: 'Lovely ghost in white cloth', style: 'Ghibli' },
  { telegram_id: '4',   name: 'JM·F',      head_url: `${R2}/jmf.png`,        avatar_describe: 'creative artistic person' },
  { telegram_id: '5',   name: 'Isaya',     head_url: `${R2}/isaya.png`,      avatar_describe: 'young woman with headphones' },
  { telegram_id: '6',   name: 'Isabel',    head_url: `${R2}/isabel.png`,     avatar_describe: 'confident young woman' },
];

function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return { apiOrigin: p.get('api_origin'), telegramId: p.get('telegram_id') };
}

function postMessageCall(apiOrigin: string, url: string, timeoutMs = 15000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const payload = { url, method: 'GET', data: null, request_id: requestId, emitter: window.location.origin };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));

    // Extract just the origin (strips path) — critical for postMessage to work
    const targetOrigin = new URL(apiOrigin).origin;

    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('timeout'));
    }, timeoutMs);

    function handler(event: MessageEvent) {
      if (event.origin !== targetOrigin) return;
      if (typeof event.data !== 'string' || !event.data.startsWith('callAPIResult-')) return;
      try {
        const result = JSON.parse(decodeURIComponent(escape(atob(event.data.slice('callAPIResult-'.length)))));
        if (result.request_id !== requestId) return;
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        result.success ? resolve(result.data) : reject(new Error(result.error));
      } catch { /* not our message */ }
    }

    window.addEventListener('message', handler);
    window.parent.postMessage(`callAPI-${encoded}`, targetOrigin);
  });
}

interface RawUser {
  telegram_id: string | number;
  name?: string;
  head_url?: string;
  avatar_describe?: string | null;
  style?: string;
}

function parseUser(raw: RawUser, fallbackName = ''): Character {
  return {
    telegram_id: String(raw.telegram_id),
    name: raw.name || fallbackName,
    head_url: raw.head_url || '',
    avatar_describe: raw.avatar_describe || undefined,
    style: raw.style || undefined,
  };
}

/** Enrich a character with full AI profile via public API (by name, no token needed) */
export async function enrichCharacter(char: Character): Promise<Character> {
  if (char.avatar_describe && char.head_url && char.style) return char;
  const data = await fetchPublicUserByName(char.name);
  if (!data) return char;
  return {
    ...char,
    head_url: data.head_url || char.head_url,
    avatar_describe: data.avatar_describe || char.avatar_describe,
    style: data.style || char.style,
  };
}

export interface AigramState {
  me: Character | null;
  contacts: Character[];
  loading: boolean;
  isDemo: boolean;
  apiOrigin: string | null;
}

export function useAigram(): AigramState {
  const [me, setMe] = useState<Character | null>(null);
  const [contacts, setContacts] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const { apiOrigin, telegramId } = getUrlParams();

  useEffect(() => {
    if (!apiOrigin || !telegramId) {
      // Demo mode — use bundled R2 avatars, optionally enrich with public API
      setIsDemo(true);
      setMe(null);
      setContacts(DEMO_CONTACTS);
      setLoading(false);

      // Enrich in background (for style/avatar_describe updates)
      Promise.all(
        DEMO_CONTACTS.map(c =>
          fetchPublicUserByName(c.name).then(d => d ? {
            ...c,
            head_url: d.head_url || c.head_url,
            avatar_describe: d.avatar_describe || c.avatar_describe,
            style: d.style || c.style,
          } : c).catch(() => c)
        )
      ).then(enriched => setContacts(enriched));

      return;
    }

    async function load() {
      try {
        const [meRaw, contactsRaw] = await Promise.all([
          postMessageCall(apiOrigin!, `/note/telegram/user/get/info/by/telegram_id?telegram_id=${telegramId}`, 8000),
          postMessageCall(apiOrigin!, `/note/telegram/user/contact/list?telegram_id=${telegramId}`, 15000),
        ]);

        // Unwrap { data: user } or direct user object
        const meData = (meRaw && typeof meRaw === 'object' && 'data' in (meRaw as object))
          ? (meRaw as { data: RawUser }).data
          : meRaw as RawUser;
        setMe(parseUser(meData, '你'));

        // Unwrap { data: [...] } or direct array
        const rawList: RawUser[] = Array.isArray(contactsRaw)
          ? contactsRaw
          : Array.isArray((contactsRaw as { data?: RawUser[] })?.data)
            ? (contactsRaw as { data: RawUser[] }).data
            : [];

        const friends = rawList.slice(0, 9).map(u => parseUser(u));
        setContacts(friends.length > 0 ? friends : DEMO_CONTACTS);
        setIsDemo(friends.length === 0);
      } catch {
        setContacts(DEMO_CONTACTS);
        setIsDemo(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [apiOrigin, telegramId]);

  return { me, contacts, loading, isDemo, apiOrigin };
}
