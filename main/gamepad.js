const koffi = require('koffi');
const { getMainWindow } = require('./window');

// XInput structures and constants
const XINPUT_GAMEPAD_DPAD_UP = 0x0001;
const XINPUT_GAMEPAD_DPAD_DOWN = 0x0002;
const XINPUT_GAMEPAD_DPAD_LEFT = 0x0004;
const XINPUT_GAMEPAD_DPAD_RIGHT = 0x0008;
const XINPUT_GAMEPAD_START = 0x0010;
const XINPUT_GAMEPAD_BACK = 0x0020;
const XINPUT_GAMEPAD_LEFT_THUMB = 0x0040;
const XINPUT_GAMEPAD_RIGHT_THUMB = 0x0080;
const XINPUT_GAMEPAD_LEFT_SHOULDER = 0x0100;
const XINPUT_GAMEPAD_RIGHT_SHOULDER = 0x0200;
const XINPUT_GAMEPAD_A = 0x1000;
const XINPUT_GAMEPAD_B = 0x2000;
const XINPUT_GAMEPAD_X = 0x4000;
const XINPUT_GAMEPAD_Y = 0x8000;

// Thumbstick deadzone (Xbox default is ~7849)
const DEADZONE = 8000;
const STICK_MAX = 32767;
const CURSOR_SPEED = 12; // Pixels per poll at full tilt

let xinput = null;
let XInputGetState = null;
let pollInterval = null;
let lastButtons = 0;

// D-pad repeat settings
const DPAD_REPEAT_DELAY = 200;
const DPAD_REPEAT_RATE = 50;

// Track held buttons for repeat
let heldButtons = {};
let repeatTimers = {};

function initXInput() {
    try {
        // Try XInput1_4 first (Windows 8+), fall back to XInput9_1_0
        try {
            xinput = koffi.load('xinput1_4.dll');
        } catch {
            try {
                xinput = koffi.load('xinput1_3.dll');
            } catch {
                xinput = koffi.load('xinput9_1_0.dll');
            }
        }

        // Define XINPUT_GAMEPAD structure
        const XINPUT_GAMEPAD = koffi.struct('XINPUT_GAMEPAD', {
            wButtons: 'uint16',
            bLeftTrigger: 'uint8',
            bRightTrigger: 'uint8',
            sThumbLX: 'int16',
            sThumbLY: 'int16',
            sThumbRX: 'int16',
            sThumbRY: 'int16'
        });

        // Define XINPUT_STATE structure
        const XINPUT_STATE = koffi.struct('XINPUT_STATE', {
            dwPacketNumber: 'uint32',
            Gamepad: XINPUT_GAMEPAD
        });

        // Get function pointer
        XInputGetState = xinput.func('uint32 XInputGetState(uint32 dwUserIndex, _Out_ XINPUT_STATE *pState)');

        console.log('XInput initialized successfully');
        return true;
    } catch (err) {
        console.error('Failed to initialize XInput:', err.message);
        return false;
    }
}

function isButtonPressed(buttons, button) {
    return (buttons & button) !== 0;
}

function isButtonJustPressed(currentButtons, button) {
    return isButtonPressed(currentButtons, button) && !isButtonPressed(lastButtons, button);
}

function handleButtonAction(action) {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;

    // Send action to renderer
    win.webContents.send('gamepad-action', action);
}

function handleAnalogInput(dx, dy) {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;

    // Send analog movement to renderer
    win.webContents.send('analog-input', { dx, dy });
}

function handleWindowAction(action) {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;

    switch (action) {
        case 'toggle':
            if (win.isVisible()) {
                win.hide();
            } else {
                win.show();
                win.focus();
            }
            break;
        case 'show':
            win.show();
            win.focus();
            break;
        case 'close':
            require('electron').app.quit();
            break;
        case 'hide':
            win.hide();
            break;
    }
}

function setupDpadRepeat(button, action) {
    // Clear existing timer for this button
    if (repeatTimers[button]) {
        clearTimeout(repeatTimers[button]);
        clearInterval(repeatTimers[button + '_interval']);
    }

    // Initial delay before repeat starts
    repeatTimers[button] = setTimeout(() => {
        // Start repeating
        repeatTimers[button + '_interval'] = setInterval(() => {
            if (heldButtons[button]) {
                handleButtonAction(action);
            } else {
                clearInterval(repeatTimers[button + '_interval']);
            }
        }, DPAD_REPEAT_RATE);
    }, DPAD_REPEAT_DELAY);
}

