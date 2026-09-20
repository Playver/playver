import { LegalContent, LEGAL_UPDATED, LEGAL_UPDATED_FR, p, list } from "./types";

const terms: LegalContent = {
  en: {
    title: "Terms of Service",
    updated: LEGAL_UPDATED,
    intro: [
      p(
        "These Terms of Service (\"Terms\") govern your access to and use of Playver, including our website, apps, and related services (together, the \"Service\"), operated by Playver Inc. (\"Playver\", \"we\", \"us\", or \"our\"), a company governed by the laws of Quebec, Canada."
      ),
      p(
        "By creating an account, registering for an event, organizing an event, or otherwise using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization, and \"you\" refers to both you and that organization."
      ),
      p(
        "Nothing in these Terms limits any right you have under Quebec's Consumer Protection Act or any other law that cannot be waived or limited by contract. If any part of these Terms conflicts with such a law, that law governs instead."
      ),
    ],
    sections: [
      {
        id: "eligibility",
        heading: "1. Eligibility and accounts",
        blocks: [
          p(
            "You must be at least 13 years old to create a Playver account. If you are under the age of majority in your province, you may only use the Service with the involvement and consent of a parent or legal guardian, who agrees to these Terms on your behalf and takes responsibility for your use of the Service."
          ),
          p(
            "Many participants registered for events on Playver are minors registered by a parent, guardian, or coach. Anyone who registers a minor for an event represents that they are authorized to do so and to agree to these Terms, the applicable Refund & Cancellation Policy, and any event-specific waivers on that minor's behalf."
          ),
          p(
            "You must provide accurate, current information when creating an account and keep it up to date. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at playver@gmail.com if you suspect unauthorized use of your account."
          ),
        ],
      },
      {
        id: "the-service",
        heading: "2. What Playver is",
        blocks: [
          p(
            "Playver is a technology platform that helps people discover, organize, and participate in sports events, tournaments, and teams. Through the Service you can, among other things, create an athlete profile, join or manage teams, browse and register for events and tournaments, communicate with organizers and teammates, and pay for paid registrations using the Playver wallet."
          ),
          p(
            "We may add, change, or remove features of the Service at any time, and may impose limits on certain features or restrict access to parts of the Service, without liability, except where required by law."
          ),
        ],
      },
      {
        id: "platform-role",
        heading: "3. Playver's role: a platform, not the event organizer",
        blocks: [
          p(
            "This section is the most important one in these Terms, because it defines who is responsible for what."
          ),
          p(
            "Events, tournaments, and teams listed on Playver are created and run by independent third-party organizers — clubs, leagues, coaches, schools, or individuals (\"Organizers\") — who are not employees, agents, or representatives of Playver. Playver does not plan, supervise, staff, insure, or physically operate any event, practice, tournament, or activity listed on the Service."
          ),
          p(
            "Playver provides the technology that lets Organizers list events and collect registrations and payments, and that lets participants find and register for those events. We are not a party to the relationship between an Organizer and a participant, and we do not guarantee the accuracy of any listing, the qualifications or conduct of any Organizer or participant, or the safety of any venue or activity."
          ),
          p(
            "Organizers are solely responsible for their events, including compliance with applicable laws, obtaining any required permits or insurance, venue safety, on-site supervision and first aid, and the truthfulness of any listing or communication they post."
          ),
        ],
      },
      {
        id: "assumption-of-risk",
        heading: "4. Participation in physical activity — assumption of risk",
        blocks: [
          p(
            "Sports and physical activities carry inherent risks of injury, including serious injury. By registering for or participating in an event found through Playver, you acknowledge that you are voluntarily choosing to take part in a physical activity organized by a third-party Organizer, and that you understand and accept the inherent risks involved."
          ),
          p(
            "We strongly encourage participants to review any waiver, code of conduct, or safety information provided by the Organizer before an event, and to ensure they are medically fit to participate. We encourage Organizers to carry appropriate liability insurance and to obtain their own participant waivers where appropriate for their activity."
          ),
          p(
            "As required by Quebec law, nothing in this section or elsewhere in these Terms excludes or limits Playver's liability for bodily or moral injury caused by our own fault. This section is intended to describe the nature of the activities offered through the Service and the respective roles of Playver and Organizers — not to exclude liability that cannot lawfully be excluded."
          ),
        ],
      },
      {
        id: "organizer-responsibilities",
        heading: "5. Additional responsibilities for Organizers",
        blocks: [
          p("If you create or manage an event, tournament, team, or organization on Playver, you additionally agree that you will:"),
          list([
            "Provide accurate information about your event, including dates, location, pricing, and any age or eligibility requirements;",
            "Set out any refund or cancellation terms specific to your event clearly at registration, consistent with our Refund & Cancellation Policy;",
            "Comply with all applicable laws, including those relating to child safety, privacy, insurance, and consumer protection;",
            "Only collect personal information from participants (including through custom registration forms) that is necessary for the event, and handle it responsibly;",
            "Promptly notify participants through the Service if an event is cancelled, postponed, or materially changed.",
          ]),
          p(
            "Playver may remove a listing, suspend an Organizer's ability to collect payments, or terminate an account that violates these Terms, our Acceptable Use Policy, or applicable law."
          ),
        ],
      },
      {
        id: "payments",
        heading: "6. Payments, the Playver wallet, and fees",
        blocks: [
          p(
            "Paid registrations on Playver are processed through the Playver wallet. You can add funds to your wallet by card; paying for a paid event, tournament, or team applies your wallet balance to the price first and charges any remaining amount to your card, and the Organizer receives the full listed price either way. Organizers can withdraw available wallet funds to a linked bank account through our payment partner, Stripe, subject to identity verification and the holds and minimums described in our Refund & Cancellation Policy."
          ),
          p(
            "Card payments are processed by Stripe, Inc. Playver does not store your full card number. Details on refunds, holds, and fees are set out in our Refund & Cancellation Policy, which forms part of these Terms."
          ),
          p(
            "We may charge platform or service fees in the future. Any fee will be disclosed to you before you pay it. We do not retroactively charge fees on completed transactions."
          ),
        ],
      },
      {
        id: "content-conduct",
        heading: "7. Your content and conduct",
        blocks: [
          p(
            "You retain ownership of the content you submit to the Service (profile photos, team logos, event descriptions, messages, and similar content, \"User Content\"). By submitting User Content, you grant Playver a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, and display that content solely to operate and promote the Service."
          ),
          p(
            "You are responsible for your User Content and for your conduct on the Service. Your use of the Service is also governed by our Acceptable Use Policy, which sets out conduct that is not allowed."
          ),
        ],
      },
      {
        id: "ip",
        heading: "8. Intellectual property",
        blocks: [
          p(
            "The Service, including its design, software, logos, and the Playver name and marks, is owned by Playver Inc. or our licensors and is protected by intellectual property laws. Except for the limited right to use the Service as intended, these Terms do not grant you any rights to our intellectual property."
          ),
        ],
      },
      {
        id: "third-party",
        heading: "9. Third-party services",
        blocks: [
          p(
            "The Service relies on third-party providers, including Stripe (payments), to operate. We select these providers carefully, but we are not responsible for outages, errors, or acts or omissions of third-party providers that are outside our reasonable control."
          ),
        ],
      },
      {
        id: "disclaimers",
        heading: "10. Disclaimers",
        blocks: [
          p(
            "The Service is provided \"as is\" and \"as available.\" To the fullest extent permitted by law, Playver disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement, and does not warrant that the Service will be uninterrupted, secure, or error-free, or that information provided by Organizers or other users is accurate or reliable."
          ),
          p(
            "This section does not affect any legal warranty you benefit from under Quebec's Consumer Protection Act or other applicable law that cannot be excluded."
          ),
        ],
      },
      {
        id: "liability",
        heading: "11. Limitation of liability",
        blocks: [
          p(
            "To the fullest extent permitted by law, Playver's total liability to you arising out of or relating to the Service will not exceed the greater of (a) the amount of fees you paid to Playver (as distinct from amounts paid to Organizers) in the 12 months before the claim, or (b) CAD $100. Playver will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, arising from your use of the Service."
          ),
          p(
            "As required by Quebec law, nothing in these Terms excludes or limits our liability for bodily or moral injury caused by our fault, for gross or intentional fault, or for any other liability that cannot lawfully be excluded or limited."
          ),
        ],
      },
      {
        id: "indemnification",
        heading: "12. Indemnification",
        blocks: [
          p(
            "You agree to defend, indemnify, and hold Playver harmless from claims, damages, and reasonable expenses (including legal fees) arising from your breach of these Terms, your User Content, your event or activity as an Organizer, or your violation of applicable law, except to the extent caused by Playver's own fault."
          ),
        ],
      },
      {
        id: "termination",
        heading: "13. Suspension and termination",
        blocks: [
          p(
            "You may stop using the Service and close your account at any time by contacting us. We may suspend or terminate your access to the Service if you violate these Terms, our Acceptable Use Policy, or applicable law, or to protect the safety or integrity of the Service, with notice where reasonably possible. Sections of these Terms that by their nature should survive termination (including payments already owed, liability, and dispute resolution) will survive."
          ),
        ],
      },
      {
        id: "changes",
        heading: "14. Changes to these Terms",
        blocks: [
          p(
            "We may update these Terms from time to time. If we make material changes, we will provide reasonable notice (for example, by email or an in-app notice) before the changes take effect. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms."
          ),
        ],
      },
      {
        id: "governing-law",
        heading: "15. Governing law and disputes",
        blocks: [
          p(
            "These Terms are governed by the laws of the Province of Quebec and the federal laws of Canada applicable therein, without regard to conflict of law principles. Subject to any right you have to bring a claim in your local jurisdiction under mandatory consumer protection law, you and Playver agree that any dispute arising from these Terms or the Service will be submitted to the exclusive jurisdiction of the courts of the Province of Quebec."
          ),
          p(
            "Both the English and French versions of these Terms have equal legal value. If you are a resident of Quebec, the French version will prevail in the event of any inconsistency between the two versions."
          ),
        ],
      },
      {
        id: "general",
        heading: "16. General",
        blocks: [
          p(
            "If any provision of these Terms is found unenforceable, the remaining provisions will remain in full effect. Our failure to enforce a provision is not a waiver of it. You may not assign these Terms without our consent; we may assign these Terms in connection with a merger, acquisition, or sale of assets. Neither party is liable for delays caused by events outside its reasonable control."
          ),
        ],
      },
      {
        id: "contact",
        heading: "17. Contact us",
        blocks: [
          p(
            "Questions about these Terms can be sent to playver@gmail.com."
          ),
        ],
      },
    ],
  },
  fr: {
    title: "Conditions d'utilisation",
    updated: LEGAL_UPDATED_FR,
    intro: [
      p(
        "Les présentes Conditions d'utilisation (les « Conditions ») régissent votre accès et votre utilisation de Playver, y compris notre site Web, nos applications et les services connexes (collectivement, le « Service »), exploités par Playver Inc. (« Playver », « nous »), une société régie par les lois du Québec, Canada."
      ),
      p(
        "En créant un compte, en vous inscrivant à un événement, en organisant un événement ou en utilisant autrement le Service, vous acceptez d'être lié par les présentes Conditions. Si vous n'êtes pas d'accord, n'utilisez pas le Service. Si vous utilisez le Service au nom d'une organisation, vous déclarez avoir le pouvoir de lier cette organisation, et « vous » désigne à la fois vous et cette organisation."
      ),
      p(
        "Rien dans les présentes Conditions ne limite les droits que vous tenez de la Loi sur la protection du consommateur du Québec ou de toute autre loi à laquelle il ne peut être renoncé par contrat. En cas de conflit entre les présentes Conditions et une telle loi, cette loi prévaut."
      ),
    ],
    sections: [
      {
        id: "eligibility",
        heading: "1. Admissibilité et comptes",
        blocks: [
          p(
            "Vous devez avoir au moins 13 ans pour créer un compte Playver. Si vous n'avez pas atteint l'âge de la majorité dans votre province, vous ne pouvez utiliser le Service qu'avec la participation et le consentement d'un parent ou tuteur légal, qui accepte les présentes Conditions en votre nom et assume la responsabilité de votre utilisation du Service."
          ),
          p(
            "Un grand nombre de participants inscrits à des événements sur Playver sont des mineurs inscrits par un parent, un tuteur ou un entraîneur. Toute personne qui inscrit un mineur à un événement déclare être autorisée à le faire et à accepter, au nom de ce mineur, les présentes Conditions, la Politique de remboursement et d'annulation applicable et toute décharge propre à l'événement."
          ),
          p(
            "Vous devez fournir des renseignements exacts et à jour lors de la création de votre compte et les tenir à jour. Vous êtes responsable de la confidentialité de vos identifiants de connexion et de toute activité effectuée sous votre compte. Avisez-nous immédiatement à playver@gmail.com si vous soupçonnez une utilisation non autorisée de votre compte."
          ),
        ],
      },
      {
        id: "the-service",
        heading: "2. Ce qu'est Playver",
        blocks: [
          p(
            "Playver est une plateforme technologique qui aide les gens à découvrir, organiser et participer à des événements sportifs, tournois et équipes. Le Service vous permet notamment de créer un profil d'athlète, de joindre ou de gérer des équipes, de parcourir et de vous inscrire à des événements et tournois, de communiquer avec les organisateurs et coéquipiers, et de payer les inscriptions payantes au moyen du portefeuille Playver."
          ),
          p(
            "Nous pouvons ajouter, modifier ou retirer des fonctionnalités du Service en tout temps, et pouvons imposer des limites à certaines fonctionnalités ou restreindre l'accès à certaines parties du Service, sans responsabilité, sauf lorsque la loi l'exige autrement."
          ),
        ],
      },
      {
        id: "platform-role",
        heading: "3. Le rôle de Playver : une plateforme, pas l'organisateur de l'événement",
        blocks: [
          p("Cette section est la plus importante des présentes Conditions, car elle définit qui est responsable de quoi."),
          p(
            "Les événements, tournois et équipes affichés sur Playver sont créés et gérés par des organisateurs tiers indépendants — clubs, ligues, entraîneurs, écoles ou particuliers (les « Organisateurs ») — qui ne sont ni des employés, ni des mandataires, ni des représentants de Playver. Playver ne planifie, ne supervise, ne dote en personnel, n'assure et n'exploite physiquement aucun événement, entraînement, tournoi ou activité affiché sur le Service."
          ),
          p(
            "Playver fournit la technologie permettant aux Organisateurs d'afficher des événements et de percevoir les inscriptions et paiements, et permettant aux participants de trouver et de s'inscrire à ces événements. Nous ne sommes pas partie à la relation entre un Organisateur et un participant, et nous ne garantissons ni l'exactitude d'une annonce, ni les compétences ou la conduite d'un Organisateur ou d'un participant, ni la sécurité d'un lieu ou d'une activité."
          ),
          p(
            "Les Organisateurs sont seuls responsables de leurs événements, y compris la conformité aux lois applicables, l'obtention des permis ou assurances requis, la sécurité des lieux, la supervision sur place et les premiers soins, ainsi que l'exactitude de toute annonce ou communication qu'ils publient."
          ),
        ],
      },
      {
        id: "assumption-of-risk",
        heading: "4. Participation à une activité physique — acceptation des risques",
        blocks: [
          p(
            "Les sports et activités physiques comportent des risques inhérents de blessure, y compris des blessures graves. En vous inscrivant à un événement trouvé grâce à Playver ou en y participant, vous reconnaissez choisir volontairement de prendre part à une activité physique organisée par un Organisateur tiers, et comprendre et accepter les risques inhérents qui y sont associés."
          ),
          p(
            "Nous encourageons fortement les participants à consulter toute décharge, code de conduite ou renseignement de sécurité fourni par l'Organisateur avant un événement, et à s'assurer d'être médicalement aptes à participer. Nous encourageons les Organisateurs à détenir une assurance responsabilité appropriée et à obtenir leurs propres décharges de participants lorsque cela convient à leur activité."
          ),
          p(
            "Conformément au droit québécois, rien dans la présente section ni ailleurs dans les présentes Conditions n'exclut ni ne limite la responsabilité de Playver pour un préjudice corporel ou moral causé par sa propre faute. Cette section vise à décrire la nature des activités offertes par l'entremise du Service et les rôles respectifs de Playver et des Organisateurs — non à exclure une responsabilité qui ne peut légalement être exclue."
          ),
        ],
      },
      {
        id: "organizer-responsibilities",
        heading: "5. Responsabilités additionnelles des Organisateurs",
        blocks: [
          p("Si vous créez ou gérez un événement, un tournoi, une équipe ou une organisation sur Playver, vous acceptez également de :"),
          list([
            "Fournir des renseignements exacts sur votre événement, y compris les dates, le lieu, les prix et toute exigence d'âge ou d'admissibilité;",
            "Énoncer clairement, au moment de l'inscription, toute condition de remboursement ou d'annulation propre à votre événement, conformément à notre Politique de remboursement et d'annulation;",
            "Respecter toutes les lois applicables, y compris celles relatives à la sécurité des enfants, à la protection des renseignements personnels, aux assurances et à la protection du consommateur;",
            "Ne recueillir auprès des participants (y compris au moyen de formulaires d'inscription personnalisés) que les renseignements personnels nécessaires à l'événement, et les traiter de façon responsable;",
            "Aviser rapidement les participants, par l'entremise du Service, si un événement est annulé, reporté ou modifié de façon importante.",
          ]),
          p(
            "Playver peut retirer une annonce, suspendre la capacité d'un Organisateur à percevoir des paiements, ou résilier un compte qui contrevient aux présentes Conditions, à notre Politique d'utilisation acceptable ou à la loi applicable."
          ),
        ],
      },
      {
        id: "payments",
        heading: "6. Paiements, portefeuille Playver et frais",
        blocks: [
          p(
            "Les inscriptions payantes sur Playver sont traitées au moyen du portefeuille Playver. Vous pouvez ajouter des fonds à votre portefeuille par carte; le paiement d'un événement, tournoi ou équipe payant applique d'abord votre solde de portefeuille au prix, puis facture tout montant restant à votre carte — l'Organisateur reçoit le prix affiché en entier dans tous les cas. Les Organisateurs peuvent retirer les fonds disponibles de leur portefeuille vers un compte bancaire lié par l'entremise de notre partenaire de paiement, Stripe, sous réserve d'une vérification d'identité et des délais de retenue et montants minimaux décrits dans notre Politique de remboursement et d'annulation."
          ),
          p(
            "Les paiements par carte sont traités par Stripe, Inc. Playver ne conserve pas votre numéro de carte complet. Les détails relatifs aux remboursements, aux retenues et aux frais figurent dans notre Politique de remboursement et d'annulation, laquelle fait partie intégrante des présentes Conditions."
          ),
          p(
            "Nous pourrions imposer des frais de plateforme ou de service à l'avenir. Tout frais vous sera divulgué avant que vous ne le payiez. Nous n'imposons pas de frais rétroactifs sur des transactions déjà complétées."
          ),
        ],
      },
      {
        id: "content-conduct",
        heading: "7. Votre contenu et votre conduite",
        blocks: [
          p(
            "Vous conservez la propriété du contenu que vous soumettez au Service (photos de profil, logos d'équipe, descriptions d'événements, messages et contenu similaire, le « Contenu utilisateur »). En soumettant du Contenu utilisateur, vous accordez à Playver une licence non exclusive, mondiale et libre de redevances pour héberger, stocker, reproduire et afficher ce contenu uniquement aux fins d'exploitation et de promotion du Service."
          ),
          p(
            "Vous êtes responsable de votre Contenu utilisateur et de votre conduite sur le Service. Votre utilisation du Service est également régie par notre Politique d'utilisation acceptable, qui énonce les conduites interdites."
          ),
        ],
      },
      {
        id: "ip",
        heading: "8. Propriété intellectuelle",
        blocks: [
          p(
            "Le Service, y compris sa conception, ses logiciels, ses logos, ainsi que le nom et les marques Playver, appartiennent à Playver Inc. ou à ses concédants de licence et sont protégés par les lois sur la propriété intellectuelle. Sauf pour le droit limité d'utiliser le Service tel que prévu, les présentes Conditions ne vous accordent aucun droit sur notre propriété intellectuelle."
          ),
        ],
      },
      {
        id: "third-party",
        heading: "9. Services tiers",
        blocks: [
          p(
            "Le Service repose sur des fournisseurs tiers, notamment Stripe (paiements), pour fonctionner. Nous choisissons ces fournisseurs avec soin, mais nous ne sommes pas responsables des interruptions, erreurs ou actes ou omissions de fournisseurs tiers qui échappent à notre contrôle raisonnable."
          ),
        ],
      },
      {
        id: "disclaimers",
        heading: "10. Avis de non-responsabilité",
        blocks: [
          p(
            "Le Service est fourni « tel quel » et « selon sa disponibilité ». Dans toute la mesure permise par la loi, Playver rejette toute garantie, expresse ou implicite, y compris les garanties de qualité marchande, d'adéquation à un usage particulier et d'absence de contrefaçon, et ne garantit pas que le Service sera ininterrompu, sécurisé ou exempt d'erreurs, ni que les renseignements fournis par les Organisateurs ou d'autres utilisateurs sont exacts ou fiables."
          ),
          p(
            "La présente section n'affecte aucune garantie légale dont vous bénéficiez en vertu de la Loi sur la protection du consommateur du Québec ou de toute autre loi applicable à laquelle il ne peut être renoncé."
          ),
        ],
      },
      {
        id: "liability",
        heading: "11. Limitation de responsabilité",
        blocks: [
          p(
            "Dans toute la mesure permise par la loi, la responsabilité totale de Playver envers vous découlant du Service n'excédera pas le plus élevé des montants suivants : (a) les frais que vous avez versés à Playver (à l'exclusion des sommes versées aux Organisateurs) au cours des 12 mois précédant la réclamation, ou (b) 100 $ CA. Playver ne sera pas responsable des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs, ni des pertes de profits, découlant de votre utilisation du Service."
          ),
          p(
            "Conformément au droit québécois, rien dans les présentes Conditions n'exclut ni ne limite notre responsabilité pour un préjudice corporel ou moral causé par notre faute, pour une faute lourde ou intentionnelle, ni pour toute autre responsabilité qui ne peut légalement être exclue ou limitée."
          ),
        ],
      },
      {
        id: "indemnification",
        heading: "12. Indemnisation",
        blocks: [
          p(
            "Vous acceptez de défendre, d'indemniser et de tenir Playver indemne de toute réclamation, dommage et dépense raisonnable (y compris les frais juridiques) découlant de votre violation des présentes Conditions, de votre Contenu utilisateur, de votre événement ou activité en tant qu'Organisateur, ou de votre violation de la loi applicable, sauf dans la mesure où cela résulte de la faute de Playver."
          ),
        ],
      },
      {
        id: "termination",
        heading: "13. Suspension et résiliation",
        blocks: [
          p(
            "Vous pouvez cesser d'utiliser le Service et fermer votre compte en tout temps en communiquant avec nous. Nous pouvons suspendre ou résilier votre accès au Service si vous contrevenez aux présentes Conditions, à notre Politique d'utilisation acceptable ou à la loi applicable, ou pour protéger la sécurité ou l'intégrité du Service, avec préavis lorsque raisonnablement possible. Les sections des présentes Conditions qui, de par leur nature, doivent survivre à la résiliation (y compris les paiements déjà dus, la responsabilité et le règlement des différends) y survivront."
          ),
        ],
      },
      {
        id: "changes",
        heading: "14. Modifications des présentes Conditions",
        blocks: [
          p(
            "Nous pouvons mettre à jour les présentes Conditions de temps à autre. Si nous apportons des changements importants, nous fournirons un préavis raisonnable (par exemple, par courriel ou avis dans l'application) avant l'entrée en vigueur des changements. L'utilisation continue du Service après l'entrée en vigueur des changements constitue une acceptation des Conditions mises à jour."
          ),
        ],
      },
      {
        id: "governing-law",
        heading: "15. Droit applicable et différends",
        blocks: [
          p(
            "Les présentes Conditions sont régies par les lois de la province de Québec et les lois fédérales du Canada qui y sont applicables, sans égard aux principes de conflits de lois. Sous réserve de tout droit dont vous disposez d'intenter un recours dans votre juridiction locale en vertu d'une loi impérative de protection du consommateur, vous et Playver convenez que tout différend découlant des présentes Conditions ou du Service sera soumis à la compétence exclusive des tribunaux de la province de Québec."
          ),
          p(
            "Les versions française et anglaise des présentes Conditions ont la même valeur juridique. Si vous résidez au Québec, la version française prévaudra en cas d'incompatibilité entre les deux versions."
          ),
        ],
      },
      {
        id: "general",
        heading: "16. Dispositions générales",
        blocks: [
          p(
            "Si une disposition des présentes Conditions est jugée inapplicable, les autres dispositions demeurent pleinement en vigueur. Notre défaut d'appliquer une disposition ne constitue pas une renonciation à celle-ci. Vous ne pouvez céder les présentes Conditions sans notre consentement; nous pouvons céder les présentes Conditions dans le cadre d'une fusion, d'une acquisition ou d'une vente d'actifs. Aucune partie n'est responsable des retards causés par des événements hors de son contrôle raisonnable."
          ),
        ],
      },
      {
        id: "contact",
        heading: "17. Nous joindre",
        blocks: [p("Toute question au sujet des présentes Conditions peut être envoyée à playver@gmail.com.")],
      },
    ],
  },
};

export default terms;
