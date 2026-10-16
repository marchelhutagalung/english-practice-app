import { useEffect, useState } from 'preact/hooks';
import { listProfiles } from '../db/repo';
import type { Profile } from '../domain/types';
import { useContent } from './content';
import { DialogHost } from './dialog';
import { ProfilePicker } from './kid/ProfilePicker';
import { KidHome } from './kid/KidHome';
import { Quiz, type SessionResult, type SessionSpec } from './kid/Quiz';
import { Results } from './kid/Results';
import { PinGate } from './parent/PinGate';
import { ParentHome } from './parent/ParentHome';

type Route =
  | { name: 'profiles' }
  | { name: 'kid'; profile: Profile }
  | { name: 'quiz'; spec: SessionSpec; run: number }
  | { name: 'results'; result: SessionResult }
  | { name: 'pin' }
  | { name: 'parent' };

export function App() {
  const content = useContent();
  const [route, setRoute] = useState<Route>({ name: 'profiles' });
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (route.name === 'profiles') void listProfiles().then(setProfiles);
    window.scrollTo(0, 0);
  }, [route.name]);

  if (!content.loaded) {
    return (
      <div class="screen center">
        <p class="big-emoji" aria-hidden="true">
          🦉
        </p>
        <p>Loading…</p>
      </div>
    );
  }

  let screen;
  switch (route.name) {
    case 'profiles':
      screen = <ProfilePicker profiles={profiles} onPick={(profile) => setRoute({ name: 'kid', profile })} onParent={() => setRoute({ name: 'pin' })} />;
      break;
    case 'kid':
      screen = (
        <KidHome
          profile={route.profile}
          onBack={() => setRoute({ name: 'profiles' })}
          onStart={(spec) => setRoute({ name: 'quiz', spec, run: Date.now() })}
        />
      );
      break;
    case 'quiz':
      screen = (
        <Quiz
          key={route.run}
          spec={route.spec}
          onDone={(result) => setRoute({ name: 'results', result })}
          onQuit={() => setRoute({ name: 'kid', profile: route.spec.profile })}
        />
      );
      break;
    case 'results': {
      const { result } = route;
      screen = (
        <Results
          result={result}
          onHome={() => setRoute({ name: 'kid', profile: result.spec.profile })}
          onRetry={() =>
            setRoute({
              name: 'quiz',
              run: Date.now(),
              spec: { profile: result.spec.profile, mode: 'retry', title: `Mistakes: ${result.spec.title.replace(/^Mistakes: /, '')}`, questionIds: result.wrongIds },
            })
          }
        />
      );
      break;
    }
    case 'pin':
      screen = <PinGate onUnlock={() => setRoute({ name: 'parent' })} onCancel={() => setRoute({ name: 'profiles' })} />;
      break;
    case 'parent':
      screen = <ParentHome onExit={() => setRoute({ name: 'profiles' })} />;
      break;
  }

  return (
    <>
      {screen}
      <DialogHost />
    </>
  );
}
