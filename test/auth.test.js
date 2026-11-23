const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { test } = require("node:test");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../src/models/user.model");
const { registerUser, loginUser, logoutUser } = require("../src/controller/auth.controller");
const { auth } = require("../src/middlewares/auth.middleware");
const { adminRoleCheck } = require("../src/middlewares/admin.middleware");

const userId = "000000000000000000000001";
const username = "test-customer";
const email = "customer@example.invalid";
const password = "fixture-password";
const sevenDaysInSeconds = 7 * 24 * 60 * 60;

function useTestSecret(t) {
    const previousSecret = process.env.JWT_SECRET;
    const secret = randomUUID();
    process.env.JWT_SECRET = secret;
    t.after(() => {
        if (previousSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = previousSecret;
        }
    });
    return secret;
}

function invoke(handler, req) {
    return new Promise((resolve, reject) => {
        const res = {
            status(code) {
                this.statusCode = code;
                return this;
            },
            cookie(name, value, options) {
                this.tokenCookie = { name, value, options };
                return this;
            },
            clearCookie(name, options) {
                this.clearedCookie = { name, options };
                return this;
            },
            json(body) {
                resolve({
                    statusCode: this.statusCode,
                    body: JSON.parse(JSON.stringify(body)),
                    tokenCookie: this.tokenCookie,
                    clearedCookie: this.clearedCookie,
                });
                return this;
            },
        };
        Promise.resolve(handler(req, res, (error) => {
            if (error) reject(error);
            else resolve({ continued: true });
        })).catch(reject);
    });
}

test("registration assigns the customer role and returns only public user fields", async (t) => {
    const secret = useTestSecret(t);
    t.mock.method(User, "findOne", async () => null);
    const createUser = t.mock.method(User, "create", async (fields) => (
        new User({ ...fields, _id: userId })
    ));

    const response = await invoke(registerUser, {
        body: { username, email, password, role: "admin" },
    });

    assert.equal(response.statusCode, 201);
    const [persistedFields] = createUser.mock.calls[0].arguments;
    assert.equal(persistedFields.role, "user");
    assert.ok(await bcrypt.compare(password, persistedFields.password));
    assert.deepEqual(response.body.data, { _id: userId, username, email, role: "user" });
    const claims = jwt.verify(response.tokenCookie.value, secret);
    assert.equal(claims.role, "user");
    assert.equal(claims.exp - claims.iat, sevenDaysInSeconds);
});

test("login returns safe user data and preserves the admin role until the token expires", async (t) => {
    const secret = useTestSecret(t);
    const passwordHash = await bcrypt.hash(password, 4);
    const user = new User({ _id: userId, username, email, password: passwordHash, role: "admin" });
    t.mock.method(User, "findById", () => ({
  select: async () => user,
}));
    t.mock.method(User, "findOne", async () => user);

    const response = await invoke(loginUser, { body: { email, password } });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, { _id: userId, username, email, role: "admin" });
    assert.equal(response.tokenCookie.name, "token");
    const token = response.tokenCookie.value;
    const claims = jwt.verify(token, secret);
    assert.equal(claims.role, "admin");
    assert.equal(claims.exp - claims.iat, sevenDaysInSeconds);
    assert.equal(response.tokenCookie.options.maxAge, sevenDaysInSeconds * 1000);

    assert.deepEqual(await invoke(auth, { cookies: { token } }), { continued: true });

    t.mock.method(Date, "now", () => claims.exp * 1000);
    const expired = await invoke(auth, { cookies: { token } });
    assert.equal(expired.statusCode, 401);
    assert.equal(expired.body.success, false);
});

const invalidTokens = [
    {
        name: "a signed legacy admin token without an expiration",
        sign: (secret) => jwt.sign({ id: userId, role: "admin" }, secret),
    },
    {
        name: "a token with a nonnumeric expiration",
        sign: (secret) => jwt.sign('{"exp":"later"}', secret, { header: { typ: "JWT" } }),
    },
    {
        name: "a token with a nonfinite expiration",
        sign: (secret) => jwt.sign('{"exp":1e400}', secret, { header: { typ: "JWT" } }),
    },
    {
        name: "an expired token",
        sign: (secret) => jwt.sign({ id: userId }, secret, { expiresIn: -60 }),
    },
    {
        name: "an unexpired token with an invalid signature",
        sign: () => jwt.sign({ id: userId }, randomUUID(), { expiresIn: "7d" }),
    },
];

