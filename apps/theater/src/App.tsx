import { useEffect, useState } from 'react';
import { RunIndex } from './components/RunIndex';
import { Theater } from './components/Theater';

function readRoute() {
  const p = new URLSearchParams(location.search);
  return { run: p.get('run'), present: p.has('present') && p.get('present') !== '0' };
}

export function App() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const on = () => setRoute(readRoute());
    addEventListener('popstate', on);
    return () => removeEventListener('popstate', on);
  }, []);
  return route.run ? <Theater key={route.run} runId={route.run} present={route.present} /> : <RunIndex />;
}

export function navigate(search: string) {
  history.pushState(null, '', search || location.pathname);
  dispatchEvent(new PopStateEvent('popstate'));
}
