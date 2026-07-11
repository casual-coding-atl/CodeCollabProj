/**
 * Escape a user-supplied string so it can be used literally inside a MongoDB
 * `$regex` query. Prevents ReDoS and 500s caused by invalid/crafted patterns.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = escapeRegExp;
