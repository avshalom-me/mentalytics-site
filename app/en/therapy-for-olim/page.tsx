import type { Metadata } from "next";
import Link from "next/link";
import ArticleTOC from "@/app/components/ArticleTOC";
import PageViewTracker from "@/app/components/PageViewTracker";
import DocumentLanguage from "../DocumentLanguage";
import { AdjustmentCycleFigure, AliyahChartFigure, TwoLanguagesFigure } from "./figures";

/*
 * The English translation of the site's article on therapy for olim (the
 * Hebrew draft of 27/9/2026 as the owner edited it, translated through a
 * four-model panel). Published under the house byline, "the Tipul Chacham
 * team", at the owner's request.
 *
 * Every number and source was checked against the original before
 * publication; see the reference list at the bottom. Plain English on
 * purpose: the readers are olim and their families, not clinicians.
 */

const BASE_URL = "https://www.mentalytics.co.il";
const PATH = "/en/therapy-for-olim";
const URL = `${BASE_URL}${PATH}`;
const H1 = "Therapy for New and Veteran Olim";
const TITLE = "Therapy for Olim in Israel: Why Language Matters";
const DESCRIPTION =
  "Why the language you speak in therapy matters, what aliyah and relocation do emotionally, and how to find an English-speaking therapist in Israel.";
const PUBLISHED = "2026-09-27";
const IMAGE = `${BASE_URL}/og/therapy-for-olim.png`;

export const metadata: Metadata = {
  // absolute: the root template would append the Hebrew "| טיפול חכם".
  title: { absolute: `${TITLE} | Tipul Chacham` },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    type: "article",
    url: URL,
    title: `${H1}: Why Language Matters`,
    description: DESCRIPTION,
    locale: "en_US",
    siteName: "Tipul Chacham (Mentalytics)",
    publishedTime: PUBLISHED,
    images: [{ url: IMAGE, width: 1200, height: 630, alt: "Therapy for new and veteran olim: why the language of therapy matters" }],
  },
};

type Ref = { text: string; url?: string };

