import { test } from "node:test";
import assert from "node:assert/strict";
import { evmAddressToBytes32, waitForAttestation } from "../src/attestation.js";

test("evm address → bytes32 left-padded", () => {
  const b = evmAddressToBytes32("0x000000000000000000000000000000000000dEaD");
  assert.equal(b.length, 32);
  assert.equal(Buffer.from(b).toString("hex"), "000000000000000000000000000000000000000000000000000000000000dead");
  assert.throws(() => evmAddressToBytes32("0x123"));
});

test("polls until status complete, tolerates 404 and PENDING", async () => {
  let n = 0;
  const fetchImpl: typeof fetch = async () => {
    n++;
    if (n === 1) return new Response("", { status: 404 });
    if (n === 2) return new Response(JSON.stringify({ messages: [{ message: "0x01", attestation: "PENDING", status: "pending_confirmations" }] }), { status: 200 });
    return new Response(JSON.stringify({ messages: [{ message: "0x01", attestation: "0xab", status: "complete", eventNonce: "7" }] }), { status: 200 });
  };
  const a = await waitForAttestation({ irisApi: "https://iris.test/", sourceDomain: 5, txHash: "sig", fetchImpl, intervalMs: 1 });
  assert.equal(a.attestation, "0xab");
  assert.equal(n, 3);
});
