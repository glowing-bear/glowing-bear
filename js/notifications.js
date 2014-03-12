var weechat = angular.module('weechat');

weechat.factory('notifications', ['$rootScope', '$log', 'models', 'settings', function($rootScope, $log, models, settings) {
    var serviceworker = false;
    var notifications = [];
    // Ask for permission to display desktop notifications
    var requestNotificationPermission = function() {
        // Firefox
        if (window.Notification) {
            Notification.requestPermission(function(status) {
                $log.info('Notification permission status: ', status);
                if (Notification.permission !== status) {
                    Notification.permission = status;
                }
            });
        }

        // Webkit
        if (window.webkitNotifications !== undefined) {
            var havePermission = window.webkitNotifications.checkPermission();
            if (havePermission !== 0) { // 0 is PERMISSION_ALLOWED
                $log.info('Notification permission status: ', havePermission === 0);
                window.webkitNotifications.requestPermission();
            }
        }

        if ('serviceWorker' in navigator) {
            $log.info('Service Worker is supported');
            navigator.serviceWorker.register('serviceworker.js').then(function(reg) {
                $log.info('Service Worker install:', reg);
                serviceworker = true;
            }).catch(function(err) {
                $log.info('Service Worker err:', err);
            });
        }

        document.addEventListener('deviceready', function() {
            // Add cordova local notification click handler
            if (cordova !== null && cordova.plugins !== undefined && cordova.plugins.notification !== undefined &&
                cordova.plugins.notification.local !== undefined) {
                cordova.plugins.notification.local.on("click", function (notification) {
                    // go to buffer
                    var data = JSON.parse(notification.data);
                    models.setActiveBuffer(data.buffer);
                    window.focus();
                    // clear this notification
                    cordova.plugins.notification.local.clear(notification.id);
                });
            }
        });
    };

    var showNotification = function(buffer, title, body) {
        if (serviceworker) {
            navigator.serviceWorker.ready.then(function(registration) {
                registration.showNotification(title, {
                    body: body,
                    icon: 'assets/img/glowing_bear_128x128.png',
                    vibrate: [200, 100],
                    tag: 'gb-highlight-vib'
                });
            });
        } else if (typeof Windows !== 'undefined' && typeof Windows.UI !== 'undefined' && typeof Windows.UI.Notifications !== 'undefined') {

            var winNotifications = Windows.UI.Notifications;
            var toastNotifier = winNotifications.ToastNotificationManager.createToastNotifier();
            var template = winNotifications.ToastTemplateType.toastText02;
            var toastXml = winNotifications.ToastNotificationManager.getTemplateContent(template);
            var toastTextElements = toastXml.getElementsByTagName("text");

            toastTextElements[0].appendChild(toastXml.createTextNode(title));
            toastTextElements[1].appendChild(toastXml.createTextNode(body));

            var toast = new winNotifications.ToastNotification(toastXml);

            toast.onactivated = function() {
                models.setActiveBuffer(buffer.id);
                window.focus();
            };

            toastNotifier.show(toast);

        } else if (typeof Notification !== 'undefined') {
            var notification = new Notification(title, {
                body: body,
                icon: 'assets/img/favicon.png'
            });

            // Save notification, so we can close all outstanding ones when disconnecting
            notification.id = notifications.length;
            notifications.push(notification);

            // Cancel notification automatically
            var timeout = 15*1000;
            notification.onshow = function() {
                setTimeout(function() {
                    notification.close();
                }, timeout);
            };

            // Click takes the user to the buffer
            notification.onclick = function() {
                models.setActiveBuffer(buffer.id);
                window.focus();
                notification.close();
            };

            // Remove from list of active notifications
            notification.onclose = function() {
                delete notifications[this.id];
            };
        } else if (cordova !== undefined && cordova.plugins !== undefined && cordova.plugins.notification !== undefined && cordova.plugins.notification.local !== undefined) {
            // Cordova local notification
            // Calculate notification id from buffer ID
            // Needs to be unique number, but we'll only ever have one per buffer
            var id = parseInt(buffer.id, 16);

            // Cancel previous notification for buffer (if there was one)
            cordova.plugins.notification.local.clear(id);

            // Send new notification
            cordova.plugins.notification.local.schedule({
                id: id,
                text: body,
                title: title,
                data: { buffer: buffer.id }  // remember buffer id for when the notification is clicked
            });

        }

    };


    // Reduce buffers with "+" operation over a key. Mostly useful for unread/notification counts.
    var unreadCount = function(type) {
        if (!type) {
            type = "unread";
        }

        // Do this the old-fashioned way with iterating over the keys, as underscore proved to be error-prone
        var keys = Object.keys(models.model.buffers);
        var count = 0;
        for (var key in keys) {
            count += models.model.buffers[keys[key]][type];
        }

        return count;
    };


    var updateTitle = function() {
        var notifications = unreadCount('notification');
        if (notifications > 0) {
            // New notifications deserve an exclamation mark
            $rootScope.notificationStatus = '(' + notifications + ') ';
        } else {
            $rootScope.notificationStatus = '';
        }

        var activeBuffer = models.getActiveBuffer();
        if (activeBuffer) {
            $rootScope.pageTitle = activeBuffer.shortName + ' | ' + activeBuffer.rtitle;
        }
    };

    /* Function gets called from bufferLineAdded code if user should be notified */
    var createHighlight = function(buffer, message) {
        var title = '';
        var body = '';
        var numNotifications = buffer.notification;

        if (buffer.type === "private") {
            if (numNotifications > 1) {
                title = numNotifications.toString() + ' private messages from ';
            } else {
                title = 'Private message from ';
            }
            body = message.text;
        } else {
            if (numNotifications > 1) {
                title = numNotifications.toString() + ' highlights in ';
            } else {
                title = 'Highlight in ';
            }
            var prefix = '';
            for (var i = 0; i < message.prefix.length; i++) {
                prefix += message.prefix[i].text;
            }
            body = '<' + prefix + '> ' + message.text;
        }
        title += buffer.shortName + " (" + buffer.server + ")";

        showNotification(buffer, title, body);
    };

    var cancelAll = function() {
        while (notifications.length > 0) {
            var notification = notifications.pop();
            if (notification !== undefined) {
                notification.close();
            }
        }
    };

    return {
        requestNotificationPermission: requestNotificationPermission,
        updateTitle: updateTitle,
        createHighlight: createHighlight,
        cancelAll: cancelAll,
        unreadCount: unreadCount
    };
}]);
