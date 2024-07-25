import calculator from "./app";

describe("Calculator", () => {
  it("throws error when input.length < 2", () => {
    expect(() => calculator("+", [0])).toThrow(
      "inputs should have length >= 2",
    );
  });

  it("throws error when unsupported operator was used", () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(() => calculator("&", [0, 0])).toThrow("Unknown operator &");
  });

  it("adds 2 or more numbers incl. `NaN` and `Infinity`", () => {
    expect(calculator("+", [1, 41])).toEqual(42);
    expect(calculator("+", [1, 2, 39])).toEqual(42);
    expect(calculator("+", [1, 2, NaN])).toEqual(NaN);
    expect(calculator("+", [1, 2, Infinity])).toEqual(Infinity);
  });

  it("subtracts 2 or more numbers incl. `NaN` and `Infinity`", () => {
    expect(calculator("-", [43, 1])).toEqual(42);
    expect(calculator("-", [44, 1, 1])).toEqual(42);
    expect(calculator("-", [1, 2, NaN])).toEqual(NaN);
    expect(calculator("-", [1, 2, Infinity])).toEqual(-Infinity);
  });

  it("multiplies 2 or more numbers incl. `NaN` and `Infinity`", () => {
    expect(calculator("*", [21, 2])).toEqual(42);
    expect(calculator("*", [3, 7, 2])).toEqual(42);
    expect(calculator("*", [42, NaN])).toEqual(NaN);
    expect(calculator("*", [42, Infinity])).toEqual(Infinity);
  });

  it("divides 2 or more numbers incl. `NaN` and `Infinity`", () => {
    expect(calculator("/", [84, 2])).toEqual(42);
    expect(calculator("/", [42, 0])).toEqual(Infinity);
    expect(calculator("/", [42, NaN])).toEqual(NaN);
    expect(calculator("/", [168, 2, 2])).toEqual(42);
  });
});
