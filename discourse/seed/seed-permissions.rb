# Seed groups + private categories + chat channels for fine-grained
# permission control on Mia's Quiz Discuss.
#
# Idempotent: re-running this script doesn't duplicate groups, only
# updates settings if needed. Categories are upserted by slug; chat
# channels by slug.
#
# Run from inside the Discourse container:
#   sudo cp seed-permissions.rb /var/discourse/shared/standalone/seed-permissions.rb
#   sudo docker exec app rails runner /shared/seed-permissions.rb

# ─── helpers ────────────────────────────────────────────────────

SYSTEM_USERNAMES = %w[discobot system].freeze
admin = User
  .where(admin: true)
  .where.not(username_lower: SYSTEM_USERNAMES)
  .order(:id)
  .first
abort "no human admin found — sign in once first" unless admin
puts "Using admin: #{admin.username} (#{admin.email})"

def upsert_group(name:, full_name:, description:, visibility: :members, mentionable: :only_admins)
  g = Group.find_by(name: name)
  if g
    g.update!(
      full_name: full_name,
      bio_raw: description,
    )
    puts "  ↺ group exists: #{name} (#{g.users.count} members)"
    return g
  end
  vis_levels = Group.visibility_levels
  ment = case mentionable
         when :everyone then 99
         when :only_admins then 2
         when :nobody then 0
         else 0
         end
  g = Group.create!(
    name: name,
    full_name: full_name,
    bio_raw: description,
    visibility_level: vis_levels[visibility] || vis_levels[:members],
    public_admission: false,
    public_exit: false,
    allow_membership_requests: false,
    mentionable_level: ment,
    messageable_level: 99,
    automatic: false,
  )
  puts "  ✓ created group: #{name}"
  g
end

def add_to_group(group, user)
  return unless user
  return if GroupUser.exists?(group: group, user: user)
  GroupUser.create!(group: group, user: user)
  puts "    + #{user.username} → #{group.name}"
end

def upsert_category(name:, slug:, description:, color:, text_color: "1B2A4E", parent: nil, position: 0, admin:)
  cat = Category.find_by(slug: slug)
  if cat
    cat.update!(
      name: name,
      description: description,
      color: color,
      text_color: text_color,
      position: position,
    )
    puts "  ↺ category exists: #{name}"
  else
    cat = Category.create!(
      name: name,
      slug: slug,
      description: description,
      color: color,
      text_color: text_color,
      parent_category_id: parent&.id,
      position: position,
      user_id: admin.id,
    )
    puts "  ✓ created category: #{name}"
  end
  cat
end

def set_category_permissions(category, perms_hash)
  # perms_hash: { "groupname" => :full | :reply | :create_post | :readonly }
  category.set_permissions(perms_hash)
  category.save!
  puts "    perms: #{perms_hash.inspect}"
end

def first_post_in(category, admin, title, raw)
  existing = Topic.where(title: title, category_id: category.id).first
  if existing
    puts "  ✓ topic exists: #{title}"
    return existing
  end
  topic = PostCreator.create!(
    admin,
    title: title,
    raw: raw,
    category: category.id,
    archetype: Archetype.default,
    skip_validations: true,
  ).topic
  puts "  ✓ created topic: #{title}"
  topic
end

# ─── groups ─────────────────────────────────────────────────────

puts "\nGROUPS"
authors_group = upsert_group(
  name: "authors",
  full_name: "Authors",
  description: "Sam and Mia. Site authors with admin powers.",
)
finalists_group = upsert_group(
  name: "finalists",
  full_name: "Finalists",
  description: "The two players in the Grand Final. Add manually once we know them.",
)
semis_group = upsert_group(
  name: "semi_finalists",
  full_name: "Semi-finalists",
  description: "The four (or however many) players in the semi-finals. Add manually as the bracket settles.",
)
players_group = upsert_group(
  name: "players",
  full_name: "Players",
  description: "Everyone enrolled in the current tournament. Add manually OR sync from quiz site.",
)
spectators_group = upsert_group(
  name: "spectators",
  full_name: "Spectators",
  description: "Non-playing family members. Read-only on most rooms; can post in Off Topic.",
)

