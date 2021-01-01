// Template from https://www.electronjs.org/docs/tutorial/spellchecker

const url = require('url');
const { clipboard, Menu, MenuItem } = require('electron')

exports.create = function() {

global.mainWindow.webContents.on('context-menu', (event, params) => {
	let url = params.linkURL || params.srcURL;
	const menu = new Menu()

	// Show copy as Image option for images
	if (params.hasImageContents) {
		menu.append(new MenuItem({
			label: '&Copy image',
			click() { event.sender.copyImageAt(params.x, params.y); },
		}));
	}

	if (params.selectionText || params.isEditable) {
		if (params.isEditable) {
			menu.append(new MenuItem({
				role: 'undo',
				enabled: params.editFlags.canUndo
			}))
			menu.append(new MenuItem({
				role: 'redo',
				enabled: params.editFlags.canRedo
			}))
			menu.append(new MenuItem({
				type: 'separator'
			}))
		}

		let did_we_show_dictionary = false;
		// Add each spelling suggestion
		for (const suggestion of params.dictionarySuggestions) {
			menu.append(new MenuItem({
				label: suggestion,
				click: () => global.mainWindow.webContents.replaceMisspelling(suggestion)
			}))
			did_we_show_dictionary = true;
		}

		// Allow users to add the misspelled word to the dictionary
		if (params.misspelledWord) {
		menu.append(
			new MenuItem({
				label: 'Add to dictionary',
				click: () => global.mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
			}))
			did_we_show_dictionary = true;
		}

		// Show seperator only if dictionary was shown above
		if (did_we_show_dictionary) {
			menu.append(new MenuItem({
				type: 'separator'
			}));
		}

		menu.append(new MenuItem({
			role: 'cut',
			label: 'Cut',
			enabled: params.editFlags.canCut
		}));
		menu.append(new MenuItem({
			role: 'copy',
			label: 'Copy',
			enabled: params.editFlags.canCopy
		}));
		menu.append(new MenuItem({
			role: 'paste',
			label: 'Paste',
			enabled: params.editFlags.canPaste
		}));
		menu.append(new MenuItem({
			role: 'selectall',
			label: 'Select All',
			enabled: params.editFlags.canSelectAll
		}));
	}

	if (params.linkURL || params.srcURL) {
		// No point offering to copy a blob: or file: URL either
		if (!url.startsWith('blob:') && !url.startsWith('file:')) {
		// Special-case e-mail URLs to strip the `mailto:` like modern browsers do
			if (url.startsWith('mailto:')) {
				menu.append(new MenuItem({
					label: 'Copy email &address',
					click() { clipboard.writeText(url.substr(7)); },
 				}))
			} else {
				menu.append(new MenuItem({
					label: 'Copy link &address',
					click() { clipboard.writeText(url); },
				}))
			}
		}
    }

	// we should only show the menu if it actually has items
	if (menu.items.length !== 0) menu.popup();
})}
