const { cvToHex } = require("@stacks/transactions");

async function postTransferSip010PrintEvent(context) {
  const selectedFunction = context.selectedFunction;
  // A fungible token complies with the SIP-010 standard if the transfer event
  // always emits the print event with the `memo` content.
  if (selectedFunction.name !== "transfer") {
    return;
  }

  const functionCall = context.functionCall;
  const functionCallEvents = functionCall.events;

  if (functionCallEvents.length === 0) {
    throw new Error(
      "No transfer events. The transfer function must emit the SIP-010 print event!"
    );
  }

  // The `memo` parameter is the fourth parameter of the `transfer` function.
  const memoParameterIndex = 3;

  const memoArg = context.clarityValueArguments[memoParameterIndex];

  // The `memo` argument is optional. If `none`, nothing has to be printed.
  if (memoArg.type === 9) {
    return;
  }

  // The `memo` argument must be `some`. Otherwise, the generated clarity
  // argument is invalid.
  if (memoArg.type !== 10) {
    return;
  }

  // Turn the inner value of the `some` type into a hex to compare it with the
  // print event data.
  const hexMemoArgValue = cvToHex(memoArg.value);

  const sip010PrintEvent = functionCallEvents.find(
    (ev) => ev.event === "print_event"
  );

  if (!sip010PrintEvent) {
    throw new Error(
      "No print event found. The transfer function must emit the SIP-010 print event!"
    );
  }

  const sip010PrintEventValue = sip010PrintEvent.data.raw_value;

  if (sip010PrintEventValue !== hexMemoArgValue) {
    throw new Error(
      `The print event memo value is not equal to the memo parameter value: ${hexMemoArgValue} !== ${sip010PrintEventValue}`
    );
  }

  return;
}

module.exports = {
  postTransferSip010PrintEvent,
};
