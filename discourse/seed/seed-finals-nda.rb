# Seed the finals-NDA holding-zone group + the private Finalists chat
# channel used by the bridge plugin's finals confidentiality flow.
#
# Lifecycle (handled in plugin.rb):
#   • A user lands in `finalists` (auto-synced from quiz-site
#     bracket) AND has no qb_finals_nda_agreed_at → SSO also adds
#     them to `pending_finals_nda`.
#   • Plugin sends a system PM with the confidentiality terms.
#   • Theme JS gate redirects every page to that PM.
#   • User replies "yes" / "agree" → plugin POSTs to quiz site
#     /api/forum/finals-nda-agreed → DB column set, on next SSO
#     login they're removed from pending_finals_nda.
#
# Idempotent.
#
#   sudo cp seed-finals-nda.rb /var/discourse/shared/standalone/seed-finals-nda.rb
#   sudo docker exec app rails runner /shared/seed-finals-nda.rb

GROUP_NAME = "pending_finals_nda"

g = Group.find_by(name: GROUP_NAME)
if g
  puts "  ↺ group exists: #{GROUP_NAME} (#{g.users.count} members)"
else
  g = Group.create!(
    name: GROUP_NAME,
    full_name: "Pending Finals NDA",
    bio_raw:
      "Holding zone for finalists who haven't yet agreed to the " \
      "finals confidentiality terms. Members are auto-redirected " \
      "to the NDA PM until they reply with \"yes\".",
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
  flair_icon: "user-secret",
  flair_color: "FFFFFF",
  flair_bg_color: "C9296A",
)
begin
  g.update!(default_notification_level: 3)
rescue
end

# Create a finalists-only category if it doesn't exist, with a chat
# channel attached. Visible only to the `finalists` group AND
# `authors`. Members in `pending_finals_nda` are still in
# `finalists` so to truly hide we'd add a per-category exclusion —
# but Discourse's permission model doesn't support that. The JS gate
# is the active enforcement.
authors = Group.find_by(name: "authors")
finalists_group = Group.find_by(name: "finalists")
if authors && finalists_group
  cat = Category.find_by(slug: "finals-room")
  unless cat
    cat = Category.create!(
      name: "Finals Room",
      slug: "finals-room",
      description:
        "Private space for the finalists. Coordination, scheduling, " \
        "and behind-the-scenes prep happens here. Confidentiality " \
        "terms apply — see the NDA you agreed to.",
      color: "FFD93D",
      text_color: "1B2A4E",
      user_id: authors.users.first&.id || User.where(admin: true).first&.id,
    )
    puts "  ✓ created category: Finals Room"
  end
  cat.set_permissions(
    authors: :full,
    finalists: :full,
  )
  cat.save!
  cat.custom_fields["qb_is_finals_room"] = "true"
  cat.save_custom_fields(true)

  # Try to create a chat channel. Fail silently if Chat plugin is off.
  begin
    chan = Chat::Channel.where(chatable_type: "Category", chatable_id: cat.id).first
    unless chan
      result = Chat::CreateCategoryChannel.call(
        guardian: Guardian.new(Discourse.system_user),
        params: {
          category_id: cat.id,
          name: "Finals Room Chat",
          description: "Live chat for finalists. Confidential — finals participants + authors only.",
        },
      )
      if result.respond_to?(:channel) && result.channel
        puts "  ✓ created chat channel: Finals Room Chat (id=#{result.channel.id})"
      end
    else
      puts "  ↺ chat channel already exists"
    end
  rescue StandardError => e
    puts "  ⚠ chat channel skipped: #{e.message}"
  end
end

puts "\n✅ Finals NDA infrastructure ready."
