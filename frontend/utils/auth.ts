const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export async function refreshTokenIfNeeded(): Promise<string | null> {
  const token = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refresh_token");
  console.log('[DEBUG] refreshTokenIfNeeded called. token:', token, 'refreshToken:', refreshToken);
  
  if (!token || !refreshToken) {
    console.warn('[DEBUG] No token or refresh token found.');
    return null;
  }

  try {
    // Try to refresh the token
    const res = await fetch(`${backendUrl}/api/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    console.log('[DEBUG] refreshTokenIfNeeded response:', res);

    if (res.ok) {
      const data = await res.json();
      console.log('[DEBUG] refreshTokenIfNeeded success. New token:', data.token);
      localStorage.setItem("token", data.token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return data.token;
    } else {
      // Refresh failed, clear tokens and redirect to login
      console.error('[DEBUG] Token refresh failed. Clearing tokens.');
      localStorage.removeItem("token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
      return null;
    }
  } catch (error) {
    console.error("[DEBUG] Token refresh failed (exception):", error);
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
    return null;
  }
}

export async function getValidToken(): Promise<string | null> {
  const token = localStorage.getItem("token");
  console.log('[DEBUG] getValidToken called. token:', token);
  if (!token) {
    return null;
  }
  return token;
} 