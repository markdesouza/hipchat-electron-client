'use strict'

const electron = require('electron')
const open = require('open')
const path = require('path')
const storage = require('electron-json-storage')
const prompt = require('electron-prompt')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const Menu = electron.Menu;
const MenuItem = electron.MenuItem;
const Tray = electron.Tray;
const ipcMain = electron.ipcMain
const nativeImage = electron.nativeImage

const DEFAULT_SERVER_URL = ''
let mainWindow = null
let appIcon = null
let prefs = {}

// Set dock icon in macos
if (process.platform == 'darwin') {
    let dockIconPath = path.resolve(path.join(__dirname, 'images/hipchat-dock.png'))
    let dockIconImage = nativeImage.createFromPath(dockIconPath)
    app.dock.setIcon(dockIconImage)
}

app.on('ready', function () {
    let instanceLock = app.requestSingleInstanceLock()
    if (!instanceLock) {
        console.log("An instance is already running. Exiting...")
        quit()
    } else {
        app.on('second-instance', (event, argv, cwd) => {
            showAndFocusWindow()

            if (argv.includes('--new-chat')) {
                newChat()
            }
        })
    }

    storage.get('prefs', function (error, data) {
        if (error) {
            console.log("Could not load preferences from storage:", error, data)
        }
        prefs = data

        if (!prefs || !prefs.server_url || process.argv.includes('--logout')) {
            prefs.server_url = DEFAULT_SERVER_URL
            savePrefs(true)
        }

        if (prefs.server_url === "") {
            prompt({
                title: 'Enter HipChat Server Address',
                label: 'URL:',
                value: 'https://hipchat.workplace.com',
                inputAttrs: {
                    type: 'url'
                },
                type: 'input'
            }).then((input) => {
                if (input !== null && input.trim() !== "") {
                    input = input.trim()
                    if (!input.endsWith("/chat")) {
                        if (!input.endsWith("/")) {
                            input += "/chat"
                        } else {
                            input += "chat"
                        }
                    }
                    prefs.server_url = input
                    savePrefs(true)
                    loadChatWindow()
                } else {
                    console.log("HipChat Server URL can not be empty")
                    quit()
                }
            }).catch(console.error)
        } else {
            loadChatWindow()
        }
    })
})


