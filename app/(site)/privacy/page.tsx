import { Blank, LegalPage, businessLine } from "@/components/site/LegalPage";
import { getPublicStorefront } from "@/lib/data";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Privacy policy", description: "What Iyer Mess collects when you order, why, who processes it, and your rights.", path: "/privacy" });
export const revalidate = 3600;

export default async function PrivacyPage() {
  const { settings: s } = await getPublicStorefront();
  const contact = s.legal.grievance_email || s.support_email;
  return (
    <LegalPage
      title="Privacy policy"
      updated="October 2026"
      intro={<>This explains what {s.shop_name} collects when you use this website, why, who helps us process it, and the choices you have. We only collect what we need to take, deliver and support your orders.</>}
      sections={[
        {
          id: "who",
          title: "Who we are",
          body: (
            <p>
              This website is run by {businessLine(s)} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). For anything about your data, write to <Blank value={contact} label="Privacy contact email" />.
            </p>
          ),
        },
        {
          id: "collect",
          title: "What we collect",
          body: (
            <ul>
              <li><b>Email address</b>: used to log you in, with a one-time code we email you or with your Google account, and for order emails and receipts.</li>
              <li><b>Google profile basics</b>: if you sign in with Google, your name and email from Google (never your password).</li>
              <li><b>Mobile number and name</b>: so we and our delivery team can call or WhatsApp you about your orders.</li>
              <li><b>Delivery addresses</b>: the ones you enter or save as Home, Work or Other, with the map pin.</li>
              <li><b>Your location</b>: only when you tap &ldquo;Use my current location&rdquo; and your browser asks your permission. We use it to set the delivery pin and work out distance. We don&rsquo;t track you in the background.</li>
              <li><b>Orders</b>: items, amounts, delivery or pickup slot, and payment status. Card and UPI details are entered on Razorpay&rsquo;s secure page; we never see your card number or UPI PIN.</li>
              <li><b>Notification settings</b>: if you turn on order notifications, a technical address for your browser so we can send them.</li>
              <li><b>Messages</b> you send through the contact form.</li>
              <li><b>Security logs</b>: IP address and basic request details, kept briefly to stop abuse such as fake orders or repeated login-code requests.</li>
            </ul>
          ),
        },
        {
          id: "use",
          title: "How we use it",
          body: (
            <ul>
              <li>To take, prepare, deliver and support your orders, including calling or messaging you about them.</li>
              <li>To send order updates by email and (if you turned them on) notifications.</li>
              <li>To calculate delivery distance and charges.</li>
              <li>To prevent fraud and keep the service secure.</li>
              <li>To keep the records the law requires.</li>
            </ul>
          ),
        },
        {
          id: "share",
          title: "Who helps us",
          body: (
            <>
              <p>We don&rsquo;t sell your data or use it for advertising. These services process it on our behalf, only to run the shop:</p>
              <ul>
                <li><b>Supabase</b>: database and login. Data is stored on servers outside India (currently in Japan).</li>
                <li><b>Vercel</b>: website hosting.</li>
                <li><b>Razorpay</b>: online UPI payments.</li>
                <li><b>Google Maps</b>: address search, maps and distance.</li>
                <li><b>Google</b>: &ldquo;Continue with Google&rdquo; sign-in, if you use it.</li>
                <li><b>Resend</b>: login-code and order emails, sent from info@svcloudkitchen.com.</li>
                <li><b>Cloudflare Turnstile</b>: the &ldquo;verify you are human&rdquo; check at login.</li>
                <li><b>Courier partners</b>: for orders outside our local area, your name, phone and address, so they can deliver.</li>
              </ul>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies and storage",
          body: <p>We use only what the site needs to work: a login cookie, your language choice, and your cart saved in your browser. There are no advertising or tracking cookies.</p>,
        },
        {
          id: "keep",
          title: "How long we keep it",
          body: <p>Order records are kept for as long as the law requires for accounts. Your account, saved addresses and preferences stay until you delete them or ask us to delete your account. Security logs are deleted within a day.</p>,
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <>
              <p>Under India&rsquo;s Digital Personal Data Protection Act, 2023 you can ask us to show, correct or delete your personal data, and withdraw consent (for example, turn off notifications or location at any time). You can edit your details and addresses yourself in <a className="ink-link" href="/account">Your account</a>.</p>
              <p>
                <b>Grievance officer:</b> <Blank value={s.legal.grievance_name} label="Grievance officer name" />, <Blank value={s.legal.grievance_email} label="Grievance officer email" />. We will acknowledge your request and reply as quickly as we can.
              </p>
            </>
          ),
        },
        {
          id: "children",
          title: "Children",
          body: <p>Accounts are for adults. If you believe a child has given us personal data, contact us and we will delete it.</p>,
        },
        {
          id: "changes",
          title: "Changes",
          body: <p>If we change this policy we&rsquo;ll update this page and the date at the top. Significant changes will be shown on the site.</p>,
        },
      ]}
    />
  );
}
