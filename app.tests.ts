import { red } from "ansicolor";
import {
  getManifestFileName,
  invalidRemoteDataErrorMessage,
  main,
  noRemoteData,
  tryParseRemoteDataSettings,
} from "./app";
import { RemoteDataSettings } from "./app.types";
import { version } from "./package.json";
import { resolve } from "path";
import fs from "fs";
import EventEmitter from "events";

const clarinetTomlRemoteData = {
  correctSettings: {
    toml: `
[repl.remote_data]
api_url = 'https://api.hiro.so'
enabled = true
initial_height = 150000
`,
    expectedRemoteDataSettings: {
      enabled: true,
      api_url: "https://api.hiro.so",
      initial_height: 150000,
    },
  },
  noInitialHeightSettings: {
    toml: `
[repl.remote_data]
api_url = 'https://api.hiro.so'
enabled = true
`,
    expectedRemoteDataSettings: noRemoteData,
  },
  noRemoteDataSettings: {
    toml: ``,
    expectedRemoteDataSettings: noRemoteData,
  },
};

describe("Command-line arguments handling", () => {
  const initialArgv = process.argv;

  const helpMessage = `
  rv v${version}
  
  Usage: rv <path-to-clarinet-project> <contract-name> <type> [--seed=<seed>] [--path=<path>] [--runs=<runs>] [--dial=<path-to-dialers-file>] [--help]

  Positional arguments:
    path-to-clarinet-project - The path to the Clarinet project.
    contract-name - The name of the contract to be fuzzed.
    type - The type to use for exercising the contracts. Possible values: test, invariant.

  Options:
    --seed - The seed to use for the replay functionality.
    --path - The path to use for the replay functionality.
    --runs - The runs to use for iterating over the tests. Default: 100.
    --dial – The path to a JavaScript file containing custom pre- and post-execution functions (dialers).
    --help - Show the help message.
  `;
  const noManifestMessage = red(
    `\nNo path to Clarinet project provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities.`
  );
  const noContractNameMessage = red(
    `\nNo target contract name provided. Please provide the contract name to be fuzzed.`
  );

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
      ["no command-line arguments"],
      ["node", "app.js"],
      [noManifestMessage, helpMessage],
    ],
    [
      ["manifest path"],
      ["node", "app.js", "example"],
      [noContractNameMessage, helpMessage],
    ],
    [
      ["manifest path", "contract name"],
      ["node", "app.js", "example", "counter"],
      [
        red(
          `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`
        ),
        helpMessage,
      ],
    ],
    [
      ["manifest path", "contract name", "seed"],
      ["node", "app.js", "example", "counter", "--seed=123"],
      [
        red(
          `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`
        ),
        helpMessage,
      ],
    ],
    [
      ["manifest path", "contract name", "seed", "path"],
      ["node", "app.js", "example", "counter", "--seed=123", "--path=84:0"],
      [
        red(
          `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`
        ),
        helpMessage,
      ],
    ],
    [
      ["manifest path", "contract name", "runs"],
      ["node", "app.js", "example", "counter", "--runs=10"],
      [
        red(
          `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`
        ),
        helpMessage,
      ],
    ],
    [
      ["manifest path", "contract name", "path"],
      ["node", "app.js", "example", "counter", "--path=84:0"],
      [
        red(
          `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`
        ),
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
        red(
          `\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant.`
        ),
        helpMessage,
      ],
    ],
    [
      ["manifest path", "contract name", "type=invariant"],
      ["node", "app.js", "example", "counter", "invariant"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `\nStarting invariant testing type for the counter contract...\n`,
      ],
    ],
    [
      ["manifest path", "contract name", "type=InVaRiAnT (case-insensitive)"],
      ["node", "app.js", "example", "counter", "InVaRiAnT"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `\nStarting invariant testing type for the counter contract...\n`,
      ],
    ],
    [
      ["manifest path", "contract name", "type=invariant", "dialers file path"],
      [
        "node",
        "app.js",
        "example",
        "counter",
        "invariant",
        "--dial=example/sip010.js",
      ],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using dial path: example/sip010.js`,
        `\nStarting invariant testing type for the counter contract...\n`,
      ],
    ],
    [
      ["manifest path", "contract name", "type=test"],
      ["node", "app.js", "example", "counter", "test"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `\nStarting property testing type for the counter contract...\n`,
      ],
    ],
    [
      ["manifest path", "contract name", "type=tESt (case-insensitive)"],
      ["node", "app.js", "example", "counter", "tESt"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `\nStarting property testing type for the counter contract...\n`,
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
        `\nStarting invariant testing type for the counter contract...\n`,
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
        `\nStarting invariant testing type for the counter contract...\n`,
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
        `\nStarting property testing type for the counter contract...\n`,
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
        `\nStarting property testing type for the reverse contract...\n`,
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
        `\nStarting property testing type for the slice contract...\n`,
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
        `\nStarting property testing type for the counter contract...\n`,
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

describe("Custom manifest detection", () => {
  it("returns the default manifest file name for the example project", () => {
    // Arrange
    const manifestDir = "example";
    const targetContractName = "counter";

    // Act
    const actual = getManifestFileName(manifestDir, targetContractName);

    // Assert
    expect(actual).toBe("Clarinet.toml");
  });

  it("returns the custom manifest file name when it exists", () => {
    // Setup
    const manifestDir = "d290f1ee-6c54-4b01-90e6-d701748f0851";
    const targetContractName = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

    const expected = `Clarinet-${targetContractName}.toml`;
    const expectedPath = resolve(manifestDir, expected);

    jest
      .spyOn(fs, "existsSync")
      .mockImplementation((p: fs.PathLike) => p.toString() === expectedPath);

    // Exercise
    const actual = getManifestFileName(manifestDir, targetContractName);

    // Verify
    expect(actual).toBe(expected);

    // Teardown
    jest.restoreAllMocks();
  });
});

describe("Remote data settings parsing", () => {
  it.each([
    [
      "correctly overrides the no remote data settings when the remote data settings are not provided",
      clarinetTomlRemoteData.noRemoteDataSettings.toml,
      clarinetTomlRemoteData.noRemoteDataSettings.expectedRemoteDataSettings,
    ],
    [
      "correctly parses the remote data settings when they are provided",
      clarinetTomlRemoteData.correctSettings.toml,
      clarinetTomlRemoteData.correctSettings.expectedRemoteDataSettings,
    ],
  ])(
    "%s",
    (
      _testCase: string,
      tomlContent: string,
      processedRemoteDataSettings: RemoteDataSettings
    ) => {
      // Setup
      const anyPath = `${Date.now()}.toml`;

      jest
        .spyOn(fs, "readFileSync")
        .mockImplementation((path: fs.PathOrFileDescriptor) => {
          expect(path).toBe(resolve(anyPath));
          return tomlContent;
        });

      // Exercise
      const actual = tryParseRemoteDataSettings(anyPath, new EventEmitter());

      // Verify
      expect(actual).toEqual(processedRemoteDataSettings);

      // Teardown
      jest.restoreAllMocks();
    }
  );

  it("throws an error when the remote data settings are not properly set up", () => {
    // Setup
    const anyPath = `${Date.now()}.toml`;

    jest
      .spyOn(fs, "readFileSync")
      .mockImplementation((path: fs.PathOrFileDescriptor) => {
        expect(path).toBe(resolve(anyPath));
        return clarinetTomlRemoteData.noInitialHeightSettings.toml;
      });

    // Exercise
    const act = () => tryParseRemoteDataSettings(anyPath, new EventEmitter());

    // Verify
    expect(act).toThrow(invalidRemoteDataErrorMessage);

    // Teardown
    jest.restoreAllMocks();
  });
});
