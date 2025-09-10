// Originally copied from hirosystems clarity-examples repository:
// https://github.com/hirosystems/clarity-examples/blob/ccd9ecf0bf136d7f28ef116706ed2936f6d8781a/examples/stx-defi/tests/stx-defi.test.ts

import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

describe("stx-defi tests", () => {
  it("verifies deposit", () => {
    const depositResponse = simnet.callPublicFn(
      "stx-defi",
      "deposit",
      [Cl.uint(1000)],
      address1
    );
    console.log("deposit response: " + Cl.prettyPrint(depositResponse.result));

    const totalDeposits1 = simnet.getDataVar("stx-defi", "total-deposits");
    expect(totalDeposits1).toBeUint(1000);

    simnet.callPublicFn("stx-defi", "deposit", [Cl.uint(1000)], address1);
    const totalDeposits2 = simnet.getDataVar("stx-defi", "total-deposits");
    expect(totalDeposits2).toBeUint(2000);
  });

  it("borrows 10 and verifies the amount owed to be 10", () => {
    // address1 deposits 1000 to "their principal", which will be "locked" in the contract (on the chain)
    simnet.callPublicFn("stx-defi", "deposit", [Cl.uint(1000)], address1);
    var totalDeposits = simnet.getDataVar("stx-defi", "total-deposits");
    expect(totalDeposits).toBeUint(1000);

    // address1 attempts to borrow 10 from their initial deposit for 1000 (which is "locked" in the contract, on the chain)
    const borrowResponse = simnet.callPublicFn(
      "stx-defi",
      "borrow",
      [Cl.uint(10)],
      address1
    );
    console.log("borrow response: " + Cl.prettyPrint(borrowResponse.result));

    // verify the amount owed is exactly what the address1 borrowed, which is 10 (because borrow and owed check are happening on the
    // "same block", so no interest will be applied)
    const { result } = simnet.callReadOnlyFn(
      "stx-defi",
      "get-amount-owed",
      [],
      address1
    );
    console.log("owed amount: " + Cl.prettyPrint(result));
    expect(result).toBeOk(Cl.uint(10));
  });

  it("verifies repayment is successful", () => {
    simnet.callPublicFn("stx-defi", "deposit", [Cl.uint(1000)], address1);
    const borrowResponse = simnet.callPublicFn(
      "stx-defi",
      "borrow",
      [Cl.uint(10)],
      address1
    );
    expect(borrowResponse).toBeOk;

    const repayResponse = simnet.callPublicFn(
      "stx-defi",
      "repay",
      [Cl.uint(10)],
      address1
    );
    expect(repayResponse).toBeOk;

    const { result } = simnet.callReadOnlyFn(
      "stx-defi",
      "get-amount-owed",
      [],
      address1
    );
    expect(result).toBeOk(Cl.uint(0));
  });

  it("verifies no yields to claim yet", () => {
    simnet.callPublicFn("stx-defi", "deposit", [Cl.uint(1000)], address1);
    const borrowResponse = simnet.callPublicFn(
      "stx-defi",
      "borrow",
      [Cl.uint(10)],
      address1
    );
    expect(borrowResponse).toBeOk;

    const repayResponse = simnet.callPublicFn(
      "stx-defi",
      "repay",
      [Cl.uint(10)],
      address1
    );
    expect(repayResponse).toBeOk;

    const foo = simnet.callPublicFn("stx-defi", "claim-yield", [], address1);
    console.log("yield response : " + Cl.prettyPrint(foo.result));
    // It is expected to error with `u3` (because there is no yeild; ie: value < 0); only when there are claims, which
    // will only occur when the loan was active for some time (for a few blocks in the chain), and that the default
    // 10% loan interest were applied to the principal loan
    expect(foo.result).toBeErr;
  });
});
