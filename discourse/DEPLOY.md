# Discourse @ discuss.miaswebsites.art — deployment guide

You're standing up a self-hosted Discourse instance, theming it as the picture-book Quiz Book site, single-sign-on'd to the existing Auth0 player session, and adding a small bridge plugin. This guide goes from "fresh server" to "live forum."

Total time, first run: **~60 minutes**, with most of it waiting for the bootstrap rebuild.

## What you'll spin up

| Piece | Lives on | Owner |
|---|---|---|
| **Discourse** (Rails app + Postgres + Redis + Sidekiq + nginx) | Your VPS | This guide |
| **DiscourseConnect SSO endpoint** | quiz.miaswebsites.art | Already shipped at `/api/discourse/sso` |
| **Theme** | Discourse admin → Themes | `discourse/theme/` in this repo |
| **Plugin** | Discourse Docker via `app.yml` hook | `discourse/plugin/` in this repo |
| **DNS** | Your registrar | `discuss.miaswebsites.art A → <server IP>` |
| **Email** | Resend (SMTP relay) | Already have credentials |

---

## 1. Provision the VPS

**Minimum spec:** 2 GB RAM, 1 vCPU, 20 GB disk. **Recommended:** 4 GB RAM. Discourse won't bootstrap on less than 1 GB; the official setup script refuses anything under 1 GB swap-included.

| Provider | Plan | ~Cost |
|---|---|---|
| Hetzner CX22 | 4 GB / 2 vCPU / 40 GB | €4.51/mo |
| DigitalOcean | Basic 2 GB | $12/mo |
| Vultr | Cloud Compute 2 GB | $12/mo |

Pick Ubuntu 22.04 LTS or 24.04 LTS. The Discourse Docker image targets these.

```bash
# After SSH'ing in as root:
apt update && apt upgrade -y
apt install -y git
```

## 2. DNS

In your domain registrar (or Cloudflare):

```
discuss.miaswebsites.art    A     <server public IP>     (TTL 300)
```

If you're behind Cloudflare, **disable the proxy** (grey cloud) for this record. Discourse needs to terminate TLS itself via Let's Encrypt. You can re-enable Cloudflare later with full SSL/strict mode if you want, after the cert is provisioned.

Wait for DNS to propagate before continuing — `dig discuss.miaswebsites.art` should show your server IP.

## 3. Install Discourse

The official installer is `discourse_docker`:

```bash
mkdir /var/discourse
git clone https://github.com/discourse/discourse_docker.git /var/discourse
cd /var/discourse
./discourse-setup
```

It'll prompt you for a few values. Use:

| Prompt | Value |
|---|---|
| Hostname | `discuss.miaswebsites.art` |
| Email address for admin | your email |
| SMTP server address | `smtp.resend.com` |
| SMTP port | `587` |
| SMTP user | `resend` |
| SMTP password | your Resend API key (starts with `re_`) |
| Notification email | `Mia's Quiz Discuss <discuss@miaswebsites.art>` |
| Let's Encrypt email | your email (for cert renewals) |

