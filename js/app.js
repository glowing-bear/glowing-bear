document.addEventListener("deviceready", function () {
    if (navigator.splashscreen !== undefined) {
        navigator.splashscreen.hide();
    }
}, false);