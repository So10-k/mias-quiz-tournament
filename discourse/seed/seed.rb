# Seed Mia's Quiz Discuss with categories + welcome topics.
#
# Idempotent: re-running this script doesn't duplicate. Categories
# are looked up by slug, topics by exact title.
#
# Run from inside the Discourse container:
#   docker exec -i app rails runner /shared/seed.rb
# (after copying the file to /var/discourse/shared/standalone/seed.rb)

# ─── helpers ────────────────────────────────────────────────────

# Pick the FIRST HUMAN admin — Discourse's `discobot` and `system`
# bots are also admins by default, but we want a real person as the
# author of the welcome topics so the forum reads as run by people,
# not bots.
SYSTEM_USERNAMES = %w[discobot system].freeze
admin = User
  .where(admin: true)
  .where.not(username_lower: SYSTEM_USERNAMES)
  .order(:id)
  .first
unless admin
  puts "❌ no human admin found — sign in once to create one, then re-run"
  exit 1
end
puts "Using admin: #{admin.username} (#{admin.email})"

# If a previous run authored topics as discobot/system, reassign those
# topics + their first posts to the real admin. Cheap fix-up that lets
# us re-run the seed safely.
def reassign_to(topic, real_admin)
  return unless SYSTEM_USERNAMES.include?(topic.user&.username_lower)
  topic.update_columns(user_id: real_admin.id)
  first = topic.first_post
  if first && SYSTEM_USERNAMES.include?(first.user&.username_lower)
    first.update_columns(user_id: real_admin.id)
  end
  puts "    re-attributed to #{real_admin.username}"
end

def upsert_category(name:, slug:, description:, color:, text_color: "1B2A4E", parent: nil, position: 0)
  cat = Category.find_by(slug: slug)
  if cat
    cat.update!(
      name: name,
      description: description,
      color: color,
      text_color: text_color,
      position: position,
    )
    puts "  ↺ updated category: #{name}"
  else
    cat = Category.create!(
      name: name,
      slug: slug,
      description: description,
      color: color,
      text_color: text_color,
      parent_category_id: parent&.id,
      position: position,
      user_id: User.where(admin: true).first.id,
    )
    puts "  ✓ created category: #{name}"
  end
  cat
end

def upsert_topic(admin:, category:, title:, raw:, pinned: false, pinned_globally: false)
  existing = Topic.where(title: title, category_id: category.id).first
  if existing
    reassign_to(existing, admin)
    # Update the first post if content drifted.
    first = existing.first_post
    if first && first.raw.strip != raw.strip
      first.revise(admin, raw: raw, edit_reason: "seed sync")
      puts "  ↺ updated topic: #{title}"
    else
      puts "  ✓ topic exists: #{title}"
    end
    if pinned && !existing.pinned_at
      existing.update_pinned(true, pinned_globally)
      puts "    pinned"
    end
    return existing
  end
  result = PostCreator.create!(
    admin,
    title: title,
    raw: raw,
    category: category.id,
    archetype: Archetype.default,
    skip_validations: true,
  )
  if pinned
    result.topic.update_pinned(true, pinned_globally)
  end
  puts "  ✓ created topic: #{title}"
  result.topic
end

# ─── categories ─────────────────────────────────────────────────

puts "\nCATEGORIES"
welcome = upsert_category(
  name: "Welcome",
  slug: "welcome",
  description: "Start here. How the forum works, who runs it, and a couple of friendly notes.",
  color: "FFD93D",
  position: 1,
)
tournament = upsert_category(
  name: "Tournament Talk",
  slug: "tournament-talk",
  description: "Predictions, smack talk, who's looking strong, who's looking shaky. The main room.",
  color: "E94B7E",
  text_color: "FFFFFF",
  position: 2,
)
recaps = upsert_category(
  name: "Round Recaps",
  slug: "round-recaps",
  description: "One topic per round. Post-round chatter, surprises, post-mortems.",
  color: "87CEEB",
  position: 3,
)
offtopic = upsert_category(
  name: "Off Topic",
  slug: "off-topic",
  description: "Anything else. Snacks, vacation photos, jokes, family news. The non-quiz room.",
  color: "7DD87D",
  position: 4,
)
help_cat = upsert_category(
  name: "Help & Suggestions",
  slug: "help-suggestions",
  description: "Stuck on something? Got an idea for the site? Drop it here — Sam reads everything.",
  color: "FFFFFF",
  position: 5,
)