// In order of first citation in the text.
const REFS: Ref[] = [
  { text: "Pavlenko, A. (2012). Affective processing in bilingual speakers: Disembodied cognition? International Journal of Psychology, 47(6), 405-428.", url: "https://doi.org/10.1080/00207594.2012.743665" },
  { text: "Marian, V., & Neisser, U. (2000). Language-dependent recall of autobiographical memories. Journal of Experimental Psychology: General, 129(3), 361-368.", url: "https://doi.org/10.1037/0096-3445.129.3.361" },
  { text: "Marcos, L. R. (1976). Bilinguals in psychotherapy: Language as an emotional barrier. American Journal of Psychotherapy, 30(4), 552-560.", url: "https://doi.org/10.1176/appi.psychotherapy.1976.30.4.552" },
  { text: "Verkerk, L., Fuller, J. M., Huiskes, M., & Schüppert, A. (2024). 'My recovery is in English': Clients' language choices in multilingual psychotherapy. Counselling and Psychotherapy Research, 24(3), 949-961.", url: "https://doi.org/10.1002/capr.12769" },
  { text: "Hsueh, L., Hirsh, A. T., Maupomé, G., & Stewart, J. C. (2021). Patient-provider language concordance and health outcomes: A systematic review, evidence map, and research agenda. Medical Care Research and Review, 78(1), 3-23.", url: "https://doi.org/10.1177/1077558719860708" },
  { text: "Bauer, A. M., & Alegría, M. (2010). Impact of patient language proficiency and interpreter service use on the quality of psychiatric care: A systematic review. Psychiatric Services, 61(8), 765-773.", url: "https://doi.org/10.1176/ps.2010.61.8.765" },
  { text: "Amit, K., & Riss, I. (2014). The subjective well-being of immigrants: Pre- and post-migration. Social Indicators Research, 119(1), 247-264.", url: "https://ideas.repec.org/a/spr/soinre/v119y2014i1p247-264.html" },
  { text: "Demes, K. A., & Geeraert, N. (2015). The highs and lows of a cultural transition: A longitudinal analysis of sojourner stress and adaptation across 50 countries. Journal of Personality and Social Psychology, 109(2), 316-337.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4507515/" },
  { text: "Israel Ministry of Health. Mental health therapy services (through the health funds, and what to do in a crisis).", url: "https://me.health.gov.il/en/mental-health/therapy-rehabilitation/public-care/community-treatment/treatment-services/" },
  { text: "ERAN, Emotional First Aid. English helpline for olim.", url: "https://www.eran.org.il/eran-for-the-community/olim/english-helpline/" },
  { text: "Nefesh B'Nefesh year-end aliyah figures, as reported by Israel National News (December 28, 2022), The Jewish Link (January 4, 2024) and JNS (December 30, 2025, \"North American aliyah tops 4,100 in 2025, highest level in four years\").", url: "https://www.jns.org/israel-news/north-american-aliyah-tops-4100-in-2025-highest-level-in-four-years" },
  { text: "Israel Ministry of Aliyah and Integration, 2025 figures, as reported by ynet (Hebrew).", url: "https://www.ynet.co.il/judaism/article/hkhnuzgn11x" },
  { text: "Aviram, U., & Azary-Viesel, S. (2015). Mental health reform in Israel: Challenge and opportunity. Taub Center for Social Policy Studies in Israel, Policy Paper 2015.02.", url: "https://www.taubcenter.org.il/wp-content/uploads/2020/12/mentalhealthreformenglish2015.pdf" },
  { text: "Israel Ministry of Health. Register of licensed psychologists (Hebrew).", url: "https://registries.health.gov.il/Practitioners/27" },
  { text: "Flückiger, C., Del Re, A. C., Wampold, B. E., & Horvath, A. O. (2018). The alliance in adult psychotherapy: A meta-analytic synthesis. Psychotherapy, 55(4), 316-340.", url: "https://doi.org/10.1037/pst0000172" },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Does therapy in English work if you live in Israel?",
    a: "Yes. Therapy does not have to be in the language of the country you live in. What matters is that the language lets you communicate clearly and feel safe with your therapist, and the quality of that relationship is consistently linked to how well therapy works.",
  },
  {
    q: "My Hebrew is good. Is there any point in looking for a therapist who speaks English?",
    a: "Sometimes, yes. Being fluent day to day is not the same as being fluent emotionally. You can also mix: talk about daily life in Hebrew and about your childhood in English. Notice whether you can express your feelings more precisely in your mother tongue, and how much that matters to you.",
  },
  {
    q: "Is switching languages in therapy confusing?",
    a: "Usually not. It can bring back memories and make feelings clearer, and a bilingual therapist can use it as a tool. It is better to talk about the switches than to try to avoid them.",
  },
  {
    q: "How long does it take to adjust after aliyah?",
    a: "There is no right amount of time. Adjustment is not a straight line. It depends on language, work, support, age, and what is happening in Israel and in your home country.",
  },
  {
    q: "Can I get therapy in English through my kupat holim?",
    a: "You can ask for it. Israel's health funds have been responsible for mental health services since July 2015, but how many English-speaking therapists they have varies between health funds and regions.",
  },
];

const FAQ_REFS: (number[] | null)[] = [[15], null, null, [8], [9, 13]];

function Cite({ n }: { n: number[] }) {
  return (
    <sup className="cite">
      {n.map((k) => (
        <a key={k} href={`#ref-${k}`} aria-label={`Source ${k}`}>[{k}]</a>
      ))}
    </sup>
  );
}

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: H1,
  alternativeHeadline: TITLE,
  description: DESCRIPTION,
  inLanguage: "en",
  datePublished: PUBLISHED,
  dateModified: PUBLISHED,
  image: IMAGE,
  author: {
    "@type": "Organization",
    name: "Tipul Chacham Team",
    alternateName: "צוות טיפול חכם",
    url: `${BASE_URL}/en`,
  },
  publisher: {
    "@type": "Organization",
    name: "Tipul Chacham",
    alternateName: ["טיפול חכם", "Mentalytics"],
    url: BASE_URL,
    logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
  },
  url: URL,
  mainEntityOfPage: { "@type": "WebPage", "@id": URL },
  about: [
    { "@type": "Thing", name: "Psychotherapy in a second language" },
    { "@type": "Thing", name: "Aliyah" },
    { "@type": "Thing", name: "Acculturative stress" },
    { "@type": "Thing", name: "Relocation" },
    { "@type": "Thing", name: "English-speaking therapists in Israel" },
  ],
  citation: REFS.slice(0, 8).map((r) => ({ "@type": "CreativeWork", name: r.text, url: r.url })),
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  inLanguage: "en",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Tipul Chacham in English", item: `${BASE_URL}/en` },
    { "@type": "ListItem", position: 2, name: "Therapy for olim", item: URL },
  ],
};

