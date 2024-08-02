import { main } from "../app";

// https://blog.codeleak.pl/2021/12/parameterized-tests-with-jest.html
describe("Manifest handling", () => {
  it("throws error when manifest path is not provided", () => {
    expect(async () => await main()).rejects.toThrow(
      "No path to Clarinet.toml manifest provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities."
    );
  });
});
