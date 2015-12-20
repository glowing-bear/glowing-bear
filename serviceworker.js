// File needs to be stored in the root of the app.

this.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open('v1').then(function(cache) {
            return cache.addAll([
                'assets/img/glowing_bear_128x128.png',
            ]);
        })
    );
});

this.addEventListener('push', function(event) {
    // TODO, support GCM here
    var title = 'Push message';
    event.waitUntil(
        self.registration.showNotification(title, {
          body: 'The Message',
          icon: 'assets/img/favicon.png',
          tag: 'my-tag'
        }));
});