const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "16px 18px" };

export default function TherapyForOlimPage() {
  return (
    <div lang="en" dir="ltr" style={{ textAlign: "left" }}>
      <DocumentLanguage lang="en" dir="ltr" />
      <PageViewTracker page="english-article" source="therapy-for-olim" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <main className="mx-auto max-w-6xl px-5 py-8 pb-20">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>
            <li><Link href="/en" style={{ color: "var(--muted)" }} className="hover:underline">Tipul Chacham in English</Link></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" style={{ color: "var(--text-2)", fontWeight: 600 }}>Therapy for olim</li>
          </ol>
        </nav>

        <div className="lg:grid lg:gap-12" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
          <div id="article-body" className="min-w-0" style={{ maxWidth: "740px" }}>
            <article className="article-body">
              <header className="mb-8 pb-6" style={{ borderBottom: "1px solid var(--line)" }}>
                <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "8px" }}>
                  <time dateTime={PUBLISHED}>September 27, 2026</time> · By the Tipul Chacham team
                </p>
                <h1>{H1}</h1>
                <p className="dek">
                  Why the language of therapy matters, what moving to Israel can do to your emotional life, and how to find
                  an English-speaking therapist.
                </p>
              </header>

              <section aria-label="In short" className="takeaways">
                <p className="takeaways-title">In short</p>
                <ul>
                  <li>Many people feel emotions more directly in their first language, so a therapist who speaks it can help, even if your Hebrew is good.<Cite n={[1]} /></li>
                  <li>A second language also creates distance. For some people that distance makes painful topics easier to talk about. For others, it gets in the way.<Cite n={[4]} /></li>
                  <li>For assessment and diagnosis, language matters most: an evaluation in a language that is not your main one can be incomplete or distorted.<Cite n={[6]} /></li>
                  <li>Adjustment rarely follows fixed stages. In a study of 2,480 exchange students, only about 5% went through the classic “honeymoon, crisis, recovery” curve, so a hard patch does not mean your aliyah failed.<Cite n={[8]} /></li>
                  <li>You can find therapy in English through your kupat holim (health fund), privately or online. ERAN runs an English helpline for olim at *3201; in an emergency, go to the ER or call 101.<Cite n={[10]} /></li>
                </ul>
              </section>

              <p>
                For olim (immigrants to Israel), families on relocation, and anyone whose mother tongue is not Hebrew, a
                therapist who speaks their language saves them the constant effort of “translating themselves.” It leaves
                more room for the raw feelings they are living with. This matters especially now: in recent years, aliyah
                (immigration to Israel) from North America and other English-speaking countries has been growing.
              </p>

              <h2>Why does language matter in therapy?</h2>
              <p>
                Your mother tongue is the language in which you first felt love, fear, shame and comfort. A 2012 review of
                research on bilingual people found that for most people, emotional words in their first language are
                processed more automatically and are felt more in the body, while in a language learned later, emotional
                reactions tend to be milder and more distant.<Cite n={[1]} /> Put simply, “I’m so sorry” can touch a different
                place than the Hebrew “slicha” (<bdi lang="he">סליחה</bdi>), even for someone who speaks fluent Hebrew.
              </p>
              <p>
                Language is tied to memory, too. In a classic 2000 study of people who speak both Russian and English,
                participants recalled more memories from a certain period of their lives when the conversation was in the
                language they spoke at that time.<Cite n={[2]} /> A woman who made aliyah from New Jersey may find that her childhood stories come alive in
                English, even though she lives her daily life in Hebrew.
              </p>

              <h2>The paradox of therapy in a second language</h2>
              <p>
                In 1976, the psychiatrist Luis Marcos described an “emotional detachment effect” in patients who spoke in
                therapy in a language that was not their mother tongue.<Cite n={[3]} /> This distance is not necessarily a bad
                thing. On the one hand, therapy held entirely in a “distant” language can stay in the head and never reach the
                heart. On the other hand, a certain amount of distance can work like a guardrail, making it possible to talk
                about trauma, sexuality or shame without being flooded.
              </p>
              <p>
                A study published in 2024 under the title “My recovery is in English” came to one clear conclusion: there is
                no single, fixed link between language and emotion. For some patients, a second language gave exactly the
                distance they needed to talk about past trauma. Others felt it was not enough to fully express
                themselves.<Cite n={[4]} /> So the right question is not “Which language should therapy be in?” but{" "}
                <strong>“In which language are you least busy searching for words, and most free to feel?”</strong>
              </p>

              <h2>Does my therapist need to speak my language?</h2>
              <p>
                Not necessarily. As usual, the answer is complicated. A 2021 review of 38 studies on language matching between
                patients and health care providers found a mixed picture: in some studies, a shared language was linked to better outcomes, and
                in others no link was found.<Cite n={[5]} /> Part of the reason may be the paradox described above. Sometimes
                the distance created by a different language or culture actually makes it easier to open up.
              </p>
              <p>
                Assessment and diagnosis are different. There, precise words and cultural understanding matter a great deal.
                So when you need an evaluation, it is more important that the psychologist or psychiatrist doing it knows
                your mother tongue well. A 2010 review of 26 studies in psychiatry found that an evaluation done in a language
                that is not the patient’s main language can be incomplete or distorted.<Cite n={[6]} />
              </p>

              <h2>Why do aliyah and relocation shake even strong people?</h2>
              <blockquote>
                <strong>Acculturative stress</strong> is the mental strain of having to learn the unwritten rules of a new
                culture and live by them, while still holding on to who you were.
              </blockquote>
              <p>
                This stress adds up from small things: a call with a clerk at Bituach Leumi (National Insurance), a
                parent-teacher meeting where you miss the jokes, Israeli directness that can feel rude at first. Moving to
                another country also brings losses that are hard to name: your support network, your professional standing, a
                sense of humor that worked in another language, and the confidence of knowing “how things work.”
              </p>
              <p>
                A 2014 Israeli study of olim from North America found that their work situation was usually below what they
                had in their home countries. Even so, their life satisfaction was relatively high, and most did not think about
                leaving.<Cite n={[7]} /> Crisis and opportunity can live side by side. You can be at peace with your decision and
                still grieve what you left behind. In a way, this is even necessary. It does not help to push away the crisis
                and the grief just to feel better about the decision to move. It is possible, and worth trying, to hold both
                feelings at once: joy about the change, the new country and the new possibilities opening up, together with
                grief for what you left behind and for how complicated it is to start a new life in a different language and
                culture.
              </p>
              <p>
                In situations like these, therapy that focuses on relocation can make a real difference. It helps you
                separate practical problems from emotional pain, work through homesickness and guilt toward parents who
                stayed abroad, and notice changes in your relationship, for example when one partner speaks Hebrew well and
                the other depends on them. In Israel, sirens, war and a heated public mood come on top of all this, and they
                reach olim before they have built a support network here.
              </p>
              <h3>What do people work on in relocation therapy?</h3>
              <ul>
                <li><strong>Before the move and in the first months:</strong> expectations, fears and decisions, including the gap between what you imagined and what is actually happening.</li>
                <li><strong>Grief for what you left behind:</strong> home, friends, aging parents and language, even when moving was completely your choice.</li>
                <li><strong>Relationships and parenting:</strong> shifting roles, depending on the partner who knows the country, and arguments that come from overload.</li>
                <li><strong>Identity and belonging:</strong> Who am I here? What is left of who I used to be? And how do I deal with thoughts of going back?</li>
              </ul>

              <h2>Are there normal stages of adjustment, and when is it more than that?</h2>
              <p>
                The familiar model describes a “honeymoon” at the start of the move, then a crisis, then gradual adjustment.
                But when researchers followed people over time, the picture was much more varied. A 2015 study that followed
                2,480 teenagers in student exchange programs in more than 50 countries found five different patterns of stress, and
                only about 5% of them went through the classic curve of excitement, a fall and recovery. Most had mild stress
                (41%) or minor relief (47%).<Cite n={[8]} /> The study looked at temporary stays, not immigration, but the
                message holds: there is no single right path.
              </p>
              <p>
                That is why it helps to think of adjustment as a cycle, not a ladder (Figure 1). You can move ahead at work and
                feel stuck socially, or feel settled and then be thrown off again around a holiday, a birth, a war or a visit
                “home.”
              </p>
              <figure>
                <p className="fig-title">Figure 1: Adjustment is a cycle, not a ladder</p>
                <div className="fig-scroll"><AdjustmentCycleFigure /></div>
                <figcaption>
                  Adjustment does not follow fixed stages. Life events sometimes bring you back to friction, and that does not
                  mean the move has failed. The key point in the diagram is the check: when distress lasts and gets in the way
                  of daily life, it is time to reach out for help.
                </figcaption>
              </figure>

              <h3>When should you reach out for help?</h3>
              <p>You do not need to wait for a diagnosis. Consider getting help when:</p>
              <ul>
                <li>Sadness, anxiety, anger or homesickness go on for weeks and make your life smaller.</li>
                <li>Your sleep, appetite or energy changes a lot.</li>
                <li>You pull away from people, have panic attacks, or drink or use drugs more than before.</li>
                <li>Arguments at home keep coming back and getting worse.</li>
                <li>A child or teen avoids school, friends or activities they used to love.</li>
              </ul>
              <p>
                <strong>In an emergency</strong>, such as suicidal thoughts or immediate danger, do not wait for an
                appointment. Go to the emergency room,<Cite n={[9]} /> call Magen David Adom (MDA), Israel’s ambulance service,
                at 101, or call ERAN, Israel’s emotional first aid line, at 1201. It is good to know that ERAN also runs an
                English-language helpline for olim: <strong>*3201</strong>, Sunday to Thursday until 9 pm.<Cite n={[10]} />
              </p>

              <h2>What do children and teens go through after the move?</h2>
              <p>
                Children pick up Hebrew fast, so it can look as if they are “doing fine.” But how quickly a child learns the
                language is not necessarily a sign of emotional adjustment. Children lose friends, their place in the social
                group and a shared language with the teacher, and sometimes they feel that even their parents do not know how
                the system works. Teenagers make the move in exactly the years when belonging and identity are being built
                anyway, and some of them end up translating and handling things for their parents. This shift, from the place
                of a child to something closer to the place of a parent who helps the family find its way in a new country,
                has complex effects on the emotional life of both parent and child, and on the whole family. It is very
                important to talk about it and work through it.
              </p>
              <p>
                Sometimes the best first step for a child is parent guidance, or therapy for the parent. And when it comes to
                which language to use in a child’s therapy, ask the child. Many children of olim speak English at home and
                Hebrew in class, and the language in which they are comfortable talking about feelings is not always the one
                they speak best.
              </p>

              <h2>What is different about the Israeli context?</h2>
              <p>
                Aliyah from North America has grown in recent years. According to Nefesh B’Nefesh, the organization that
                helps North Americans make aliyah, 3,900 olim arrived in 2022, 3,020 in 2023, 3,706 in 2024 and 4,150 in 2025,
                a 12% rise in the last year (Figure 2).<Cite n={[11]} /> And according to Israel’s Ministry of Aliyah and
                Integration, of about 21,900 olim in 2025, about 3,500 came from the United States and about 840 from the UK.
                Together, that is almost one in every five.<Cite n={[12]} />
              </p>
              <figure>
                <p className="fig-title">Figure 2: North American olim who came with Nefesh B’Nefesh, 2022 to 2025</p>
                <div className="fig-scroll"><AliyahChartFigure /></div>
                <figcaption>
                  <strong>Source:</strong> Nefesh B’Nefesh year-end announcements, as published by Israel National News
                  (December 28, 2022), The Jewish Link (January 4, 2024) and JNS (December 30, 2025). The numbers count olim
                  from the United States and Canada who came with the organization’s help, not all English speakers in Israel.
                  *The 2022 figure was published as a year-end estimate.
                </figcaption>
              </figure>
              <p>
                These numbers are only part of the picture. English speakers in Israel also include returning residents
                (Israelis coming back after years abroad), spouses who did not make aliyah, students, lone soldiers (soldiers serving without family in Israel) and
                families on relocation. And there is a familiar paradox here: you can feel at home in your values or your
                community, and at the same time feel like a complete outsider at a parent-teacher meeting or in a doctor’s
                office.
              </p>
              <figure>
                <p className="fig-title">Illustration: Between two languages</p>
                <div className="fig-scroll"><TwoLanguagesFigure /></div>
                <figcaption>
                  Two languages, one person. Where they overlap, words turn into feelings, and therapy can move freely between
                  the two.
                </figcaption>
              </figure>

              <h2>How do you find an English-speaking therapist in Israel?</h2>
              <p>There are three main routes, and you can combine them:</p>
              <ul>
                <li>
                  <strong>Your kupat holim (health fund).</strong> Since July 2015, Israel’s health funds have been responsible
                  for mental health services,<Cite n={[13]} /> and treatment through them is free or costs a low quarterly
                  fee.<Cite n={[9]} /> Ask directly for a therapist who works in English, and ask about independent therapists
                  who work with your health fund.
                </li>
                <li>
                  <strong>Private therapy.</strong> This gives you a wider choice of language, approach, hours and experience
                  with olim, but it costs more. Some supplementary health fund plans and private insurance policies pay back
                  part of the cost, so check in advance.
                </li>
                <li>
                  <strong>Online therapy.</strong> This greatly widens your options, especially outside central Israel. Make
                  sure the therapist is licensed to work in Israel, and ask how your privacy is protected and what happens in
                  an emergency.
                </li>
              </ul>
              <p>
                Whatever route you choose, check the therapist’s credentials. Licensed psychologists are listed in the
                Ministry of Health’s register of psychologists, which you can search on the ministry’s website.<Cite n={[14]} />{" "}
                Tipul Chacham also has a <Link href="/en">page of therapists who work in English</Link>, which you can filter by
                region, age group and online sessions.
              </p>

              <h2>What should you ask a therapist before you start?</h2>
              <p>A short first call by phone or video is a chance to check the fit. Questions worth asking:</p>
              <ol>
                <li>Are you comfortable doing therapy fully in English, including talking about painful and emotional topics?</li>
                <li>What experience do you have with olim, relocation, cross-cultural couples or bilingual children?</li>
                <li>Can we switch between English and Hebrew during a session?</li>
                <li>What is your training and license, and what approach do you use?</li>
                <li>Do you work with my health fund or insurance, and what is your cancellation policy?</li>
                <li>For online therapy: what do we do if there is an emergency?</li>
              </ol>
              <p>
                Pay attention to how the conversation feels, too. Do you keep having to explain the culture you come from? Can
                you talk about regret, anger at Israel or doubts without fearing judgment?
              </p>

              <h2>Frequently asked questions</h2>
              {FAQ.map((f, i) => (
                <div key={f.q} className="faq">
                  <h3>{f.q}</h3>
                  <p>
                    {f.a}
                    {FAQ_REFS[i] && <Cite n={FAQ_REFS[i]!} />}
                  </p>
                </div>
              ))}

              <p className="disclaimer">
                This guide offers general information. It is not a diagnosis, and it does not replace professional care.
              </p>

              <h2 id="sources">Sources</h2>
              <ol className="references">
                {REFS.map((r, i) => (
                  <li key={i} id={`ref-${i + 1}`}>
                    {r.text}{" "}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer">{r.url.replace(/^https:\/\//, "")}</a>
                    )}
                  </li>
                ))}
              </ol>
            </article>

            <div className="mt-12 pt-8" style={{ borderTop: "1px solid var(--line)" }}>
              <div style={{ ...card, background: "var(--teal-pale)", borderColor: "var(--teal-mid)", padding: "22px 24px" }}>
                <p style={{ fontWeight: 900, fontSize: "18px", color: "var(--text)", marginBottom: "6px" }}>Looking for an English-speaking therapist?</p>
                <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.7, marginBottom: "14px" }}>
                  Every therapist on our English page works in English as well as Hebrew, and their training certificates
                  have been verified. You contact them directly.
                </p>
                <Link href="/en#therapists" className="rounded-full px-5 py-2.5 text-sm font-bold inline-block hover:bg-[var(--teal-dark)]"
                  style={{ background: "var(--teal)", color: "#fff" }}>
                  See therapists who work in English
                </Link>
                <p style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: "14px" }}>
                  Not sure what kind of help you need? Try our matching questionnaire for{" "}
                  <Link href="/adults" style={{ color: "var(--teal-dark)", fontWeight: 700, textDecoration: "underline" }}>adults</Link> or for{" "}
                  <Link href="/kids" style={{ color: "var(--teal-dark)", fontWeight: 700, textDecoration: "underline" }}>children and teens</Link>{" "}
                  (in Hebrew for now).
                </p>
              </div>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div style={{ position: "sticky", top: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <ArticleTOC heading="On this page" label="Contents" />
              <div style={{ ...card, background: "var(--teal-pale)", borderColor: "var(--teal-mid)" }}>
                <p style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--teal-dark)", marginBottom: "6px" }}>Therapists who work in English</p>
                <p style={{ fontSize: "13px", color: "var(--teal-dark)", lineHeight: 1.7, marginBottom: "10px" }}>
                  Psychologists and therapists across Israel and online. Filter by region, age group and online sessions.
                </p>
                <Link href="/en#therapists" className="rounded-full px-4 py-2 text-sm font-bold text-center block"
                  style={{ background: "var(--teal)", color: "#fff" }}>
                  Browse the therapists
                </Link>
              </div>
              <div style={card}>
                <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: ".12em", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase" }}>Written by</p>
                <p style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--text)" }}>The Tipul Chacham team</p>
                <p style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "4px", lineHeight: 1.6 }}>
                  Tipul Chacham (Mentalytics) is an Israeli platform, built by psychologists and researchers, that helps
                  people find the right kind of therapy and the right therapist.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <style>{`
        .article-body { color: #292524; font-size: 17px; line-height: 1.8; }
        .article-body h1 { font-size: clamp(2rem, 4vw, 2.6rem); font-weight: 900; line-height: 1.15; color: var(--text); letter-spacing: -.01em; margin-bottom: 12px; }
        .article-body .dek { font-size: 18px; color: var(--text-2); line-height: 1.6; margin: 0; }
        .article-body h2 { font-size: 1.5rem; font-weight: 800; color: #1c1917; margin-top: 2.5rem; margin-bottom: 1rem; line-height: 1.3; scroll-margin-top: 90px; }
        .article-body h3 { font-size: 1.12rem; font-weight: 700; color: #292524; margin-top: 1.75rem; margin-bottom: .5rem; }
        .article-body p { margin-bottom: 1.1rem; }
        .article-body strong { color: #1c1917; font-weight: 700; }
        .article-body a { color: var(--teal-dark); text-decoration: underline; text-underline-offset: 3px; }
        .article-body ul, .article-body ol:not(.references) { margin: .5rem 0 1.4rem; padding-left: 1.4rem; }
        .article-body ul li { list-style-type: disc; margin-bottom: .5rem; }
        .article-body ol:not(.references) li { list-style-type: decimal; margin-bottom: .5rem; }
        .article-body blockquote { border-left: 3px solid var(--teal); padding: .25rem 1rem; margin: 1.25rem 0 1.5rem; color: #44403c; }
        .article-body .takeaways { border-left: 3px solid var(--gold); padding: .25rem 0 .25rem 1.1rem; margin: 0 0 2rem; }
        .article-body .takeaways-title { font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--gold-dark); margin-bottom: .4rem; }
        .article-body .takeaways ul { margin: 0; }
        .article-body .takeaways li { font-size: 16px; margin-bottom: .35rem; }
        .article-body sup.cite { font-size: .68em; margin-left: 1px; }
        .article-body sup.cite a { color: var(--teal); text-decoration: none; font-weight: 700; }
        .article-body figure { margin: 1.75rem 0 2rem; }
        .article-body .fig-title { font-weight: 800; font-size: 15px; color: var(--text); margin-bottom: .5rem; }
        /* On a phone a 900-wide diagram would shrink its labels to ~5px: keep a
           readable minimum width and let the figure scroll sideways instead. */
        .article-body .fig-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @media (max-width: 700px) { .article-body .fig-scroll svg { min-width: 640px; } }
        .article-body figcaption { font-size: 13.5px; color: var(--muted); line-height: 1.6; margin-top: .5rem; }
        .article-body .faq h3 { margin-top: 1.25rem; }
        .article-body .disclaimer { font-size: 13.5px; color: var(--muted); margin-top: 2rem; }
        .article-body .references { font-size: 13px; line-height: 1.7; color: #57534e; padding-left: 1.5rem; }
        .article-body .references li { list-style-type: decimal; margin-bottom: .6rem; scroll-margin-top: 90px; }
        .article-body .references a { word-break: break-word; }
      `}</style>
    </div>
  );
}
