# hipchat-electron-client
A modern HipChat client to work with the abandoned HipChat server from Atlassian

## Features

- Produces builds for Mac (Universal / M1 compatible), Windows, Linux  **(done)**
- Fixes the right click crash from the official Atlassian client (under MacOS 12.0+)  **(done)**
- Fixes the non-responsive search bar (under MacOS 12.0+)  **(done)**
- Fixes the intermittent logout issue  **(done)**
- Removes services like video calling that rely on Atlassian and no longer work **(done)**
- Opens links in your default browser
- Minimizes to a tray icon & adds tray based notifications
- Desktop notifications
- Enhanced keyboard shortcuts

## Build and run from source

1. Checkout this repository and install dependencies

        $ git checkout https://github.com/markdesouza/hipchat-electron-client
        $ cd hipchat-electron-client
        $ yarn install

2. Start the application

        $ yarn start

## Produce builds

        $ yarn build-mac
        or
        $ yarn build-win
        or
        $ yarn build-linux

## Arguments

    Ignore server url saved in preferences
    $ yarn start --new-chat

    Open new chat:
    $ yarn start --new-chat