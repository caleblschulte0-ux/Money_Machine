"use client";

import { useActionState } from "react";
import { submitSignup, type SignupState } from "./actions";

const initial: SignupState = { status: "idle", message: "" };

export function SignupForm({
  slug,
  cta,
  askedFor,
}: {
  slug: string;
  cta: string;
  askedFor: string;
}) {
  const [state, action, pending] = useActionState(submitSignup, initial);

  if (state.status === "ok") {
    return (
      <div className="result ok" role="status">
        <strong>{state.message}</strong>
      </div>
    );
  }

  return (
    <form action={action} className="signup">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="renderedAt" value={Date.now()} />
      {/* Bots fill this; people never see it. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor={`website-${slug}`}>Website</label>
        <input id={`website-${slug}`} type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <label htmlFor={`email-${slug}`}>Email</label>
      <input
        id={`email-${slug}`}
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="you@yourcompany.com"
      />

      <label htmlFor={`name-${slug}`}>Name</label>
      <input id={`name-${slug}`} type="text" name="name" autoComplete="name" placeholder="Optional" />

      {askedFor === "booked_call" && (
        <>
          <label htmlFor={`note-${slug}`}>What are you dealing with?</label>
          <textarea
            id={`note-${slug}`}
            name="note"
            rows={3}
            placeholder="Optional — a sentence helps me come prepared"
          />
        </>
      )}

      <button type="submit" disabled={pending}>
        {pending ? "Sending…" : cta}
      </button>

      {state.status === "error" && (
        <p className="result error" role="alert">
          {state.message}
        </p>
      )}

      <p className="privacy">
        Your email goes to one person, who will reply personally. No list, no automated
        sequence, no sharing with anyone else.
      </p>
    </form>
  );
}
