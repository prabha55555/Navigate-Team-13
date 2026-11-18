/**
 * Topic normalisation. A course defines canonical topics (e.g. "queues");
 * questions written by people or AI use free text ("Queue Fundamentals",
 * "Queues"). Every question topic is mapped to the course's canonical topic
 * when saved, and every aggregation groups by the canonical name.
 */
const STOP_WORDS = new Set(['and', 'of', 'the', 'in', 'to', 'with', 'a', 'an', 'for', 'on', 'vs', 'versus']);

const cleanTopic = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 120);
const topicKey = (t) => cleanTopic(t).toLowerCase();

function singular(word) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(sses|xes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Significant, singularised words of a topic. */
const wordsOf = (t) => topicKey(t).split(/[^a-z0-9+#]+/).filter((w) => w && !STOP_WORDS.has(w)).map(singular);

/**
 * The course's canonical topic for `topic`:
 *  1. exact match ignoring case and spacing;
 *  2. otherwise the course topic whose words (singular/plural-insensitive) all
 *     appear in the question topic, or that contains the question topic's
 *     words ("Queue Fundamentals" → "queues", "Stacks" → "Stacks & Queues");
 *     the most specific (most words) match wins;
 *  3. otherwise the cleaned original.
 * @param {string} topic
 * @param {string[]} courseTopics
 */
function canonicalTopic(topic, courseTopics) {
  const cleaned = cleanTopic(topic);
  if (!cleaned) return '';
  const candidates = (courseTopics || []).map(cleanTopic).filter(Boolean);
  const exact = candidates.find((t) => topicKey(t) === topicKey(cleaned));
  if (exact) return exact;

  const words = wordsOf(cleaned);
  if (!words.length) return cleaned;
  const wordSet = new Set(words);
  let best = null;
  let bestScore = 0;
  candidates.forEach((t) => {
    const courseWords = wordsOf(t);
    if (!courseWords.length) return;
    const courseSet = new Set(courseWords);
    const courseInTopic = courseWords.every((w) => wordSet.has(w));
    const topicInCourse = words.every((w) => courseSet.has(w));
    if (!courseInTopic && !topicInCourse) return;
    // Prefer the course topic sharing the most words with the question topic.
    const score = courseWords.filter((w) => wordSet.has(w)).length * 10 + courseWords.length;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  });
  return best || cleaned;
}

/**
 * Points per canonical topic for a set of graded questions.
 * @param {object[]} questions { id, topic }
 * @param {object[]} results { questionId, pointsEarned, maxPoints }
 * @param {string[]} [courseTopics]
 * @returns {{ topic, pointsEarned, maxPoints, percentage }[]} weakest first (unrounded percentage in `pct`)
 */
function topicBreakdown(questions, results, courseTopics) {
  const topicOf = new Map((questions || []).map((q) => [q.id, canonicalTopic(q.topic, courseTopics)]));
  const groups = new Map();
  (results || []).forEach((r) => {
    const topic = topicOf.get(r.questionId);
    if (!topic) return;
    const key = topicKey(topic);
    const g = groups.get(key) || { topic, pointsEarned: 0, maxPoints: 0 };
    g.pointsEarned += r.pointsEarned || 0;
    g.maxPoints += r.maxPoints || 0;
    groups.set(key, g);
  });
  return [...groups.values()]
    .filter((g) => g.maxPoints > 0)
    .map((g) => ({ ...g, pct: (g.pointsEarned / g.maxPoints) * 100 }))
    // Weakest first; on a tie, the topic that lost more points.
    .sort((a, b) => a.pct - b.pct || (b.maxPoints - b.pointsEarned) - (a.maxPoints - a.pointsEarned));
}

module.exports = { cleanTopic, topicKey, canonicalTopic, topicBreakdown };
