'use strict'

const electron = require('electron')
const open = require('open')
const path = require('path')
const storage = require('electron-json-storage')
const prompt = require('electron-prompt')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipcMain = electron.ipcMain
const nativeImage = electron.nativeImage

const DEFAULT_SERVER_URL = ''
let mainWindow = null
let appIcon = null
let prefs = {}

// Handle icon initialisation
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
    },
    dock: {
        normal: 'images/hipchat-dock.png',
        alert: 'images/hipchat-dock.png',
    },
}

let normalTrayIconPath = path.resolve(path.join(__dirname, (process.platform in iconPaths) ? iconPaths[process.platform].normal : iconPaths.default.normal))
let normalTrayIconImage = nativeImage.createFromPath(normalTrayIconPath)
let alertTrayIconPath = path.resolve(path.join(__dirname, (process.platform in iconPaths) ? iconPaths[process.platform].alert : iconPaths.default.alert))
let alertTrayIconImage = nativeImage.createFromPath(alertTrayIconPath)
let dockIconPath = path.resolve(path.join(__dirname, iconPaths.dock.normal))
let dockIconImage = nativeImage.createFromPath(dockIconPath)

if (process.platform == 'darwin') {
    app.dock.setIcon(dockIconImage)
}


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
    mainWindow.loadURL(prefs.server_url)

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
        savePrefs(false)
    });

    mainWindow.on('move', function (event) {
        var position = mainWindow.getPosition()
        prefs['windowX'] = position[0]
        prefs['windowY'] = position[1]
        savePrefs(false)
    })

    let contents = mainWindow.webContents
    contents.on('did-finish-load', () => {
        contents.insertCSS('#logo { margin-left: 60px; } header { -webkit-user-select: none;  -webkit-app-region: drag; } .activity-icon{ display:none; } .hc-video-call-btn-link { display:none !important; } ')
    })
}

function quit() {
    app.quit()
}

function savePrefs(exitOnFail) {
    storage.set('prefs', prefs, function (error) {
        if (error) {
            console.log("Couldn't save preferences due to storage error: ", error)
            if (exitOnFail) {
                quit()
            }
        }
    })
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