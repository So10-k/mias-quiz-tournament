# Post-rebuild branding + welcome banner. Run via:
#   docker exec app rails runner /shared/post-rebuild-setup.rb

notice = "**Welcome!** This is the discussion forum for Mia's Quiz Tournament. " \
         "Click \"Sign In\" — you'll bounce through the main site and come " \
         "right back. New here? Read the **Welcome — start here** topic."

SiteSetting.global_notice = notice
SiteSetting.title = "Mia's Quiz Discuss"
SiteSetting.site_description = "Talk about the tournament. Predictions, recaps, snack reviews."
SiteSetting.short_site_description = "Mia's Quiz Tournament forum."

puts "✓ global_notice set (#{notice.length} chars)"
puts "✓ title: #{SiteSetting.title}"
puts "✓ description set"
