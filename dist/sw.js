const CACHE = 'vocab-offline-v3';
const HOME = new URL('./', self.registration.scope).href;
const EXAM = new URL('./exam-words.json', self.registration.scope).href;
const WORDS = new URL('./words.json', self.registration.scope).href;
async function checked(url, kind) {
  const response = await fetch(url, {cache:'no-store', credentials:'same-origin'});
  if (!response.ok || response.redirected) throw new Error('Unavailable');
  const content = await response.clone().text();
  if (kind === 'words') {
    const data = JSON.parse(content);
    if (!Array.isArray(data) || data.length !== (url === EXAM ? 223 : 120) || !data.every(x => x.word && x.meaning)) throw new Error('Invalid words');
  } else if (!content.includes('단어 기억장') || !content.includes('vocab-memory-120-v1')) throw new Error('Invalid page');
  return response;
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const [home, words, exam] = await Promise.all([checked(HOME,'home'), checked(WORDS,'words'), checked(EXAM,'words')]);
  const cache = await caches.open(CACHE);
  await Promise.all([cache.put(HOME,home), cache.put(WORDS,words), cache.put(EXAM,exam)]);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('vocab-offline-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  let key,kind;
  if (request.mode === 'navigate' && new URL(request.url).pathname === new URL(HOME).pathname) { key=HOME;kind='home'; }
  else if (new URL(request.url).pathname === new URL(EXAM).pathname) { key=EXAM;kind='words'; }
  else if (new URL(request.url).pathname === new URL(WORDS).pathname) { key=WORDS;kind='words'; }
  else return;
  event.respondWith((async () => {
    try {
      const response = await checked(key,kind);
      const cache = await caches.open(CACHE); await cache.put(key,response.clone());
      return response;
    } catch {
      const cached = await caches.match(key);
      return cached || new Response('오프라인 자료를 불러오지 못했어. 인터넷에 연결해서 다시 열어 줘.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
