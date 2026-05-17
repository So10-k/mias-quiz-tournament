# Seed the "Author Handbook" private category + a single
# comprehensive guide topic that documents every recent feature for
# Sam + Mia (the authors).
#
# Idempotent. Re-running updates the guide topic in place.
#
# Run inside the Discourse container:
#   sudo cp seed-author-handbook.rb /var/discourse/shared/standalone/seed-author-handbook.rb
#   sudo docker exec app rails runner /shared/seed-author-handbook.rb

CATEGORY_SLUG = "author-handbook"
CATEGORY_NAME = "Author Handbook"
TOPIC_TITLE = "📖 The Author's Handbook — every feature, in one place"
TOPIC_FIELD = "qb_is_author_handbook"

authors_group = Group.find_by(name: "authors")
abort "  ⚠ authors group missing — run seed-permissions.rb first" unless authors_group

# ── category ─────────────────────────────────────────────────────
cat = Category.find_by(slug: CATEGORY_SLUG)
if cat
  puts "  ↺ category exists: #{CATEGORY_NAME}"
else
  cat = Category.new(
    name: CATEGORY_NAME,
    slug: CATEGORY_SLUG,
    description:
      "Private reference for Sam + Mia: how every quiz-site ↔ forum " \
      "feature works, what commands exist, what to do in common " \
      "situations. Visible only to authors.",
    color: "FFD93D",
    text_color: "1B2A4E",
    user_id: authors_group.users.first&.id ||
             User.where(admin: true).where.not(username_lower: %w[discobot system]).first&.id,
  )
  cat.save!
  puts "  ✓ created category: #{CATEGORY_NAME}"
end
cat.set_permissions(authors: :full)
cat.save!

