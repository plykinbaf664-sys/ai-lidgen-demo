"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    if (response.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next?.startsWith("/") && !next.startsWith("//") ? next : "/leadgen");
      return;
    }
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setError(data.error || "Не удалось войти.");
    setPending(false);
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand-row">
          <p className="eyebrow">Leadgen Client</p>
          <span className="login-security-state"><i />Приватный контур</span>
        </div>
        <div className="login-heading">
          <h1>Добро пожаловать</h1>
          <p className="muted">Войдите в закрытую рабочую панель.</p>
        </div>
        <label><span>Логин или email</span><input name="username" required autoComplete="username" /></label>
        <label><span>Пароль</span><input name="password" type="password" required autoComplete="current-password" /></label>
        {error ? <p className="outreach-error" role="alert">{error}</p> : null}
        <button className="ui-button ui-button-primary" disabled={pending} type="submit">
          {pending ? "Входим…" : "Войти"}
        </button>
        <small className="login-footnote">Lead intelligence · Outreach · Follow-up</small>
      </form>
    </main>
  );
}
