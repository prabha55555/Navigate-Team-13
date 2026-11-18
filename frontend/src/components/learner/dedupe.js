// Collapses identical requests that are already in flight (React StrictMode runs effects twice in
// development, and quick remounts can repeat a load). Failures are shared too, never retried here.
const inflight = new Map();

export default function dedupe(key, load) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = Promise.resolve()
    .then(load)
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
