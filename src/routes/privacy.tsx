import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — KudiLens" },
      {
        name: "description",
        content:
          "How KudiLens collects, uses, protects and deletes your personal and financial data.",
      },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="14 October 2026">
      <p>
        KudiLens helps you understand and plan your money. To do that you give us personal and
        financial information. This policy explains what we collect, why, who it's shared with, and
        the choices you have. It is written to meet the Nigeria Data Protection Act 2023 (NDPA) and,
        for users elsewhere, similar laws such as the UK and EU GDPR.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <b>Account details:</b> your email address and sign-in method (email and password, or
          Google).
        </li>
        <li>
          <b>Profile:</b> name, age, retirement age, country, base currency and your planning
          assumptions.
        </li>
        <li>
          <b>Financial information you enter or import:</b> income, spending, accounts, investments,
          property, debts, goals, family members' ages and costs, and bank statement transactions
          you upload.
        </li>
        <li>
          <b>Content you create:</b> questions to the Ask Kudi advisor, investment ideas, reviews
          and notes.
        </li>
        <li>
          <b>Settings kept only on your device:</b> theme, privacy mode, app-lock PIN (stored as a
          one-way hash, never the PIN itself) and install preferences. These never leave your
          device.
        </li>
      </ul>
      <p>
        We don't collect your bank login details, card numbers or BVN, and we never ask for them.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>
          To run the app: show your dashboard, forecasts, plans and insights (performance of our
          contract with you).
        </li>
        <li>
          To keep your account secure, including two-step login and app lock (legitimate interest).
        </li>
        <li>
          To answer your questions in Ask Kudi and generate insights (performance of contract).
        </li>
        <li>To meet legal obligations.</li>
      </ul>
      <p>We don't sell your data and we don't use it for advertising.</p>

      <h2>Who we share it with</h2>
      <ul>
        <li>
          <b>Hosting and database:</b> Lovable Cloud (built on Supabase) stores your account and
          data.
        </li>
        <li>
          <b>AI processing:</b> when you use Ask Kudi or AI insights, a summary of your numbers is
          sent to Lovable's AI gateway to generate the answer. Family members' names are never
          included.
        </li>
        <li>
          <b>Market data:</b> we fetch exchange rates, fund prices (Yahoo Finance) and the SEC
          Nigeria weekly fund report. No personal data is sent to these sources.
        </li>
      </ul>
      <p>
        These providers may process data outside Nigeria. Where they do, we rely on the safeguards
        the NDPA allows, such as contractual protections.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while your account is open. When you delete your account in Settings, your
        data is deleted from our database straight away; backups held by our hosting provider expire
        on their normal schedule.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>See and download your data: Settings → Your data → Download my data.</li>
        <li>Correct it: edit anything in My numbers.</li>
        <li>Delete it: Settings → Your data → Delete my account.</li>
        <li>Object to or restrict processing, and withdraw consent at any time.</li>
        <li>
          Complain to the Nigeria Data Protection Commission (NDPC), or your local data protection
          authority.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit, and each user can only read their own records (row-level
        security). You can add two-step login and an app lock. No system is perfectly secure; tell
        us at once if you think your account has been accessed without your permission.
      </p>

      <h2>Children</h2>
      <p>
        KudiLens is for adults (18+). You may record family members' ages and costs for planning.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We'll tell you in the app before material changes take effect. For privacy questions or
        requests, contact the KudiLens team through the details in the app store listing or the
        app's support page.
      </p>
    </LegalPage>
  );
}
