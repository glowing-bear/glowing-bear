'use strict';



var weechat = angular.module('weechat');

weechat.directive('inputBar', function() {

    return {

        templateUrl: 'directives/input.html',

        scope: {
            inputId: '@inputId',
            command: '=command'
        },

        controller: ['$rootScope', '$scope', '$element', '$log', '$compile', 'connection', 'imgur', 'models', 'IrcUtils', 'settings', 'utils', function($rootScope,
                             $scope,
                             $element, //XXX do we need this? don't seem to be using it
                             $log,
                             $compile,
                             connection, //XXX we should eliminate this dependency and use signals instead
                             imgur,
                             models,
                             IrcUtils,
                             settings,
                             utils) {

            // Expose utils to be able to check if we're on a mobile UI
            $scope.utils = utils;

            // Emojify input. E.g. Turn :smile: into the unicode equivalent, but
            // don't do replacements in the middle of a word (e.g. std::io::foo)
            $scope.inputChanged = function() {
                // Cancel any command completion that was still ongoing
                commandCompletionInputChanged = true;

                var emojiRegex = /^(?:[\uD800-\uDBFF][\uDC00-\uDFFF])+$/, // *only* emoji
                    changed = false,  // whether a segment was modified
                    inputNode = $scope.getInputNode(),
                    caretPos = inputNode.selectionStart,
                    position = 0;  // current position in text

                // use capturing group in regex to include whitespace in output array
                var segments = $scope.command.split(/(\s+)/);
                for (var i = 0; i < segments.length; i ++) {
                    if (/\s+/.test(segments[i]) || emojiRegex.test(segments[i])) {
                        // ignore whitespace and emoji-only segments
                        position += segments[i].length;
                        continue;
                    }
                    // emojify segment
                    var emojified = emojione.shortnameToUnicode(segments[i]);
                    if (emojiRegex.test(emojified)) {
                        // If result consists *only* of emoji, adjust caret
                        // position and replace segment with emojified version
                        caretPos = caretPos - segments[i].length + emojified.length;
                        segments[i] = emojified;
                        changed = true;
                    }
                    position += segments[i].length;
                }
                if (changed) {  // Only re-assemble if something changed
                    $scope.command = segments.join('');
                    setTimeout(function() {
                        inputNode.setSelectionRange(caretPos, caretPos);
                    });
                }
            };

            /*
             * Returns the input element
             */
            $scope.getInputNode = function() {
                return document.querySelector('textarea#' + $scope.inputId);
            };

            $scope.hideSidebar = function() {
                $rootScope.hideSidebar();
            };

            $scope.completeNick = function() {
                if ((models.version[0] == 2 && models.version[1] >= 9 || models.version[0] > 2) &&
                    $scope.command.startsWith('/') ) {
                    // We are completing a command, another function will do
                    // this on WeeChat 2.9 and later
                    return;
                }

                // input DOM node
                var inputNode = $scope.getInputNode();

                // get current caret position
                var caretPos = inputNode.selectionStart;

                // get current active buffer
                var activeBuffer = models.getActiveBuffer();

                // Empty input makes $scope.command undefined -- use empty string instead
                var input = $scope.command || '';

                // complete nick
                var completion_suffix = models.wconfig['weechat.completion.nick_completer'];
                var add_space = models.wconfig['weechat.completion.nick_add_space'];
                var nickComp = IrcUtils.completeNick(input, caretPos, $scope.iterCandidate,
                                                     activeBuffer.getNicklistByTime().reverse(),
                                                     completion_suffix, add_space);

                // remember iteration candidate
                $scope.iterCandidate = nickComp.iterCandidate;

                // update current input
                $scope.command = nickComp.text;

                // update current caret position
                setTimeout(function() {
                    inputNode.focus();
                    inputNode.setSelectionRange(nickComp.caretPos, nickComp.caretPos);
                }, 0);
            };

            var previousInput;
            var commandCompletionList;
            var commandCompletionAddSpace;
            var commandCompletionBaseWord;
            var commandCompletionPosition;
            var commandCompletionPositionInList;
            var commandCompletionInputChanged;
            $scope.completeCommand = function(direction) {
                if (models.version[0] < 2 || (models.version[0] == 2 && models.version[1] < 9)) {
                    // Command completion is only supported on WeeChat 2.9+
                    return;
                }

                if ( !$scope.command.startsWith('/') ) {
                    // We are not completing a command, maybe a nick?
                    return;
                }

                // Cancel if input changes
                commandCompletionInputChanged = false;

                // input DOM node
                var inputNode = $scope.getInputNode();

                // get current caret position
                var caretPos = inputNode.selectionStart;

                // get current active buffer
                var activeBuffer = models.getActiveBuffer();

                // Empty input makes $scope.command undefined -- use empty string instead
                var input = $scope.command || '';

                // This function is for later cycling the list after we got it
                var cycleCompletionList = function (direction) {
                    // Don't do anything, the input has changed before we were able to complete the command
                    if ( commandCompletionInputChanged ) {
                        return;
                    }

                    // Check if the list has elements and we have not cycled to the end yet
                    if ( !commandCompletionList || !commandCompletionList[0] ) {
                        return;
                    }

                    // If we are cycling in the other direction, go back two placed in the list
                    if ( direction === 'backward' ) {
                        commandCompletionPositionInList -= 2;

                        if ( commandCompletionPositionInList < 0 ) {
                            // We have reached the beginning of list and are going backward, so go to the end;
                            commandCompletionPositionInList = commandCompletionList.length - 1;
                        }
                    }

                    // Check we have not reached the end of the cycle list
                    if ( commandCompletionList.length <= commandCompletionPositionInList ) {
                        // We have reached the end of the list, start at the beginning
                        commandCompletionPositionInList = 0;
                    }

                    // Cycle the list
                    // First remove the word that's to be completed
                    var commandBeforeReplace = $scope.command.substring(0, commandCompletionPosition - commandCompletionBaseWord.length);
                    var commandAfterReplace = $scope.command.substring(commandCompletionPosition, $scope.command.length);
                    var replacedWord = commandCompletionList[commandCompletionPositionInList];
                    var suffix = commandCompletionAddSpace ? ' ' : '';

                    // Fill in the new command
                    $scope.command = commandBeforeReplace + replacedWord + suffix + commandAfterReplace;

                    // Set the cursor position
                    var newCursorPos = commandBeforeReplace.length + replacedWord.length + suffix.length;
                    setTimeout(function() {
                        inputNode.focus();
                        inputNode.setSelectionRange(newCursorPos, newCursorPos);
                    }, 0);

                    // If there is only one item in the list, we are done, no next cycle
                    if ( commandCompletionList.length === 1) {
                        previousInput = '';
                        return;
                    }
                    // Setup for the next cycle
                    commandCompletionPositionInList++;
                    commandCompletionBaseWord = replacedWord + suffix;
                    previousInput = $scope.command + activeBuffer.id;
                    commandCompletionPosition = newCursorPos;
                };

                // Check if we have requested this completion info before
                if (input + activeBuffer.id !== previousInput) {
                    // Remeber we requested this input for next time
                    previousInput = input + activeBuffer.id;

                    // Ask weechat for the completion list
                    connection.requestCompletion(activeBuffer.id, caretPos, input).then( function(completionObject) {
                        // Save the list of completion object, we will only request is once
                        // and cycle through it as long as the input doesn't change
                        commandCompletionList = completionObject.list;
                        commandCompletionAddSpace = completionObject.add_space;
                        commandCompletionBaseWord = completionObject.base_word;
                        commandCompletionPosition = caretPos;
                        commandCompletionPositionInList = 0;
                    }).then( function () {
                        //after we get the list we can continue with our first cycle
                        cycleCompletionList(direction);
                    });


                } else {
                    // Input hasn't changed so we should already have our completion list
                    cycleCompletionList(direction);
                }
            };



            $rootScope.insertAtCaret = function(toInsert) {
                // caret position in the input bar
                var inputNode = $scope.getInputNode(),
                    caretPos = inputNode.selectionStart;

                var prefix = $scope.command.substring(0, caretPos),
                    suffix = $scope.command.substring(caretPos, $scope.command.length);
                // Add spaces if missing
                if (prefix.length > 0 && prefix[prefix.length - 1] !== ' ') {
                    prefix += ' ';
                }
                if (suffix.length > 0 && suffix[0] !== ' ') {
                    suffix = ' '.concat(suffix);
                }
                $scope.command = prefix + toInsert + suffix;

                setTimeout(function() {
                    inputNode.focus();
                    var pos = $scope.command.length - suffix.length;
                    inputNode.setSelectionRange(pos, pos);
                    // force refresh?
                    $scope.$apply();
                }, 0);
            };

            $scope.uploadImage = function($event, files) {
                // Send image url after upload
                var sendImageUrl = function(imageUrl, deleteHash) {
                    // Put link in input box
                    if(imageUrl !== undefined && imageUrl !== '') {
                        $rootScope.insertAtCaret(String(imageUrl));
                    }
                };

                if(typeof files !== "undefined" && files.length > 0) {
                    // Loop through files
                    for (var i = 0; i < files.length; i++) {
                        // Process image
                        imgur.process(files[i], sendImageUrl);
                    }
                }
            };

            var deleteCallback = function (deleteHash) {
                // Image got sucessfully deleted.
                // Show toast with delete link
                var toastDeleted = $compile('<div class="toast toast-short">Successfully deleted.</div>')($scope)[0];
                document.body.appendChild(toastDeleted);
                setTimeout(function() { document.body.removeChild(toastDeleted); }, 5000);

                // Try to remove the toast with the deletion link (it stays 15s
                // instead of the 5 of the deletion notification, so it could
                // come back beneath it, which would be confusing)
                var pasteToast = document.querySelector("[data-imgur-deletehash='" + deleteHash + "']");
                if (!!pasteToast) {
                    document.body.removeChild(pasteToast);
                }
            };

            $scope.imgurDelete = function (deleteHash) {
                imgur.deleteImage( deleteHash, deleteCallback );
            };

            // Send the message to the websocket
            $scope.sendMessage = function() {
                //XXX Use a signal here
                var ab = models.getActiveBuffer();

                // It's undefined early in the lifecycle of the program.
                // Don't send empty commands
                if($scope.command !== undefined && $scope.command !== '') {

                    // log to buffer history
                    ab.addToHistory($scope.command);

                    // Split the command into multiple commands based on line breaks
                    $scope.command.split(/\r?\n/).forEach(function(line) {
                        // Ask before a /quit
                        if (line === '/quit' || line.indexOf('/quit ') === 0) {
                            if (!window.confirm("Are you sure you want to quit WeeChat? This will prevent you from connecting with Glowing Bear until you restart WeeChat on the command line!")) {
                                // skip this line
                                return;
                            }
                        }
                        connection.sendMessage(line);
                    });

                    // Check for /clear command
                    if ($scope.command === '/buffer clear' || $scope.command === '/c') {
                        $log.debug('Clearing lines');
                        ab.clear();
                    }

                    // Check against a list of commands that opens a new
                    // buffer and save the name of the buffer so we can
                    // also automatically switch to the new buffer in gb
                    var opencommands = ['/query', '/join', '/j', '/q'];
                    var spacepos = $scope.command.indexOf(' ');
                    var firstword = $scope.command.substr(0, spacepos);
                    var index = opencommands.indexOf(firstword);
                    if (index >= 0) {
                        var queryName = $scope.command.substring(spacepos + 1);
                        // Cache our queries so when a buffer gets opened we can open in UI
                        models.outgoingQueries.push(queryName);
                    }

                    // Empty the input after it's sent
                    $scope.command = '';
                }

                // New style clearing requires this, old does not
                if (settings.hotlistsync && models.version[0] >= 1) {
                    connection.sendHotlistClear();
                }

                $scope.getInputNode().focus();
            };

            //XXX THIS DOES NOT BELONG HERE!
            $rootScope.addMention = function(bufferline) {
                if (!bufferline.showHiddenBrackets) {
                    // the line is a notice or action or something else that doesn't belong
                    return;
                }
                var prefix = bufferline.prefix;
                // Extract nick from bufferline prefix
                var nick = prefix[prefix.length - 1].text;

                // Check whether the user is still online
                var buffer = models.getBuffer(bufferline.buffer);
                var is_online = buffer.queryNicklist(nick);
                if (buffer.type === 'channel' && !is_online) {
                    // show a toast that the user left
                    var toast = document.createElement('div');
                    toast.className = "toast toast-short";
                    toast.innerHTML = nick + " has left the room";
                    document.body.appendChild(toast);
                    setTimeout(function() { document.body.removeChild(toast); }, 5000);
                }

                var newValue = $scope.command || '';  // can be undefined, in that case, use the empty string
                var addColon = newValue.length === 0;
                if (newValue.length > 0) {
                    // Try to determine if it's a sequence of nicks
                    var trimmedValue = newValue.trim();
                    if (trimmedValue.charAt(trimmedValue.length - 1) === ':') {
                        // get last word
                        var lastSpace = trimmedValue.lastIndexOf(' ') + 1;
                        var lastWord = trimmedValue.slice(lastSpace, trimmedValue.length - 1);
                        var nicklist = models.getActiveBuffer().getNicklistByTime();
                        // check against nicklist to see if it's a list of highlights
                        for (var index in nicklist) {
                            if (nicklist[index].name === lastWord) {
                                // It's another highlight!
                                newValue = newValue.slice(0, newValue.lastIndexOf(':')) + ' ';
                                addColon = true;
                                break;
                            }
                        }
                    }

                    // Add a space before the nick if there isn't one already
                    // Last char might have changed above, so re-check
                    if (newValue.charAt(newValue.length - 1) !== ' ') {
                        newValue += ' ';
                    }
                }
                // Add highlight to nicklist
                newValue += nick;
                if (addColon) {
                    newValue += ': ';
                }
                $scope.command = newValue;
                $scope.getInputNode().focus();
            };


            // Handle key presses in the input bar
            $rootScope.handleKeyPress = function($event) {
                // don't do anything if not connected
                if (!$rootScope.connected) {
                    return true;
                }

                var inputNode = $scope.getInputNode();

                // Support different browser quirks
                var code = $event.keyCode ? $event.keyCode : $event.charCode;

                // A KeyboardEvent property representing the physical key that was pressed, ignoring the keyboard layout and ignoring whether any modifier keys were active.
                // Not supported in Edge or Safari at the time of writing this, but supported in Firefox and Chrome.
                var key = $event.code;

                // Safari doesn't implement DOM 3 input events yet as of 8.0.6
                var altg = $event.getModifierState ? $event.getModifierState('AltGraph') : false;
                // Mac OSX behaves differntly for altgr, so we check for that
                if (altg) {
                    // We don't handle any anything with altgr
                    return false;
                }

                // reset quick keys display
                $rootScope.showQuickKeys = false;

                // any other key than Tab resets nick completion iteration
                var tmpIterCandidate = $scope.iterCandidate;
                $scope.iterCandidate = null;

                var bufferNumber;
                var sortedBuffers;
                var filteredBufferNum;
                var activeBufferId;

                // if Alt+J was pressed last...
                if ($rootScope.showJumpKeys) {
                    var cleanup = function() { // cleanup helper
                        $rootScope.showJumpKeys = false;
                        $rootScope.jumpDecimal = undefined;
                        $scope.$parent.search = '';
                        $scope.$parent.search_placeholder = 'Search';
                        $rootScope.refresh_filter_predicate();
                    };

                    // ... we expect two digits now
                    if (!$event.altKey && (code > 47 && code < 58)) {
                        // first digit
                        if ($rootScope.jumpDecimal === undefined) {
                            $rootScope.jumpDecimal = code - 48;
                            $event.preventDefault();
                            $scope.$parent.search = $rootScope.jumpDecimal;
                            $rootScope.refresh_filter_predicate();
                        // second digit, jump to correct buffer
                        } else {
                            bufferNumber = ($rootScope.jumpDecimal * 10) + (code - 48);
                            $scope.$parent.setActiveBuffer(bufferNumber, '$jumpKey');

                            $event.preventDefault();
                            cleanup();
                        }
                    } else {
                        // Not a decimal digit, abort
                        cleanup();
                    }
                }

                // Left Alt+[0-9] -> jump to buffer
                if ($event.altKey && !$event.ctrlKey && (code > 47 && code < 58) && settings.enableQuickKeys) {
                    if (code === 48) {
                        code = 58;
                    }
                    bufferNumber = code - 48 - 1 ;

                    // quick select filtered entries
                    if (($scope.$parent.search.length || settings.onlyUnread) && $scope.$parent.filteredBuffers.length) {
                        filteredBufferNum = $scope.$parent.filteredBuffers[bufferNumber];
                        if (filteredBufferNum !== undefined) {
                            activeBufferId = [filteredBufferNum.number, filteredBufferNum.id];
                        }
                    } else {
                        // Map the buffers to only their numbers and IDs so we don't have to
                        // copy the entire (possibly very large) buffer object, and then sort
                        // the buffers according to their WeeChat number
                        sortedBuffers = Object.entries(models.getBuffers()).map(function([key, buffer], index) {
                            return [buffer.number, buffer.id];
                        }).sort(function(left, right) {
                            // By default, Array.prototype.sort() sorts alphabetically.
                            // Pass an ordering function to sort by first element.
                            return left[0] - right[0];
                        });
                        activeBufferId = sortedBuffers[bufferNumber];
                    }
                    if (activeBufferId) {
                        $scope.$parent.setActiveBuffer(activeBufferId[1]);
                        $event.preventDefault();
                    }
                }

                // Tab -> nick completion
                if (code === 9 && !$event.altKey && !$event.ctrlKey && !$event.shiftKey) {
                    $event.preventDefault();
                    $scope.iterCandidate = tmpIterCandidate;
                    $scope.completeNick();
                    $scope.completeCommand('forward');
                    return true;
                }

                // Shitft-Tab -> nick completion backward (only commands)
                if (code === 9 && !$event.altKey && !$event.ctrlKey && $event.shiftKey) {
                    $event.preventDefault();
                    $scope.completeCommand('backward');
                    return true;
                }

                // Left Alt+n -> toggle nicklist
                if ($event.altKey && !$event.ctrlKey && code === 78) {
                    $event.preventDefault();
                    $rootScope.toggleNicklist();
                    return true;
                }

                // Alt+A -> switch to buffer with activity
                if ($event.altKey && (code === 97 || code === 65)) {
                    $event.preventDefault();
                    $rootScope.switchToActivityBuffer();
                    return true;
                }

                // Alt+Arrow up/down -> switch to prev/next adjacent buffer
                if ($event.altKey && !$event.ctrlKey && (code === 38 || code === 40)) {
                    $event.preventDefault();
                    var direction = code - 39;
                    $rootScope.switchToAdjacentBuffer(direction);
                    return true;
                }

                // Alt+L -> focus on input bar
                if ($event.altKey && (code === 76 || code === 108)) {
                    $event.preventDefault();
                    inputNode.focus();
                    inputNode.setSelectionRange($scope.command.length, $scope.command.length);
                    return true;
                }

                // Alt+< -> switch to previous buffer
                // https://w3c.github.io/uievents-code/#code-IntlBackslash
                // Support both backquote and intlbackslash for this action, since macos is weird
                // https://github.com/microsoft/vscode/issues/65082
                if ($event.altKey && (code === 60 || code === 226 || key === "IntlBackslash" || key === "Backquote"))  {
                    var previousBuffer = models.getPreviousBuffer();
                    if (previousBuffer) {
                        models.setActiveBuffer(previousBuffer.id);
                        $event.preventDefault();
                        return true;
                    }
                }

                // Double-tap Escape -> disconnect
                if (code === 27) {
                    $event.preventDefault();

                    // Check if a modal is visible. If so, close it instead of disconnecting
                    var modals = document.querySelectorAll('.gb-modal');
                    for (var modalId = 0; modalId < modals.length; modalId++) {
                        if (modals[modalId].getAttribute('data-state') === 'visible') {
                            modals[modalId].setAttribute('data-state', 'hidden');
                            return true;
                        }
                    }

                    if (typeof $scope.lastEscape !== "undefined" && (Date.now() - $scope.lastEscape) <= 500) {
                        // Double-tap
                        connection.disconnect();
                    }
                    $scope.lastEscape = Date.now();
                    return true;
                }

                // Alt+G -> focus on buffer filter input
                if ($event.altKey && (code === 103 || code === 71)) {
                    $event.preventDefault();
                    if (!$scope.$parent.isSidebarVisible()) {
                        $scope.$parent.showSidebar();
                    }
                    setTimeout(function() {
                        document.getElementById('bufferFilter').focus();
                    });
                    return true;
                }

                // Alt-h -> Toggle all as read
                if ($event.altKey && !$event.ctrlKey && code === 72) {
                    var buffers = models.getBuffers();
                    Object.entries(buffers).forEach(function([key, buffer], index) {
                        buffer.unread = 0;
                        buffer.notification = 0;
                    });
                    var servers = models.getServers();
                    Object.entries(servers).forEach(function([key, server], index) {
                        server.unread = 0;
                    });
                    connection.sendHotlistClearAll();
                }

                // Alt+J -> Jump to buffer
                if ($event.altKey && (code === 106 || code === 74)) {
                    $event.preventDefault();
                    // reset search state and show jump keys
                    $scope.$parent.search = '';
                    $scope.$parent.search_placeholder = 'Number';
                    $rootScope.showJumpKeys = true;
                    return true;
                }

                var caretPos;

                // Arrow up -> go up in history
                if ($event.type === "keydown" && code === 38 && document.activeElement === inputNode) {
                    // In case of multiline we don't want to do this unless at the first line
                    if ($scope.command) {
                        caretPos = inputNode.selectionStart;
                        if ($scope.command.slice(0, caretPos).indexOf("\n") !== -1) {
                            return false;
                        }
                    }
                    $scope.command = models.getActiveBuffer().getHistoryUp($scope.command);
                    // Set cursor to last position. Need 1ms (0ms works for chrome) timeout because
                    // browser sets cursor position to the beginning after this key handler returns.
                    setTimeout(function() {
                        if ($scope.command) {
                            inputNode.setSelectionRange($scope.command.length, $scope.command.length);
                        }
                    }, 1);
                    return true;
                }

                // Arrow down -> go down in history
                if ($event.type === "keydown" && code === 40 && document.activeElement === inputNode) {
                    // In case of multiline we don't want to do this unless it's the last line
                    if ($scope.command) {
                        caretPos = inputNode.selectionStart;
                        if ( $scope.command.slice(caretPos).indexOf("\n") !== -1) {
                            return false;
                        }
                    }
                    $scope.command = models.getActiveBuffer().getHistoryDown($scope.command);
                    // We don't need to set the cursor to the rightmost position here, the browser does that for us
                    return true;
                }

                // Enter to submit, shift-enter for newline
                if (code == 13 && !$event.shiftKey && document.activeElement === inputNode) {
                    $event.preventDefault();
                    $scope.sendMessage();
                    return true;
                }

                var bufferlines = document.getElementById("bufferlines");
                var lines;
                var i;

                // Page up -> scroll up
                if ($event.type === "keydown" && code === 33 && document.activeElement === inputNode && !$event.ctrlKey && !$event.altKey && !$event.shiftKey) {
                    if (bufferlines.scrollTop === 0) {
                        if (!$rootScope.loadingLines) {
                            $scope.$parent.fetchMoreLines();
                        }
                        return true;
                    }
                    lines = bufferlines.querySelectorAll("tr");
                    for (i = lines.length - 1; i >= 0; i--) {
                        if ((lines[i].offsetTop-bufferlines.scrollTop)<bufferlines.clientHeight/2) {
                            lines[i].scrollIntoView(false);
                            break;
                        }
                    }
                    return true;
                }

                // Page down -> scroll down
                if ($event.type === "keydown" && code === 34 && document.activeElement === inputNode && !$event.ctrlKey && !$event.altKey && !$event.shiftKey) {
                    lines = bufferlines.querySelectorAll("tr");
                    for (i = 0; i < lines.length; i++) {
                        if ((lines[i].offsetTop-bufferlines.scrollTop)>bufferlines.clientHeight/2) {
                            lines[i].scrollIntoView(true);
                            break;
                        }
                    }
                    return true;
                }

                // Some readline keybindings
                if (settings.readlineBindings && $event.ctrlKey && !$event.altKey && !$event.shiftKey && document.activeElement === inputNode) {
                    // get current caret position
                    caretPos = inputNode.selectionStart;
                    // Ctrl-a
                    if (code == 65) {
                        inputNode.setSelectionRange(0, 0);
                    // Ctrl-e
                    } else if (code == 69) {
                        inputNode.setSelectionRange($scope.command.length, $scope.command.length);
                    // Ctrl-u
                    } else if (code == 85) {
                        $scope.command = $scope.command.slice(caretPos);
                        setTimeout(function() {
                            inputNode.setSelectionRange(0, 0);
                        });
                    // Ctrl-k
                    } else if (code == 75) {
                        $scope.command = $scope.command.slice(0, caretPos);
                        setTimeout(function() {
                            inputNode.setSelectionRange($scope.command.length, $scope.command.length);
                        });
                    // Ctrl-w
                    } else if (code == 87) {
                        var trimmedValue = $scope.command.slice(0, caretPos);
                        var lastSpace = trimmedValue.replace(/\s+$/, '').lastIndexOf(' ') + 1;
                        $scope.command = $scope.command.slice(0, lastSpace) + $scope.command.slice(caretPos, $scope.command.length);
                        setTimeout(function() {
                            inputNode.setSelectionRange(lastSpace, lastSpace);
                        });
                    } else {
                        return false;
                    }
                    $event.preventDefault();
                    return true;
                }

                // Alt key down -> display quick key legend
                if ($event.type === "keydown" && code === 18 && !$event.ctrlKey && !$event.shiftKey && settings.enableQuickKeys) {
                    $rootScope.showQuickKeys = true;
                }
            };

            $rootScope.handleKeyRelease = function($event) {
                // Alt key up -> remove quick key legend
                if ($event.keyCode === 18) {
                    if ($rootScope.quickKeysTimer !== undefined) {
                        clearTimeout($rootScope.quickKeysTimer);
                    }
                    $rootScope.quickKeysTimer = setTimeout(function() {
                        if ($rootScope.showQuickKeys) {
                            $rootScope.showQuickKeys = false;
                            $rootScope.$apply();
                        }
                        delete $rootScope.quickKeysTimer;
                    }, 1000);
                    return true;
                }
            };

            $scope.handleCompleteNickButton = function($event) {
                $event.preventDefault();
                $scope.completeNick();
                $scope.completeCommand('forward');

                setTimeout(function() {
                    $scope.getInputNode().focus();
                }, 0);

                return true;
            };
            
            $scope.inputPasted = function(e) {
                if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length) {
                    e.stopPropagation();
                    e.preventDefault();

                    var sendImageUrl = function(imageUrl, deleteHash) {
                        if(imageUrl !== undefined && imageUrl !== '') {
                            $rootScope.insertAtCaret(String(imageUrl));
                        }

                        // Show toast with delete link
                        var toastImgur = $compile('<div class="toast toast-long" data-imgur-deletehash=\'' + deleteHash + '\'>Image uploaded to Imgur. <a id="deleteImgur" ng-click="imgurDelete(\'' + deleteHash + '\')" href="">Delete?</a></div>')($scope)[0];
                        document.body.appendChild(toastImgur);
                        setTimeout(function() { document.body.removeChild(toastImgur); }, 15000);

                        // Log the delete hash to the console in case the toast was missed.
                        console.log('An image was uploaded to imgur, delete it with $scope.imgurDelete(\'' + deleteHash + '\')');
                    };

                    for (var i = 0; i < e.clipboardData.files.length; i++) {
                        imgur.process(e.clipboardData.files[i], sendImageUrl);
                    }
                    return false;
                }
                return true;
            };
        }]
    };
});
