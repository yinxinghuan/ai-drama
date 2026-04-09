import { useState, useCallback, useRef, useEffect } from 'react';
import type { Character, Shot, Phase, Work, DramaTemplate } from './types';
import { useAigram, enrichCharacter } from './hooks/useAigram';
import { generateSceneImage, enhancePrompt } from './utils/imageApi';
import { submitVideo, pollVideoTask, waitForVideoCooldown, markVideoCallStart } from './utils/videoApi';
import { saveWork } from './utils/works';
import HomePage from './pages/HomePage';
import ScriptPage from './pages/ScriptPage';
import GeneratingPage from './pages/GeneratingPage';
import TheaterPage from './pages/TheaterPage';
import WorksPage from './pages/WorksPage';
import './Drama.less';

function makeShot(prompt = ''): Shot {
  return { id: crypto.randomUUID(), prompt, status: 'idle' };
}

const INITIAL_SHOTS = [
  makeShot('开场，主角出现，镜头慢慢推进'),
  makeShot(''),
  makeShot(''),
];

/** Resolve the character for a shot: own > shot[0] > default */
export function resolveCharacter(shot: Shot, shots: Shot[], defaultChar: Character | null): Character | null {
  return shot.character ?? shots[0]?.character ?? defaultChar;
}

function buildPrompt(userPrompt: string, character: Character | null): string {
  const parts: string[] = [];
  if (character?.avatar_describe) parts.push(character.avatar_describe);
  if (character?.style) parts.push(`${character.style} style`);
  parts.push('cinematic film');
  parts.push(userPrompt);
  parts.push('forward motion, no loop, end on a different scene from the opening');
  return parts.join(', ');
}