for (const { name, sign } of invalidTokens) {
    test(`authentication rejects ${name}`, async (t) => {
        const secret = useTestSecret(t);
        const req = { cookies: { token: sign(secret) } };

        const response = await invoke(auth, req);

        assert.equal(response.statusCode, 401);
        assert.equal(response.body.success, false);
        assert.equal(req.user, undefined);
    });
}

test("authentication accepts a valid unexpired token", async (t) => {
    const secret = useTestSecret(t);
    const token = jwt.sign({ id: userId, role: "user" }, secret, { expiresIn: "7d" });
    const req = { cookies: { token } };
    const user = {
  _id: userId,
  role: "user",
};

t.mock.method(User, "findById", () => ({
  select: async () => user,
}));
    assert.deepEqual(await invoke(auth, req), { continued: true });
    assert.equal(req.user.id, userId);
    assert.equal(req.user.role, "user");
});

for (const environment of ["production", "development"]) {
    test(`registration, login, and logout use matching cookie attributes in ${environment}`, async (t) => {
        const previous = process.env.NODE_ENV;
        process.env.NODE_ENV = environment;
        t.after(() => {
            if (previous === undefined) delete process.env.NODE_ENV;
            else process.env.NODE_ENV = previous;
        });
        useTestSecret(t);
        const passwordHash = await bcrypt.hash(password, 4);
        const user = new User({ _id: userId, username, email, password: passwordHash });
        const lookup = t.mock.method(User, "findOne", async () => null);
        t.mock.method(User, "create", async () => user);

        const registration = await invoke(registerUser, { body: { username, email, password } });
        lookup.mock.mockImplementation(async () => user);
        const login = await invoke(loginUser, { body: { email, password } });
        const logout = await invoke(logoutUser, {});
        const attributes = {
            httpOnly: true,
            secure: environment === "production",
            sameSite: "lax",
            path: "/",
        };

        for (const cookie of [registration.tokenCookie, login.tokenCookie]) {
            assert.equal(cookie.name, "token");
            assert.deepEqual(cookie.options, { ...attributes, maxAge: sevenDaysInSeconds * 1000 });
        }
        assert.deepEqual(logout.clearedCookie, { name: "token", options: attributes });
    });
}

test("stale admin token cannot access admin routes after demotion", async (t) => {
  const secret = useTestSecret(t);

  const token = jwt.sign(
    { id: userId, role: "admin" },
    secret,
    { expiresIn: "7d" }
  );

  const currentUser = {
    _id: userId,
    role: "user",
  };

  t.mock.method(User, "findById", () => ({
    select: async () => currentUser,
  }));

  const req = {
    cookies: { token },
  };

  const authResult = await invoke(auth, req);
  assert.deepEqual(authResult, { continued: true });

  // The database role, not the stale JWT role, must be used.
  assert.equal(req.user.role, "user");

  const adminResult = await invoke(adminRoleCheck, req);

  assert.equal(adminResult.statusCode, 403);
  assert.equal(adminResult.body.success, false);
});

test("authentication rejects a valid token when the account no longer exists", async (t) => {
  const secret = useTestSecret(t);

  const token = jwt.sign(
    { id: userId, role: "admin" },
    secret,
    { expiresIn: "7d" }
  );

  t.mock.method(User, "findById", () => ({
    select: async () => null,
  }));

  const result = await invoke(auth, {
    cookies: { token },
  });

  assert.equal(result.statusCode, 401);
  assert.equal(result.body.success, false);
});

test("authentication fails closed when the database lookup fails", async (t) => {
  const secret = useTestSecret(t);

  const token = jwt.sign(
    { id: userId, role: "admin" },
    secret,
    { expiresIn: "7d" }
  );

  t.mock.method(User, "findById", () => ({
    select: async () => {
      throw new Error("Database unavailable");
    },
  }));

  const req = {
    cookies: { token },
  };

  const result = await invoke(auth, req);

  assert.equal(result.statusCode, 500);
  assert.equal(result.body.success, false);
  assert.equal(req.user, undefined);
});
