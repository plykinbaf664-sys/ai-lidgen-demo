import { argument, readHidden } from "./auth-cli-utils.mjs";

const baseUrl = argument("--base-url", "https://127.0.0.1").replace(/\/$/, "");
const username = argument("--username", "").trim();

if (!username) {
  console.error("Укажите --username.");
  process.exit(1);
}

const password = await readHidden("Пароль (скрытый ввод): ");
const origin = new URL(baseUrl).origin;

async function login(label) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify({ username, password }),
  });
  console.log(`${label}: HTTP ${response.status}`);
  if (response.status !== 200) return null;

  const setCookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie")];
  const sessionCookie = setCookies.find((value) => value?.includes("leadgen_client_session="));
  const flagsValid = Boolean(
    sessionCookie?.includes("HttpOnly") && sessionCookie.includes("Secure") && /SameSite=Lax/i.test(sessionCookie),
  );
  console.log(`${label}_COOKIE: ${flagsValid ? "PASS" : "FAIL"}`);
  if (!sessionCookie || !flagsValid) return null;
  return sessionCookie.split(";", 1)[0];
}

async function openPrivate(cookie, label) {
  const response = await fetch(`${baseUrl}/leadgen`, {
    redirect: "manual",
    headers: { Cookie: cookie },
  });
  console.log(`${label}: HTTP ${response.status}`);
  return response.status === 200;
}

async function logout(cookie) {
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Sec-Fetch-Site": "same-origin",
    },
  });
  const cleared = (response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie")])
    .some((value) => value?.includes("leadgen_client_session=") && /Max-Age=0/i.test(value));
  console.log(`LOGOUT: HTTP ${response.status}, COOKIE ${cleared ? "CLEARED" : "NOT_CLEARED"}`);
  return response.status === 303 && cleared;
}

let success = true;
const firstCookie = await login("LOGIN_1");
if (!firstCookie) {
  console.log("AUTH E2E: FAIL");
  process.exit(1);
}
success &&= await openPrivate(firstCookie, "PRIVATE_PAGE_1");
success &&= await logout(firstCookie);

const secondCookie = await login("LOGIN_2");
success &&= Boolean(secondCookie);
if (secondCookie) success &&= await openPrivate(secondCookie, "PRIVATE_PAGE_2");
success &&= Boolean(firstCookie && secondCookie && firstCookie !== secondCookie);

console.log(`AUTH E2E: ${success ? "PASS" : "FAIL"}`);
process.exit(success ? 0 : 1);