export default function Drama() {
  const aigram = useAigram();
  const [phase, setPhase] = useState<Phase>('home');
  const [prevPhase, setPrevPhase] = useState<Phase>('generating');
  const [genBackPhase, setGenBackPhase] = useState<Phase>('home');
  const [defaultCharacter, setDefaultCharacter] = useState<Character | null>(null);
  const [shots, setShots] = useState<Shot[]>(INITIAL_SHOTS);

  // Stable work ID for the current generation session, used for incremental saves
  const currentWorkId = useRef<string | null>(null);
  const currentCharacter = useRef<Character | null>(null);

  // Auto-set default character from aigram.me
  useEffect(() => {
    if (!defaultCharacter && aigram.me) {
      setDefaultCharacter(aigram.me);
    }
  }, [aigram.me, defaultCharacter]);

  const goTheater = (from: Phase) => { setPrevPhase(from); setPhase('theater'); };

  const handleSelectTemplate = useCallback((template: DramaTemplate) => {
    setShots(template.shots.map(p => makeShot(p)));
    setPhase('script');
  }, []);

  const handleFreeCreate = useCallback(() => {
    setShots(INITIAL_SHOTS.map(s => makeShot(s.prompt)));
    setPhase('script');
  }, []);

  const handleChangeDefaultCharacter = useCallback(async (char: Character) => {
    const enriched = await enrichCharacter(char);
    setDefaultCharacter(enriched);
  }, []);

  const updateShot = useCallback((id: string, update: Partial<Shot>) => {
    setShots(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  }, []);

  // Save current shots to works — called after each shot completes
  const saveCurrentWork = useCallback((shotsSnapshot: Shot[]) => {
    const workId = currentWorkId.current;
    const char = currentCharacter.current;
    if (!workId || !char) return;
    const work: Work = { id: workId, createdAt: Date.now(), character: char, shots: shotsSnapshot };
    saveWork(aigram.me?.telegram_id, work);
  }, [aigram.me?.telegram_id]);

  /**
   * Submit a single shot to the server — generates image + submits video job.
   * Returns taskId. Does NOT poll — caller handles polling separately.
   */
  const submitShotJob = useCallback(async (shot: Shot, char: Character): Promise<string> => {
    updateShot(shot.id, { status: 'imaging', error: undefined, taskId: undefined });
    const enhanced = await enhancePrompt(shot.prompt, char.head_url || undefined);
    const prompt = buildPrompt(enhanced, char);

    let startUrl = shot.startImageUrl;
    if (!startUrl) {
      startUrl = await generateSceneImage(prompt, char.head_url);
      updateShot(shot.id, { startImageUrl: startUrl });
    }

    updateShot(shot.id, { status: 'waiting' });
    await waitForVideoCooldown(remaining => {
      updateShot(shot.id, { waitSeconds: remaining });
    });

    markVideoCallStart();
    updateShot(shot.id, { status: 'generating' });

    const taskId = await submitVideo(prompt, startUrl, shot.endImageUrl);
    updateShot(shot.id, { taskId });
    return taskId;
  }, [updateShot]);

  /** Poll a single shot and update its status */
  const pollShot = useCallback(async (shotId: string, taskId: string) => {
    try {
      const videoUrl = await pollVideoTask(taskId);
      updateShot(shotId, { status: 'done', videoUrl });
    } catch (err) {
      updateShot(shotId, { status: 'error', error: err instanceof Error ? err.message : '生成失败' });
    }
    setShots(prev => { saveCurrentWork(prev); return prev; });
  }, [updateShot, saveCurrentWork]);

  /**
   * Sequential generation: submit → poll → next shot.
   * Server doesn't support concurrent video tasks.
   */
  const handleGenerate = useCallback(async (enrichedShots: Shot[]) => {
    const activeShots = enrichedShots.filter(s => s.prompt.trim());
    if (activeShots.length === 0) return;

    // Derive primary character from first shot
    const primaryChar = resolveCharacter(activeShots[0], enrichedShots, defaultCharacter);
    if (!primaryChar) return;

    const workId = crypto.randomUUID();
    currentWorkId.current = workId;
    currentCharacter.current = primaryChar;

    const pendingShots = enrichedShots.map(s => ({
      ...s, status: 'idle' as const, videoUrl: undefined, error: undefined, waitSeconds: undefined, taskId: undefined,
    }));
    setShots(pendingShots);
    setGenBackPhase('script');
    setPhase('generating');

    saveWork(aigram.me?.telegram_id, { id: workId, createdAt: Date.now(), character: primaryChar, shots: pendingShots });

    // One at a time: submit → poll until done → next
    for (const shot of activeShots) {
      const shotChar = resolveCharacter(shot, enrichedShots, defaultCharacter) ?? primaryChar;
      try {
        const taskId = await submitShotJob(shot, shotChar);
        await pollShot(shot.id, taskId);
      } catch (err) {
        updateShot(shot.id, { status: 'error', error: err instanceof Error ? err.message : '提交失败' });
        setShots(prev => { saveCurrentWork(prev); return prev; });
      }
    }
  }, [defaultCharacter, submitShotJob, pollShot, updateShot, saveCurrentWork, aigram.me?.telegram_id]);

  const handleRegenShot = useCallback(async (shotId: string) => {
    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;
    const char = resolveCharacter(shot, shots, defaultCharacter);
    if (!char) return;
    try {
      const taskId = await submitShotJob(shot, char);
      setShots(prev => { saveCurrentWork(prev); return prev; });
      await pollShot(shotId, taskId);
    } catch (err) {
      updateShot(shotId, { status: 'error', error: err instanceof Error ? err.message : '提交失败' });
      setShots(prev => { saveCurrentWork(prev); return prev; });
    }
  }, [shots, defaultCharacter, submitShotJob, pollShot, updateShot, saveCurrentWork]);

  const handleRestart = () => {
    setShots(prev => prev.map(s => ({
      ...s, status: 'idle' as const, videoUrl: undefined, error: undefined, waitSeconds: undefined, taskId: undefined,
    })));
    setPhase('script');
  };

  const handleResumeWork = useCallback(async (work: Work) => {
    // If this is the currently active work, just navigate back — don't reload
    if (work.id === currentWorkId.current) {
      setGenBackPhase('works');
      setPhase('generating');
      return;
    }

    setDefaultCharacter(work.character);
    currentWorkId.current = work.id;
    currentCharacter.current = work.character;

    // Normalize statuses based on actual data
    const normalized = work.shots.map(s => ({
      ...s,
      status: s.videoUrl ? 'done' as const
        : s.taskId ? 'generating' as const
        : 'idle' as const,
      error: undefined,
      waitSeconds: undefined,
    }));
    setShots(normalized);
    setGenBackPhase('works');
    setPhase('generating');

    // Resume polling for shots that have a taskId but no videoUrl — one at a time
    const pending = normalized.filter(s => s.taskId && !s.videoUrl);
    for (const shot of pending) {
      await pollShot(shot.id, shot.taskId!);
    }
  }, [pollShot]);

  // Continue generating remaining idle/error shots — sequential
  const handleContinueGeneration = useCallback(async () => {
    const remaining = shots.filter(s => s.prompt.trim() && (s.status === 'idle' || s.status === 'error'));

    for (const shot of remaining) {
      const char = resolveCharacter(shot, shots, defaultCharacter);
      if (!char) continue;
      try {
        const taskId = await submitShotJob(shot, char);
        await pollShot(shot.id, taskId);
      } catch (err) {
        updateShot(shot.id, { status: 'error', error: err instanceof Error ? err.message : '提交失败' });
        setShots(prev => { saveCurrentWork(prev); return prev; });
      }
    }
  }, [shots, defaultCharacter, submitShotJob, pollShot, updateShot, saveCurrentWork]);

  const isGenerating = shots.some(s => ['imaging', 'waiting', 'generating'].includes(s.status));

  return (
    <div className="ad-root">
      {phase === 'home' && (
        <HomePage
          aigram={aigram}
          defaultCharacter={defaultCharacter}
          onSelectTemplate={handleSelectTemplate}
          onFreeCreate={handleFreeCreate}
          onOpenWorks={() => setPhase('works')}
          onChangeDefaultCharacter={handleChangeDefaultCharacter}
          isGenerating={isGenerating}
          onResumeGenerating={() => { setGenBackPhase('home'); setPhase('generating'); }}
        />
      )}
      {phase === 'works' && (
        <WorksPage
          uid={aigram.me?.telegram_id}
          onBack={() => setPhase('home')}
          onOpen={handleResumeWork}
        />
      )}
      {phase === 'script' && (
        <ScriptPage
          aigram={aigram}
          defaultCharacter={defaultCharacter}
          shots={shots}
          onShotsChange={(updater) => setShots(updater)}
          onGenerate={handleGenerate}
          onBack={() => setPhase('home')}
        />
      )}
      {phase === 'generating' && (
        <GeneratingPage
          shots={shots}
          onRegen={handleRegenShot}
          onContinue={handleContinueGeneration}
          onPreview={() => goTheater('generating')}
          onBack={() => setPhase(genBackPhase)}
        />
      )}
      {phase === 'theater' && (
        <TheaterPage
          shots={shots}
          defaultCharacter={defaultCharacter}
          onBack={() => setPhase(prevPhase)}
          onRestart={handleRestart}
          onRegenShot={handleRegenShot}
        />
      )}
    </div>
  );
}
