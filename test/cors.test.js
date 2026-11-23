const assert = require("node:assert/strict");
const { test } = require("node:test");
const cors = require("cors");
const corsOptions = require("../src/config/cors");

const trusted = "https://campusfest.example.invalid";
const otherTrusted = "https://staff.example.invalid";

function preflight(options, origin) {
  const headers = {};
  const req = { method: "OPTIONS", headers: { origin } };
  const res = {
    getHeader(name) { return headers[name.toLowerCase()]; },
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    end() {},
  };
  cors(options)(req, res, () => {});
  return headers;
}

test("preflight grants credentialed CORS only to exact configured origins", () => {
  const options = corsOptions({
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: `${trusted}, ${otherTrusted}`,
  });

  for (const origin of [trusted, otherTrusted]) {
    const headers = preflight(options, origin);
    assert.equal(headers["access-control-allow-origin"], origin);
    assert.equal(headers["access-control-allow-credentials"], "true");
  }

  for (const origin of [`${trusted}:8443`, `${trusted}.other.invalid`, "http://localhost:5173"]) {
    const headers = preflight(options, origin);
    assert.equal(headers["access-control-allow-origin"], undefined);
    assert.equal(headers["access-control-allow-credentials"], undefined);
  }
});

test("local development keeps the Vite default origin", () => {
  const headers = preflight(corsOptions({}), "http://localhost:5173");
  assert.equal(headers["access-control-allow-origin"], "http://localhost:5173");
});

test("production requires an explicit list and rejects wildcards and malformed origins", () => {
  assert.throws(() => corsOptions({ NODE_ENV: "production" }), /is required/);
  for (const entry of ["*", `${trusted}/api`, `${trusted},`, "null"]) {
    assert.throws(() => corsOptions({ CORS_ALLOWED_ORIGINS: entry }), /HTTP\(S\) origins/);
  }
});
