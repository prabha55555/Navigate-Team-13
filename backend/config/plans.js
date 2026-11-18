/**
 * Plan catalog. `null` limits mean "unlimited".
 * Staff seats count owner + admin + instructor members.
 * An AI generation is one call to syllabus analysis, question generation,
 * AI feedback for a submission, or practice-quiz generation.
 */
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceDetail: 'forever',
    limits: { staffSeats: 2, students: 50, aiGenerations: 25 },
    features: ['2 staff seats', 'Up to 50 students', '25 AI generations / month', 'Assessments, proctoring & analytics']
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    priceDetail: 'per instructor / month',
    limits: { staffSeats: 25, students: 2000, aiGenerations: 1000 },
    features: ['Everything in Free', '25 staff seats', 'Up to 2,000 students', '1,000 AI generations / month', 'Larger cohorts & faculty teams']
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Contact sales',
    priceDetail: 'custom contract',
    limits: { staffSeats: null, students: null, aiGenerations: null },
    features: ['Unlimited seats & students', 'Unlimited AI generations', 'Custom branding', 'Dedicated onboarding & support']
  }
};

const PLAN_IDS = Object.keys(PLANS);

module.exports = { PLANS, PLAN_IDS };
