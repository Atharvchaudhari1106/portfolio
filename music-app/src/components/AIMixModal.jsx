import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Wand2, Play, Plus, Check, Loader2 } from 'lucide-react';
import { parseMixPrompt, MOOD_COLORS } from '../services/aiEngine';
import { searchMusic } from '../services/musicService';
import { useAudio } from '../context/AudioContext';

const SUGGESTION_CHIPS = [
  { label: '💪 Workout', prompt: 'workout' },
  { label: '📚 Study', prompt: 'study' },
  { label: '🎉 Party', prompt: 'party' },
  { label: '🌧️ Rainy Day', prompt: 'rainy' },
  { label: '🚗 Road Trip', prompt: 'drive' },
  { label: '💕 Romance', prompt: 'romance' },
  { label: '🌙 Sleep', prompt: 'sleep' },
  { label: '🎯 Focus', prompt: 'focus' },
  { label: '🌅 Morning', prompt: 'morning' },
  { label: '👨‍🍳 Cooking', prompt: 'cooking' },
];

const AIMixModal = ({ isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMix, setGeneratedMix] = useState(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [saved, setSaved] = useState(false);
  const { playTrack, createPlaylist, addToPlaylist } = useAudio();

  useEffect(() => {
    if (!isOpen) {
      setPrompt('');
      setGeneratedMix(null);
      setIsGenerating(false);
      setProgress(0);
      setPhase('');
      setSaved(false);
    }
  }, [isOpen]);

  const handleGenerate = async (inputPrompt) => {
    const usePrompt = inputPrompt || prompt;
    if (!usePrompt.trim()) return;

    setIsGenerating(true);
    setGeneratedMix(null);
    setProgress(0);
    setSaved(false);

    try {
      const mixConfig = parseMixPrompt(usePrompt);
      setPhase('🧠 Analyzing your request...');
      setProgress(15);

      await new Promise(r => setTimeout(r, 600));
      setPhase('🔍 Searching for matching tracks...');
      setProgress(30);

      // Search for songs using all search terms
      const allTracks = [];
      const seen = new Set();

      for (let i = 0; i < mixConfig.searchTerms.length; i++) {
        const term = mixConfig.searchTerms[i];
        setProgress(30 + ((i / mixConfig.searchTerms.length) * 40));
        setPhase(`🎵 Finding "${term}" tracks...`);

        try {
          const results = await searchMusic(term);
          for (const track of results) {
            if (track.streamUrl && !seen.has(track.id)) {
              seen.add(track.id);
              allTracks.push(track);
            }
          }
        } catch {
          // continue with next term
        }
      }

      setProgress(75);
      setPhase('🤖 AI is curating the perfect mix...');
      await new Promise(r => setTimeout(r, 800));

      // Filter out instrumentals/karaoke
      const filtered = allTracks.filter(t => {
        const lower = t.title.toLowerCase();
        return !['instrumental', 'karaoke', 'ringtone', 'bgm', 'background'].some(kw => lower.includes(kw));
      });

      // Sort by play count to get best versions
      filtered.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));

      // Take top 15 tracks
      const mixTracks = filtered.slice(0, 15);

      setProgress(95);
      setPhase('✨ Finalizing your mix...');
      await new Promise(r => setTimeout(r, 500));

      setGeneratedMix({
        title: mixConfig.title,
        mood: mixConfig.mood,
        tracks: mixTracks,
        prompt: usePrompt,
        gradient: mixConfig.mood ? MOOD_COLORS[mixConfig.mood]?.gradient : 'linear-gradient(135deg, #667eea, #764ba2)'
      });

      setProgress(100);
      setPhase('');
    } catch (err) {
      console.error('AI Mix generation failed:', err);
      setPhase('❌ Failed to generate mix. Try a different prompt.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayAll = () => {
    if (generatedMix?.tracks?.length > 0) {
      playTrack(generatedMix.tracks[0], generatedMix.tracks);
      onClose();
    }
  };

  const handleSaveToLibrary = () => {
    if (!generatedMix || saved) return;
    const playlist = createPlaylist(generatedMix.title);
    for (const track of generatedMix.tracks) {
      addToPlaylist(playlist.id, track);
    }
    setSaved(true);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="ai-mix-overlay" onClick={onClose}>
      <div className="ai-mix-modal animate-fade-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-mix-header">
          <div className="ai-mix-header-left">
            <div className="ai-mix-icon">
              <Sparkles size={22} />
            </div>
            <div>
              <h2>AI Mix Generator</h2>
              <p>Describe the vibe, get a perfect playlist</p>
            </div>
          </div>
          <button className="ai-mix-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="ai-mix-content">
          {!generatedMix ? (
            <>
              {/* Prompt Input */}
              <div className="ai-mix-input-section">
                <div className="ai-mix-input-wrap">
                  <Wand2 size={20} className="ai-mix-input-icon" />
                  <input
                    type="text"
                    placeholder="e.g., chill music for studying, party bangers, rainy day vibes..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    disabled={isGenerating}
                    autoFocus
                  />
                </div>
                <button
                  className="ai-mix-generate-btn"
                  onClick={() => handleGenerate()}
                  disabled={isGenerating || !prompt.trim()}
                >
                  {isGenerating ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
              </div>

              {/* Quick Suggestions */}
              {!isGenerating && (
                <div className="ai-mix-suggestions">
                  <h4>Quick Picks</h4>
                  <div className="ai-mix-chips">
                    {SUGGESTION_CHIPS.map(chip => (
                      <button
                        key={chip.prompt}
                        className="ai-mix-chip"
                        onClick={() => {
                          setPrompt(chip.prompt);
                          handleGenerate(chip.prompt);
                        }}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Generation Progress */}
              {isGenerating && (
                <div className="ai-mix-progress">
                  <div className="ai-mix-progress-visual">
                    <div className="ai-mix-brain">
                      <Sparkles size={40} className="ai-pulse" />
                    </div>
                    <div className="ai-mix-progress-bar">
                      <div className="ai-mix-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="ai-mix-phase">{phase}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Generated Mix Results */
            <div className="ai-mix-results">
              <div className="ai-mix-results-header" style={{ background: generatedMix.gradient }}>
                <Sparkles size={24} />
                <h3>{generatedMix.title}</h3>
                <p>{generatedMix.tracks.length} tracks curated by AI</p>
              </div>

              <div className="ai-mix-actions">
                <button className="ai-mix-play-all" onClick={handlePlayAll}>
                  <Play size={18} fill="currentColor" /> Play All
                </button>
                <button
                  className={`ai-mix-save ${saved ? 'saved' : ''}`}
                  onClick={handleSaveToLibrary}
                  disabled={saved}
                >
                  {saved ? <Check size={18} /> : <Plus size={18} />}
                  {saved ? 'Saved!' : 'Save to Library'}
                </button>
              </div>

              <div className="ai-mix-tracklist">
                {generatedMix.tracks.map((track, idx) => (
                  <div
                    key={track.id}
                    className="ai-mix-track"
                    onClick={() => playTrack(track, generatedMix.tracks)}
                  >
                    <span className="ai-mix-track-num">{idx + 1}</span>
                    <img src={track.thumbnail} alt={track.title} className="ai-mix-track-art" />
                    <div className="ai-mix-track-info">
                      <p className="ai-mix-track-title">{track.title}</p>
                      <p className="ai-mix-track-artist">{track.artist}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button className="ai-mix-new" onClick={() => { setGeneratedMix(null); setPrompt(''); }}>
                <Wand2 size={16} /> Generate Another Mix
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AIMixModal;
