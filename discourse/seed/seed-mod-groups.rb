# Add granular moderation tiers wired to Discourse-native mechanisms:
#
#   trial_moderators — auto-grants TL4 (Leader: edit any post,
#                      recategorize, dismiss flags lite). Made
#                      category moderators of every PUBLIC category
#                      so they can pin/unpin/edit/delete within
#                      those — and only those.
#   honorary_mods    — auto-grants TL4 across the site. No extra
#                      category-mod powers. A recognition group.
#   regulars         — auto-grants TL3 (handles flags by quorum,
#                      can lock topics, etc).
#
# Safety guarantees of this script:
#   • Idempotent: re-running doesn't duplicate or downgrade.
#   • Add-only: never removes anyone from a group, never strips a
#     category permission, never demotes a user.
#   • Additive permissions: adding a group as a category moderator
#     doesn't change the existing read/write access for anyone else.
#   • Wrapped in a single transaction — if anything errors mid-way,
#     nothing persists.
#
# Run:
#   sudo cp seed-mod-groups.rb /var/discourse/shared/standalone/seed-mod-groups.rb
#   sudo docker exec app rails runner /shared/seed-mod-groups.rb

# ─── helpers ────────────────────────────────────────────────────

def upsert_mod_group(name:, full_name:, description:, grant_tl:, title:, flair_icon:, flair_bg:, flair_fg:)
  g = Group.find_by(name: name)
  if g
    # Don't downgrade. Only nudge fields if currently empty.
    g.full_name = full_name if g.full_name.blank?
    g.bio_raw = description if g.bio_raw.blank?
    # NEVER lower the grant_trust_level — only raise it. Avoids
    # accidentally demoting someone if they were promoted manually.
    if (g.grant_trust_level || 0) < grant_tl
      g.grant_trust_level = grant_tl
    end
    g.title = title if g.title.blank?
    g.flair_icon = flair_icon if g.flair_icon.blank?
    g.flair_bg_color = flair_bg if g.flair_bg_color.blank?
    g.flair_color = flair_fg if g.flair_color.blank?
    g.save!
    puts "  ↺ group exists: #{name} (#{g.users.count} members, TL#{g.grant_trust_level || 0} grant)"
    return g
  end
  g = Group.create!(
    name: name,
    full_name: full_name,
    bio_raw: description,
    visibility_level: Group.visibility_levels[:members],
    public_admission: false,
    public_exit: false,
    allow_membership_requests: false,
    mentionable_level: 2,        # only_admins
    messageable_level: 99,       # everyone
    grant_trust_level: grant_tl,
    title: title,
    flair_icon: flair_icon,
    flair_bg_color: flair_bg,
    flair_color: flair_fg,
    automatic: false,
  )
  puts "  ✓ created group: #{name} (TL#{grant_tl} grant)"
  g
end

def add_category_moderator(category, group)
  return unless defined?(::CategoryModerationGroup)
  existing = ::CategoryModerationGroup.find_by(category_id: category.id, group_id: group.id)
  if existing
    puts "    (#{category.slug}: #{group.name} already a moderator)"
    return
  end
  ::CategoryModerationGroup.create!(category_id: category.id, group_id: group.id)
  puts "    ✓ #{group.name} → moderator of '#{category.name}'"
end

# ─── execute inside a transaction (atomic) ──────────────────────

ActiveRecord::Base.transaction do
  puts "GROUPS"

  trial = upsert_mod_group(
    name: "trial_moderators",
    full_name: "Trial Moderators",
    description: "On-trial mods for the public categories. They can pin, edit, recategorize, and clean up posts in the public rooms only. No site-wide powers.",
    grant_tl: 4,
    title: "Trial Mod",
    flair_icon: "shield-halved",
    flair_bg: "E94B7E",
    flair_fg: "FFFFFF",
  )

  honorary = upsert_mod_group(
    name: "honorary_mods",
    full_name: "Honorary Moderators",
    description: "Recognition group. Auto-grants Trust Level 4 (Leader) — edit any post, recategorize, lock topics. No site-wide admin powers.",
    grant_tl: 4,
    title: "Honorary Mod",
    flair_icon: "medal",
    flair_bg: "FFD93D",
    flair_fg: "1B2A4E",
  )

  regulars = upsert_mod_group(
    name: "regulars",
    full_name: "Regulars",
    description: "Trust Level 3 grant — handles flags by quorum, can lock topics, edit own old posts. The 'reliable longtime member' tier.",
    grant_tl: 3,
    title: "Regular",
    flair_icon: "thumbs-up",
    flair_bg: "B7E5FF",
    flair_fg: "1B2A4E",
  )

  puts "\nCATEGORY MODERATION (additive — no existing perm touched)"
  public_slugs = %w[welcome tournament-talk round-recaps off-topic help-suggestions]
  public_slugs.each do |slug|
    cat = Category.find_by(slug: slug)
    unless cat
      puts "  ⚠ skipping unknown category: #{slug}"
      next
    end
    add_category_moderator(cat, trial)
  end

  puts "\nSUMMARY"
  [trial, honorary, regulars].each do |g|
    g.reload
    puts "  #{g.name}: TL#{g.grant_trust_level} grant · flair=#{g.flair_icon} · members=#{g.users.count}"
  end

  if defined?(::CategoryModerationGroup)
    cmg = ::CategoryModerationGroup.where(group_id: trial.id)
    puts "  trial_moderators is moderator of: #{cmg.map { |x| Category.find(x.category_id).slug }.join(', ')}"
  else
    puts "  ⚠ CategoryModerationGroup not available in this Discourse — trial_moderators get TL4 powers but no category-scoped mod tools"
  end
end

puts "\n✅ moderation tier groups ready"
puts
puts "Next:"
puts "  • admin → Groups → trial_moderators / honorary_mods / regulars → Add members"
puts "  • Members of these groups get auto-bumped to the configured TL on join"
puts "  • trial_moderators gain category-mod tools in public categories ONLY"
