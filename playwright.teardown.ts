import { request } from "@playwright/test";

async function globalTeardown() {
  console.log(
    "Shutting down the webServer gracefully to generate NYC coverage...",
  );
  const reqContext = await request.newContext();
  try {
    await reqContext.get("http://localhost:3000/api/v1/health/shutdown");
  } catch (err) {
    // It's expected to potentially get ECONNRESET if the server closes the socket
  }

  // Wait a bit to ensure the server had time to flush NYC output
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

export default globalTeardown;