function loadChatWindow() {
    var electronScreen = electron.screen
    var primaryDisplay = electronScreen.getPrimaryDisplay()
    var defaultWidth = ('windowWidth' in prefs) ? prefs['windowWidth'] : Math.floor(primaryDisplay.workAreaSize.width * 0.9)
    var defaultHeight = ('windowHeight' in prefs) ? prefs['windowHeight'] : Math.floor(primaryDisplay.workAreaSize.height * 0.9)
    var defaultZoom = ('zoom' in prefs) ? prefs['zoom'] : 1.0

    // Open Chat Window
    var windowOptions = {
        title: 'HipChat',
        titleBarStyle: 'hiddenInset',
        spellcheck: true,
        width: defaultWidth,
        height: defaultHeight,
        icon: path.resolve(path.join(__dirname, 'images/256x256/hipchat.png')),
        webPreferences: {
            zoomFactor: defaultZoom,
            nodeIntegration: false,
            preload: path.resolve(path.join(__dirname, 'preload.js')),
            contextIsolation: false,
            allowDisplayingInsecureContent: true,
        }
    }
    if ('windowX' in prefs)
        windowOptions['x'] = prefs['windowX']
    if ('windowY' in prefs)
        windowOptions['y'] = prefs['windowX']
    mainWindow = new BrowserWindow(windowOptions)

    // Window Event Listeners
    mainWindow.on('close', function (event) {
        quit()
    })

    mainWindow.on('closed', function () {
        mainWindow = null
    })

    mainWindow.on('resize', function (event) {
        var size = mainWindow.getSize()
        prefs['windowWidth'] = size[0]
        prefs['windowHeight'] = size[1]
        savePrefs()
    });

    mainWindow.on('move', function (event) {
        var position = mainWindow.getPosition()
        prefs['windowX'] = position[0]
        prefs['windowY'] = position[1]
        savePrefs()
    })

    // Application / window menu items
    let template = [
        {
            label: "HipChat",
            submenu: [
                { label: "New Chat", accelerator: 'CmdOrCtrl+N', click: newChat },
                { label: "Invite to Room", click: function () { sendKeyboardShortcut('I', true); } },
                { label: "Go To Unread Message", accelerator: 'CmdOrCtrl+G', click: gotoUnread },
                { label: "Close Room", accelerator: 'CmdOrCtrl+W', click: closeRoom },
                { label: "Previous Room", visible: false, accelerator: 'CmdOrCtrl+PageUp', click: function () { sendKeyboardShortcut('Up', true, true); } },
                { label: "Previous Room", visible: false, accelerator: 'CmdOrCtrl+Shift+Tab', click: function () { sendKeyboardShortcut('Up', true, true); } },
                { label: "Next Room", visible: false, accelerator: 'CmdOrCtrl+PageDown', click: function () { sendKeyboardShortcut('Down', true, true); } },
                { label: "Next Room", visible: false, accelerator: 'CmdOrCtrl+Tab', click: function () { sendKeyboardShortcut('Down', true, true); } },
                { type: 'separator' },
                { label: "Logout", click: logout },
                { label: "Quit", accelerator: 'CmdOrCtrl+Q', click: quit },
            ]
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    role: 'undo'
                },
                {
                    label: 'Redo',
                    accelerator: 'Shift+CmdOrCtrl+Z',
                    role: 'redo'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Cut',
                    accelerator: 'CmdOrCtrl+X',
                    role: 'cut'
                },
                {
                    label: 'Copy',
                    accelerator: 'CmdOrCtrl+C',
                    role: 'copy'
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    role: 'paste'
                },
                {
                    label: 'Select All',
                    accelerator: 'CmdOrCtrl+A',
                    role: 'selectall'
                },
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: function (item, focusedWindow) {
                        if (focusedWindow)
                            focusedWindow.reload();
                    }
                },
                {
                    label: 'Toggle Full Screen',
                    accelerator: (function () {
                        if (process.platform == 'darwin')
                            return 'Ctrl+Command+F';
                        else
                            return 'F11';
                    })(),
                    click: function (item, focusedWindow) {
                        if (focusedWindow)
                            focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
                    }
                },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: (function () {
                        if (process.platform == 'darwin')
                            return 'Alt+Command+I';
                        else
                            return 'Ctrl+Shift+I';
                    })(),
                    click: function (item, focusedWindow) {
                        if (focusedWindow)
                            focusedWindow.webContents.toggleDevTools();
                    }
                },
                { type: 'separator' },
                { label: "Zoom In", accelerator: 'CmdOrCtrl+=', click: function () { zoom(1); } },
                { label: "Zoom Out", accelerator: 'CmdOrCtrl+-', click: function () { zoom(-1); } },
                { label: "Reset Zoom", accelerator: 'CmdOrCtrl+0', click: function () { zoom(0); } },
            ]
        },
        {
            label: 'Window',
            role: 'window',
            submenu: [
                {
                    label: 'Minimize',
                    accelerator: 'CmdOrCtrl+M',
                    role: 'minimize'
                },
                {
                    label: 'Close',
                    role: 'close'
                },
            ]
        }
    ]
    mainWindow.setMenu(Menu.buildFromTemplate(template));
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));

    // Tray icon menu
    const iconPaths = {
        linux: {
            normal: 'images/64x64/hipchat-mono.png',
            alert: 'images/64x64/hipchat-mono-alert.png',
        },
        win32: {
            normal: 'images/16x16/hipchat.png',
            alert: 'images/16x16/hipchat-alert.png',
        },
        darwin: {
            normal: 'images/32x32/hipchat-mono@2x.png',
            alert: 'images/32x32/hipchat-attention@2x.png',
        },
        default: {
            normal: 'images/hipchat-default.png',
            alert: 'images/hipchat-default.png',
        }
    }
    let normalTrayIconPath = path.resolve(path.join(__dirname, (process.platform in iconPaths) ? iconPaths[process.platform].normal : iconPaths.default.normal))
    let normalTrayIconImage = nativeImage.createFromPath(normalTrayIconPath)
    let alertTrayIconPath = path.resolve(path.join(__dirname, (process.platform in iconPaths) ? iconPaths[process.platform].alert : iconPaths.default.alert))
    let alertTrayIconImage = nativeImage.createFromPath(alertTrayIconPath)
    appIcon = new Tray(normalTrayIconPath)
    var contextMenu = Menu.buildFromTemplate([
        { label: 'Show HipChat', type: 'normal', click: showAndFocusWindow },
        { type: 'separator' },
        { label: 'Join Chat', type: 'normal', click: newChat },
        { type: 'separator' },
        //{ label: 'Settings', type: 'normal' }, // TODO: Figure this action out
        //{ type: 'separator' },
        { label: 'Logout', type: 'normal', click: logout },
        { label: 'Quit HipChat', type: 'normal', click: quit },
    ])
    appIcon.setToolTip('HipChat')
    appIcon.setContextMenu(contextMenu)
    appIcon.on('click', () => {
        if (mentionCount > 0)
            gotoUnread()
    })
    appIcon.on('double-click', () => {
        (mentionCount > 0) ? gotoUnread() : toggleWindowFocus()
    })

    // Load the chat url
    mainWindow.loadURL(prefs.server_url)

    let contents = mainWindow.webContents
    contents.on('did-finish-load', () => {
        contents.insertCSS('#logo { margin-left: 60px; } header { -webkit-user-select: none;  -webkit-app-region: drag; } .activity-icon{ display:none; } .hc-video-call-btn-link { display:none !important; } ')
    })
    contents.on('new-window', function (event, url) {
        // Intercept 'new-window' event so we can open links in the OS default browser
        event.preventDefault()
        open(url)
    })
}

