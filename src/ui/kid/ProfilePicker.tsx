import type { Profile } from '../../domain/types';

export function ProfilePicker({ profiles, onPick, onParent }: { profiles: Profile[]; onPick: (p: Profile) => void; onParent: () => void }) {
  return (
    <div class="screen">
      <header class="hero">
        <h1>👋 Who is practising today?</h1>
      </header>
      {profiles.length === 0 ? (
        <div class="card center-text">
          <p class="big-emoji" aria-hidden="true">
            🦉
          </p>
          <h2>Welcome!</h2>
          <p>Ask a grown-up to open Parent mode and add your name.</p>
        </div>
      ) : (
        <div class="profile-grid">
          {profiles.map((p) => (
            <button key={p.id} class="profile-card" onClick={() => onPick(p)}>
              <span class="avatar" aria-hidden="true">
                {p.avatar}
              </span>
              <span class="name">{p.name}</span>
              <span class="muted">Grade {p.grade}</span>
            </button>
          ))}
        </div>
      )}
      <footer class="footer">
        <button class="btn ghost" onClick={onParent}>
          🔒 Parent mode
        </button>
      </footer>
    </div>
  );
}
