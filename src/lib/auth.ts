"use client";

const USERS = [
  { email: "gavin@methodicventures.com", password: "Acquireeverything$!", display_name: "Gavin" },
  { email: "logan@methodicventures.com", password: "Acquireeverything$!", display_name: "Logan" },
  { email: "dean@methodicventures.com",  password: "Acquireeverything$!", display_name: "Dean" },
  { email: "methodicpartners@gmail.com", password: "methodicintern123!",  display_name: "Intern" },
];

const SESSION_KEY = "methodic-session";
const COOKIE_NAME = "methodic-session";

export interface Session { email: string; display_name: string; ts: number }

export function login(email: string, password: string): Session | null {
  const u = USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
  );
  if (!u) return null;
  const session: Session = { email: u.email, display_name: u.display_name, ts: Date.now() };
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    document.cookie = `${COOKIE_NAME}=1; path=/; max-age=2592000; SameSite=Lax`;
  }
  return session;
}

export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
