var weechat = angular.module('weechat');

weechat.factory('notifications', ['$rootScope', '$log', 'models', 'settings', function($rootScope, $log, models, settings) {
    // Ask for permission to display desktop notifications
    var notifications = [];
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

        // Add cordova local notification click handler
        if (window.plugin !== undefined && window.plugin.notification !== undefined && window.plugin.notification.local !== undefined) {
            window.plugin.notification.local.onclick = function (id, state, json) {
                // Parse payload
                var data = JSON.parse(json);
                var buffer = data.buffer;
                if (buffer) {
                    // Hide sidebar, open notification buffer
                    // TODO does this work?
                    $rootScope.hideSidebar();
                    models.setActiveBuffer(buffer);
                }
            };
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

        if (['#', '&', '+', '!'].indexOf(buffer.shortName.charAt(0)) < 0) {
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
        title += buffer.shortName;
        title += buffer.fullName.replace(/irc.([^\.]+)\..+/, " ($1)");

        // Chrome for Android doesn't know this
        if (typeof Notification !== 'undefined') {
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

        } else if (window.plugin !== undefined && window.plugin.notification !== undefined && window.plugin.notification.local !== undefined) {
            // Cordova local notification
            // Calculate notification id from buffer ID
            // Needs to be unique number, but we'll only ever have one per buffer
            var id = parseInt(buffer.id, 16);

            // Cancel previous notification for buffer (if there was one)
            window.plugin.notification.local.cancel(id);

            // Send new notification
            window.plugin.notification.local.add({
                id: id,
                message: body,
                title: title,
                autoCancel: true,
                json: JSON.stringify({ buffer: buffer.id })  // remember buffer id for when the notification is clicked
            });
        }
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
