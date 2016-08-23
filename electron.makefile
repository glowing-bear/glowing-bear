# Common flags for electron-packager on all platforms
ELECTRON_COMMON=. "Glowing Bear" --overwrite --version-string.FileDescription="Glowing Bear" --ignore=node_modules --ignore=test --ignore=bower_components

# fetch dependencies for local installation
bower:
	bower install

# copy dependencies from bower_components to the correct place
copylocal:
	find bower_components \( -name "*min.js" -o -name "*min.css" \) -exec cp {} 3rdparty \;
	cp -r bower_components/bootstrap/fonts .
	cp bower_components/emojione/assets/sprites/emojione.sprites.svg 3rdparty

# modify index.html to use local files
uselocal: copylocal
	sed -i.bak 's,https://cdnjs.cloudflare.com/ajax/libs/[^\"]*/,3rdparty/,g' index.html
	sed -i.bak 's, integrity=\".*\" crossorigin=\"anonymous\",,' index.html

# build the electron app for various platforms
build-electron-windows: uselocal
	electron-packager ${ELECTRON_COMMON} --platform=win32 --arch=ia32 --version=1.3.3 --icon=assets/img/favicon.ico --asar=true

build-electron-darwin: uselocal
	electron-packager ${ELECTRON_COMMON} --platform=darwin --arch=x64 --version=1.3.3 --icon=assets/img/glowing-bear.icns

build-electron-linux: uselocal
	electron-packager ${ELECTRON_COMMON} --platform=linux --arch=x64 --version=1.3.3 --icon=assets/img/favicon.ico
