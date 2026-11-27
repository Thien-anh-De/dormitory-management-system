/**
 * Verify a Cloudflare Turnstile token on the server.
 * Supports temporary load-test bypass ONLY when LOAD_TEST_BYPASS_SECRET is set.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  bypassHeader?: string | null
): Promise<boolean> {
  const bypassSecret = process.env.LOAD_TEST_BYPASS_SECRET;
  if (bypassSecret && bypassHeader && bypassHeader === bypassSecret) {
    return true;
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey || !token) {
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