# ─── topics ─────────────────────────────────────────────────────

puts "\nTOPICS"

upsert_topic(
  admin: admin,
  category: welcome,
  pinned: true,
  pinned_globally: true,
  title: "Welcome — start here",
  raw: <<~MD,
    Hi! 👋

    This is the **discussion forum** for Mia's Quiz Tournament. It's a place to chat about the games, predict the brackets, share recaps, and just hang out together between rounds.

    ## What you can do here

    - 💬 Read what other players have posted, and reply.
    - ✏️ Write your own topic (a "topic" is just a new conversation).
    - ❤️ Tap the heart to like a post — it's how we cheer for each other.
    - 🔔 Watch a topic so you get an email when someone replies.

    ## How to write something

    1. Click the big pink **+ New Topic** button at the top.
    2. Pick a category on the right — pick **Tournament Talk** if it's about the games, **Off Topic** for anything else, or **Help & Suggestions** if you have a question.
    3. Give it a title and write whatever you want.
    4. Click **+ Create Topic** at the bottom.

    Done. Anyone signed in can read it and reply.

    ## A note on signing in

    You **don't need a separate password for the forum**. Click "Sign In" and the site bounces you over to the main Quiz Book site (`quiz.miaswebsites.art`). If you're already signed in there, you'll come right back to the forum signed in. If you're not signed in there, just sign in once and you're good for both places.

    ## What this forum isn't

    - It's not where the quizzes happen — those are still on the main site under **Play**.
    - It's not a place to share private things you wouldn't want everyone in the family to read. The whole tournament can see every post.

    Have fun, be kind, and may the best player win 🏆.

    — Sam
  MD
)

upsert_topic(
  admin: admin,
  category: welcome,
  title: "How to embed bracket / standings / Question of the Day in your post",
  raw: <<~MD,
    There are three little widgets you can drop into any post and they'll show live data from the main site.

    Type any of these on a line by themselves:

    - `[quizbook-bracket]` — shows the current tournament bracket
    - `[quizbook-qotd]` — shows today's Question of the Day
    - `[quizbook-standings]` — shows who's still in

    For example, if you write:

    > **Round 4 predictions** — here's the bracket as it stands:
    >
    > `[quizbook-bracket]`
    >
    > I think Manou pulls the upset.

    …it shows the actual bracket inline in your post, updating live.

    Try it in a reply below. ⬇️
  MD
)

upsert_topic(
  admin: admin,
  category: tournament,
  title: "Who's making the final?",
  raw: <<~MD,
    With the semis underway, who do you think is going to be the last two standing? Wild predictions encouraged.

    `[quizbook-bracket]`

    Drop your pick + one sentence on why. Bonus points if you predicted the upset before it happened. 🔮
  MD
)

upsert_topic(
  admin: admin,
  category: tournament,
  title: "Best moment of the tournament so far",
  raw: <<~MD,
    Whether it was a heartbreak loss, a buzzer-beat round, an answer that made everyone groan, or just a really good piece of trash talk — what's the moment from this season you'll remember?

    No wrong answers. (Unless your answer is wrong, in which case yes.)
  MD
)

upsert_topic(
  admin: admin,
  category: offtopic,
  title: "What snacks are you bringing for the live finals?",
  raw: <<~MD,
    The live final is coming up and we'll all be watching together (over a stream — details once we have a date).

    What are you eating? What's the team-snack of the watch party? Recipes welcome. 🍿🍪🍇

    Setting the bar low: I'm planning popcorn + a frosting-only graham cracker because Mia insists.
  MD
)

upsert_topic(
  admin: admin,
  category: help_cat,
  title: "Found a bug? Have an idea? Tell us here.",
  raw: <<~MD,
    If anything on the site or this forum is broken, slow, confusing, or just _bad_, please post it here. Even tiny things help.

    Also: if you have an idea for a feature, a redesign, a different way to do the brackets, a new question of the day topic — drop it here too. We read every reply.

    No formatting required, no need to be polite, just say what's on your mind.

    — Sam
  MD
)

puts "\n✅ seed complete"
