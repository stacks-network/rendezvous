import fc from "fast-check";
import { compareGenerators } from "./sample";
import { hexaStringGenerator } from "./shared";

describe("Fast-check deprecated generators replacement validation", () => {
  const charSet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

  it("string-ascii Clarity type corresponding generator", () => {
    fc.assert(
      fc.property(fc.nat(), (length) => {
        const deprecatedGenerator = fc.stringOf(fc.constantFrom(...charSet), {
          maxLength: length,
          minLength: 0,
        });

        const replacementGenerator = fc.string({
          unit: fc.constantFrom(...charSet),
          maxLength: length,
        });

        const comparisonResults = compareGenerators(
          deprecatedGenerator,
          replacementGenerator
        );
        const isMatching = comparisonResults.every(
          (result) => result.match.matches
        );
        const mismatchedItems = comparisonResults.flatMap(
          (result) => result.match.mismatchedItems
        );

        expect(mismatchedItems).toEqual([]);
        expect(isMatching).toBe(true);
      })
    );
  });

  it("buff Clarity type corresponding generator", () => {
    fc.assert(
      fc.property(fc.nat(), (length) => {
        const deprecatedGenerator = fc.hexaString({ maxLength: 2 * length });

        const replacementGenerator = hexaStringGenerator({
          maxLength: 2 * length,
        });

        const comparisonResults = compareGenerators(
          deprecatedGenerator,
          replacementGenerator
        );

        const isMatching = comparisonResults.every(
          (result) => result.match.matches
        );
        const mismatchedItems = comparisonResults.flatMap(
          (result) => result.match.mismatchedItems
        );

        expect(mismatchedItems).toEqual([]);
        expect(isMatching).toBe(true);
      })
    );
  });
});
