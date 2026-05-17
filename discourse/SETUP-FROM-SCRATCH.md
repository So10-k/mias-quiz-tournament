# Discourse @ discuss.miaswebsites.art — start to finish

This is the no-skipping-steps version. If you've never used AWS, never SSH'd into a server, never edited a YAML file — you can still finish this guide. Every command is copy-paste; every place you need to change a value is **bolded**.

**What you're building:** a self-hosted Discourse forum at `https://discuss.miaswebsites.art`, themed to look like the picture-book Quiz Book site, single-sign-on'd to the existing Auth0 player session.

**Time required:** ~75 minutes. Most of that is unattended waits while AWS provisions the box and Discourse builds the Docker image.

**Cost:** ~$15/month for the EC2 t3.small + 30 GB EBS. Free for the first year if you have AWS Free Tier credit.

---

## Tools you'll need

- AWS account (free to make at https://aws.amazon.com — you'll need a card on file)
- A terminal app. On macOS that's **Terminal** (already installed) or iTerm.
- Your registrar (where `miaswebsites.art` lives — Cloudflare, Namecheap, Google Domains, etc.)
- This repo cloned locally (you have it)

When the guide says **terminal**, that's a terminal on your laptop. When it says **server**, that's a terminal SSH'd into your EC2 box. They look the same in this doc — pay attention to which is which.

---

## Step 1 · Launch the EC2 box

### 1.1 Open the EC2 console

Go to https://console.aws.amazon.com/ec2/. If you've never used AWS before, sign in / create the account first. You'll land on the EC2 dashboard.

In the **top-right corner**, check the region dropdown. Pick the region closest to where most of your players are. **`us-east-1` (N. Virginia)** is a fine default for North America. Keep it consistent — every resource you create lives in one region.

### 1.2 Click **Launch instance** (orange button, top of dashboard).

Fill in the form:

| Field | Value |
|---|---|
| **Name** | `discuss-miaswebsites` |
| **Application and OS Images (AMI)** | Click "Browse more AMIs" → search **"Ubuntu Server 24.04 LTS"** → pick the one labeled **"Free tier eligible"**, 64-bit (x86). |
| **Instance type** | `t3.small` (2 vCPU, 2 GB RAM) |
| **Key pair** | Click **"Create new key pair"**. Name: `discuss-key`. Type: **RSA**. Format: **.pem**. Click "Create key pair" — your browser downloads `discuss-key.pem`. **Save it somewhere you won't lose it** (e.g. `~/Downloads/discuss-key.pem`). |
| **Network settings** → click **Edit** | |
| → Auto-assign public IP | **Enable** |
| → Firewall (security groups) | **Create security group**. Name: `discuss-sg`. |
| → Inbound security group rules | Add THREE rules: |
| | Rule 1: SSH, port 22, source = **My IP** |
| | Rule 2: HTTP, port 80, source = **Anywhere (0.0.0.0/0)** |
| | Rule 3: HTTPS, port 443, source = **Anywhere (0.0.0.0/0)** |
| **Configure storage** | Change the default 8 GiB to **30 GiB**, type **gp3**. ⚠️ Double-check this stuck — the field sometimes reverts to 8 GiB if you tab away. If you ended up at 8 GiB, see the "If you launched at 8 GiB by accident" box below. |

At the bottom: click the orange **Launch instance** button. Wait ~30 seconds; you'll see "Successfully initiated launch of instance".

Click **View all instances** at the bottom. You'll see your new instance booting (state: "Pending" → "Running"). Wait until status checks pass (~2 minutes).

### 1.3 Get a stable IP (Elastic IP)

The IP you got from the launch wizard is **dynamic** — if you ever stop + start the instance, it changes. DNS doesn't like that. Allocate a static one:

1. Left sidebar → **Elastic IPs** → **Allocate Elastic IP address** → "Allocate".
2. Right-click the new IP → **Associate Elastic IP address** → instance: `discuss-miaswebsites` → **Associate**.

**Write down this IP.** Call it `<SERVER-IP>` for the rest of this doc. Example: `54.123.45.67`.

### 1.4 SSH in (first connection)

In your **terminal** (laptop):

```bash
chmod 400 ~/Downloads/discuss-key.pem
ssh -i ~/Downloads/discuss-key.pem ubuntu@<SERVER-IP>
```

Replace `<SERVER-IP>` with your actual IP. You'll see "Are you sure you want to continue connecting?" → type `yes`. You're in. The prompt now looks like `ubuntu@ip-...:~$` — you're on the **server**.

If you ever get "Permission denied (publickey)" — make sure the user is `ubuntu` (Ubuntu's default), not `root` or `ec2-user`. And make sure you ran `chmod 400` on the key.

---

## Step 2 · Point DNS at the server

In your registrar's DNS panel, add an **A record**:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `discuss` | `<SERVER-IP>` | 300 |

If you're on **Cloudflare**: set "Proxy status" to **DNS only** (grey cloud, not orange). Discourse needs to terminate TLS itself for Let's Encrypt. You can re-enable proxy later if you want, with SSL mode = "Full (strict)".

Verify (in **terminal** on your laptop):

```bash
dig discuss.miaswebsites.art +short
```

You should see your `<SERVER-IP>`. If you see nothing or the wrong IP, wait 5 minutes and try again — DNS propagation.

**Don't continue until DNS resolves.** Discourse's installer will fail at the Let's Encrypt step if DNS isn't right.

---

## Step 3 · Prep the server

Back on the **server** (the SSH session from step 1.4):

```bash
# Update everything
sudo apt update && sudo apt upgrade -y

# Discourse needs git + curl
sudo apt install -y git curl

# Ubuntu 24.04 doesn't ship with Docker. Discourse REQUIRES Docker.
# The official Docker convenience script handles everything (repo
# add, key import, package install, daemon start). Run it once.
curl -fsSL https://get.docker.com | sudo sh

# Confirm Docker is up:
sudo docker --version          # should print Docker version 24.x or 27.x
sudo systemctl status docker | head -3   # active (running)

# t3.small only has 2 GB RAM. Discourse builds will OOM without swap.
# Add 2 GB of swap.
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Verify swap is on:
```bash
free -h
```
You should see ~2 GB in the "Swap" row.

### If you launched at 8 GiB by accident

Symptom: `./discourse-setup` later complains `Discourse requires at least 5.0GB free disk space. This system has 1.4GB.`

Fix in two parts:

**A. Grow the EBS volume** (AWS console):
1. EC2 → **Volumes** → find the row attached to `discuss-miaswebsites`.
2. Right-click → **Modify volume** → Size: `30` → **Modify** → confirm.
3. Wait ~30 seconds (state goes `in-use - optimizing`).

**B. Grow the partition + filesystem** (on the **server**):
```bash
sudo growpart /dev/nvme0n1 1
sudo resize2fs /dev/nvme0n1p1
df -h /                            # confirm ~30G total, ~25G free
```

Then resume Step 4 (`./discourse-setup`).

---

## Step 4 · Install Discourse

Still on the **server**:

```bash
sudo -i           # become root for the rest of this section
mkdir /var/discourse
git clone https://github.com/discourse/discourse_docker.git /var/discourse
cd /var/discourse
./discourse-setup
```

> **If `discourse-setup` complains that Docker isn't installed:** you missed the Docker step in Step 3 above. Run this on the server now, then re-run `./discourse-setup`:
> ```bash
> curl -fsSL https://get.docker.com | sh
> ```

The script will ask you a series of questions. Answer with these values (anything not listed, accept the default by pressing Enter):

| Prompt | Your answer |
|---|---|
| Hostname for your Discourse? | `discuss.miaswebsites.art` |
| Email address for admin account(s)? | **your email** (e.g. `appdev7710@gmail.com`) |
| SMTP server address? | `smtp.resend.com` |
| SMTP port? | `587` |
| SMTP user name? | `resend` |
| SMTP password? | **your Resend API key** (the `re_…` thing — find it at https://resend.com/api-keys) |
| Notification email address? | `Mia's Quiz Discuss <discuss@miaswebsites.art>` |
| Optional email address for Let's Encrypt warnings? | **your email** |

It writes `/var/discourse/containers/app.yml` and starts building. **This takes 15–25 minutes** on a t3.small. Don't close the SSH session. It scrolls a lot of red-looking text — that's normal Docker output, not errors.

When it finishes you'll see something like:
```
Bootstrapping App
...
Success!
Your container has been launched...
```

### 4.1 Test it

In a **browser**, open `https://discuss.miaswebsites.art`. You should see the Discourse welcome screen. Sign up with the email you provided in the wizard. **The first account you create is automatically the admin.**

If you see a Let's Encrypt error: DNS isn't right. Go back to step 2.

---

## Step 5 · Configure SSO (single sign-on with the quiz site)

This is the magic part. After this, "Sign In" on the forum bounces through quiz.miaswebsites.art and the user comes back logged in. No password to manage.

### 5.1 Generate a shared secret

On your **laptop**:

```bash
openssl rand -hex 32
```

Copy the 64-character hex string. Call it `<SSO-SECRET>`.

### 5.2 Set the secret on the quiz site

```bash
cd ~/Downloads/miasapp1
printf '<SSO-SECRET>' | vercel env add DISCOURSE_SSO_SECRET production
vercel --prod
```

Replace `<SSO-SECRET>` with the actual hex string. The redeploy takes ~1 minute.

### 5.3 Set the secret + URL on Discourse

In a **browser**, go to `https://discuss.miaswebsites.art/admin/site_settings/category/login`. (You need to be signed in as the admin you created.)

Search for "discourse connect" and set:

| Setting | Value |
|---|---|
| `enable discourse connect` | ✅ on |
| `discourse connect url` | `https://quiz.miaswebsites.art/api/discourse/sso` |
| `discourse connect secret` | **`<SSO-SECRET>`** (paste the same string) |
| `discourse connect overrides email` | ✅ on |
| `discourse connect overrides name` | ✅ on |
| `auth overrides email` | ✅ on |
| `enable local logins` | ❌ off |
| `enable local logins via email` | ❌ off |

Each row has its own Save button — make sure you click it on every change.

### 5.4 Test SSO

Open `https://discuss.miaswebsites.art` in an **incognito / private browser window**. Click **Sign Up** or **Log In**.

What should happen: you redirect to quiz.miaswebsites.art. If you're not signed in there, you go through Auth0. After you're signed in, you bounce back to Discourse, already logged in.

If you see "Bad SSO signature": the secrets don't match. Re-set both sides.

---

## Step 6 · Install the theme

The theme is at https://github.com/So10-k/discourse-quizbook-theme.

### 6.1 Make a personal access token (so Discourse can clone your private repo)

1. https://github.com/settings/tokens?type=beta — "Generate new token" (fine-grained).
2. Token name: `discourse-theme-readonly`. Expiration: 1 year (or whatever).
3. Repository access: **Only select repositories** → pick `discourse-quizbook-theme`.
4. Repository permissions: **Contents: Read-only**.
5. Generate. Copy the token (starts with `github_pat_…`). Call it `<GH-TOKEN>`.

### 6.2 Tell Discourse to clone with the token

In the **browser**, on Discourse: admin → **Customize** → **Themes** → **Install** → "From a git repository".

| Field | Value |
|---|---|
| URL | `https://oauth2:<GH-TOKEN>@github.com/So10-k/discourse-quizbook-theme.git` |
| Branch | `main` |

Click **Install**. Discourse pulls the repo + builds the theme.

### 6.3 Activate the theme

After install, click into the "Quiz Book Theme" you just made:
- ✅ **Set as default**
- ✅ **User selectable**

Visit `https://discuss.miaswebsites.art` — should now look picture-book (sky-blue background, navy borders, sun-yellow buttons, "🌞 Quiz Book" pill in the header).

---

## Step 7 · Install the bridge plugin

The plugin is at https://github.com/So10-k/discourse-quizbook-bridge.

Plugins are baked into the Docker image at build time, not installed at runtime. So you edit `app.yml` + rebuild.

On the **server** (SSH'd in, as root):

```bash
nano /var/discourse/containers/app.yml
```

Find the `hooks:` section. It looks like this around line ~50–60:

```yaml
hooks:
  after_code:
    - exec:
        cd: $home/plugins
        cmd:
          - git clone https://github.com/discourse/docker_manager.git
```

Add a SECOND `git clone` line under it. Replace `<GH-TOKEN>` with the same fine-grained token you made above (give it Read-only access to the bridge repo too — re-edit at https://github.com/settings/tokens?type=beta to add the second repo to the token's scope, OR make a new token).

```yaml
hooks:
  after_code:
    - exec:
        cd: $home/plugins
        cmd:
          - git clone https://github.com/discourse/docker_manager.git
          - git clone https://oauth2:<GH-TOKEN>@github.com/So10-k/discourse-quizbook-bridge.git
```

Save: in `nano`, press **Ctrl+O** → Enter → **Ctrl+X**.

Rebuild:

```bash
cd /var/discourse
./launcher rebuild app
```

Another 10–15 minutes. The forum is offline during rebuild. When it finishes, the plugin is live.

Verify: admin → **Plugins** → you should see `discourse-quizbook-bridge` → set ✅ enabled if it isn't already.

Test:
```
https://discuss.miaswebsites.art/quizbook/qotd.json
```
Should return JSON like `{"ok":true,"url":"https://quiz.miaswebsites.art/qotd"}`.

---

## Step 8 · Polish

In Discourse admin → **Settings** → **Required**:

| Setting | Value |
|---|---|
| `title` | `Mia's Quiz Discuss` |
| `site_description` | `Talk about the tournament. Predictions, gloating, snack reviews.` |
| `short_site_description` | `Mia's Quiz Tournament discussion forum.` |
| `contact_email` | your email |

In **Settings** → **Branding**:
- Upload a logo. Reuse `/email-assets/sun.gif` from the quiz site, or make a square 512×512 PNG of the picture-book sun.

In **Settings** → **Posting** (so 7-year-old Mia can post):
- `min post length` → `5`
- `min topic title length` → `5`
- `min first post length` → `5`

---

## Step 9 · Things you should set up before forgetting

### Backups

Discourse admin → **Backups** → **Configure** (settings page).

Easiest: configure S3-compatible (works with R2). Go to admin → **Settings** → search "backup":
- `backup_location` → `s3`
- `s3_backup_bucket` → e.g. `miaswebsites-discourse-backups`
- `s3_endpoint` → your R2 endpoint (e.g. `https://2f8365ea25e7fd8c95ba7da82046b81c.r2.cloudflarestorage.com`)
- `s3_access_key_id` → make a separate R2 token with write access to that bucket
- `s3_secret_access_key` → ditto
- `automatic_backups_enabled` → ✅ on
- `backup_frequency` → `7` (days)

Click **Backups** in the admin menu → **Create backup** to test.

### Monitoring

Already done — `/status` on the quiz site checks `discuss.miaswebsites.art` and shows green/red.

### Letting it auto-update

Inside Discourse → top-right hamburger → **Admin** → **Dashboard**. There's an "Update available" banner whenever a new Discourse release ships. Click it; it does the rebuild for you.

---

## How to make changes after launch

### Update the theme

Edit files in `~/Downloads/miasapp1/discourse/theme/` on your laptop, then:

```bash
cd ~/Downloads/miasapp1/discourse/theme
git add .
git commit -m "tweak: whatever"
git push
```

Then in Discourse admin → Themes → "Quiz Book Theme" → click the **🔄** "Check for updates" button → "Update". Live in ~10 seconds, no rebuild.

### Update the plugin

Plugin changes need a rebuild. Edit files in `~/Downloads/miasapp1/discourse/plugin/`, then:

```bash
cd ~/Downloads/miasapp1/discourse/plugin
git add .
git commit -m "plugin: whatever"
git push
```

Then on the server:
```bash
cd /var/discourse && ./launcher rebuild app
```

### Update Discourse itself

```bash
cd /var/discourse && git pull && ./launcher rebuild app
```

Or click the in-app "Update available" banner in admin.

---

## When something breaks

| Symptom | Where to look |
|---|---|
| Forum is down | `ssh` to server, `cd /var/discourse && ./launcher logs app | tail -100` |
| SSO sends "Bad signature" | Re-set both sides of `DISCOURSE_SSO_SECRET` (Vercel + Discourse admin). Redeploy. |
| Theme isn't live after install | Admin → Themes → your theme → "Set as default" + "User selectable" |
| Plugin not appearing | Did you rebuild? `./launcher rebuild app` |
| Cert renewal failing | Check that DNS is set right + Cloudflare proxy is **off** for `discuss.` |
| Stuck rebuild / out of memory | `free -h` on server. If swap is 0, you skipped step 3. Add it now and rebuild. |
| You can't SSH in | Security group rule for SSH (port 22) is probably set to "My IP" — your IP changed. Edit the rule in EC2 → Security Groups. |

---

## What's where

| Lives | What |
|---|---|
| `quiz.miaswebsites.art/api/discourse/sso` | SSO endpoint (auto-deployed with the rest of the quiz site) |
| https://github.com/So10-k/discourse-quizbook-theme | Theme code — edit + push to update |
| https://github.com/So10-k/discourse-quizbook-bridge | Plugin code — edit + push + rebuild server to update |
| EC2 instance `discuss-miaswebsites` (region us-east-1) | Discourse itself |
| Elastic IP `<SERVER-IP>` | Stable IP — never release this until you stop hosting |
| `/var/discourse/containers/app.yml` (on server) | Discourse config (SMTP, plugins, hooks) |

You're done. Go pick a topic name and ask Mia to write the first post.
