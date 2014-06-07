document.addEventListener('deviceready', function() {
  navigator.splashscreen.hide();
}, false);

// FirefoxOS needs this for :active CSS rules (since it ignores :hover anyway)
document.addEventListener("touchstart", function(){}, true);
