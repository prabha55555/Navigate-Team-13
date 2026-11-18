/**
 * Consistent JSON shape for API documents: `_id` → `id` (string), no `__v`.
 *
 * Usage:
 *   const { toJSONPlugin } = require('../utils/serialize');
 *   schema.plugin(toJSONPlugin, { hide: ['password'] });  // doc.toJSON() / res.json(doc)
 *   serialize(leanDoc)                                     // for .lean() results
 */

/** Converts ObjectIds (and other non-plain values) nested in a lean result to strings. */
function normalize(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (value instanceof Date) return value;
  if (value instanceof Map) return normalize(Object.fromEntries(value));
  if (typeof value === 'object') {
    if (value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') return value.toString();
    if (typeof value.toHexString === 'function') return value.toHexString();
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (key === '__v') continue;
      if (key === '_id') {
        out.id = v == null ? v : String(v);
        continue;
      }
      out[key] = normalize(v);
    }
    return out;
  }
  return value;
}

/**
 * Serialize a lean object (or array of them) to the API shape.
 * @param {object|object[]} doc
 * @param {{ hide?: string[] }} [opts] top-level keys to drop
 */
function serialize(doc, { hide = [] } = {}) {
  if (Array.isArray(doc)) return doc.map((d) => serialize(d, { hide }));
  if (!doc || typeof doc !== 'object') return doc;
  const plain = typeof doc.toObject === 'function' ? doc.toObject({ depopulate: false }) : doc;
  const out = normalize(plain);
  for (const key of hide) delete out[key];
  return out;
}

/** Mongoose schema plugin: applies `serialize` to toJSON / toObject({ transform }). */
function toJSONPlugin(schema, { hide = [] } = {}) {
  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform: (_doc, ret) => {
      const out = normalize(ret);
      for (const key of hide) delete out[key];
      return out;
    }
  });
}

module.exports = { serialize, toJSONPlugin };
