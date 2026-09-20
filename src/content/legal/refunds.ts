import { LegalContent, LEGAL_UPDATED, LEGAL_UPDATED_FR, p } from "./types";

const refunds: LegalContent = {
  en: {
    title: "Refund & Cancellation Policy",
    updated: LEGAL_UPDATED,
    intro: [
      p(
        "This Refund & Cancellation Policy explains how the Playver wallet works, when payments for events and tournaments are refunded, and how organizer withdrawals work. It forms part of our Terms of Service. Nothing in this Policy limits any right you have under Quebec's Consumer Protection Act or other applicable law."
      ),
    ],
    sections: [
      {
        id: "wallet-topups",
        heading: "1. Adding funds to your wallet",
        blocks: [
          p(
            "You can add funds to your Playver wallet by card. You are credited the full amount you top up; Playver absorbs the card network's processing fee on top-ups rather than deducting it from your balance."
          ),
          p(
            "Wallet top-ups are not refundable to your original payment method except where required by law or where we determine, at our discretion, that a top-up was made in error or as a result of fraud. Funds added to your wallet remain available in your wallet to use toward future paid events, tournaments, or teams, or to withdraw as described in Section 5."
          ),
        ],
      },
      {
        id: "paying-for-events",
        heading: "2. Paying for events and tournaments",
        blocks: [
          p(
            "When you register for a paid event, tournament, or team, we apply your available wallet balance to the listed price first. If your wallet balance doesn't cover the full price, the remaining amount is charged to your card. Either way, the Organizer receives the full listed price. Playver does not charge you a separate service fee on top of the listed price at this time."
          ),
          p(
            "Unless the event listing states otherwise, or unless Section 3 applies, payments for events and tournaments are not refundable if you simply change your mind or are unable to attend. Some Organizers may choose to offer their own refund window for voluntary withdrawals; where they do, the terms will be shown to you on the event page before you pay, and those terms apply in addition to this Policy."
          ),
        ],
      },
      {
        id: "organizer-cancellation",
        heading: "3. When an Organizer cancels or postpones an event",
        blocks: [
          p(
            "If an Organizer cancels an event, participants who paid through Playver are automatically refunded to their Playver wallet. You do not need to request this refund — it is triggered automatically when the Organizer marks the event as cancelled."
          ),
          p(
            "If an Organizer postpones an event to a new date, your registration and payment generally carry over to the new date. If you are unable to attend the new date, contact the Organizer about their options, or contact us at playver@gmail.com if you believe you are entitled to a refund and cannot resolve it with the Organizer."
          ),
          p(
            "Refunds under this section are credited to your Playver wallet, not to your original card, unless we determine otherwise is required. Wallet funds can be used toward another event or withdrawn as described in Section 5."
          ),
        ],
      },
      {
        id: "withdrawal-hold",
        heading: "4. Why organizer funds are held for 48 hours after an event",
        blocks: [
          p(
            "To make sure the automatic refund described in Section 3 can always be paid, funds an Organizer receives from a paid event or tournament are held — not available for withdrawal — until 48 hours after that event's scheduled end date. If the event is cancelled, the funds tied to it remain held until any related refund has been completed."
          ),
          p(
            "This hold exists to protect participants: without it, an Organizer could withdraw all funds immediately after collecting registrations and then cancel the event, leaving nothing available to refund. The hold applies only to funds tied to a specific event during that event's hold period — it does not affect your ability to use your own wallet balance to pay for events, or to withdraw funds that are not subject to a hold."
          ),
        ],
      },
      {
        id: "withdrawals",
        heading: "5. Withdrawing funds to a bank account",
        blocks: [
          p(
            "Any user can connect a payout account and withdraw available (non-held) wallet funds to a linked bank account through our payment partner, Stripe. Withdrawals require identity verification through Stripe, a minimum withdrawal amount of CAD $10, and are subject to the hold described in Section 4 where applicable."
          ),
          p(
            "Playver currently charges no fee on withdrawals. We may introduce fees in the future; if we do, we will disclose them to you before you confirm a withdrawal."
          ),
        ],
      },
      {
        id: "disputes",
        heading: "6. Payment disputes and chargebacks",
        blocks: [
          p(
            "If you believe you were charged in error, please contact us at playver@gmail.com before initiating a chargeback with your card issuer, so we can investigate and resolve the issue directly. Initiating a chargeback for a transaction that was properly authorized may result in suspension of your account while the dispute is resolved."
          ),
        ],
      },
      {
        id: "changes",
        heading: "7. Changes to this Policy",
        blocks: [
          p(
            "We may update this Policy from time to time. If we make material changes, we will provide reasonable notice before the changes take effect. Changes will not apply retroactively to reduce refunds already owed to you under the version of this Policy in effect at the time of your payment."
          ),
        ],
      },
      {
        id: "contact",
        heading: "8. Contact us",
        blocks: [p("Questions about a payment, refund, or withdrawal can be sent to playver@gmail.com.")],
      },
    ],
  },
  fr: {
    title: "Politique de remboursement et d'annulation",
    updated: LEGAL_UPDATED_FR,
    intro: [
      p(
        "La présente Politique de remboursement et d'annulation explique le fonctionnement du portefeuille Playver, les cas où les paiements d'événements et de tournois sont remboursés, ainsi que le fonctionnement des retraits des organisateurs. Elle fait partie de nos Conditions d'utilisation. Rien dans la présente Politique ne limite les droits que vous tenez de la Loi sur la protection du consommateur du Québec ou de toute autre loi applicable."
      ),
    ],
    sections: [
      {
        id: "wallet-topups",
        heading: "1. Ajouter des fonds à votre portefeuille",
        blocks: [
          p(
            "Vous pouvez ajouter des fonds à votre portefeuille Playver par carte. Le montant intégral de votre recharge vous est crédité; Playver absorbe les frais de traitement du réseau de cartes sur les recharges plutôt que de les déduire de votre solde."
          ),
          p(
            "Les recharges de portefeuille ne sont pas remboursables sur votre mode de paiement original, sauf lorsque la loi l'exige ou lorsque nous déterminons, à notre discrétion, qu'une recharge a été effectuée par erreur ou à la suite d'une fraude. Les fonds ajoutés à votre portefeuille demeurent disponibles dans votre portefeuille pour de futurs événements, tournois ou équipes payants, ou pour un retrait tel que décrit à la section 5."
          ),
        ],
      },
      {
        id: "paying-for-events",
        heading: "2. Payer pour des événements et tournois",
        blocks: [
          p(
            "Lorsque vous vous inscrivez à un événement, un tournoi ou une équipe payant, nous appliquons d'abord le solde disponible de votre portefeuille au prix affiché. Si votre solde ne couvre pas le prix en entier, le montant restant est facturé à votre carte. Dans tous les cas, l'Organisateur reçoit le prix affiché en entier. Playver ne vous facture actuellement aucuns frais de service additionnels au-delà du prix affiché."
          ),
          p(
            "Sauf indication contraire sur l'annonce de l'événement, ou sauf application de la section 3, les paiements d'événements et de tournois ne sont pas remboursables si vous changez simplement d'avis ou êtes dans l'impossibilité d'y assister. Certains Organisateurs peuvent choisir d'offrir leur propre délai de remboursement pour un désistement volontaire; le cas échéant, les conditions vous seront présentées sur la page de l'événement avant le paiement, et s'ajoutent à la présente Politique."
          ),
        ],
      },
      {
        id: "organizer-cancellation",
        heading: "3. Lorsqu'un Organisateur annule ou reporte un événement",
        blocks: [
          p(
            "Si un Organisateur annule un événement, les participants ayant payé par Playver sont automatiquement remboursés dans leur portefeuille Playver. Vous n'avez pas à demander ce remboursement — il est déclenché automatiquement lorsque l'Organisateur marque l'événement comme annulé."
          ),
          p(
            "Si un Organisateur reporte un événement à une nouvelle date, votre inscription et votre paiement sont généralement reportés à la nouvelle date. Si vous ne pouvez pas assister à la nouvelle date, communiquez avec l'Organisateur au sujet de ses options, ou avec nous à playver@gmail.com si vous croyez avoir droit à un remboursement et ne pouvez pas régler la situation avec l'Organisateur."
          ),
          p(
            "Les remboursements visés par la présente section sont crédités à votre portefeuille Playver, et non à votre carte d'origine, à moins que nous déterminions qu'une autre méthode est requise. Les fonds du portefeuille peuvent être utilisés pour un autre événement ou retirés tel que décrit à la section 5."
          ),
        ],
      },
      {
        id: "withdrawal-hold",
        heading: "4. Pourquoi les fonds des organisateurs sont retenus pendant 48 heures après un événement",
        blocks: [
          p(
            "Afin de garantir que le remboursement automatique décrit à la section 3 puisse toujours être versé, les fonds qu'un Organisateur reçoit d'un événement ou tournoi payant sont retenus — non disponibles pour retrait — jusqu'à 48 heures après la date de fin prévue de cet événement. Si l'événement est annulé, les fonds qui y sont liés demeurent retenus jusqu'à ce que tout remboursement connexe soit complété."
          ),
          p(
            "Cette retenue vise à protéger les participants : sans elle, un Organisateur pourrait retirer tous les fonds immédiatement après avoir perçu les inscriptions, puis annuler l'événement, ne laissant rien de disponible pour un remboursement. La retenue ne s'applique qu'aux fonds liés à un événement précis pendant la période de retenue de cet événement — elle n'affecte pas votre capacité à utiliser votre propre solde de portefeuille pour payer des événements, ni à retirer des fonds qui ne font pas l'objet d'une retenue."
          ),
        ],
      },
      {
        id: "withdrawals",
        heading: "5. Retirer des fonds vers un compte bancaire",
        blocks: [
          p(
            "Tout utilisateur peut lier un compte de versement et retirer les fonds disponibles (non retenus) de son portefeuille vers un compte bancaire lié, par l'entremise de notre partenaire de paiement, Stripe. Les retraits exigent une vérification d'identité par Stripe, un montant minimal de retrait de 10 $ CA, et sont assujettis à la retenue décrite à la section 4, le cas échéant."
          ),
          p(
            "Playver ne facture actuellement aucuns frais sur les retraits. Nous pourrions instaurer des frais à l'avenir; le cas échéant, nous vous les divulguerons avant que vous ne confirmiez un retrait."
          ),
        ],
      },
      {
        id: "disputes",
        heading: "6. Différends de paiement et rétrofacturations",
        blocks: [
          p(
            "Si vous croyez avoir été facturé par erreur, veuillez communiquer avec nous à playver@gmail.com avant d'entamer une rétrofacturation auprès de l'émetteur de votre carte, afin que nous puissions enquêter et régler la situation directement. Le fait d'entamer une rétrofacturation pour une transaction dûment autorisée peut entraîner la suspension de votre compte pendant la résolution du différend."
          ),
        ],
      },
      {
        id: "changes",
        heading: "7. Modifications de la présente Politique",
        blocks: [
          p(
            "Nous pouvons mettre à jour la présente Politique de temps à autre. Si nous apportons des changements importants, nous fournirons un préavis raisonnable avant leur entrée en vigueur. Les changements ne s'appliqueront pas rétroactivement de manière à réduire les remboursements déjà dus en vertu de la version de la présente Politique en vigueur au moment de votre paiement."
          ),
        ],
      },
      {
        id: "contact",
        heading: "8. Nous joindre",
        blocks: [p("Toute question au sujet d'un paiement, d'un remboursement ou d'un retrait peut être envoyée à playver@gmail.com.")],
      },
    ],
  },
};

export default refunds;
