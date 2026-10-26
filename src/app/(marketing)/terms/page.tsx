import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { APP_DOMAIN, APP_NAME, APP_SUPPORT_EMAIL, APP_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms governing use of ${APP_NAME} and mailboxes at ${APP_DOMAIN}.`,
  alternates: { canonical: `${APP_URL}/terms` },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description={`These Terms of Service (“Terms”) govern access to and use of ${APP_NAME} at ${APP_DOMAIN}. By signing in or using the service, you agree to these Terms.`}
      updated="October 27, 2026"
    >
      <h2>1. The service</h2>
      <p>
        {APP_NAME} provides authenticated, receive-only email mailboxes and a web interface
        to read inbound messages. The service is not a general-purpose email provider: users
        cannot send, forward-as-send, or relay outbound mail through the product.
      </p>

      <h2>2. Accounts</h2>
      <p>
        Access is invitation- or staff-provisioned. You must keep credentials confidential,
        use accurate information, and notify us promptly of unauthorized use. You are
        responsible for activity under your account. We may suspend or terminate accounts
        that violate these Terms or pose a security risk.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Attempt to send mail, abuse inbound routing, or circumvent receive-only limits</li>
        <li>Use the service for unlawful, fraudulent, or harmful activity</li>
        <li>Probe, scan, or attack our systems, or bypass authentication or rate limits</li>
        <li>Share access credentials or resell access without our written permission</li>
        <li>Interfere with other users’ mailboxes or the integrity of the service</li>
      </ul>

      <h2>4. Mail content</h2>
      <p>
        You are responsible for how you use information you receive. Message content is
        provided by third-party senders; we do not control what others email to your
        address. We may remove or restrict access to content that violates law or these
        Terms, or that threatens system safety.
      </p>

      <h2>5. Privacy</h2>
      <p>
        Our handling of personal data is described in the{" "}
        <Link href="/privacy">Privacy Policy</Link>, which forms part of these Terms.
      </p>

      <h2>6. Availability and changes</h2>
      <p>
        We aim for reliable availability but do not guarantee uninterrupted service. We may
        modify features, impose limits, perform maintenance, or discontinue parts of the
        service with reasonable notice when practical.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The {APP_NAME} name, branding, software, and site content are owned by us or our
        licensors. You receive a limited, non-exclusive right to use the service as
        provided — not to copy, reverse engineer (except where prohibited by law), or create
        derivative works of our software.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND,
        EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT. WE DO NOT WARRANT THAT INBOUND MAIL WILL ALWAYS BE DELIVERED,
        COMPLETE, OR ERROR-FREE.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, {APP_NAME.toUpperCase()} AND ITS OPERATORS
        WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
        DAMAGES, OR FOR LOST PROFITS, DATA, OR BUSINESS, ARISING FROM YOUR USE OF THE
        SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED
        THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM (OR
        USD $50 IF YOU PAID NOTHING).
      </p>

      <h2>10. Indemnity</h2>
      <p>
        You will defend and indemnify us against claims arising from your misuse of the
        service or violation of these Terms, except to the extent caused by our willful
        misconduct.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws applicable in the jurisdiction where the
        service operator is established, without regard to conflict-of-law rules. Courts in
        that jurisdiction will have exclusive venue, unless applicable consumer law requires
        otherwise.
      </p>

      <h2>12. Changes to Terms</h2>
      <p>
        We may update these Terms. The “Last updated” date will change when we do. If you
        continue using the service after an update, you accept the revised Terms.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href={`mailto:${APP_SUPPORT_EMAIL}`}>{APP_SUPPORT_EMAIL}</a> ·{" "}
        <Link href="/contact">Contact page</Link>
      </p>
    </LegalPage>
  );
}
