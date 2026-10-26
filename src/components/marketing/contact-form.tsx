"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { APP_NAME, APP_SUPPORT_EMAIL } from "@/lib/config";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !message.trim()) {
      toast.error("Email and message are required.");
      return;
    }
    const body = [
      name.trim() ? `Name: ${name.trim()}` : null,
      `From: ${email.trim()}`,
      "",
      message.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const mailto = `mailto:${APP_SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject.trim() || `${APP_NAME} support`
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    toast.success("Opening your email client…");
  }

  return (
    <div className="rounded-2xl border border-[var(--mk-line)] bg-white p-6 shadow-[0_20px_50px_-40px_rgba(11,21,38,0.5)] sm:p-8">
      <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--mk-ink)]">
        Send a message
      </h2>
      <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--mk-ink)_55%,transparent)]">
        Submitting opens your email client with a draft to {APP_SUPPORT_EMAIL}.
      </p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-subject">Subject</Label>
          <Input
            id="contact-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Account access, privacy request…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-message">Message</Label>
          <Textarea
            id="contact-message"
            required
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How can we help?"
            className="resize-y"
          />
        </div>
        <Button
          type="submit"
          className="w-full bg-[var(--mk-ink)] text-[var(--mk-paper)] hover:bg-[var(--mk-ink-soft)] sm:w-auto"
        >
          Open email draft
        </Button>
      </form>
    </div>
  );
}
