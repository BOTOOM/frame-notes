import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  modules: ["@wxt-dev/module-react"],
  manifest: ({ browser }) => ({
    name: "__MSG_extensionName__",
    description: "__MSG_extensionDescription__",
    default_locale: "en",
    permissions: ["storage", "activeTab"],
    host_permissions: ["http://localhost/*", "http://127.0.0.1/*"],
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
    action: {
      default_title: "__MSG_extensionName__",
      default_popup: "popup.html",
    },
    commands: {
      "new-note": {
        suggested_key: { default: "Alt+Shift+N", mac: "Alt+Shift+N" },
        description: "__MSG_commandNewNote__",
      },
      "set-start": {
        suggested_key: { default: "Alt+Shift+I", mac: "Alt+Shift+I" },
        description: "__MSG_commandSetStart__",
      },
      "set-end": {
        suggested_key: { default: "Alt+Shift+O", mac: "Alt+Shift+O" },
        description: "__MSG_commandSetEnd__",
      },
      "copy-notes": {
        suggested_key: { default: "Alt+Shift+C", mac: "Alt+Shift+C" },
        description: "__MSG_commandCopy__",
      },
      "toggle-panel": {
        description: "__MSG_commandToggle__",
      },
    },
    web_accessible_resources:
      browser === "firefox"
        ? ["bridge.js"]
        : [{ resources: ["bridge.js"], matches: ["http://localhost/*", "http://127.0.0.1/*"] }],
  }),
});
