# Seed the admin-triggered hold/appeal infrastructure used by the
# discourse-quizbook-bridge plugin:
#
#   • Group `held_for_review` — holding zone for admin-imposed holds
#   • Category `Held Reviews` — private to the `authors` group; the
#     bot opens an audit topic per appeal here, admins reply yes/no
#     to release or deny
#
# Lifecycle (handled in plugin.rb):
#   admin types `hold @user reason` in a PM to @system
#     → plugin adds user to `held_for_review`
#     → plugin sends user a PM asking for an apology/appeal
#   user replies in their PM
#     → plugin posts the reply into `Held Reviews` as a new topic
#   admin replies yes/no in that topic
#     → yes: remove user from group + DM them "released"
#     → no:  DM them "denied, try again"
#
# Idempotent. Safe to re-run.
#
# Run inside the Discourse container:
#   sudo cp seed-held-reviews.rb /var/discourse/shared/standalone/seed-held-reviews.rb
#   sudo docker exec app rails runner /shared/seed-held-reviews.rb

GROUP_NAME = "held_for_review"
CATEGORY_SLUG = "held-reviews"
CATEGORY_NAME = "Held Reviews"

# ── group ────────────────────────────────────────────────────────
g = Group.find_by(name: GROUP_NAME)
if g
  puts "  ↺ group already exists: #{GROUP_NAME} (#{g.users.count} members)"
else
  g = Group.create!(
    name: GROUP_NAME,
    full_name: "Held for Review",
    bio_raw:
      "Holding zone for users an admin has placed under review (e.g. " \
      "for rule violations). Members are auto-redirected to their " \
      "appeal PM and stay there until an admin votes to release them " \
      "in the private Held Reviews category.",
    visibility_level: Group.visibility_levels[:staff],
    public_admission: false,
    public_exit: false,
    allow_membership_requests: false,
    mentionable_level: 2,
    messageable_level: 99,
    automatic: false,
  )
  puts "  ✓ created group: #{GROUP_NAME}"
end

g.update!(
  flair_icon: "lock",
  flair_color: "FFFFFF",
  flair_bg_color: "C9296A",
)
begin
  g.update!(default_notification_level: 3)
rescue
end

# ── category (private to authors) ────────────────────────────────
authors_group = Group.find_by(name: "authors")
abort "  ⚠ authors group missing — run seed-permissions.rb first" unless authors_group

cat = Category.find_by(slug: CATEGORY_SLUG)
if cat
  puts "  ↺ category exists: #{CATEGORY_NAME}"
else
  cat = Category.new(
    name: CATEGORY_NAME,
    slug: CATEGORY_SLUG,
    description:
      "Private audit log of admin-imposed holds and user appeals. " \
      "Reply 'yes' or 'no' to a topic in this category to release or " \
      "deny the held user. Visible only to authors.",
    color: "C9296A",
    text_color: "FFFFFF",
    user_id: authors_group.users.first&.id ||
             User.where(admin: true).where.not(username_lower: %w[discobot system]).first&.id,
  )
  cat.save!
  puts "  ✓ created category: #{CATEGORY_NAME}"
end

# Lock down permissions: ONLY authors can read/post.
cat.set_permissions(authors: :full)
cat.save!

# Stamp tag so the bot can find it later without slug-coupling.
cat.custom_fields["qb_is_held_reviews"] = "true"
cat.save_custom_fields(true)

puts "\n✅ held_for_review group + Held Reviews category ready. Deploy plugin update next."
