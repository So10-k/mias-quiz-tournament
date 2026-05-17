# Seed the `pending_terms` holding-zone group used by the
# discourse-quizbook-bridge plugin's terms-agreement flow.
#
# Lifecycle: on first SSO login, the plugin adds the user to this
# group, sends them a system PM with the terms, and the theme JS
# redirects every page to that PM until they reply with "yes". On
# "yes", the plugin removes them from this group, freeing up the
# rest of the forum.
#
# This script just creates the group + flair. The plugin code
# (plugin.rb) handles add/remove + PM creation. Idempotent.
#
# Run inside the Discourse container:
#   sudo cp seed-terms-gate.rb /var/discourse/shared/standalone/seed-terms-gate.rb
#   sudo docker exec app rails runner /shared/seed-terms-gate.rb

GROUP_NAME = "pending_terms"

g = Group.find_by(name: GROUP_NAME)
if g
  puts "  ↺ group already exists: #{GROUP_NAME} (#{g.users.count} members)"
else
  g = Group.create!(
    name: GROUP_NAME,
    full_name: "Pending Terms Agreement",
    bio_raw:
      "Holding zone for users who haven't yet agreed to the forum terms. " \
      "Members of this group are auto-redirected to the welcome PM until " \
      "they reply with \"yes\".",
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

# Flair — make it visible & friendly. Hourglass = "you're held up
# briefly until you agree".
g.update!(
  flair_icon: "hourglass-half",
  flair_color: "1B2A4E",
  flair_bg_color: "FFD93D",
)
begin
  g.update_columns(primary_group: false)
rescue
  # Older schemas — skip silently.
end
begin
  g.update!(default_notification_level: 3)
rescue
end

puts "\n✅ pending_terms group ready. Next: deploy the plugin update to wire the auto-add + PM + reply listener."