function clearDpadRepeat(button) {
    if (repeatTimers[button]) {
        clearTimeout(repeatTimers[button]);
        delete repeatTimers[button];
    }
    if (repeatTimers[button + '_interval']) {
        clearInterval(repeatTimers[button + '_interval']);
        delete repeatTimers[button + '_interval'];
    }
}

function pollGamepad() {
    if (!XInputGetState) return;
    
    // Check if window still exists
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;

    // Create state buffer
    const state = {
        dwPacketNumber: 0,
        Gamepad: {
            wButtons: 0,
            bLeftTrigger: 0,
            bRightTrigger: 0,
            sThumbLX: 0,
            sThumbLY: 0,
            sThumbRX: 0,
            sThumbRY: 0
        }
    };

    // Poll controller 0
    const result = XInputGetState(0, state);
    
    if (result !== 0) {
        // Controller not connected, reset state
        lastButtons = 0;
        return;
    }

    const buttons = state.Gamepad.wButtons;

    // Back + B combo to close/quit the app
    if (isButtonPressed(buttons, XINPUT_GAMEPAD_BACK) && isButtonPressed(buttons, XINPUT_GAMEPAD_B)) {
        if (!isButtonPressed(lastButtons, XINPUT_GAMEPAD_BACK) || !isButtonPressed(lastButtons, XINPUT_GAMEPAD_B)) {
            handleWindowAction('close');
        }
        lastButtons = buttons;
        return; // Don't process other buttons when using combo
    }

    // Guide button handling - using Back + Start combo as pseudo-guide
    // (True Guide button requires undocumented XInputGetStateEx)
    if (isButtonPressed(buttons, XINPUT_GAMEPAD_BACK) && isButtonPressed(buttons, XINPUT_GAMEPAD_START)) {
        if (!isButtonPressed(lastButtons, XINPUT_GAMEPAD_BACK) || !isButtonPressed(lastButtons, XINPUT_GAMEPAD_START)) {
            handleWindowAction('toggle');
        }
        lastButtons = buttons;
        return; // Don't process other buttons when using combo
    }

    // Only process navigation buttons if window is visible
    if (win && win.isVisible()) {
        // Left thumbstick for cursor movement
        let thumbLX = state.Gamepad.sThumbLX;
        let thumbLY = state.Gamepad.sThumbLY;
        
        // Apply deadzone
        if (Math.abs(thumbLX) < DEADZONE) thumbLX = 0;
        if (Math.abs(thumbLY) < DEADZONE) thumbLY = 0;
        
        // Convert to cursor movement (Y is inverted on controller)
        if (thumbLX !== 0 || thumbLY !== 0) {
            const dx = (thumbLX / STICK_MAX) * CURSOR_SPEED;
            const dy = (-thumbLY / STICK_MAX) * CURSOR_SPEED; // Invert Y
            handleAnalogInput(dx, dy);
        }
        
        // Right thumbstick for scrolling
        let thumbRX = state.Gamepad.sThumbRX;
        let thumbRY = state.Gamepad.sThumbRY;
        
        if (Math.abs(thumbRX) < DEADZONE) thumbRX = 0;
        if (Math.abs(thumbRY) < DEADZONE) thumbRY = 0;
        
        if (thumbRY !== 0) {
            // Scroll with right stick
            const scrollAmount = (-thumbRY / STICK_MAX) * 15;
            if (scrollAmount > 2) {
                handleButtonAction('scroll-down-analog');
            } else if (scrollAmount < -2) {
                handleButtonAction('scroll-up-analog');
            }
        }

        // D-pad for cursor movement (with repeat)
        if (isButtonPressed(buttons, XINPUT_GAMEPAD_DPAD_UP)) {
            if (!heldButtons[XINPUT_GAMEPAD_DPAD_UP]) {
                heldButtons[XINPUT_GAMEPAD_DPAD_UP] = true;
                handleButtonAction('cursor-up');
                setupDpadRepeat(XINPUT_GAMEPAD_DPAD_UP, 'cursor-up');
            }
        } else {
            if (heldButtons[XINPUT_GAMEPAD_DPAD_UP]) {
                heldButtons[XINPUT_GAMEPAD_DPAD_UP] = false;
                clearDpadRepeat(XINPUT_GAMEPAD_DPAD_UP);
            }
        }

        if (isButtonPressed(buttons, XINPUT_GAMEPAD_DPAD_DOWN)) {
            if (!heldButtons[XINPUT_GAMEPAD_DPAD_DOWN]) {
                heldButtons[XINPUT_GAMEPAD_DPAD_DOWN] = true;
                handleButtonAction('cursor-down');
                setupDpadRepeat(XINPUT_GAMEPAD_DPAD_DOWN, 'cursor-down');
            }
        } else {
            if (heldButtons[XINPUT_GAMEPAD_DPAD_DOWN]) {
                heldButtons[XINPUT_GAMEPAD_DPAD_DOWN] = false;
                clearDpadRepeat(XINPUT_GAMEPAD_DPAD_DOWN);
            }
        }

        if (isButtonPressed(buttons, XINPUT_GAMEPAD_DPAD_LEFT)) {
            if (!heldButtons[XINPUT_GAMEPAD_DPAD_LEFT]) {
                heldButtons[XINPUT_GAMEPAD_DPAD_LEFT] = true;
                handleButtonAction('cursor-left');
                setupDpadRepeat(XINPUT_GAMEPAD_DPAD_LEFT, 'cursor-left');
            }
        } else {
            if (heldButtons[XINPUT_GAMEPAD_DPAD_LEFT]) {
                heldButtons[XINPUT_GAMEPAD_DPAD_LEFT] = false;
                clearDpadRepeat(XINPUT_GAMEPAD_DPAD_LEFT);
            }
        }

        if (isButtonPressed(buttons, XINPUT_GAMEPAD_DPAD_RIGHT)) {
            if (!heldButtons[XINPUT_GAMEPAD_DPAD_RIGHT]) {
                heldButtons[XINPUT_GAMEPAD_DPAD_RIGHT] = true;
                handleButtonAction('cursor-right');
                setupDpadRepeat(XINPUT_GAMEPAD_DPAD_RIGHT, 'cursor-right');
            }
        } else {
            if (heldButtons[XINPUT_GAMEPAD_DPAD_RIGHT]) {
                heldButtons[XINPUT_GAMEPAD_DPAD_RIGHT] = false;
                clearDpadRepeat(XINPUT_GAMEPAD_DPAD_RIGHT);
            }
        }

        // Face buttons (single press, no repeat)
        if (isButtonJustPressed(buttons, XINPUT_GAMEPAD_A)) {
            handleButtonAction('click');
        }

        if (isButtonJustPressed(buttons, XINPUT_GAMEPAD_B)) {
            handleButtonAction('back');
        }

        if (isButtonJustPressed(buttons, XINPUT_GAMEPAD_Y)) {
            handleButtonAction('home');
        }

        if (isButtonJustPressed(buttons, XINPUT_GAMEPAD_X)) {
            handleButtonAction('search');
        }

        // Shoulder buttons - page scroll
        if (isButtonJustPressed(buttons, XINPUT_GAMEPAD_LEFT_SHOULDER)) {
            handleButtonAction('page-up');
        }

        if (isButtonJustPressed(buttons, XINPUT_GAMEPAD_RIGHT_SHOULDER)) {
            handleButtonAction('page-down');
        }

        // Start button - send to renderer (can be intercepted by OSK for submit)
        if (isButtonJustPressed(buttons, XINPUT_GAMEPAD_START)) {
            handleButtonAction('start');
        }
        
        // Left thumb click - could be used for something
        // Right thumb click - could toggle cursor speed
    }

    lastButtons = buttons;
}

function startPolling() {
    if (!initXInput()) {
        console.log('Gamepad support disabled - XInput not available');
        return false;
    }

    // Poll at ~60Hz
    pollInterval = setInterval(pollGamepad, 16);
    console.log('Gamepad polling started');
    return true;
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    
    // Clear all repeat timers
    Object.keys(repeatTimers).forEach(key => {
        if (key.endsWith('_interval')) {
            clearInterval(repeatTimers[key]);
        } else {
            clearTimeout(repeatTimers[key]);
        }
    });
    repeatTimers = {};
    heldButtons = {};
}

module.exports = { startPolling, stopPolling };
