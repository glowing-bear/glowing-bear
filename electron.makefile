# Common flags for electron-packager on all platforms
ELECTRON_COMMON=. "Glowing Bear" --overwrite --version-string.FileDescription="Glowing Bear" --ignore=node_modules --ignore=test --ignore=bower_components

# fetch dependencies for local installation
bower:
	bower install

# copy dependencies including bower_components to the correct place
copylocal:
	mkdir -p build dist
	find ./ -maxdepth 1 ! -name build ! -name bower_components ! -name dist ! -name .git ! -name . -exec cp -fr {} build \;
	find bower_components \( -name "*min.js" -o -name "*min.css" \) -exec cp {} build/3rdparty \;
	cp -r bower_components/bootstrap/fonts build/
	cp bower_components/emojione/assets/sprites/emojione.sprites.svg build/3rdparty

# modify index.html to use local files
uselocal: copylocal
	sed -i 's,https://cdnjs.cloudflare.com/ajax/libs/[^\"]*/,3rdparty\/built/,g' build/index.html
	sed -i 's, integrity=\".*\" crossorigin=\"anonymous\",,' build/index.html

# build the electron app for various platforms
build-electron-windows: uselocal
	electron-packager ${ELECTRON_COMMON} --platform=win32 --arch=x64 --electron-version=7.1.2 --icon=assets/img/favicon.ico --overwrite=true --out=dist build

build-electron-darwin: uselocal
	electron-packager ${ELECTRON_COMMON} --platform=darwin --arch=x64 --electron-version=7.1.2 --icon=assets/img/glowing-bear.icns --overwrite=true --out=dist build build

build-electron-linux: uselocal
	electron-packager ${ELECTRON_COMMON} --platform=linux --arch=x64 --electron-version=7.1.2 --icon=assets/img/favicon.ico --overwrite=true --out=dist build

# build the electron app archives for various platforms
build-electron-windows-archive: build-electron-windows
	if [ -d "dist/Glowing Bear-win32-x64" ]; then cd dist; zip -r "Glowing Bear-win32-x64.zip" "Glowing Bear-win32-x64"; rm -rf "Glowing Bear-win32-x64"; fi

build-electron-darwin-archive: build-electron-darwin
	if [ -d "dist/Glowing Bear-darwin-x64" ]; then cd dist;	zip -r "Glowing Bear-darwin-x64.zip" "Glowing Bear-darwin-x64"; rm -rf "Glowing Bear-darwin-x64"; fi

build-electron-linux-archive: build-electron-linux
	if [ -d "dist/Glowing Bear-linux-x64" ]; then cd dist; tar cvfz "Glowing Bear-linux-x64.tgz" "Glowing Bear-linux-x64"; rm -rf "Glowing Bear-linux-x64"; fi
