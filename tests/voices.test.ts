import { describe, expect, it } from 'vitest';
import { rankVoices, speechChunks, type VoiceInfo } from '../src/domain/voices';

const v = (name: string, lang = 'en-US', voiceURI = `com.apple.voice.compact.${lang}.${name}`, extra: Partial<VoiceInfo> = {}): VoiceInfo => ({
  name, lang, voiceURI, localService: true, default: false, ...extra,
});

describe('voice ranking', () => {
  // Roughly what an iPad returns, in its (alphabetical) order.
  const ipad = [
    v('Albert', 'en-US', 'com.apple.speech.synthesis.voice.Albert'),
    v('Bad News', 'en-US', 'com.apple.speech.synthesis.voice.BadNews'),
    v('Bubbles', 'en-US', 'com.apple.speech.synthesis.voice.Bubbles'),
    v('Eddy (English (US))', 'en-US', 'com.apple.eloquence.en-US.Eddy'),
    v('Fred', 'en-US', 'com.apple.speech.synthesis.voice.Fred'),
    v('Daniel', 'en-GB'),
    v('Samantha', 'en-US'),
    v('Ava (Enhanced)', 'en-US', 'com.apple.voice.enhanced.en-US.Ava'),
    v('Zarvox', 'en-US', 'com.apple.speech.synthesis.voice.Zarvox'),
    v('Thomas', 'fr-FR'),
  ];

  it('never picks novelty voices and prefers enhanced/natural ones', () => {
    const ranked = rankVoices(ipad).map((x) => x.name);
    expect(ranked[0]).toBe('Ava (Enhanced)');
    expect(ranked).not.toContain('Albert');
    expect(ranked).not.toContain('Bubbles');
    expect(ranked).not.toContain('Zarvox');
    expect(ranked).not.toContain('Thomas');
    expect(ranked.indexOf('Samantha')).toBeLessThan(ranked.indexOf('Fred'));
    expect(ranked.indexOf('Daniel')).toBeLessThan(ranked.indexOf('Eddy (English (US))'));
  });

  it('picks a good compact voice when no enhanced voice is installed', () => {
    const ranked = rankVoices(ipad.filter((x) => !x.name.includes('Enhanced')));
    expect(ranked[0].name).toBe('Samantha');
  });
});

describe('speech chunks', () => {
  it('splits into sentences and replaces blanks', () => {
    expect(speechChunks('The cat is ___ the box.')).toEqual(['The cat is blank the box.']);
    const chunks = speechChunks('Penguins are birds, but they cannot fly. They use their wings like flippers to swim fast in the water. Most penguins live in the south!');
    expect(chunks).toHaveLength(3);
    expect(chunks[2]).toBe('Most penguins live in the south!');
  });
});
