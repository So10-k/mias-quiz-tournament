# Migrate all content authored by `Sam1` (the orphan wizard-created
# admin with no SSO link) over to the SSO-linked admin (`mia`),
# then suspend Sam1 so it can't be used. Idempotent.
#
# Run:
#   sudo docker exec app rails runner /shared/consolidate-admin.rb

orphan = User.find_by(username_lower: "sam1")
sso_admin = User.joins(:single_sign_on_record)
                .where(admin: true)
                .where.not(username_lower: %w[discobot system])
                .order(:id)
                .first

unless orphan && sso_admin
  puts "  ⚠ orphan=#{orphan&.username} sso_admin=#{sso_admin&.username} — nothing to do"
  exit 0
end

puts "Migrating content: #{orphan.username} (#{orphan.email}) → #{sso_admin.username} (#{sso_admin.email})"

# Re-attribute every topic + post.
topic_count = Topic.where(user_id: orphan.id).update_all(user_id: sso_admin.id)
post_count = Post.where(user_id: orphan.id).update_all(user_id: sso_admin.id)
puts "  ✓ #{topic_count} topics + #{post_count} posts re-attributed"

# Re-attribute group memberships (Sam1 was in `authors`).
GroupUser.where(user_id: orphan.id).find_each do |gu|
  unless GroupUser.exists?(group_id: gu.group_id, user_id: sso_admin.id)
    GroupUser.create!(group_id: gu.group_id, user_id: sso_admin.id)
    puts "  + #{sso_admin.username} → group #{Group.find(gu.group_id).name}"
  end
  gu.destroy!
end

# Make sure the SSO admin keeps admin + moderator.
sso_admin.update!(admin: true, moderator: true) unless sso_admin.admin && sso_admin.moderator

# Demote + suspend the orphan so nobody can use it.
orphan.update!(admin: false, moderator: false)
unless orphan.suspended?
  orphan.suspended_till = 100.years.from_now
  orphan.suspended_at = Time.zone.now
  orphan.save!
  puts "  ✓ #{orphan.username} demoted + suspended for 100y"
end

puts "\n✅ consolidation complete"
puts "   Sign in via SSO at https://discuss.miaswebsites.art — you'll be #{sso_admin.username} with admin access."
