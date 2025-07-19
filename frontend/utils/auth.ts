const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export async function refreshTokenIfNeeded(): Promise<string | null> {
  const token = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refresh_token");
  
  if (!token || !refreshToken) {
    return null;
  }

  try {
    // Try to refresh the token
    const res = await fetch(`${backendUrl}/api/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return data.token;
    } else {
      // Refresh failed, clear tokens and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
      return null;
    }
  } catch (error) {
    console.error("Token refresh failed:", error);
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
    return null;
  }
}

export async function getValidToken(): Promise<string | null> {
  const token = localStorage.getItem("token");
  if (!token) {
    return null;
  }
  return token;
} 