function showAndFocusWindow() {
    if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
    }
}

function toggleWindowFocus() {
    if (mainWindow) {
        if (mainWindow.isVisible()) {
            mainWindow.hide()
        } else {
            showAndFocusWindow()
        }
    }
}

// Send a keyboard event to the page (see Electron Docs: Accelerators for valid keyCode values)
function sendKeyboardShortcut(keyCode, ctrlKey, altKey, shiftKey) {
    showAndFocusWindow();
    var modifiers = [];
    if (ctrlKey) modifiers.push('control');
    if (altKey) modifiers.push('alt');
    if (shiftKey) modifiers.push('shift');
    mainWindow.webContents.sendInputEvent({
        type: 'keyDown',
        keyCode: keyCode,
        modifiers: modifiers,
    });
}

function logout() {
    delete prefs['server_url']
    savePrefs(false, true)
}

function zoom(mode) {
    if (!prefs['zoom']) {
        prefs['zoom'] = 1.0
    }

    // Modify zoom
    if (mode == 0) {
        prefs['zoom'] = 1.0
    } else {
        prefs['zoom'] += (mode * 0.2)
    }

    mainWindow.webContents.send('zoom', prefs['zoom'])
    savePrefs()
}

function gotoUnread() {
    showAndFocusWindow()
    mainWindow.webContents.send('jump-to-unread')
}

function closeRoom() {
    mainWindow.webContents.send('close-room');
}

function newChat() {
    showAndFocusWindow();
    sendKeyboardShortcut('J', true);
}

function quit() {
    app.quit()
}

function savePrefs(exitOnFail = false, exitOnSuccess = false) {
    // Note this is an async request as such quiting immediately may prevent the preferences from saving
    storage.set('prefs', prefs, function (error) {
        if (error) {
            console.log("Couldn't save preferences due to storage error: ", error)
            if (exitOnFail) {
                quit()
            }
        } else if (exitOnSuccess) {
            quit()
        }
    })
}