// Simple sanitization middleware to strip HTML/script tags from incoming data
// This is a lightweight helper to reduce XSS risk without extra dependencies.

const stripTags = (value) => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '') // remove script blocks
    .replace(/<[^>]*>/g, '') // remove remaining tags
    .trim();
};

const sanitizeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v));
  }
  if (value && typeof value === 'object') {
    const clean = {};
    for (const key of Object.keys(value)) {
      clean[key] = sanitizeValue(value[key]);
    }
    return clean;
  }
  return stripTags(value);
};

const sanitize = () => (req, _res, next) => {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  next();
};

module.exports = sanitize;
