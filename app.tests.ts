import { main } from "./app";

describe("Command-line arguments handling", () => {
  const initialArgv = process.argv;
  const helpMessage = `
  Usage: ./rv <path-to-clarinet-project> <contract-name> [--type=<type>] [--seed=<seed>] [--path=<path>]

  Positional arguments:
    path-to-clarinet-project - The path to the Clarinet project.
    contract-name - The name of the contract to be fuzzed.

  Options:
    --seed - The seed to use for the replay functionality.
    --path - The path to use for the replay functionality.
    --type - The type to use for exercising the contracts. Possible values: test, invariant. Default: invariant.
    --help - Show the help message.
  `;
  const noManifestMessage = `\nNo path to Clarinet project provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities.`;
  const noContractNameMessage = `\nNo target contract name provided. Please provide the contract name to be fuzzed.`;

  it.each([
    ["manifest path", ["node", "app.js"]],
    ["target contract name", ["node", "app.js", "./path/to/clarinet/project"]],
    ["--help flag", ["node", "app.js", "--help"]],
  ])(
    "returns undefined when %s is not provided",
    async (_testCase: string, argv: string[]) => {
      process.argv = argv;
      expect(await main()).toBeUndefined();
      process.argv = initialArgv;
    }
  );

  it("logs the help message at the end when --help is specified", async () => {
    // Arrange
    process.argv = ["node", "app.js", "--help"];

    const consoleLogs: string[] = [];
    jest.spyOn(console, "log").mockImplementation((message: string) => {
      consoleLogs.push(message);
    });

    // Act
    await main();

    const actual = consoleLogs[consoleLogs.length - 1];

    // Assert
    const expected = helpMessage;
    expect(actual).toBe(expected);

    process.argv = initialArgv;
    jest.restoreAllMocks();
  });

  it.each([
    ["manifest path", ["node", "app.js"], noManifestMessage],
    [
      "target contract name",
      ["node", "app.js", "./path/to/clarinet/project"],
      noContractNameMessage,
    ],
  ])(
    "logs the info and the help message when the %s is not provided",
    async (_testCase: string, argv: string[], expected: string) => {
      // Arrange
      process.argv = argv;
      const consoleLogs: string[] = [];
      jest.spyOn(console, "log").mockImplementation((message: string) => {
        consoleLogs.push(message);
      });

      // Act
      await main();

      const actualLastLog = consoleLogs[consoleLogs.length - 1];
      const actualSecondToLastLog = consoleLogs[consoleLogs.length - 2];

      // Assert
      const expectedLastLog = helpMessage;

      expect(actualLastLog).toBe(expectedLastLog);
      expect(actualSecondToLastLog).toBe(expected);

      process.argv = initialArgv;
      jest.restoreAllMocks();
    }
  );

  it.each([
    [
      ["manifest path", "contract name"],
      ["node", "app.js", "example", "counter"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `\nStarting invariant testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "seed"],
      ["node", "app.js", "example", "counter", "--seed=123"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using seed: 123`,
        `\nStarting invariant testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "seed", "path"],
      ["node", "app.js", "example", "counter", "--seed=123", "--path=84:0"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using seed: 123`,
        `Using path: 84:0`,
        `\nStarting invariant testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "path"],
      ["node", "app.js", "example", "counter", "--path=84:0"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using path: 84:0`,
        `\nStarting invariant testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "type=invariant"],
      ["node", "app.js", "example", "counter", "--type=invariant"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `\nStarting invariant testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "type=test"],
      ["node", "app.js", "example", "counter", "--type=test"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `\nStarting property testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "seed", "path", "type=test"],
      [
        "node",
        "app.js",
        "example",
        "counter",
        "--seed=123",
        "--path=84:0",
        "--type=test",
      ],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using seed: 123`,
        `Using path: 84:0`,
        `\nStarting property testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "seed", "path", "type=invariant"],
      [
        "node",
        "app.js",
        "example",
        "counter",
        "--seed=123",
        "--path=84:0",
        "--type=test",
      ],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using seed: 123`,
        `Using path: 84:0`,
        `\nStarting property testing type for the counter contract...`,
      ],
    ],
  ])(
    "logs the correct values when arguments %p are provided",
    async (_testCase: string[], argv: string[], expectedLogs: string[]) => {
      // Arrange
      process.argv = argv;
      const consoleLogs: string[] = [];
      jest.spyOn(console, "log").mockImplementation((message: string) => {
        consoleLogs.push(message);
      });
      jest.spyOn(console, "error").mockImplementation(() => {});

      // Act
      try {
        await main();
      } catch {
        // Do nothing.
      }

      // Assert
      expectedLogs.forEach((expectedLog) => {
        expect(consoleLogs).toContain(expectedLog);
      });

      process.argv = initialArgv;
      jest.restoreAllMocks();
    }
  );
});