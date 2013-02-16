var output;
var hostport;
var proto;
var password;
function init() {
  output = document.getElementById("output");
  hostport = prompt("Enter hostname:port of WeeChat/relay", "hostname:5000")
  proto = prompt("Protocol (weechat / irc)", "weechat")
  password = prompt("Password (for relay)", "")
  websocket = new WebSocket("ws://" + hostport + "/weechat");
  websocket.onopen = function(evt) { onOpen(evt) };
  websocket.onclose = function(evt) { onClose(evt) };
  websocket.onmessage = function(evt) { onMessage(evt) };
  websocket.onerror = function(evt) { onError(evt) };
}
function onOpen(evt) {
  display("connected", "Connected to " + hostport);
  if (proto == "weechat") {
    doSend("init password=" + password + "\ninfo version\ntest\n");
  } else {
    doSend("PASS " + password + "\r\nNICK test\r\nUSER test 0 * :test\r\n");
  }
}
function onClose(evt) {
  display("disconnected", "Disconnected");
}
function onMessage(evt) {
  display("recv", "&rArr; " + evt.data);
}
function onError(evt) {
  display("error", "ERROR: " + evt.data);
}
function doSend(message) {
  msgs = message.replace(/[\r\n]+$/g, "").split("\n");
  for (var i = 0; i < msgs.length; i++) {
    display("sent", "&lArr; " + msgs[i]);
  }
  websocket.send(message);
}
function display(class_name, message) {
  var div = document.createElement("div");
  div.className = class_name;
  div.innerHTML = message;
  output.appendChild(div);
}
window.addEventListener("load", init, false);
