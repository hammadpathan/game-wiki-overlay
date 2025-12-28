const { globalShortcut } = require("electron");
const { getMainWindow } = require("./window");

let isClickThrough = false;

function setupShortcuts() {
    // Toggle overlay visibility
    globalShortcut.register("Control+Shift+W", () => {
        const win = getMainWindow();
        if (!win) return;

        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
        }
    });

    // Toggle click-through mode
    globalShortcut.register("Control+Shift+C", () => {
        const win = getMainWindow();
        if (!win) return;

        isClickThrough = !isClickThrough;
        win.setIgnoreMouseEvents(isClickThrough, { forward: true });
        
        // Send message to renderer to show click-through state
        win.webContents.send('click-through-changed', isClickThrough);
    });
}

module.exports = { setupShortcuts };

