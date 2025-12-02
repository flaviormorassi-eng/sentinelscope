type Listener = () => void;
let listeners: Listener[] = [];

export function subscribe(listener: Listener) {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

export function trigger() {
  for (const l of listeners) l();
}
