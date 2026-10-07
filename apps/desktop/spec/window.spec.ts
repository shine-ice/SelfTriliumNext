import { EventEmitter } from "node:events";

import { beforeEach, describe, expect, it, vi } from "vitest";

const savedState = vi.hoisted(() => ({ isMaximized: false, isFullScreen: false }));

// Model Electron's maximize() side effect: it also reveals a hidden window.
class TestWindow extends EventEmitter {
    visible: boolean;
    maximized = false;
    fullScreen = false;
    webContents = { setWindowOpenHandler: vi.fn(), on: vi.fn() };
    setMenuBarVisibility = vi.fn();
    loadURL = vi.fn();

    constructor(opts: { show: boolean }) {
        super();
        this.visible = opts.show;
    }

    show() {
        this.visible = true;
        this.emit("show");
    }

    maximize() {
        this.maximized = true;
        this.show();
    }

    setFullScreen(value: boolean) {
        this.fullScreen = value;
        if (value) this.show();
    }

    isDestroyed() { return false; }
}

vi.mock("electron", () => ({
    app: { on: vi.fn() },
    ipcMain: { on: vi.fn(), emit: vi.fn() },
    BrowserWindow: TestWindow
}));
vi.mock("electron-window-state", () => ({
    default: () => ({
        width: 1200,
        height: 800,
        manage: (win: TestWindow) => {
            if (savedState.isMaximized) win.maximize();
            if (savedState.isFullScreen) win.setFullScreen(true);
        }
    })
}));
vi.mock("@electron/remote/main/index.js", () => ({ enable: vi.fn() }));
vi.mock("../../server/src/services/app_info.js", () => ({ default: { appVersion: "test" } }));
vi.mock("../../server/src/services/cls.js", () => ({ default: {} }));
vi.mock("../../server/src/services/custom_dictionary.js", () => ({ default: {} }));
vi.mock("../../server/src/services/keyboard_actions.js", () => ({ default: {} }));
vi.mock("../../server/src/services/log.js", () => ({ default: {} }));
vi.mock("../../server/src/services/options.js", () => ({ default: { getOptionBool: () => false } }));
vi.mock("../../server/src/services/port.js", () => ({ default: 8080 }));
vi.mock("../../server/src/services/printing.js", () => ({ initPrintingHandlers: vi.fn() }));
vi.mock("../../server/src/services/resource_dir.js", () => ({ RESOURCE_DIR: "." }));
vi.mock("../../server/src/services/sql_init.js", () => ({ default: {} }));
vi.mock("../../server/src/services/utils.js", () => ({ isDev: false, isMac: false, isWindows: true }));

// Import after TestWindow is initialized because the Electron mock uses it.
const windowService = (await import("../../server/src/services/window.js")).default;

describe("main window startup visibility", () => {
    beforeEach(() => {
        savedState.isMaximized = false;
        savedState.isFullScreen = false;
    });

    for (const state of ["normal", "maximized", "fullscreen"] as const) {
        it(`keeps a ${state} window hidden until explicitly opened`, async () => {
            savedState.isMaximized = state === "maximized";
            savedState.isFullScreen = state === "fullscreen";
            const { app } = await import("electron");
            await windowService.createMainWindow(app, { show: false });
            const win = windowService.getMainWindow() as unknown as TestWindow;

            expect(win.visible).toBe(false);
            expect(win.maximized).toBe(false);
            expect(win.fullScreen).toBe(false);

            win.show();
            expect(win.visible).toBe(true);
            expect(win.maximized).toBe(savedState.isMaximized);
            expect(win.fullScreen).toBe(savedState.isFullScreen);

            // Later openings must not reapply the startup state.
            win.maximized = false;
            win.fullScreen = false;
            win.show();
            expect(win.maximized).toBe(false);
            expect(win.fullScreen).toBe(false);
        });
    }

    it("restores maximized state immediately on a normal visible launch", async () => {
        savedState.isMaximized = true;
        const { app } = await import("electron");
        await windowService.createMainWindow(app);
        const win = windowService.getMainWindow() as unknown as TestWindow;
        expect(win.visible).toBe(true);
        expect(win.maximized).toBe(true);
    });
});
