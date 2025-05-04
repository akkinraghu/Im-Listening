// This file completely overrides the pgvector module during build time
// It's used in the next.config.js to replace the pgvector/pg module

module.exports = {
  registerType: function() {
    console.log('Using pgvector override - no actual registration happening');
    return null;
  }
};
