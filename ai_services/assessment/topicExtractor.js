/**
 * Deterministic topic extraction from syllabus text, used whenever the AI
 * model is unavailable or returns something unusable, and to clean up topic
 * lists the model does return.
 */

const MAX_TOPICS = 15;
const MAX_TOPIC_LENGTH = 80;

// "1.", "2)", "(3)", "a.", "-", "•", "Week 3:", "Unit 2 -", "Module 4." ...
const LIST_PREFIX = /^\s*(?:[-–—•*▪◦·]+|\(?\d{1,3}[.)]|\(?[A-Za-z][.)](?=\s)|(?:week|unit|module|chapter|lecture|lesson|topic|part|session)\s*\d{1,3}\s*[:.)\-–—]?)\s*/i;
const LIST_ITEM = /^\s*(?:[-–—•*▪◦·]|\(?\d{1,3}[.)]|\(?[A-Za-z][.)]\s|(?:week|unit|module|chapter|lecture|lesson|session)\s*\d{1,3}\b)/i;
// Lines that introduce a topic list ("Topics:", "Course outline", "Modules covered:").
const SECTION_HEADER = /^\s*(?:course\s+|main\s+|key\s+|weekly\s+)?(?:topics?|contents?|modules?|units?|outline|schedule|lessons?|curriculum|syllabus|chapters?)(?:\s+(?:covered|overview|outline|list|schedule))?\s*:?\s*(.*)$/i;
// "Grading: 40%", "Assessment: weekly quizzes" — any other labelled line ends a section.
const OTHER_LABEL = /^\s*[A-Z][\w &/()'-]{0,40}:\s*\S/;
const NOT_A_TOPIC = /^(?:course\s+)?(?:topics?|contents?|modules?|units?|outline|schedule|lessons?|curriculum|syllabus|chapters?|overview|grading|assessments?|policies|policy|objectives?|instructor|textbooks?|prerequisites?)$/i;

/** Strips list markers and stray punctuation from one candidate topic. */
function cleanTopic(raw) {
  let t = String(raw || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2 && LIST_PREFIX.test(t); i += 1) t = t.replace(LIST_PREFIX, '').trim();
  return t.replace(/^[\s:;,.\-–—]+|[\s:;,.\-–—]+$/g, '').replace(/\*\*/g, '').trim();
}

function isTopic(t) {
  return t.length >= 3
    && t.length <= MAX_TOPIC_LENGTH
    && /[A-Za-z]/.test(t)
    && !/[{}[\]"\\]/.test(t)
    && !NOT_A_TOPIC.test(t);
}

/**
 * Normalises a topic list: items containing several lines are split, list
 * numbering/bullets are removed, junk (JSON fragments, very long lines,
 * headings) is dropped, and duplicates are removed case-insensitively.
 * @param {Array} list topics from any source (strings; other values ignored)
 * @returns {string[]}
 */
function cleanTopicList(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : [])
    .filter((item) => typeof item === 'string')
    .flatMap((item) => item.split(/\r?\n/))
    .map(cleanTopic)
    .forEach((t) => {
      const key = t.toLowerCase();
      if (isTopic(t) && !seen.has(key)) {
        seen.add(key);
        out.push(t);
      }
    });
  return out.slice(0, MAX_TOPICS);
}

/**
 * Whether a topic list looks like model/fallback garbage rather than topics
 * (JSON fragments, multi-line blobs, overly long entries).
 */
function looksLikeJunk(list) {
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.some((item) => typeof item !== 'string'
    || /[{}[\]"\\\n]/.test(item)
    || item.trim().length > MAX_TOPIC_LENGTH);
}

/**
 * Extracts topics from raw syllabus text:
 *  1. lines under a "Topics:" / "Modules" / "Course outline" style heading
 *     (until a blank line or another labelled line), or an inline list after it;
 *  2. otherwise every numbered / bulleted / "Week N:" line in the document.
 * @param {string} text
 * @returns {string[]}
 */
function extractTopicsFromText(text) {
  const lines = String(text || '').split(/\r?\n/);
  const found = [];

  for (let i = 0; i < lines.length; i += 1) {
    const header = lines[i].match(SECTION_HEADER);
    // A header is a short line; long prose that merely starts with "Course ..." is not one.
    if (!header || lines[i].trim().length > 60 + header[1].length) continue; // eslint-disable-line no-continue
    const inline = header[1].trim();
    if (inline) {
      // "Topics: arrays, lists, trees" — an inline list.
      if (/[,;]/.test(inline)) found.push(...inline.split(/[,;]/));
      else if (LIST_ITEM.test(inline)) found.push(inline);
      else continue; // eslint-disable-line no-continue
    }
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j += 1; // allow one gap after the heading
    for (; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.trim() === '') break;
      if (!LIST_ITEM.test(line) && OTHER_LABEL.test(line)) break;
      found.push(line);
    }
  }

  if (!cleanTopicList(found).length) {
    lines.filter((line) => LIST_ITEM.test(line)).forEach((line) => found.push(line));
  }
  return cleanTopicList(found);
}

module.exports = { cleanTopicList, extractTopicsFromText, looksLikeJunk };
