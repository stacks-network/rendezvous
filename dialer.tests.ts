import { join } from "path";
import { DialerRegistry } from "./dialer";
import { existsSync } from "fs";

const dialPath = join("example", "dialer.ts");

describe("DialerRegistry interaction", () => {
  it("initializes the dialer registry with the dialer file", async () => {
    // Act
    const actual = new DialerRegistry(dialPath);

    // Assert
    expect(actual).toBeInstanceOf(DialerRegistry);
  });

  it("correctly executes registered pre-dialer", async () => {
    // Arrange
    const mockPreDialer = jest.fn();
    const dialerRegistry = new DialerRegistry(dialPath);
    dialerRegistry.registerPreDialer(mockPreDialer);

    // Act
    await dialerRegistry.executePreDialers({});

    // Assert
    expect(mockPreDialer).toHaveBeenCalledTimes(1);
  });

  it("correctly executes registered post-dialer", async () => {
    // Arrange
    const mockPostDialer = jest.fn();
    const dialerRegistry = new DialerRegistry(dialPath);
    dialerRegistry.registerPostDialer(mockPostDialer);

    // Act
    await dialerRegistry.executePostDialers({});

    // Assert
    expect(mockPostDialer).toHaveBeenCalledTimes(1);
  });

  it("all the pre-dialers are executed", async () => {
    // Arrange
    const mockPreDialer1 = jest.fn();
    const mockPreDialer2 = jest.fn();
    const registry = new DialerRegistry(dialPath);

    registry.registerPreDialer(mockPreDialer1);
    registry.registerPreDialer(mockPreDialer2);

    // Act
    await registry.executePreDialers({});

    // Assert
    expect(mockPreDialer1).toHaveBeenCalledTimes(1);
    expect(mockPreDialer2).toHaveBeenCalledTimes(1);
  });

  it("all the post-dialers are executed", async () => {
    // Arrange
    const mockPostDialer1 = jest.fn();
    const mockPostDialer2 = jest.fn();
    const registry = new DialerRegistry(dialPath);

    registry.registerPostDialer(mockPostDialer1);
    registry.registerPostDialer(mockPostDialer2);

    // Act
    await registry.executePostDialers({});

    // Assert
    expect(mockPostDialer1).toHaveBeenCalledTimes(1);
    expect(mockPostDialer2).toHaveBeenCalledTimes(1);
  });

  it("early exits when specified dialer file is not found", async () => {
    // Arrange
    jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit was called");
    });
    const registry = new DialerRegistry("non-existent.js");

    // Act & Assert
    expect(registry.registerDialers()).rejects.toThrow(
      "process.exit was called"
    );
  });
});
