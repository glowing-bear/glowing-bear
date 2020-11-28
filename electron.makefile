# Common flags for electron-packager on all platforms
ELECTRON_COMMON=./build "Glowing Bear" --overwrite --version-string.FileDescription="Glowing Bear" --ignore=node_modules --ignore=test --ignore=bower_components

build:
	npm run build

# copy dependencies from bower_components to the correct place
#copylocal:
#	find bower_components \( -name "*min.js" -o -name "*min.css" \) -exec cp {} 3rdparty \;
#	cp -r bower_components/bootstrap/fonts .

# modify index.html to use local files
#uselocal: copylocal
#	sed -i.bak 's,https://cdnjs.cloudflare.com/ajax/libs/[^\"]*/,3rdparty/,g' index.html
#	sed -i.bak 's, integrity=\".*\" crossorigin=\"anonymous\",,' index.html

# build the electron app for various platforms
build-electron-windows: build
	electron-packager ${ELECTRON_COMMON} --platform=win32 --arch=ia32 --electron-version=9.0.5 --icon=assets/img/favicon.ico --asar=true

build-electron-darwin: build
	electron-packager ${ELECTRON_COMMON} --platform=darwin --arch=x64 --electron-version=9.0.5 --icon=assets/img/glowing-bear.icns

build-electron-linux: build
	electron-packager ${ELECTRON_COMMON} --platform=linux --arch=x64 --electron-version=9.0.5 --icon=assets/img/favicon.ico
