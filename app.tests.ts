import { main } from "./app";

describe("Command-line arguments handling", () => {
  const initialArgv = process.argv;
  const helpMessage = `
  Usage: ./rv <path-to-clarinet-project> <contract-name> <type> [--seed=<seed>] [--path=<path>] [--runs=<runs>]

  Positional arguments:
    path-to-clarinet-project - The path to the Clarinet project.
    contract-name - The name of the contract to be fuzzed.
    type - The type to use for exercising the contracts. Possible values: test, invariant.

  Options:
    --seed - The seed to use for the replay functionality.
    --path - The path to use for the replay functionality.
    --runs - The runs to use for iterating over the tests. Default: 100.
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
        `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`,
        helpMessage,
      ],
    ],
    [
      ["manifest path", "contract name", "seed"],
      ["node", "app.js", "example", "counter", "--seed=123"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using seed: 123`,
        `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`,
        helpMessage,
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
        `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`,
        helpMessage,
      ],
    ],
    [
      ["manifest path", "contract name", "runs"],
      ["node", "app.js", "example", "counter", "--runs=10"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using runs: 10`,
        `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`,
        helpMessage,
      ],
    ],
    [
      ["manifest path", "contract name", "path"],
      ["node", "app.js", "example", "counter", "--path=84:0"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using path: 84:0`,
        `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`,
        helpMessage,
      ],
    ],
    [
      ["manifest path", "contract name", "seed", "path", "runs"],
      [
        "node",
        "app.js",
        "example",
        "counter",
        "--seed=123",
        "--path=84:0",
        "--runs=10",
      ],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using seed: 123`,
        `Using path: 84:0`,
        `Using runs: 10`,
        `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`,
        helpMessage,
      ],
    ],
    [
      ["manifest path", "contract name", "type=invariant"],
      ["node", "app.js", "example", "counter", "invariant"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `\nStarting invariant testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "type=InVaRiAnT (case-insensitive)"],
      ["node", "app.js", "example", "counter", "InVaRiAnT"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `\nStarting invariant testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "type=test"],
      ["node", "app.js", "example", "counter", "test"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `\nStarting property testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "type=tESt (case-insensitive)"],
      ["node", "app.js", "example", "counter", "tESt"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `\nStarting property testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "type=invariant", "seed", "path"],
      [
        "node",
        "app.js",
        "example",
        "counter",
        "invariant",
        "--seed=123",
        "--path=84:0",
      ],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using seed: 123`,
        `Using path: 84:0`,
        `\nStarting invariant testing type for the counter contract...`,
      ],
    ],
    [
      [
        "manifest path",
        "contract name",
        "type=invARiaNT (case-insensitive)",
        "seed",
        "path",
      ],
      [
        "node",
        "app.js",
        "example",
        "counter",
        "invARiaNT",
        "--seed=123",
        "--path=84:0",
      ],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using seed: 123`,
        `Using path: 84:0`,
        `\nStarting invariant testing type for the counter contract...`,
      ],
    ],
    [
      ["manifest path", "contract name", "type=test", "seed", "path"],
      [
        "node",
        "app.js",
        "example",
        "counter",
        "test",
        "--seed=123",
        "--path=84:0",
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
      ["manifest path", "contract name = reverse", "type=test", "seed", "path"],
      [
        "node",
        "app.js",
        "example",
        "reverse",
        "test",
        "--seed=123",
        "--path=84:0",
      ],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: reverse`,
        `Using seed: 123`,
        `Using path: 84:0`,
        `\nStarting property testing type for the reverse contract...`,
      ],
    ],
    [
      ["manifest path", "contract name = slice", "type=test", "seed", "path"],
      [
        "node",
        "app.js",
        "example",
        "slice",
        "test",
        "--seed=123",
        "--path=84:0",
      ],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: slice`,
        `Using seed: 123`,
        `Using path: 84:0`,
        `\nStarting property testing type for the slice contract...`,
      ],
    ],
    [
      [
        "manifest path",
        "contract name",
        "type=teSt (case-insensitive)",
        "seed",
        "path",
      ],
      [
        "node",
        "app.js",
        "example",
        "counter",
        "teSt",
        "--seed=123",
        "--path=84:0",
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
