import { useEffect, useState } from 'preact/hooks';
import { listProfiles } from '../../db/repo';
import type { Profile } from '../../domain/types';
import { KidsTab } from './KidsTab';
import { SetsTab } from './SetsTab';
import { ProgressTab } from './ProgressTab';
import { DataTab } from './DataTab';
import { SettingsTab } from './SettingsTab';
import { Segmented } from '../widgets';

type Tab = 'kids' | 'sets' | 'progress' | 'data' | 'settings';
const TABS: { value: Tab; label: string }[] = [
  { value: 'kids', label: '👧 Kids' },
  { value: 'sets', label: '📝 Practice' },
  { value: 'progress', label: '📊 Progress' },
  { value: 'data', label: '📦 Data' },
  { value: 'settings', label: '⚙️ Settings' },
];

export function ParentHome({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<Tab>('kids');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const refreshProfiles = async () => {
    const ps = await listProfiles();
    setProfiles(ps);
    setProfileId((cur) => (cur && ps.some((p) => p.id === cur) ? cur : (ps[0]?.id ?? null)));
  };
  useEffect(() => {
    void refreshProfiles();
  }, []);

  const needsKid = tab === 'sets' || tab === 'progress';
  const profile = profiles.find((p) => p.id === profileId) ?? null;

  return (
    <div class="screen parent">
      <header class="row between wrap">
        <h1>Parent mode</h1>
        <button class="btn ghost" onClick={onExit}>
          Exit 🔓
        </button>
      </header>
      <nav class="tabs" aria-label="Parent sections">
        {TABS.map((t) => (
          <button key={t.value} class={`tab ${tab === t.value ? 'on' : ''}`} aria-current={tab === t.value} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </nav>

      {needsKid && profiles.length > 0 && (
        <Segmented
          label="Choose a kid"
          value={profileId ?? ''}
          onChange={setProfileId}
          options={profiles.map((p) => ({ value: p.id, label: `${p.avatar} ${p.name}` }))}
        />
      )}
      {needsKid && profiles.length === 0 && (
        <div class="card">
          <p>Add a kid first.</p>
          <button class="btn primary" onClick={() => setTab('kids')}>
            Add a kid
          </button>
        </div>
      )}

      {tab === 'kids' && <KidsTab profiles={profiles} onChange={refreshProfiles} />}
      {tab === 'sets' && profile && <SetsTab key={profile.id} profile={profile} />}
      {tab === 'progress' && profile && <ProgressTab key={profile.id} profile={profile} />}
      {tab === 'data' && <DataTab onChange={refreshProfiles} />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}