(Resend supports SMTP — see https://resend.com/docs/send-with-smtp.)

The script writes `/var/discourse/containers/app.yml`, then runs `./launcher rebuild app`. **First rebuild takes 15–25 minutes.** It builds the image, runs migrations, and provisions the Let's Encrypt cert. Sit through it; if it fails, fix and re-run.

When it finishes, `https://discuss.miaswebsites.art` should serve the Discourse welcome screen. Visit it, register the first account using the email you provided — that account becomes admin.

## 4. Configure DiscourseConnect (SSO)

This swaps Discourse's built-in auth for our quiz site session.

### 4a. On the quiz site

Already shipped — `/api/discourse/sso` plus `lib/discourse-sso.ts`. The endpoint reads **`DISCOURSE_SSO_SECRET`** from env. Generate a secret and add it to Vercel:

```bash
openssl rand -hex 32
# → e.g. 4d8b...64-char hex string
```

Then in Vercel:

```bash
vercel env add DISCOURSE_SSO_SECRET production
# paste the secret
```

Redeploy: `vercel --prod`.

### 4b. On Discourse

Admin panel → **Settings** → search "DiscourseConnect":

| Setting | Value |
|---|---|
| `enable discourse connect` | ✅ on |
| `discourse connect url` | `https://quiz.miaswebsites.art/api/discourse/sso` |
| `discourse connect secret` | the same secret you set on the quiz site |
| `discourse connect overrides email` | ✅ on (so users can't desync) |
| `discourse connect overrides username` | optional — on means the username always tracks the quiz side |
| `discourse connect overrides name` | ✅ on |
| `auth overrides email` | ✅ on |
| `enable local logins` | ❌ off — forces SSO; no orphan accounts |
| `enable local logins via email` | ❌ off |
| `discourse connect allows all return paths` | ❌ off |

Click "Save".

### 4c. Test

Open `https://discuss.miaswebsites.art` in an incognito window, click **Sign Up**:

1. You should redirect to `quiz.miaswebsites.art`.
2. If not signed in there, you go through Auth0.
3. Once signed in on quiz, you bounce back to Discourse logged in.

If the redirect loops or shows "Bad SSO signature": the secrets don't match. Re-set both sides.

## 5. Install the theme

The theme lives at `discourse/theme/` in this repo. To install:

**Option A — push to a private GitHub repo** (recommended for ongoing edits):

```bash
cd discourse/theme
git init
git add .
git commit -m "Initial Quiz Book theme"
gh repo create miaswebsites/discourse-theme --private --source=. --push
```

Then in Discourse admin → **Customize** → **Themes** → **Install** → "From a git repository" → paste the repo URL. Discourse pulls + installs.

**Option B — zip + upload:**

```bash
cd discourse/theme
zip -r ../quizbook-theme.zip .
```

Then in admin → Themes → Install → "Upload" → select the zip.

Either way, after install: click the theme → ✅ "Set as default" + ✅ "User selectable".

The theme's color scheme is named "Quiz Book" — Discourse picks it up automatically from `about.json`.

## 6. Install the bridge plugin

Plugins are baked into the Discourse Docker image at build time, not installed at runtime. Edit `app.yml`:

```bash
nano /var/discourse/containers/app.yml
```

Find the `hooks:` section. Append (the indentation matters — 6 spaces):

```yaml
hooks:
  after_code:
    - exec:
        cd: $home/plugins
        cmd:
          - git clone https://github.com/miaswebsites/discourse-quizbook-bridge.git
```

Replace the URL with wherever you push `discourse/plugin/` to (same git approach as the theme — a small private repo on GitHub).

Then rebuild:

```bash
cd /var/discourse
./launcher rebuild app
```

Another 10–15 minutes. After it finishes, the plugin is live. Verify: admin → **Plugins** → `discourse-quizbook-bridge` → ✅ enabled.

## 7. Hardening + final configuration

Inside the Discourse admin:

| Setting | Value | Why |
|---|---|---|
| `title` | `Mia's Quiz Discuss` | Forum name |
| `site_description` | `Talk about the tournament. Predictions, gloating, snack reviews.` | SEO + meta |
| `short_site_description` | `Mia's Quiz Tournament discussion forum.` | Used in search/social |
| `logo` / `logo_small` | Upload picture-book sun (you already have `/email-assets/sun.gif`) | Brand |
| `favicon` | Upload | Brand |
| `default_locale` | `en` | |
| `min_post_length` | `5` | Friendly to Mia (default 20 is restrictive) |
| `min_topic_title_length` | `5` | Same |
| `allow_uppercase_posts` | ❌ off | (default — keeps yelling polite) |
| `email_in` | leave empty unless you want reply-by-email | |
| `auto_handle_queued_age` | `30` | Auto-approve waiting posts after 30 days |
| `default_email_digest_frequency` | `weekly` | Pairs with newsletter cadence on the main site |

## 8. Post-deploy checklist

- [ ] Visit `https://discuss.miaswebsites.art` — picture-book theme loads (sky-blue bg, navy borders, sun-yellow buttons).
- [ ] Click "Sign In" → bounces through quiz.miaswebsites.art → returns logged in.
- [ ] Header shows "🌞 Quiz Book" pill linking back to the main site.
- [ ] Footer says `🌞 Mia's Quiz Tournament · Blog · QOTD · Theme song · Status` (no Discourse branding).
- [ ] As Sam (role=author): you have admin powers in Discourse.
- [ ] As a regular player: you sign in but aren't admin.
- [ ] `https://discuss.miaswebsites.art/quizbook/qotd.json` returns the bridge plugin's JSON.

## 9. Operations

**Rebuild after changes to `app.yml` or plugins:**
```bash
cd /var/discourse && ./launcher rebuild app
```

**Update Discourse itself:**
```bash
cd /var/discourse && git pull && ./launcher rebuild app
```

**Tail logs:**
```bash
./launcher logs app | tail -100
# or attach:
./launcher enter app
tail -f /var/log/rails/production.log
```

**Backup:** Discourse has a built-in admin → Backups → Create. Configure S3 or R2 credentials in admin settings (`backup_location`, `s3_*` settings) for off-server storage. **Set this up before you have content you'd cry over losing.**

**Monitoring:** the quiz site's `/status` page now checks `discuss.miaswebsites.art` as one of its websites. You'll see it go red if the box falls over.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Bad SSO signature" on signin | secrets mismatched | Re-set `DISCOURSE_SSO_SECRET` on Vercel + Discourse admin; redeploy |
| Sign-in loops forever | `discourse connect url` typo or quiz site can't read its env | Visit `/api/discourse/sso` directly — should 400 with "missing sso/sig" |
| Theme doesn't appear after install | Theme not set as default | Admin → Themes → click theme → "Set as default" + "User selectable" |
| Plugin not appearing | Forgot to rebuild | `./launcher rebuild app` |
| Let's Encrypt cert renewal failing | DNS proxy enabled or AAAA record points elsewhere | Disable Cloudflare proxy; ensure A record matches box IP |
| Email not sending | SMTP creds wrong | Test with `./launcher enter app && rails c` then `Email::Sender.new(Mail.new(to: 'you@x.com', from: 'discuss@miaswebsites.art', subject: 'test', body: 'test'), :test).send`  |

## Why this shape

- **Custom OIDC client avoided.** SSO uses the existing Auth0 player session via DiscourseConnect, not a new Auth0 application. Sam doesn't have to wire another callback URL.
- **Plugin + theme are separate.** Theme = visual only, hot-reloadable from the admin UI. Plugin = needs server rebuilds. Splitting them keeps tweak-the-color iteration fast.
- **Picture-book look without forking Discourse.** Theme overrides the existing CSS variables + adds picture-book pop-shadows + replaces the footer outlet. No fork, no patch — survives Discourse upgrades.
- **No Vercel deploys for forum changes.** All forum-side edits happen on the box. Quiz-side edits (the SSO endpoint) deploy normally with `vercel --prod`.

## Next moves once it's up

- Wire the **homepage hype-banner** on quiz.miaswebsites.art to also show "💬 X new replies on Discuss" by hitting `https://discuss.miaswebsites.art/latest.json` server-side.
- Embed Discourse comments under each blog post via [discourse-embed](https://meta.discourse.org/t/embedding-discourse-comments-via-javascript/31963) — drop the embed JS into `components/articles/ArticleRenderer.tsx`.
- Add a Discourse category per tournament season for archive purposes.
