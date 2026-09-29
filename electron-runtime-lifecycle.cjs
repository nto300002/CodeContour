function createRuntimeCache(createRuntime) {
  let runtimePromise;
  let closePromise;

  return {
    async get() {
      if (closePromise) await closePromise;
      if (!runtimePromise) runtimePromise = Promise.resolve().then(createRuntime);
      return runtimePromise;
    },
    async close() {
      if (closePromise) return closePromise;
      const currentRuntime = runtimePromise;
      runtimePromise = undefined;
      if (!currentRuntime) return;

      closePromise = Promise.resolve(currentRuntime).then((runtime) => runtime.close());
      try {
        await closePromise;
      } finally {
        closePromise = undefined;
      }
    },
  };
}

function registerAppLifecycle({ app, BrowserWindow, createWindow, closeRuntimes, platform = process.platform }) {
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on("window-all-closed", async () => {
    try {
      await closeRuntimes();
    } finally {
      if (platform !== "darwin") app.quit();
    }
  });
}

module.exports = { createRuntimeCache, registerAppLifecycle };
