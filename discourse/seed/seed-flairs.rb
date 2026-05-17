# Per-group flair (badge icon next to avatar), title (text shown
# next to username), and group color. Picks Font Awesome icons from
# Discourse's bundled set so we don't need to upload anything.
#
# Run:
#   sudo cp seed-flairs.rb /var/discourse/shared/standalone/seed-flairs.rb
#   sudo docker exec app rails runner /shared/seed-flairs.rb

# Each entry: title shown next to name, FA icon (no `fa-` prefix in
# modern Discourse — pass bare name), colors as 6-char hex.
GROUPS = {
  "authors" => {
    title: "Author",
    flair_icon: "sun",
    flair_color: "FFFFFF",
    flair_bg_color: "E94B7E",
    color: "E94B7E",
    primary_group: true,
  },
  "finalists" => {
    title: "Finalist",
    flair_icon: "trophy",
    flair_color: "FFFFFF",
    flair_bg_color: "C9296A",
    color: "C9296A",
    primary_group: true,
  },
  "semi_finalists" => {
    title: "Semi-finalist",
    flair_icon: "fire",
    flair_color: "FFFFFF",
    flair_bg_color: "F4A93A",
    color: "F4A93A",
    primary_group: true,
  },
  "players" => {
    title: "Still in",
    flair_icon: "check",
    flair_color: "FFFFFF",
    flair_bg_color: "4FB04F",
    color: "4FB04F",
    primary_group: false,
  },
  "spectators" => {
    title: "Spectator",
    flair_icon: "eye",
    flair_color: "1B2A4E",
    flair_bg_color: "B7E5FF",
    color: "3B4A7E",
    primary_group: false,
  },
}

GROUPS.each do |name, attrs|
  g = Group.find_by(name: name)
  unless g
    puts "  ⚠ group missing: #{name} — skipping"
    next
  end
  # Modern Discourse: setting flair_icon is enough; the model derives
  # the type. flair_upload_id is the alternative for image uploads.
  g.update!(
    title: attrs[:title],
    flair_icon: attrs[:flair_icon],
    flair_color: attrs[:flair_color],
    flair_bg_color: attrs[:flair_bg_color],
  )
  # Group color (used in the picker + as default flair_bg if flair_*
  # isn't set).
  g.update_columns(
    primary_group: attrs[:primary_group] ? true : false,
  ) if g.has_attribute?(:primary_group)
  begin
    g.update!(default_notification_level: 3) # tracking
  rescue
    # Older Discourse: skip silently.
  end
  puts "  ✓ #{name} → title=#{attrs[:title]}, icon=#{attrs[:flair_icon]}, bg=##{attrs[:flair_bg_color]}"
end

# Force every member to take the title of their highest-priority
# primary group automatically. Discourse already does this on group
# add, but we also re-stamp existing members so the seeded groups
# show titles immediately for already-added users.
GROUPS.each do |name, attrs|
  g = Group.find_by(name: name)
  next unless g
  g.users.find_each do |u|
    next unless attrs[:title]
    # Only set title if the user hasn't customised theirs.
    if u.title.blank? || GROUPS.values.map { |v| v[:title] }.include?(u.title)
      u.update_columns(title: attrs[:title])
    end
  end
end

puts "\n✅ flairs + titles applied"
