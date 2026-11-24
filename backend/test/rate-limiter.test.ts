import assert from "node:assert/strict";
import test from "node:test";
import { ipBucket } from "../rate-limiter.js";

test("IP buckets group IPv6 by /64 and IPv4 by address", () => {
  const bucket = ipBucket("2001:0DB8:0:1:ABCD:1234:5678:9ABC");
  assert.equal(ipBucket("2001:db8:0:1::2"), bucket);
  assert.notEqual(ipBucket("2001:db8:0:2::2"), bucket);
  assert.equal(ipBucket("192.0.2.1"), "192.0.2.1");
  assert.equal(ipBucket("::FFFF:192.0.2.1"), "192.0.2.1");
  assert.equal(ipBucket("::ffff:c000:201"), "192.0.2.1");
});