# ── handbook content ─────────────────────────────────────────────
handbook = <<~MD.freeze
  # 📖 The Author's Handbook

  Hey Sam, hey Mia. This is the one-stop reference for everything
  the quiz site and the forum can do together. It's just for you
  two — no one else can read this category.

  Last updated: #{Date.today.strftime("%B %-d, %Y")}.

  ---

  ## 1. 👥 Forum groups (auto-synced from the bracket)

  Every time someone signs in to the forum, the quiz site computes
  their tournament status and tells Discourse which groups they
  should be in. You don't have to do anything for these — they're
  driven entirely by the bracket.

  | Group | Who's in it |
  |---|---|
  | `players` | Currently enrolled and not eliminated |
  | `spectators` | Eliminated this season OR never enrolled |
  | `semi_finalists` | Reached a semifinal matchup (lifelong) |
  | `finalists` | Reached the final matchup (lifelong) |
  | `champions` | Won a tournament outright (lifelong, gold flair) |
  | `alumni` | Has any past or present enrollment (lifelong) |
  | `predictors` | Has made any bracket predictions |

  Their **title** + **flair** also auto-update — the highest-rank
  group wins. A past champion who's a spectator this season still
  wears the 🏆 crown.

  ## 2. 🛡️ Manual forum role grants

  For staff-flavoured roles that aren't bracket-driven:

  - `authors` — full admin (just you two)
  - `trial_moderators` — TL4 + can pin/edit/lock in public categories
  - `honorary_mods` — TL4 site-wide (edit any post, lock topics)
  - `regulars` — TL3 (handles flags by quorum)

  Manage them at https://quiz.miaswebsites.art/host/forum-roles —
  checkbox grid, "Save row" per user. Changes take effect on the
  user's next forum login (which auto-reconciles via SSO).

  ## 3. 📊 Tournament HUD strip

  Slim banner under the Discourse header on every page showing
  current chapter, players still in, countdown, and champion. Fed
  by `https://quiz.miaswebsites.art/api/forum/state`. Refreshes
  every 5 minutes.

  Also: every user's profile (`/u/<name>/summary`) has a
  picture-book Tournament Record card with their lifetime stats
  (wins, matches, championships, predictions, QOTD answers,
  furthest round) and current status.

  ## 4. 📰 Match recap auto-posts

  When you set a match winner from `/host`, a topic like
  *"Mia defeats Sam — Main Bracket Round 2"* auto-posts in the
  Round Recaps category. Idempotent — flipping a winner doesn't
  create duplicates. If Discourse is down it fails silently.

  ## 5. 📝 Staff action log

  Every meaningful host action (set winner, generate bracket, end
  tournament, send announcement, block IP, grant forum role, etc.)
  shows up in **/admin/logs/staff_action_logs** alongside Discourse-
  native admin events. Includes actor, target, before/after values,
  full details.

  Auth: signed with the SSO secret (HMAC-SHA256). One secret to
  rotate.

  ## 6. 🌞 First-login terms gate

  New SSO users land in the `pending_terms` group. They get a
  system PM titled *"🌞 Welcome — please agree to continue"* with
  a few simple rules. Every other forum page redirects them back
  to that PM until they reply with **"yes"** or **"agree"**.

  Once they reply, they're released from `pending_terms` and get a
  "🎉 You're in!" confirmation. Existing users (you, Mia, etc.)
  are never affected.

  ## 7. 🔒 Admin-triggered hold + appeal flow

  ### To put someone in time-out:
  Open a PM with `@system` and type:
  ```
  hold @username reason here
  ```
  Bot adds them to `held_for_review`, sends them an "Appeal
  required" PM with the reason, and redirects every page they visit
  back to that PM.

  ### Shortcut release:
  ```
  unhold @username
  ```
  Releases immediately, skips the appeal flow.

  ### Appeal flow:
  1. Held user replies in their appeal PM with their explanation
  2. Bot files a topic *"Appeal: @username"* in the **Held Reviews**
     category (private, just us)
  3. You reply with **`yes`** / **`approve`** / **`release`** to
     release them, or **`no`** / **`deny`** / **`reject`** to deny
     (they can submit another appeal later)
  4. Bot DMs them the result

  ## 8. 🤖 System Activity Log

  The **System Logs** category (private, just us) has one rolling
  topic where the bot logs every action it takes:
  - New user added to pending_terms / agreed to terms
  - Hold imposed / unhold imposed
  - Appeal filed
  - Yes/no vote on an appeal

  Append-only — read it like a feed; don't reply manually.

  ## 9. 💬 Embeddable widgets in posts

  In any forum post, type:
  - `[quizbook-bracket]` — embeds the live tournament bracket
  - `[quizbook-qotd]` — embeds today's question of the day
  - `[quizbook-standings]` — embeds the current standings

  They render as iframes pulled from the quiz site.

  ## 10. 📜 Public Announcements ↔ blog mirror

  Topics in the Discourse **Announcements** category auto-mirror
  to the main-site `/blog` page alongside Sam + Mia's native
  long-form articles. Mirrored topics show with a "💬 From the
  forum" badge.

  Native-only articles (from `/staff/articles`) feed the email
  digest pipeline; mirrored topics don't.

  ## 11. 🛠️ Common situations

  **Someone's making trouble**
  → DM `@system`: `hold @them reason`. They can appeal.

  **You held the wrong person**
  → DM `@system`: `unhold @them`. Done.

  **A new player just signed up but isn't seeing anything**
  → That's the terms gate working. Tell them to check their
    inbox and reply "yes" to the welcome PM.

  **A forum role looks wrong**
  → /host/forum-roles, save the right row. Takes effect on their
    next login.

  **The bracket auto-recap didn't fire**
  → Check that you set the winner from `/host` (not directly in
    the DB). Also make sure DISCOURSE_API_KEY is set in Vercel.

  **The forum's down**
  → SSH to the EC2 box, `sudo docker ps` — if `app` is missing,
    `cd /var/discourse && sudo ./launcher start app`. If a rebuild
    is mid-flight, check `/tmp/rebuild*.log` for what step it's on.

  ---

  *Re-run `seed-author-handbook.rb` to refresh this topic in
  place — the script is idempotent.*
MD

# ── topic upsert ─────────────────────────────────────────────────
existing_topic =
  Topic
    .joins(
      "LEFT JOIN topic_custom_fields tcf ON tcf.topic_id = topics.id"
    )
    .where(
      "tcf.name = ? AND tcf.value = ?",
      TOPIC_FIELD,
      "true"
    )
    .first

if existing_topic
  first_post = existing_topic.first_post
  if first_post
    PostRevisor.new(first_post).revise!(
      Discourse.system_user,
      { raw: handbook, title: TOPIC_TITLE },
      bypass_bump: true,
      skip_validations: true,
    )
    puts "  ↺ refreshed handbook topic ##{existing_topic.id}"
  else
    puts "  ⚠ topic ##{existing_topic.id} has no first post — skipping update"
  end
else
  result =
    PostCreator.create!(
      Discourse.system_user,
      title: TOPIC_TITLE,
      raw: handbook,
      category: cat.id,
      skip_validations: true,
    )
  topic = result&.topic
  topic.custom_fields[TOPIC_FIELD] = "true"
  topic.save_custom_fields(true)
  # Pin so it stays at the top of the category.
  topic.update_pinned(true, true) rescue nil
  puts "  ✓ created handbook topic ##{topic.id}"
end

puts "\n✅ Author Handbook ready in #{CATEGORY_NAME} (private to authors)."
