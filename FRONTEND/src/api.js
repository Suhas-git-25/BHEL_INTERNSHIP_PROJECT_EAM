const API_PREFIX = import.meta.env.VITE_API_BASE_URL || "";

function authHeader() {
  const token = localStorage.getItem("eam_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...authHeader(),
    ...options.headers,
  };

  const body = options.body;
  const isJSON = typeof body === "object" && body !== null && !(body instanceof FormData);
  if (isJSON) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers,
    body: isJSON ? JSON.stringify(body) : body,
  });

  const raw = await res.text();
  let data = null;
  let parseError = "";
  
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (e) {
    const looksLikeHtml = raw.trim().startsWith("<!DOCTYPE") || raw.trim().startsWith("<html");
    parseError = looksLikeHtml
      ? "API returned an HTML page. Check that the backend is running and the API route exists."
      : "Invalid response from server";
    data = {
      error: parseError,
    };
  }

  if (parseError) {
    throw new Error(parseError);
  }

  if (!res.ok) {
    const msg = data?.error || res.statusText || "Request failed";
    throw new Error(msg);
  }

  return data;
}

export function saveSession(token, user) {
  localStorage.setItem("eam_token", token);
  localStorage.setItem("eam_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("eam_token");
  localStorage.removeItem("eam_user");
}

export function loadUser() {
  const raw = localStorage.getItem("eam_user");
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loggedIn() {
  return Boolean(localStorage.getItem("eam_token"));
}

export async function downloadCategorySample(category) {
  const res = await fetch(`${API_PREFIX}/api/import/samples/${category}`, {
    headers: authHeader(),
  });
  if (!res.ok) {
    const raw = await res.text();
    let message = res.statusText;
    try {
      message = JSON.parse(raw).error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.blob();
}

export async function uploadCategoryExcel(category, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_PREFIX}/api/import/${category}`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });
  const raw = await res.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!res.ok) {
    throw new Error(data?.error || "Upload failed");
  }
  return data;
}
