const LOCAL_ORIGIN = "http://localhost:5173";

function corsOptions(env = process.env) {
  const configuredOrigins = env.CORS_ALLOWED_ORIGINS;
  if (env.NODE_ENV === "production" && !configuredOrigins?.trim()) {
    throw new Error("CORS_ALLOWED_ORIGINS is required in production");
  }

  const origins = (configuredOrigins ?? LOCAL_ORIGIN).split(",").map((value) => {
    const origin = value.trim();
    const url = URL.parse(origin);

    if (!url || !["http:", "https:"].includes(url.protocol) || url.origin !== origin) {
      throw new Error("CORS_ALLOWED_ORIGINS must contain comma-separated HTTP(S) origins without paths or wildcards");
    }

    return origin;
  });

  const trustedOrigins = new Set(origins);
  return {
    origin(origin, callback) {
      callback(null, trustedOrigins.has(origin));
    },
    credentials: true,
  };
}

module.exports = corsOptions;
