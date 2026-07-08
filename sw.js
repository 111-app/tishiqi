// 提示气 - Service Worker
const CACHE_NAME = 'tishiqi-v2';
const ASSETS = [
    '/tishiqi/',
    '/tishiqi/index.html',
    '/tishiqi/style.css',
    '/tishiqi/app.js',
    '/tishiqi/manifest.json',
];

// 安装：缓存静态资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// 拦截请求：优先缓存，回退网络
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((response) => {
                // 缓存新的成功响应
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        }).catch(() => {
            return caches.match('/tishiqi/index.html');
        })
    );
});
