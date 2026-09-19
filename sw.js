// Service worker: guarda os arquivos para uso offline e busca a rede primeiro,
// assim quem tem o PWA instalado recebe a versão nova assim que tiver internet.
const CACHE = 'precifica-estetica-v8';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json'];
const TIMEOUT_REDE = 4000; // se a rede demorar, usa o que está salvo

self.addEventListener('install', (event) => {
  // cache: 'reload' impede o navegador de instalar arquivos velhos do cache dele
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// os arquivos do app: precisam vir sempre da rede, senão o navegador entrega a versão velha do cache dele
function ehArquivoDoApp(req, url) {
  return req.mode === 'navigate' || /(\.html|\.js|\.css|\.webmanifest|manifest\.json)$/.test(url.pathname);
}

function buscarNaRede(req, ignorarCacheDoNavegador) {
  // cache: 'reload' pula o cache HTTP do navegador e pega o arquivo publicado agora
  const busca = ignorarCacheDoNavegador ? fetch(req, { cache: 'reload' }) : fetch(req);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_REDE);
    busca.then((res) => { clearTimeout(timer); resolve(res); }, (err) => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    buscarNaRede(req, ehArquivoDoApp(req, url))
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => {
        if (cached) return cached;
        // navegação sem rede e sem cache da rota: cai na tela inicial
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});
