import { useState } from 'preact/hooks';
import { deleteProfile, saveProfile } from '../../db/repo';
import type { Profile } from '../../domain/types';
import { confirmDialog } from '../dialog';

const AVATARS = ['🐱', '🐶', '🦊', '🐼', '🐨', '🦁', '🐸', '🐵', '🦄', '🐙', '🐢', '🦋', '🚀', '⚽', '🌸', '🌈'];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function KidsTab({ profiles, onChange }: { profiles: Profile[]; onChange: () => Promise<void> }) {
  const [editing, setEditing] = useState<Partial<Profile> | null>(null);

  const save = async () => {
    if (!editing?.name?.trim()) return;
    await saveProfile({ ...editing, name: editing.name.trim(), grade: editing.grade ?? 3, avatar: editing.avatar ?? AVATARS[0] } as Profile);
    setEditing(null);
    await onChange();
  };

  const remove = async (p: Profile) => {
    const ok = await confirmDialog(`Delete ${p.name}?`, {
      message: 'This removes the profile, its practice sets and all of its progress. This cannot be undone.',
      okLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteProfile(p.id);
    await onChange();
  };

  if (editing) {
    return (
      <section class="card form">
        <h2>{editing.id ? 'Edit kid' : 'Add a kid'}</h2>
        <label>
          Name
          <input value={editing.name ?? ''} maxLength={30} onInput={(e) => setEditing({ ...editing, name: (e.target as HTMLInputElement).value })} />
        </label>
        <label>
          Grade
          <select value={editing.grade ?? 3} onChange={(e) => setEditing({ ...editing, grade: Number((e.target as HTMLSelectElement).value) })}>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Avatar</legend>
          <div class="avatar-grid">
            {AVATARS.map((a) => (
              <button
                type="button"
                key={a}
                class={`avatar-pick ${(editing.avatar ?? AVATARS[0]) === a ? 'on' : ''}`}
                aria-pressed={(editing.avatar ?? AVATARS[0]) === a}
                onClick={() => setEditing({ ...editing, avatar: a })}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>
        <div class="row end">
          <button class="btn ghost" onClick={() => setEditing(null)}>
            Cancel
          </button>
          <button class="btn primary" disabled={!editing.name?.trim()} onClick={save}>
            Save
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div class="list">
        {profiles.map((p) => (
          <div key={p.id} class="list-item">
            <span class="avatar small" aria-hidden="true">
              {p.avatar}
            </span>
            <div class="grow">
              <strong>{p.name}</strong>
              <div class="muted">Grade {p.grade}</div>
            </div>
            <button class="btn small" onClick={() => setEditing(p)}>
              Edit
            </button>
            <button class="btn small danger-ghost" onClick={() => remove(p)}>
              Delete
            </button>
          </div>
        ))}
      </div>
      <button class="btn primary big" onClick={() => setEditing({ grade: 3, avatar: AVATARS[profiles.length % AVATARS.length] })}>
        + Add a kid
      </button>
    </section>
  );
}
