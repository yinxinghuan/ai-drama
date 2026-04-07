import { useState, useCallback, useRef } from 'react';
import type { Character, Shot, Phase, Work } from './types';
import { useAigram, enrichCharacter } from './hooks/useAigram';
import { generateSceneImage, enhancePrompt } from './utils/imageApi';
import { submitVideo, pollVideoTask, waitForVideoCooldown, markVideoCallStart } from './utils/videoApi';
import { saveWork } from './utils/works';
import SetupPage from './pages/SetupPage';
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

function buildPrompt(userPrompt: string, character: Character): string {
  const parts: string[] = [];
  if (character.avatar_describe) parts.push(character.avatar_describe);
  if (character.style) parts.push(`${character.style} style`);
  parts.push('cinematic film');
  parts.push(userPrompt);
  parts.push('forward motion, no loop, end on a different scene from the opening');
  return parts.join(', ');
}

export default function Drama() {
  const aigram = useAigram();
  const [phase, setPhase] = useState<Phase>('setup');
  const [prevPhase, setPrevPhase] = useState<Phase>('generating');
  const [genBackPhase, setGenBackPhase] = useState<Phase>('setup');
  const [character, setCharacter] = useState<Character | null>(null);
  const [shots, setShots] = useState<Shot[]>(INITIAL_SHOTS);

  // Stable work ID for the current generation session, used for incremental saves
  const currentWorkId = useRef<string | null>(null);
  const currentCharacter = useRef<Character | null>(null);

  const goTheater = (from: Phase) => { setPrevPhase(from); setPhase('theater'); };

  const handleSelectCharacter = useCallback(async (char: Character) => {
    const enriched = await enrichCharacter(char);
    setCharacter(enriched);
    setPhase('script');
  }, []);

  const updateShot = useCallback((id: string, update: Partial<Shot>) => {
    setShots(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  }, []);

  // Save current shots to works — called after each shot completes
  const saveCurrentWork = useCallback((shots: Shot[]) => {
    const workId = currentWorkId.current;
    const char = currentCharacter.current;
    if (!workId || !char) return;
    const work: Work = { id: workId, createdAt: Date.now(), character: char, shots };
    saveWork(aigram.me?.telegram_id, work);
  }, [aigram.me?.telegram_id]);

  const generateShot = useCallback(async (shot: Shot, char: Character) => {
    try {
      updateShot(shot.id, { status: 'imaging' });
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

      // Submit job — save taskId immediately so it persists if app is closed
      const taskId = await submitVideo(prompt, startUrl, shot.endImageUrl);
      updateShot(shot.id, { taskId });
      setShots(prev => { saveCurrentWork(prev); return prev; });

      // Poll until done
      const videoUrl = await pollVideoTask(taskId);
      updateShot(shot.id, { status: 'done', videoUrl });
    } catch (err) {
      updateShot(shot.id, { status: 'error', error: err instanceof Error ? err.message : '生成失败' });
    }
  }, [updateShot]);

  const handleGenerate = useCallback(async (enrichedShots: Shot[]) => {
    if (!character) return;
    const activeShots = enrichedShots.filter(s => s.prompt.trim());

    // Stable IDs for this generation session
    const workId = crypto.randomUUID();
    currentWorkId.current = workId;
    currentCharacter.current = character;

    const pendingShots = enrichedShots.map(s => ({
      ...s, status: 'idle' as const, videoUrl: undefined, error: undefined, waitSeconds: undefined,
    }));
    setShots(pendingShots);
    setGenBackPhase('script');
    setPhase('generating');

    // Save draft immediately so it appears in works list right away
    saveWork(aigram.me?.telegram_id, { id: workId, createdAt: Date.now(), character, shots: pendingShots });

    // Sequential generation — save after each shot completes
    for (const shot of activeShots) {
      await generateShot(shot, character);
      // Incremental save: capture current shots state and persist
      setShots(prev => {
        saveCurrentWork(prev);
        return prev;
      });
    }
  }, [character, generateShot, saveCurrentWork, aigram.me?.telegram_id]);

  const handleRegenShot = useCallback(async (shotId: string) => {
    if (!character) return;
    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;
    await generateShot(shot, character);
    // Save after regen too
    setShots(prev => {
      saveCurrentWork(prev);
      return prev;
    });
  }, [character, shots, generateShot, saveCurrentWork]);

  const handleRestart = () => {
    setShots(prev => prev.map(s => ({
      ...s, status: 'idle' as const, videoUrl: undefined, error: undefined, waitSeconds: undefined,
    })));
    setPhase('script');
  };

  const handleResumeWork = useCallback(async (work: Work) => {
    // If this is the currently active work, just navigate back — don't reload and overwrite in-memory state
    if (work.id === currentWorkId.current) {
      setGenBackPhase('works');
      setPhase('generating');
      return;
    }

    setCharacter(work.character);
    currentWorkId.current = work.id;
    currentCharacter.current = work.character;

    // Normalize statuses based on actual data — saved status may be stale
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

    // Resume polling for shots that have a taskId but no videoUrl yet
    const pending = normalized.filter(s => s.taskId && !s.videoUrl);
    for (const shot of pending) {
      try {
        const videoUrl = await pollVideoTask(shot.taskId!);
        updateShot(shot.id, { status: 'done', videoUrl });
      } catch (err) {
        updateShot(shot.id, { status: 'error', error: err instanceof Error ? err.message : '生成失败' });
      }
      setShots(prev => { saveCurrentWork(prev); return prev; });
    }
  }, [updateShot, saveCurrentWork]);

  // Continue generating remaining idle/error shots
  const handleContinueGeneration = useCallback(async () => {
    if (!character) return;
    const remaining = shots.filter(s => s.prompt.trim() && (s.status === 'idle' || s.status === 'error'));
    for (const shot of remaining) {
      await generateShot(shot, character);
      setShots(prev => { saveCurrentWork(prev); return prev; });
    }
  }, [character, shots, generateShot, saveCurrentWork]);

  const isGenerating = shots.some(s => ['imaging', 'waiting', 'generating'].includes(s.status));

  return (
    <div className="ad-root">
      {phase === 'setup' && (
        <SetupPage
          aigram={aigram}
          onSelect={handleSelectCharacter}
          onOpenWorks={() => setPhase('works')}
          isGenerating={isGenerating}
          onResumeGenerating={() => { setGenBackPhase('setup'); setPhase('generating'); }}
        />
      )}
      {phase === 'works' && (
        <WorksPage
          uid={aigram.me?.telegram_id}
          onBack={() => setPhase('setup')}
          onOpen={handleResumeWork}
        />
      )}
      {phase === 'script' && character && (
        <ScriptPage
          character={character}
          shots={shots}
          onShotsChange={(updater) => setShots(updater)}
          onGenerate={handleGenerate}
          onBack={() => setPhase('setup')}
        />
      )}
      {phase === 'generating' && character && (
        <GeneratingPage
          shots={shots}
          onRegen={handleRegenShot}
          onContinue={handleContinueGeneration}
          onPreview={() => goTheater('generating')}
          onBack={() => setPhase(genBackPhase)}
        />
      )}
      {phase === 'theater' && character && (
        <TheaterPage
          shots={shots}
          character={character}
          onBack={() => setPhase(prevPhase)}
          onRestart={handleRestart}
          onRegenShot={handleRegenShot}
        />
      )}
    </div>
  );
}
