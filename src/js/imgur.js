(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.factory('imgur', ['$rootScope', 'settings', function($rootScope, settings) {

    var process = function(image, callback) {
        // Is it an image?
        if (!image || !image.type.match(/image.*/)) return;

        var reader = new FileReader();

        // When image is read
        reader.onload = function (event) {
            var image = event.target.result.split(',')[1];
            upload(image, callback);
        };
        reader.readAsDataURL(image);
    };

    var authenticate = function(xhr) {
        // API authorization, either via Client ID (anonymous) or access token
        // (add to user's imgur account), see also:
        // https://github.com/glowing-bear/glowing-bear/wiki/Getting-an-imgur-token-&-album-hash
        var accessToken = "164efef8979cd4b";

        // Check whether the user has configured a bearer token, if so, use it
        // to add the image to the user's account
        if (settings.iToken.length >= 38){
            xhr.setRequestHeader("Authorization", "Bearer " + settings.iToken);
        } else {
            xhr.setRequestHeader("Authorization", "Client-ID " + accessToken);
        }
    };

    // Upload image to imgur from base64
    var upload = function( base64img, callback ) {
        // Progress bars container
        var progressBars = document.getElementById("imgur-upload-progress"),
            currentProgressBar = document.createElement("div");
        currentProgressBar.className='imgur-progress-bar';
        currentProgressBar.style.width = '0';

        progressBars.appendChild(currentProgressBar);

        // Assemble the form data for the upload
        var fd = new FormData();
        fd.append("image", base64img);
        fd.append("type", "base64");

        // Add the image to the provided album if configured to do so
        if (settings.iToken.length >= 38 && settings.iAlb.length >= 6) {
            fd.append("album", settings.iAlb);
        }

        // Post request to imgur api
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", "https://api.imgur.com/3/image", true);
        authenticate(xhttp);
        xhttp.setRequestHeader("Accept", "application/json");

        // Handler for response
        xhttp.onload = function() {
            // Remove progress bar
            progressBars.removeChild(currentProgressBar);

            // Check state and response status
            if (xhttp.status === 200) {
                var response = JSON.parse(xhttp.responseText);

                // Send link as message
                if (response.data && response.data.link) {
                    if (callback && typeof(callback) === "function") {
                        callback(response.data.link.replace(/^http:/, "https:"), response.data.deletehash);
                    }
                } else {
                    showErrorMsg();
                }
            } else {
                showErrorMsg();
            }
        };

        if ("upload" in xhttp) {
            // Update the progress bar if we can compute progress
            xhttp.upload.onprogress = function (event) {
                if (event.lengthComputable) {
                    var complete = (event.loaded / event.total * 100 | 0);
                    currentProgressBar.style.width = complete + '%';
                }
            };
        }
        // Send request with form data
        xhttp.send(fd);
    };

    // Delete an image from imgur with the deletion link
    var deleteImage = function( deletehash, callback ) {
        var xhttp = new XMLHttpRequest();

        // Post request to imgur api
        xhttp.open("DELETE", "https://api.imgur.com/3/image/" + deletehash, true);
        authenticate(xhttp);
        xhttp.setRequestHeader("Accept", "application/json");

        // Handler for response
        xhttp.onload = function() {
            // Check state and response status
            if (xhttp.status === 200) {
                callback(deletehash);
            } else {
                showErrorMsg();
            }
        };
        
        // Send request with form data
        xhttp.send(null);
    };

    var showErrorMsg = function() {
        // Show error msg
        $rootScope.uploadError = true;
        $rootScope.$apply();

        // Hide after 5 seconds
        setTimeout(function(){
            // Hide error msg
            $rootScope.uploadError = false;
            $rootScope.$apply();
        }, 5000);
    };

    return {
        process: process,
        deleteImage: deleteImage
    };

}]);

})();
