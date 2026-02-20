const { initSimnet } = require("@stacks/clarinet-sdk");
const { join, resolve } = require("path");

// Ensure that the Clarinet project cache and deployment plan are initialized
// before all the tests run.
beforeAll(async () => {
  try {
    const manifestPath = join(resolve(__dirname, "example"), "Clarinet.toml");
    console.log("Initializing simnet with manifest:", manifestPath);
    await initSimnet(manifestPath);
    console.log("Simnet initialized successfully");
  } catch (e) {
    console.error("Failed to initialize simnet:", e);
    throw e;
  }
}, 30000);
