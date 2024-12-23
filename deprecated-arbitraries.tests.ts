import fc from "fast-check";
import { hexaString } from "./shared";

describe("Fast-check deprecated generators replacement validation", () => {
  it("string-ascii Clarity type corresponding generator", () => {
    // Arrange
    const charSet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
    const size = 100;
    const seed = Math.floor(Math.random() * size);

    const outdated = fc.stringOf(fc.constantFrom(...charSet), {
      maxLength: size,
      minLength: 0,
    });

    const proposed = fc.string({
      unit: fc.constantFrom(...charSet),
      maxLength: size,
    });

    // Act
    const a: string[] = fc.sample(outdated, { seed: seed });
    const b: string[] = fc.sample(proposed, { seed: seed });

    // Assert
    // Strict, same-order comparison.
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("buff Clarity type corresponding generator", () => {
    // Arrange
    const size = 100;
    const seed = Math.floor(Math.random() * size);

    const outdated = fc.hexaString({ maxLength: size });
    const proposed = hexaString({ maxLength: size });

    // Act
    const a: string[] = fc.sample(outdated, { seed: seed });
    const b: string[] = fc.sample(proposed, { seed: seed });

    // Assert
    // Strict, same-order comparison.
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});
