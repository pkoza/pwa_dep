const CACHE_NAME = 'rsd-v' + "0.20230721111900",
    apiUrl = "" + '/admin/api/',
    resourcesToCache = ["/bundle.js","/bundle.css","/index.html","/logo.svg"],
    cacheWhitelist = [CACHE_NAME],
    swc = self,
    emptyResponse = (
        body = 'Network error happened',
        status = 408,
        headers = { 'Content-Type': 'text/plain' }
    ) => new Response(body, { status, headers }),
    handlers = {
        install(event) {
            console.info('installing service worker', event)
            console.dir(resourcesToCache)
            // do not wait for activation of new service worker, activate it now
            // https://stackoverflow.com/questions/48859119/why-my-service-worker-is-always-waiting-to-activate
            swc.skipWaiting()
            event.waitUntil(
                caches.open(CACHE_NAME).then(cache =>
                    cache
                        .addAll(
                            resourcesToCache
                                .map(urlToPrefetch => new Request(urlToPrefetch, { mode: 'no-cors', }))
                        )
                        .then(() =>
                            console.log(
                                'All resources have been fetched and cached:',
                                CACHE_NAME
                            )
                        )
                )
            )
        },
        activate(event) {
            swc.clients.claim()
            console.info('service worker activated', event)
            // remove all caches that are not in whitelist
            event.waitUntil(
                caches.keys().then(function (keys) {
                    return Promise.all(
                        keys.map(function (cacheName) {
                            if (cacheWhitelist.indexOf(cacheName) === -1) {
                                console.log('deleting cache:', cacheName)
                                return caches.delete(cacheName)
                            }
                        })
                    )
                })
            )
        },
        fetch(event) {
            const traceFetch = msg => console.log(
                `${event.request.method}(${event.request.mode})${event.request.url} - ${msg}`
            ), shouldCache = event.request.method === 'GET' &&
                event.request.url.indexOf('/worker.js') === -1 &&
                event.request.url.indexOf('/admin/') === -1 &&
                event.request.url.indexOf('/api/') === -1
            if (shouldCache) {
                traceFetch('check cached version')
                event.respondWith(
                    caches.match(event.request).then(response => response || fetch(event.request).then(response => {
                        traceFetch('fetched response ')
                        // Check if we received a valid response
                        if (response && response.status === 200) {
                            // IMPORTANT: Clone the response.
                            const responseToCache = response.clone();
                            console.log('response to cache:', response.url);
                            caches.open(CACHE_NAME).then(cache => {
                                traceFetch('caching response ')
                                cache.put(event.request, responseToCache)
                            })
                        }
                        return response;
                    })))
            }
            return fetch(event.request)
        },

        push(event) {
            console.log('Received a push message', event)
            var title = 'Yay a message.',
                body = 'We have received a push message.',
                tag = 'simple-push-demo-notification-tag'
            event.waitUntil(
                swc.registration.showNotification(title, {
                    body: body,
                    tag: tag,
                })
            )
        },
        notificationclick(event) {
            console.log('On notification click: ', event.notification.tag)
            // Android doesn’t close the notification when you click on it
            // See: http://crbug.com/463146
            event.notification.close()
            // This looks to see if the current is already open and
            // focuses if it is
            event.waitUntil(
                swc.clients
                    .matchAll({
                        type: 'window',
                    })
                    .then(function (clientList) {
                        var found = clientList.find(function (client) {
                            return client.url == '/' && 'focus' in client
                        })
                        return found
                            ? found.focus()
                            : swc.clients.openWindow &&
                            swc.clients.openWindow('/')
                    })
            )
        },
        message(event) {
            if (event.data) {
                switch (event.data.type) {
                    case 'CLEAR_CACHE':
                        console.info('About to clear cache:', event)
                        // remove all caches that are not in whitelist
                        event.waitUntil(
                            caches.keys().then(function (keys) {
                                return Promise.all(
                                    keys.map(function (cacheName) {
                                        return (
                                            console.log(
                                                'deleting cache:',
                                                cacheName
                                            ),
                                            caches.delete(cacheName)
                                        )
                                    })
                                )
                            })
                        )
                        break
                    case 'DELETE_ENTRY':
                        event.waitUntil(
                            caches.open(CACHE_NAME).then(cache => {
                                var regexp = new RegExp(event.data.test)
                                return cache
                                    .keys()
                                    .then(function (cachedRequests) {
                                        return Promise.all(
                                            // request.url is a full URL, not just a path, so use an appropriate RegExp!
                                            cachedRequests
                                                .filter(function (request) {
                                                    return request.url.match(
                                                        regexp
                                                    )
                                                })
                                                .map(function (request) {
                                                    return (
                                                        console.log(
                                                            'deleting cache entry:',
                                                            request.url
                                                        ),
                                                        cache.delete(request)
                                                    )
                                                })
                                        )
                                    })
                            })
                        )
                        break
                    default:
                        console.info('Unknown event received:', event.data.type)
                }
            }
        },
    }
Object.keys(handlers).forEach(key => swc.addEventListener(key, handlers[key]))
