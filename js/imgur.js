(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.factory('imgur', ['$rootScope', function($rootScope) {

	var process = function(image, callback) {

		// Is it an image?
		if (!image || !image.type.match(/image.*/)) return;

		// New file reader
		var reader = new FileReader();

		// When image is read
		reader.onload = function (event) {
			var image = event.target.result.split(',')[1];
			upload(image, callback);
		};

		// Read image as data url
		reader.readAsDataURL(image);

	};

	// Upload image to imgur from base64
	var upload = function( base64img, callback ) {

                // Set client ID (Glowing Bear)
                var clientId = "164efef8979cd4b";

		// Progress bar DOM elment
		var progressBar = document.getElementById("imgur-upload-progress");
		progressBar.style.width = '0';

		// Create new form data
		var fd = new FormData();
		fd.append("image", base64img); // Append the file
		fd.append("type", "base64"); // Set image type to base64

		// Create new XMLHttpRequest
		var xhttp = new XMLHttpRequest();

		// Post request to imgur api
		xhttp.open("POST", "https://api.imgur.com/3/image", true);

		// Set headers
		xhttp.setRequestHeader("Authorization", "Client-ID " + clientId);
		xhttp.setRequestHeader("Accept", "application/json");

		// Handler for response
		xhttp.onload = function() {

			progressBar.style.display = 'none';

			// Check state and response status
			if(xhttp.status === 200) {

				// Get response text
				var response = JSON.parse(xhttp.responseText);

				// Send link as message
				if( response.data && response.data.link ) {

					if (callback && typeof(callback) === "function") {
						callback(response.data.link);
					}

				} else {
					showErrorMsg();
				}

			} else {
				showErrorMsg();
			}

		};

		if( "upload" in xhttp ) {

			// Set progress
			xhttp.upload.onprogress = function (event) {

				// Check if we can compute progress
				if (event.lengthComputable) {
					// Complete in percent
					var complete = (event.loaded / event.total * 100 | 0);

					// Set progress bar width
					progressBar.style.display = 'block';
					progressBar.style.width = complete + '%';
				}
			};

		}

		// Send request with form data
		xhttp.send(fd);

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
        process: process
    };

}]);

})();
