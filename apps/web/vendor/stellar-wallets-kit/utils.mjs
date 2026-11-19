function parseError(e) {
  return {
    code: e?.error?.code || e?.code || -1,
    message: e?.error?.message || e?.message || typeof e === "string" && e || "Unhandled error from the wallet",
    ext: e?.error?.ext || e?.ext
  };
}

export { parseError };
