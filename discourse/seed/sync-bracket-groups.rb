# Sync Discourse groups (players / semi_finalists / finalists) from
# the quiz-site bracket. Idempotent — diffs current group memberships
# against the desired set and applies adds/removes.
#
# Auth: re-uses the discourse_connect_secret (already set in admin
# settings) as a shared bearer to authenticate against the quiz site.
# The endpoint is at https://quiz.miaswebsites.art/api/groups/bracket-sync.
#
# Run from inside the Discourse container:
#   sudo cp sync-bracket-groups.rb /var/discourse/shared/standalone/sync-bracket-groups.rb
#   sudo docker exec app rails runner /shared/sync-bracket-groups.rb
#
# Skipped users: anyone in the quiz-site bracket who hasn't signed in
# to Discourse yet doesn't have a SingleSignOnRecord row, so we can't
# resolve them to a Discourse user. They get silently skipped this
# run; once they sign in via SSO, the next run picks them up.

require "net/http"
require "uri"
require "json"

QUIZ_BASE = "https://quiz.miaswebsites.art"
SYNC_PATH = "/api/groups/bracket-sync"
MANAGED_GROUPS = %w[players semi_finalists finalists].freeze

# Pull the shared secret from Discourse Site Settings — this is the
# same value the SSO flow signs payloads with.
secret = SiteSetting.discourse_connect_secret.presence
unless secret
  abort "discourse_connect_secret not set — cannot authenticate to quiz site"
end

# ─── fetch desired state ────────────────────────────────────────

uri = URI("#{QUIZ_BASE}#{SYNC_PATH}")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true
req = Net::HTTP::Get.new(uri.request_uri)
req["Authorization"] = "Bearer #{secret}"
res = http.request(req)
unless res.is_a?(Net::HTTPSuccess)
  abort "quiz API returned #{res.code} #{res.message}: #{res.body[0..300]}"
end
payload = JSON.parse(res.body)
desired_users = payload["users"] || []
puts "Fetched #{desired_users.length} enrolled users from quiz site"
puts "  semi_finalists: #{payload.dig('counts', 'semi_finalists')}"
puts "  finalists:      #{payload.dig('counts', 'finalists')}"

# ─── resolve quiz users → Discourse users ──────────────────────

# DiscourseConnect stores external_id on SingleSignOnRecord.
# We want a map: discourse_user_id → desired_groups[]
desired_for_user = {}
unmapped = []

desired_users.each do |entry|
  ext = entry["externalId"]
  groups = (entry["groups"] || []) & MANAGED_GROUPS
  rec = SingleSignOnRecord.find_by(external_id: ext.to_s)
  if rec.nil?
    unmapped << entry["email"]
    next
  end
  desired_for_user[rec.user_id] = groups
end

if unmapped.any?
  puts "  ⚠ #{unmapped.length} quiz users haven't signed in to Discourse yet — skipped:"
  unmapped.each { |e| puts "      - #{e}" }
end

# ─── apply diff per managed group ───────────────────────────────

added_total = 0
removed_total = 0

MANAGED_GROUPS.each do |group_name|
  group = Group.find_by(name: group_name)
  unless group
    puts "  ⚠ group missing: #{group_name} — skipping"
    next
  end

  # Set of user_ids who SHOULD be in this group.
  should_be_in = desired_for_user.select { |_uid, gs| gs.include?(group_name) }.keys.to_set

  # Set of user_ids currently in this group.
  currently_in = group.users.pluck(:id).to_set

  to_add = should_be_in - currently_in
  to_remove = currently_in - should_be_in

  to_add.each do |uid|
    GroupUser.find_or_create_by!(group: group, user_id: uid)
  end
  to_remove.each do |uid|
    GroupUser.where(group: group, user_id: uid).destroy_all
  end

  added_total += to_add.length
  removed_total += to_remove.length
  puts "  group '#{group_name}': +#{to_add.length} / -#{to_remove.length} (now #{group.reload.users.count})"
end

puts "\n✅ sync complete (+#{added_total} adds, -#{removed_total} removes)"