# Add admin to authors. Mia (when she signs up) will need to be added
# manually — her quiz-site account is a separate user from Sam's.
add_to_group(authors_group, admin)
# Optional: also add admin to finalists/semis temporarily so they can
# see the channels for setup. Comment if you don't want this.
add_to_group(authors_group, User.find_by(username_lower: "mia")) if User.find_by(username_lower: "mia")

# ─── categories ─────────────────────────────────────────────────

puts "\nCATEGORIES"

# "Public" categories — visible/postable to authors + players +
# spectators (anyone signed in). Anonymous lurkers can NOT see them
# because we didn't include "everyone". Spectators (eliminated +
# non-enrolled family) get full read/write so they're not silenced.
PUBLIC_PERMS = {
  authors_group.name => :full,
  players_group.name => :full,
  spectators_group.name => :full,
}.freeze
%w[welcome tournament-talk round-recaps off-topic help-suggestions].each do |slug|
  cat = Category.find_by(slug: slug)
  next unless cat
  set_category_permissions(cat, PUBLIC_PERMS.dup)
  puts "  ↺ public+all-signed-in: #{cat.name}"
end

# Authors — only the authors group can read/write.
authors_cat = upsert_category(
  admin: admin,
  name: "Authors",
  slug: "authors",
  description: "Just for Sam and Mia. Drafts, scheduling, behind-the-scenes.",
  color: "C9296A",
  text_color: "FFFFFF",
  position: 10,
)
set_category_permissions(authors_cat, authors_group.name => :full)

# Semi-finalists — only the semi_finalists group + authors. Hidden
# from everyone else.
semis_cat = upsert_category(
  admin: admin,
  name: "Semi-finalists",
  slug: "semi-finalists",
  description: "Private room for the four semi-finalists. Talk strategy, talk smack.",
  color: "FF8C42",
  position: 11,
)
set_category_permissions(semis_cat,
  authors_group.name => :full,
  semis_group.name => :full,
)

# Finalists — only the two finalists + authors.
finalists_cat = upsert_category(
  admin: admin,
  name: "Finalists",
  slug: "finalists",
  description: "The grand-final two. Sealed room until we know who's in.",
  color: "C9296A",
  text_color: "FFFFFF",
  position: 12,
)
set_category_permissions(finalists_cat,
  authors_group.name => :full,
  finalists_group.name => :full,
)

# Finals Announcements — readable by all signed-in (players +
# spectators), only authors can post.
finals_announce = upsert_category(
  admin: admin,
  name: "Finals Announcements",
  slug: "finals-announcements",
  description: "Official notices about the live final — stream link, time, results. Read-only for everyone except authors.",
  color: "FFD93D",
  position: 5,
)
set_category_permissions(finals_announce,
  authors_group.name => :full,
  players_group.name => :readonly,
  spectators_group.name => :readonly,
)

# ─── seed first posts in private rooms ─────────────────────────

puts "\nSEED POSTS"

