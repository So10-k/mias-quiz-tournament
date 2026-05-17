# Seed the bot-action audit log category: "System Logs", private to
# the `authors` group. The bridge plugin's SystemLogger helper writes
# a reply for every notable bot action (terms PM sent, hold imposed,
# appeal filed, admin yes/no, etc.) into a rolling topic.
#
# Mirrors the seed-held-reviews.rb pattern. Idempotent.
#
# Run inside the Discourse container:
#   sudo cp seed-system-logs.rb /var/discourse/shared/standalone/seed-system-logs.rb
#   sudo docker exec app rails runner /shared/seed-system-logs.rb

CATEGORY_SLUG = "system-logs"
CATEGORY_NAME = "System Logs"
TOPIC_TITLE = "🤖 System Activity Log"

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
      "Append-only feed of bot actions: pending-terms grants, hold/" \
      "release commands, appeal filings, admin yes/no votes. Visible " \
      "only to authors. Read-only for humans (don't post here — let " \
      "the bot do its thing).",
    color: "1B2A4E",
    text_color: "FFFFFF",
    user_id: authors_group.users.first&.id ||
             User.where(admin: true).where.not(username_lower: %w[discobot system]).first&.id,
  )
  cat.save!
  puts "  ✓ created category: #{CATEGORY_NAME}"
end

# Authors-only.
cat.set_permissions(authors: :full)
cat.save!

# Tag for plugin lookup.
cat.custom_fields["qb_is_system_logs"] = "true"
cat.save_custom_fields(true)

# ── rolling topic ────────────────────────────────────────────────
existing_topic =
  Topic
    .joins(
      "LEFT JOIN topic_custom_fields tcf ON tcf.topic_id = topics.id"
    )
    .where(
      "tcf.name = ? AND tcf.value = ?",
      "qb_is_system_activity_log",
      "true"
    )
    .first

if existing_topic
  puts "  ↺ system activity log topic already exists: ##{existing_topic.id}"
else
  result =
    PostCreator.create!(
      Discourse.system_user,
      title: TOPIC_TITLE,
      raw:
        "Bot actions land here as replies. One reply per event. " \
        "Read-only — please don't reply manually (the bot's append-" \
        "only model assumes only it writes).\n\n" \
        "🌞 Created at #{Time.now.utc.iso8601}.",
      category: cat.id,
      skip_validations: true,
    )
  topic = result&.topic
  topic.custom_fields["qb_is_system_activity_log"] = "true"
  topic.save_custom_fields(true)
  puts "  ✓ created system activity log topic: ##{topic.id}"
end

puts "\n✅ System Logs category + rolling activity topic ready."
