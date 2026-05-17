# Seed the game-state-derived Discourse groups that the quiz-site
# SSO flow expects to exist:
#
#   champions   — won a tournament outright (lifelong)
#   alumni      — has any past-or-present enrollment
#   predictors  — has made any prediction
#
# Each gets full_name, bio, flair, color, and is set as a primary
# group where appropriate (champions = primary so the crown title
# wins; alumni/predictors are secondary tags that just add flair).
#
# Idempotent. Re-running updates settings without duplicating groups.
#
# Run inside the Discourse container:
#   sudo cp seed-game-groups.rb /var/discourse/shared/standalone/seed-game-groups.rb
#   sudo docker exec app rails runner /shared/seed-game-groups.rb

GROUPS = [
  {
    name: "champions",
    full_name: "Tournament Champions",
    bio: "Players who have won a Quiz Book tournament outright. Lifelong honour — once a champion, always a champion.",
    flair_icon: "crown",
    flair_color: "1B2A4E",
    flair_bg_color: "FFD93D",
    color: "F4A93A",
    primary_group: true,
    title: "🏆 Tournament Champion",
  },
  {
    name: "alumni",
    full_name: "Tournament Alumni",
    bio: "Anyone who has ever enrolled in a Quiz Book tournament — current players included. The growing fellowship of folks who've stepped into the bracket.",
    flair_icon: "graduation-cap",
    flair_color: "FFFFFF",
    flair_bg_color: "3B4A7E",
    color: "3B4A7E",
    primary_group: false,
    title: nil,
  },
  {
    name: "predictors",
    full_name: "Bracket Predictors",
    bio: "Players who've made bracket predictions. Bonus points if you actually pick the right ones.",
    flair_icon: "chess-knight",
    flair_color: "1B2A4E",
    flair_bg_color: "B7E5FF",
    color: "87CEEB",
    primary_group: false,
    title: nil,
  },
].freeze

def upsert_group(attrs)
  name = attrs[:name]
  g = Group.find_by(name: name)
  if g
    g.update!(
      full_name: attrs[:full_name],
      bio_raw: attrs[:bio],
    )
    puts "  ↺ group exists: #{name} (#{g.users.count} members)"
  else
    g = Group.create!(
      name: name,
      full_name: attrs[:full_name],
      bio_raw: attrs[:bio],
      visibility_level: Group.visibility_levels[:public],
      public_admission: false,
      public_exit: false,
      allow_membership_requests: false,
      mentionable_level: 2,
      messageable_level: 99,
      automatic: false,
    )
    puts "  ✓ created group: #{name}"
  end
  g.update!(
    flair_icon: attrs[:flair_icon],
    flair_color: attrs[:flair_color],
    flair_bg_color: attrs[:flair_bg_color],
  )
  begin
    g.update_columns(primary_group: attrs[:primary_group] ? true : false)
  rescue
    # Older schemas without the primary_group column — ignore.
  end
  if attrs[:title]
    g.update!(title: attrs[:title])
  end
  begin
    g.update!(default_notification_level: 3) # tracking
  rescue
  end
  g
end

GROUPS.each { |attrs| upsert_group(attrs) }

# Re-stamp titles for existing members of the title-bearing groups
# so they show up immediately without waiting for the user to log in
# and trigger SSO group reconciliation.
GROUPS.each do |attrs|
  next unless attrs[:title]
  g = Group.find_by(name: attrs[:name])
  next unless g
  g.users.find_each do |u|
    if u.title.blank?
      u.update_columns(title: attrs[:title])
    end
  end
end

puts "\n✅ game groups seeded — champions, alumni, predictors"
