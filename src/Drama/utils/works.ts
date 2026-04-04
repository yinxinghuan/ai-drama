import type { Work } from '../types';

const LOCAL_KEY = 'ai_drama_works';
const WORKS_API = 'https://ai-drama-image-proxy.xinghuan-yin.workers.dev/works';

// ── localStorage (demo / fallback) ───────────────────────────────────────────

export function loadWorksLocal(): Work[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveWorkLocal(work: Work): void {
  const works = loadWorksLocal();
  const idx = works.findIndex(w => w.id === work.id);
  if (idx >= 0) works[idx] = work;
  else works.unshift(work);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(works));
}

function deleteWorkLocal(id: string): void {
  const works = loadWorksLocal().filter(w => w.id !== id);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(works));
}

// ── Cloud (OSS via Worker) ────────────────────────────────────────────────────

export async function loadWorksRemote(uid: string): Promise<Work[]> {
  const res = await fetch(`${WORKS_API}?uid=${uid}`);
  if (!res.ok) throw new Error(`load works failed: ${res.status}`);
  return res.json() as Promise<Work[]>;
}

// ── Unified API ───────────────────────────────────────────────────────────────
// uid present → cloud;  absent → localStorage

export async function saveWork(uid: string | undefined, work: Work): Promise<void> {
  if (uid) {
    const res = await fetch(WORKS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, work }),
    });
    if (!res.ok) throw new Error(`save work failed: ${res.status}`);
  } else {
    saveWorkLocal(work);
  }
}

export async function deleteWork(uid: string | undefined, workId: string): Promise<void> {
  if (uid) {
    const res = await fetch(WORKS_API, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, work_id: workId }),
    });
    if (!res.ok) throw new Error(`delete work failed: ${res.status}`);
  } else {
    deleteWorkLocal(workId);
  }
}
