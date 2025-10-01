const { initSimnet } = require("@hirosystems/clarinet-sdk");
const { join, resolve } = require("path");

// Ensure that the Clarinet project cache and deployment plan are initialized
// before all the tests run.
beforeAll(async () => {
  const manifestPath = join(resolve(__dirname, "example"), "Clarinet.toml");
  await initSimnet(manifestPath);
}, 30000);
