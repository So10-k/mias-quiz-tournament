# Seed the support-ticket infrastructure used by the quiz-site
# /support page + the plugin's @support_bot command parser:
#
#   • User `support_bot` — non-admin, non-mod, special account that
#     owns ticket topics and acts on behalf of the bot commands
#   • API key bound to support_bot — used by the quiz site to POST
#     new ticket topics. Printed at the end of the script so you
#     can copy it into Vercel as DISCOURSE_BOT_API_KEY.
#   • Category "Support Tickets" — private to `authors` + the bot.
#     One topic per submitted ticket.
#
# Idempotent. Re-running won't duplicate the user/key/category, but
# WILL print the existing API key (useful if you lost it).
#
# Run inside the Discourse container:
#   sudo cp seed-support-system.rb /var/discourse/shared/standalone/seed-support-system.rb
#   sudo docker exec app rails runner /shared/seed-support-system.rb

require "securerandom"

BOT_USERNAME = "support_bot"
BOT_NAME = "Support Bot"
BOT_EMAIL = "support-bot@miaswebsites.art"
CATEGORY_SLUG = "support-tickets"
CATEGORY_NAME = "Support Tickets"

# ── 1. Create the bot user ───────────────────────────────────────
bot = User.find_by(username_lower: BOT_USERNAME)
if bot
  puts "  ↺ user already exists: @#{bot.username}"
else
  bot = User.create!(
    username: BOT_USERNAME,
    name: BOT_NAME,
    email: BOT_EMAIL,
    password: SecureRandom.hex(32),
    active: true,
    approved: true,
    trust_level: TrustLevel[4],
  )
  bot.activate
  bot.user_profile.update!(bio_raw: "Automated assistant for support tickets. Don't message me directly — I only respond inside the Support Tickets category.")
  puts "  ✓ created @#{bot.username} (id=#{bot.id})"
end

# ── 2. Issue/find an API key ─────────────────────────────────────
existing_key = ApiKey.where(user_id: bot.id, revoked_at: nil).first
if existing_key
  puts "  ↺ API key already exists (id=#{existing_key.id}). To rotate, revoke at /admin/api/keys + re-run."
  bot_key_for_print = nil
else
  # Modern Discourse: ApiKey auto-generates the key on create. The
  # plaintext is only available via `.key` immediately after, before
  # the next reload.
  api_key =
    ApiKey.create!(
      description: "support-bot — used by quiz.miaswebsites.art /support page",
      user_id: bot.id,
      created_by_id: Discourse.system_user.id,
    )
  bot_key_for_print = api_key.key
  puts "  ✓ created API key (id=#{api_key.id})"
end

# ── 3. Support Tickets category (private to authors + bot) ───────
authors = Group.find_by(name: "authors")
abort "  ⚠ authors group missing — run seed-permissions.rb first" unless authors

cat = Category.find_by(slug: CATEGORY_SLUG)
if cat
  puts "  ↺ category exists: #{CATEGORY_NAME}"
else
  cat = Category.new(
    name: CATEGORY_NAME,
    slug: CATEGORY_SLUG,
    description:
      "Inbox for support tickets submitted via quiz.miaswebsites.art" \
      "/support. Each topic = one ticket. Reply with `@support_bot " \
      "respond [message]` to email the submitter, or `@support_bot " \
      "internalnote [message]` for staff-only notes, or " \
      "`@support_bot changestatus [open|pending|resolved|closed]`.",
    color: "FFD93D",
    text_color: "1B2A4E",
    user_id: authors.users.first&.id || User.where(admin: true).first&.id,
  )
  cat.save!
  puts "  ✓ created category: #{CATEGORY_NAME}"
end

# Permissions: authors full, bot full, no everyone access.
cat.set_permissions(authors: :full)
cat.save!

# Add the bot to authors so it can post in the category. (Bot has
# admin=false, so without group membership it can't see the
# category at all.)
unless authors.users.exists?(id: bot.id)
  authors.add(bot)
  authors.save!
  puts "  ✓ added @#{bot.username} to authors group"
end

# Tag for plugin lookup.
cat.custom_fields["qb_is_support_tickets"] = "true"
cat.save_custom_fields(true)

# ── 4. Print the key for the user to copy ────────────────────────
puts
puts "✅ Support system ready."
puts
if bot_key_for_print
  puts "🔑 NEW API KEY — copy this NOW (Discourse only stores the hash):"
  puts
  puts "    DISCOURSE_BOT_API_KEY=#{bot_key_for_print}"
  puts "    DISCOURSE_BOT_USERNAME=#{BOT_USERNAME}"
  puts
  puts "Add both as Vercel environment variables for production."
else
  puts "(reusing existing API key — its plaintext is gone; rotate by revoking via /admin/api/keys then re-running this seed)"
end
