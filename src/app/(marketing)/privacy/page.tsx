import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { APP_DOMAIN, APP_NAME, APP_SUPPORT_EMAIL, APP_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${APP_NAME} collects, uses, and protects personal information.`,
  alternates: { canonical: `${APP_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description={`This Privacy Policy explains how ${APP_NAME} (“we”, “us”) handles information when you use ${APP_DOMAIN} and related services.`}
      updated="October 27, 2026"
    >
      <h2>1. Who we are</h2>
      <p>
        {APP_NAME} provides private, receive-only email mailboxes and an authenticated web
        application for reading inbound messages. Contact:{" "}
        <a href={`mailto:${APP_SUPPORT_EMAIL}`}>{APP_SUPPORT_EMAIL}</a>.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Account information</h3>
      <p>
        When an account is provisioned, we store identifiers such as email address / mailbox
        local-part, role (customer, admin, or owner), password hash, optional 2FA secrets,
        and account status (active, suspended, etc.).
      </p>
      <h3>Usage and session data</h3>
      <p>
        We maintain session records, CSRF tokens, approximate login timestamps, and limited
        security audit events (for example account creation or password changes performed by
        staff). We may record technical logs (IP address, user agent) needed to operate and
        secure the service.
      </p>
      <h3>Mailbox content</h3>
      <p>
        Inbound email (headers, subject, body, and related metadata) is stored so you can
        read it in the product. We do not use message content for advertising.
      </p>

      <h2>3. How we use information</h2>
      <ul>
        <li>To authenticate you and provide the inbox and settings experience</li>
        <li>To deliver and display inbound mail associated with your mailbox</li>
        <li>To operate admin tooling for account provisioning and support</li>
        <li>To protect the service against abuse, fraud, and unauthorized access</li>
        <li>To comply with legal obligations when required</li>
      </ul>

      <h2>4. Cookies and similar technologies</h2>
      <p>
        We use essential cookies for signed-in sessions and CSRF protection. These are
        required for the product to function. We do not use third-party advertising cookies
        on the authenticated app.
      </p>

      <h2>5. Sharing</h2>
      <p>
        We do not sell personal information. We may share data with infrastructure providers
        that host or process the service under contract (for example cloud hosting, email
        ingress, or database services), and when required by law or to protect rights and
        safety.
      </p>

      <h2>6. Retention</h2>
      <p>
        Account and mailbox data are retained while the account is active and for a
        reasonable period afterward as needed for backups, dispute resolution, and legal
        compliance. You may request deletion via{" "}
        <a href={`mailto:${APP_SUPPORT_EMAIL}`}>{APP_SUPPORT_EMAIL}</a>; some records may be
        retained where we have a legitimate need or legal duty to keep them.
      </p>

      <h2>7. Security</h2>
      <p>
        We use industry-standard controls including password hashing (Argon2id), HttpOnly
        session cookies, CSRF protections, and HTML sanitization for message display. No
        method of transmission or storage is 100% secure; please use a strong unique
        password and enable 2FA when available.
      </p>

      <h2>8. Your choices</h2>
      <p>
        Depending on your location, you may have rights to access, correct, export, or
        delete personal data, or to object to certain processing. Contact{" "}
        <a href={`mailto:${APP_SUPPORT_EMAIL}`}>{APP_SUPPORT_EMAIL}</a> to make a request. You
        can also review our <Link href="/terms">Terms of Service</Link>.
      </p>

      <h2>9. Children</h2>
      <p>
        The service is not directed to children under 16 (or the equivalent minimum age in
        your jurisdiction). We do not knowingly collect personal information from children.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy from time to time. The “Last updated” date at the top will
        change when we do. Continued use of the service after changes means you accept the
        updated policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${APP_SUPPORT_EMAIL}`}>{APP_SUPPORT_EMAIL}</a> ·{" "}
        <Link href="/contact">Contact page</Link>
      </p>
    </LegalPage>
  );
}
