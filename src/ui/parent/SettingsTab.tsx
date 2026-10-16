import { useEffect, useState } from 'preact/hooks';
import { setSetting } from '../../db/repo';
import { checkPin, isValidPin, setPin } from '../../pin';
import { englishVoices, getTtsPrefs, onVoicesChanged, pickVoice, setTtsPrefs, speak, ttsSupported } from '../../tts';
import { isHighQuality } from '../../domain/voices';
import { alertDialog } from '../dialog';

export function SettingsTab() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(englishVoices());
  const [voiceURI, setVoiceURI] = useState<string>(getTtsPrefs().voiceURI ?? '');
  const [rate, setRate] = useState(getTtsPrefs().rate);
  const [pins, setPins] = useState({ current: '', next: '', again: '' });
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const autoVoice = voices.length ? pickVoice(null) : undefined;
  const hasGoodVoice = voices.some(isHighQuality);

  useEffect(() => onVoicesChanged(() => setVoices(englishVoices())), []);
  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  const saveVoice = async (uri: string, r: number) => {
    setTtsPrefs({ voiceURI: uri || null, rate: r });
    await setSetting('tts', { voiceURI: uri || null, rate: r });
  };

  const changePin = async (e: Event) => {
    e.preventDefault();
    if (!(await checkPin(pins.current))) return void alertDialog('Current PIN is not right');
    if (!isValidPin(pins.next)) return void alertDialog('The new PIN must be exactly 4 digits');
    if (pins.next !== pins.again) return void alertDialog('The new PINs do not match');
    await setPin(pins.next);
    setPins({ current: '', next: '', again: '' });
    await alertDialog('PIN changed ✓');
  };

  const pinField = (key: keyof typeof pins, label: string) => (
    <label>
      {label}
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autocomplete="off"
        value={pins[key]}
        onInput={(e) => setPins({ ...pins, [key]: (e.target as HTMLInputElement).value.replace(/\D/g, '') })}
      />
    </label>
  );

  return (
    <section>
      <div class="card form">
        <h2>🔊 Voice (read-aloud and listening)</h2>
        {!ttsSupported() ? (
          <p class="warn-text">Speech is not available in this browser.</p>
        ) : (
          <>
            <label>
              Voice
              <select
                value={voiceURI}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  setVoiceURI(v);
                  void saveVoice(v, rate);
                }}
              >
                <option value="">Automatic — best available{autoVoice ? ` (${autoVoice.name})` : ''}</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {isHighQuality(v) ? '⭐ ' : ''}
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Speed: {rate.toFixed(2)}×
              <input
                type="range"
                min={0.5}
                max={1.3}
                step={0.05}
                value={rate}
                onInput={(e) => setRate(Number((e.target as HTMLInputElement).value))}
                onChange={(e) => void saveVoice(voiceURI, Number((e.target as HTMLInputElement).value))}
              />
            </label>
            <button class="btn" onClick={() => speak('Hello! The cat is in the box. Let us practise English together.', { rate, voiceURI: voiceURI || null })}>
              ▶ Test voice
            </button>
            {voices.length > 0 && !hasGoodVoice && (
              <p class="warn-text">
                No high-quality English voice is installed, so speech may sound robotic. On the iPad, go to Settings → Accessibility → Spoken Content → Voices → English, and
                download an "Enhanced" or "Premium" voice such as Ava, Samantha or Daniel (Wi-Fi needed once). Then reopen this app and choose it here.
              </p>
            )}
            <p class="muted">⭐ = high-quality voice. Novelty voices are hidden. If you hear nothing, check that the iPad volume is up and the silent mode is off.</p>
          </>
        )}
      </div>

      <form class="card form" onSubmit={changePin}>
        <h2>🔒 Change PIN</h2>
        {pinField('current', 'Current PIN')}
        {pinField('next', 'New PIN (4 digits)')}
        {pinField('again', 'New PIN again')}
        <div class="row end">
          <button class="btn primary" type="submit">
            Change PIN
          </button>
        </div>
      </form>

      <div class="card">
        <h2>💽 Storage</h2>
        <p class="muted">
          {persisted === null
            ? 'Checking storage…'
            : persisted
              ? 'Persistent storage is on: the browser will not clear this data automatically.'
              : 'Persistent storage was not granted. Add the app to the Home Screen and export backups regularly.'}
        </p>
      </div>
    </section>
  );
}
