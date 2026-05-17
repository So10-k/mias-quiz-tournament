# Add staff + announcements categories and the staff chat channel.
# Idempotent (safe to re-run).
#
# Run:
#   sudo cp seed-staff-channels.rb /var/discourse/shared/standalone/seed-staff-channels.rb
#   sudo docker exec app rails runner /shared/seed-staff-channels.rb

# ─── helpers (mirrors seed-permissions.rb) ──────────────────────

SYSTEM_USERNAMES = %w[discobot system].freeze
admin = User
  .where(admin: true)
  .where.not(username_lower: SYSTEM_USERNAMES)
  .order(:id)
  .first
abort "no human admin found" unless admin
puts "Using admin: #{admin.username}"

authors = Group.find_by(name: "authors") or abort "authors group missing"
trial_mods = Group.find_by(name: "trial_moderators") or abort "trial_moderators missing"
honorary = Group.find_by(name: "honorary_mods") or abort "honorary_mods missing"
players = Group.find_by(name: "players") or abort "players missing"
spectators = Group.find_by(name: "spectators") or abort "spectators missing"

def upsert_category(name:, slug:, description:, color:, text_color: "1B2A4E", admin:, position: 0)
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
      position: position,
      user_id: admin.id,
    )
    puts "  ✓ created category: #{name}"
  end
  cat
end

def set_perms(category, perms)
  category.set_permissions(perms)
  category.save!
  puts "    perms: #{perms.inspect}"
end

def upsert_topic(admin:, category:, title:, raw:, pinned: false)
  existing = Topic.where(title: title, category_id: category.id).first
  if existing
    puts "  ✓ topic exists: #{title}"
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
  result.topic.update_pinned(true, false) if pinned
  puts "  ✓ created topic: #{title}"
  result.topic
end

def upsert_category_chat(category, admin, name, description)
  return unless defined?(::Chat::Channel)
  existing = ::Chat::Channel.where(chatable_id: category.id, chatable_type: "Category").first
  if existing
    existing.update_columns(name: name, description: description)
    puts "  ↺ chat exists: #{name}"
    return existing
  end
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
    puts "  ⚠ chat create failed for #{name}: #{result.inspect[0..200]}"
    return nil
  end
  channel = result.respond_to?(:channel) ? result.channel : result[:channel]
  puts "  ✓ created chat: #{name}"
  channel
end

# ─── categories ─────────────────────────────────────────────────

ActiveRecord::Base.transaction do
  puts "\nCATEGORIES"

  # Staff — private to anyone with mod tools (authors + trial mods +
  # honorary mods). The "back office" category for moderation chat,
  # tooling questions, internal coordination.
  staff_cat = upsert_category(
    admin: admin,
    name: "Staff",
    slug: "staff",
    description: "Private staff room. Authors + Trial Mods + Honorary Mods. Coordination, moderation chatter, internal stuff.",
    color: "3B4A7E",
    text_color: "FFFFFF",
    position: 13,
  )
  set_perms(staff_cat,
    authors.name => :full,
    trial_mods.name => :full,
    honorary.name => :full,
  )

  # Staff Announcements — same audience as Staff but write-locked
  # to authors only. For "heads up, here's what's about to drop"
  # broadcasts to mod team.
  staff_ann = upsert_category(
    admin: admin,
    name: "Staff Announcements",
    slug: "staff-announcements",
    description: "Author broadcasts to the staff team. Read-only for non-authors.",
    color: "3B4A7E",
    text_color: "FFFFFF",
    position: 14,
  )
  set_perms(staff_ann,
    authors.name => :full,
    trial_mods.name => :readonly,
    honorary.name => :readonly,
  )

  # Public Announcements — everyone reads, only authors post. This
  # is the category whose topics get mirrored to the main site's
  # /blog page. Important: include "everyone" so the mirror can
  # fetch the JSON anonymously without an API key.
  ann = upsert_category(
    admin: admin,
    name: "Announcements",
    slug: "announcements",
    description: "Official announcements about Mia's Quiz Tournament — site updates, schedule changes, anything the family should know. Topics here also appear on the main site's blog page.",
    color: "FFD93D",
    position: 1,
  )
  set_perms(ann,
    authors.name => :full,
    players.name => :readonly,
    spectators.name => :readonly,
    "everyone" => :readonly,
  )

  # ─── seed first posts ────────────────────────────────────────

  puts "\nSEED POSTS"

  upsert_topic(
    admin: admin,
    category: staff_cat,
    pinned: true,
    title: "Welcome to the staff room",
    raw: <<~MD,
      This category is private to staff (authors + trial mods + honorary mods). Anyone who's not on the team can't see it.

      Use this for:
      - Coordinating moderation
      - Asking each other questions
      - Drafting things before they go public
      - Anything else moderation-adjacent

      No bots, no announcements — those live in **Staff Announcements** instead.
    MD
  )

  upsert_topic(
    admin: admin,
    category: staff_ann,
    title: "Staff Announcements — read-only for everyone except authors",
    raw: <<~MD,
      Authors (Sam + Mia) post here when something needs to land in front of the mod team:

      - Schedule changes that affect moderation
      - Policy updates
      - Heads-up about a brewing situation

      Replies are turned off. For discussion, use the **Staff** category.
    MD
  )

  upsert_topic(
    admin: admin,
    category: ann,
    pinned: true,
    title: "Welcome to Announcements",
    raw: <<~MD,
      This is where Sam (and Mia) post official updates about Mia's Quiz Tournament — site features, schedule, results, anything you'd want to be sure to see.

      Posts in this category **also appear on the main-site blog at [quiz.miaswebsites.art/blog](https://quiz.miaswebsites.art/blog)** alongside the longer-form articles. So you'll see them both places.

      You can't post in this category — only authors can. For discussion + reactions, head to **Tournament Talk** instead.
    MD
  )

  # ─── chat channel for staff ──────────────────────────────────

  puts "\nCHAT"
  upsert_category_chat(
    staff_cat,
    admin,
    "Staff chat",
    "Real-time room for the staff team — authors, trial mods, honorary mods.",
  )

  puts "\n✅ staff + announcement categories ready"
end
