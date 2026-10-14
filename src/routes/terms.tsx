import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of use — KudiLens" },
      {
        name: "description",
        content: "The terms for using KudiLens, including what the app is and isn't.",
      },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms of use" updated="14 October 2026">
      <p>
        By creating an account or using KudiLens you agree to these terms. If you don't agree,
        please don't use the app.
      </p>

      <h2>What KudiLens is</h2>
      <p>
        KudiLens is a personal finance tool. It organises the numbers you give it and shows
        calculations, forecasts and general information to help you think about your money.
      </p>

      <h2>What KudiLens is not</h2>
      <ul>
        <li>
          <b>Not financial, investment, tax or legal advice.</b> KudiLens is not registered with the
          SEC Nigeria, FCA, SEC (US), CIRO or any other regulator as an adviser, broker or fund
          manager.
        </li>
        <li>
          <b>Forecasts are estimates.</b> They depend on the assumptions you enter and can be wrong.
          Past fund performance doesn't guarantee future returns.
        </li>
        <li>
          <b>Platform and fund listings are information, not recommendations.</b> We don't receive
          payment for them. Check a firm's licence on the regulator's register and read its terms
          before investing.
        </li>
        <li>KudiLens doesn't hold, move or invest your money.</li>
      </ul>
      <p>Consider speaking to a licensed adviser before making important financial decisions.</p>

      <h2>Your account</h2>
      <ul>
        <li>You must be 18 or older.</li>
        <li>Keep your sign-in details safe. We recommend two-step login and the app lock.</li>
        <li>You're responsible for the accuracy of the information you enter.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Don't misuse the service: no attempts to access other people's data, disrupt the app, scrape
        it, or use it for anything unlawful.
      </p>

      <h2>Third-party data</h2>
      <p>
        Exchange rates, fund prices and regulator information come from third parties and may be
        delayed or contain errors. We show the source and date where we can.
      </p>

      <h2>Liability</h2>
      <p>
        KudiLens is provided “as is”. To the extent the law allows, we aren't liable for losses
        arising from decisions you make using the app, or from interruptions or errors in the
        service. Nothing in these terms limits rights you have under consumer protection law that
        can't be limited.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time in Settings. We may suspend accounts that break
        these terms.
      </p>

      <h2>Changes and governing law</h2>
      <p>
        We may update these terms and will tell you in the app before material changes take effect.
        These terms are governed by the laws of the Federal Republic of Nigeria, unless the law
        where you live says otherwise.
      </p>
    </LegalPage>
  );
}
