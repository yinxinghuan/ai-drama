import type { Work } from '../types';

const KEY = 'ai_drama_works';

export function loadWorks(): Work[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveWork(work: Work): void {
  const works = loadWorks();
  const idx = works.findIndex(w => w.id === work.id);
  if (idx >= 0) works[idx] = work;
  else works.unshift(work);
  localStorage.setItem(KEY, JSON.stringify(works));
}

export function deleteWork(id: string): void {
  const works = loadWorks().filter(w => w.id !== id);
  localStorage.setItem(KEY, JSON.stringify(works));
}