first_post_in(authors_cat, admin, "Authors-only — welcome to the back room",
  <<~MD)
    This category is hidden from everyone except people in the **authors** group (currently: Sam, plus Mia once she's added).

    Use it for:
    - Scheduling rounds
    - Drafts of blog posts before they go public
    - Behind-the-scenes notes about who's doing well, who's struggling
    - Anything you don't want the whole family to read

    Topics here will not appear in any other view, anywhere on the site, ever. Only group members see them.
  MD

first_post_in(semis_cat, admin, "Semi-finalists — your private room",
  <<~MD)
    Welcome semi-finalists. 🔥

    This category is locked to the four of you (plus Sam + Mia for moderation). The rest of the family can't see what's posted here.

    Talk strategy, talk smack, share screenshots of close-call rounds, whatever. Once the final two are decided, the **Finalists** category opens up for that pair.

    Heads up: Sam will be adding people to the `semi_finalists` group manually as the bracket resolves. If you can see this post and shouldn't, tell Sam.
  MD

first_post_in(finalists_cat, admin, "Finalists — see you in the ring",
  <<~MD)
    The two of you who made it. Welcome to the smallest and tensest room on the forum.

    Use this space for last-minute prep, format questions, whatever you'd rather not post in the public **Tournament Talk** category. Sam and Mia are in here too as moderators.

    Best of luck. 🏆
  MD

first_post_in(finals_announce, admin, "What goes here",
  <<~MD)
    This category is **read-only for everyone except authors**. Sam (and Mia) post the official finals updates here:

    - When the final is scheduled
    - The live broadcast URL
    - Whether anything's changed
    - Final results + champion announcement

    Replies are not enabled. For chatter, head to **Tournament Talk** instead.

    First real post lands here as soon as we have a date.
  MD

# ─── chat channels ──────────────────────────────────────────────

puts "\nCHAT"

# Make sure the chat plugin is enabled site-wide.
unless SiteSetting.chat_enabled
  SiteSetting.chat_enabled = true
  puts "  ↺ enabled chat plugin"
end

# Discourse Chat lives under the Chat namespace. We bind a category
# chat channel to each private category so the same group permissions
# automatically cascade. Use the official `Chat::CreateCategoryChannel`
# service when available — it handles slug generation, validations,
# and threading defaults the right way for the running Chat version.
def upsert_category_chat(category, admin, name, description, allowed_groups)
  return unless defined?(::Chat::Channel)
  existing = ::Chat::Channel.where(chatable_id: category.id, chatable_type: "Category").first
  if existing
    existing.update_columns(name: name, description: description)
    puts "  ↺ chat channel exists: #{name}"
    return existing
  end
  if defined?(::Chat::CreateCategoryChannel)
    result = ::Chat::CreateCategoryChannel.call(
      guardian: Guardian.new(admin),
      params: {
        category_id: category.id,
        name: name,
        description: description,
        threading_enabled: true,
        auto_join_users: false,
      }
    )
    if result.respond_to?(:failure?) && result.failure?
      puts "  ⚠ chat create service failed for #{name}: #{result.inspect[0..200]}"
      return nil
    end
    channel = result.respond_to?(:channel) ? result.channel : result[:channel]
    puts "  ✓ created chat channel: #{name}"
    return channel
  end
  # Fallback: direct create. Don't pass `slug` — Chat auto-generates.
  channel = ::Chat::Channel.new(
    name: name,
    description: description,
    chatable: category,
    threading_enabled: true,
    allow_channel_wide_mentions: true,
    auto_join_users: false,
  )
  channel.save(validate: false)
  puts "  ✓ created chat channel (fallback): #{name}"
  channel
end

if defined?(::Chat::Channel)
  upsert_category_chat(authors_cat, admin, "Authors chat",
    "Real-time backroom for Sam and Mia.", [authors_group])
  upsert_category_chat(semis_cat, admin, "Semi-finalists chat",
    "Real-time room for the semi-final crew.", [authors_group, semis_group])
  upsert_category_chat(finalists_cat, admin, "Finalists chat",
    "Real-time room for the final two.", [authors_group, finalists_group])
else
  puts "  ⚠ Chat plugin not loaded — chat channels skipped."
end

puts "\n✅ permissions seed complete"
puts "\nNext steps:"
puts "  1) Promote players to groups manually as the bracket resolves:"
puts "     admin → Groups → semi_finalists / finalists → Add Members"
puts "  2) Mia signs in once → admin → Users → Mia → Make admin (or just add to authors group)"
puts "  3) Custom invite messages per group — optional"
