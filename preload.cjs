const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("codeContour", Object.freeze({}));
