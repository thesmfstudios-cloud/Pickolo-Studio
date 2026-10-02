// Browser-verification-only demo transport; never load this on a real site.
if (window.location.origin === "http://localhost:3101") {
  const originalFetch = window.fetch.bind(window);
  window.__recoveryDemoRequests = [];
  window.fetch = async (input, init) => {
    const url = String(typeof input === "string" ? input : input.url || input);
    if (!url.startsWith("https://recovery-test.invalid/auth/v1/"))
      return originalFetch(input, init);
    window.__recoveryDemoRequests.push({ url, method: init?.method || "GET" });
    if (url.includes("/user") && (!init?.method || init.method === "GET")) {
      return Response.json({
        id: "11111111-1111-4111-8111-111111111111",
        email: "operator@test.invalid",
        app_metadata: { provider: "email" },
        user_metadata: {},
        aud: "authenticated",
        created_at: "2026-10-01T00:00:00Z",
      });
    }
    return Response.json(
      { message: "Demo transport only permits identity reads." },
      { status: 400 },
    );
  };
}
