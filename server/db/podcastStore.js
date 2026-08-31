'use strict';

/**
 * Shared insert path for podcast records — used by the static demo seed
 * (server/db/seed.js) and by real-data ingestion (server/podcastImport.js)
 * so both write through identical SQL and identical shape assumptions.
 */
function insertPodcastRecords(db, records) {
  const subjectIdBySlug = new Map(
    db.prepare('SELECT id, slug FROM subjects').all().map((r) => [r.slug, r.id])
  );

  const insertPodcast = db.prepare(`
    INSERT INTO podcasts (
      name, slug, description, network, format, interview_style, geo_reach,
      country, state, city, location, cultural_focus, audience_desc,
      reach_estimate, accepts_guests, guest_submission_url, public_contact,
      has_video, artwork_url, website_url, is_demo, verification_source, last_verified_date
    ) VALUES (
      @name, @slug, @description, @network, @format, @interview_style, @geo_reach,
      @country, @state, @city, @location, @cultural_focus, @audience_desc,
      @reach_estimate, @accepts_guests, @guest_submission_url, @public_contact,
      @has_video, @artwork_url, @website_url, @is_demo, @verification_source, @last_verified_date
    )
  `);
  const insertPodcastSubject = db.prepare(
    'INSERT INTO podcast_subjects (podcast_id, subject_id, is_primary) VALUES (?, ?, ?)'
  );
  const insertAudience = db.prepare(
    'INSERT INTO podcast_audiences (podcast_id, audience) VALUES (?, ?)'
  );
  const insertEpisode = db.prepare(
    'INSERT INTO episodes (podcast_id, title, description, published_at) VALUES (?, ?, ?, ?)'
  );

  const insertedIds = [];
  for (const p of records) {
    const { subjects = [], audiences = [], episodes = [], ...podcastColumns } = p;
    // node:sqlite's named-parameter binding rejects object keys the SQL
    // doesn't reference (better-sqlite3 silently ignored them), so the
    // caller-side arrays above always have to be stripped before binding.
    const info = insertPodcast.run(podcastColumns);
    const podcastId = info.lastInsertRowid;
    insertedIds.push(podcastId);

    for (const [slug, isPrimary] of subjects) {
      const subjectId = subjectIdBySlug.get(slug);
      if (subjectId) insertPodcastSubject.run(podcastId, subjectId, isPrimary ? 1 : 0);
    }
    for (const audience of audiences) insertAudience.run(podcastId, audience);
    for (const ep of episodes) insertEpisode.run(podcastId, ep.title, ep.description, ep.published_at);
  }
  return insertedIds;
}

module.exports = { insertPodcastRecords };
