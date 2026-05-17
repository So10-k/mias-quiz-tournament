# 🎵 Suno prompt — Finals Intro music sting (~22 seconds)

Use this in [suno.com](https://suno.com) (Custom mode) to generate the
backing track for the cinematic intro. Tuned to match the 22-second
Remotion timeline — quiet at first so Mia's voice cuts through, then
swelling into a stinger on the "coming soon" beat.

---

## Style / genre prompt
```
cinematic orchestral hybrid trailer, light percussive build, sub-bass pulse, glassy synth pads, single ascending piano motif, light woodblock ticks, kid-friendly, no vocals, instrumental, picture-book whimsy meets blockbuster trailer, building tension, climactic last-second hit
```

## Lyrics field (leave INSTRUMENTAL — no vocals)
```
[Instrumental]
```

## Detailed structure prompt (paste in the optional "Style of music" field)
```
0:00–0:03  ambient pad swells in, distant kalimba twinkle, piano hint
0:03–0:08  light bass pulse begins, quiet snare ticks every 4 beats
0:08–0:11  rising piano motif (4 ascending notes, repeated), strings sneak in low
0:11–0:14  motif intensifies, low brass enters, percussion doubles, building anticipation
0:14–0:17  big cinematic riser sweep, tension climbing, snare rolls
0:17–0:20  fall briefly to almost silence (whoosh), drum hit on each word
0:20–0:22  HUGE climactic hit, sustained chord, soft outro tail with sun-shimmer chime
```

## Title to give the track on Suno
```
Mia's Quiz · Finals Intro Sting
```

## After generation

1. Download the .mp3 from Suno (free tier allows downloads)
2. Drop it at: `public/audio/finals-intro-sting.mp3`
3. Edit `remotion/FinalsIntro.tsx` line ~125 — change `staticFile("audio/theme.mp3")` to `staticFile("audio/finals-intro-sting.mp3")`
4. Re-run `npm run video:render-intro`

---

## If Suno doesn't quite nail it

Tweaks to try in order of impact:

- "**less melodic**" → strips the piano motif if it's too leadingly cute
- "**more sub-bass**" → makes the build feel deeper / more cinematic
- "**brighter**" or "**warmer**" → flips between Mr.-Beast hype and storybook
- "**cut intro short**" → if 0:00–0:03 ambient is dragging
- "**no vocals**" → lock if Suno tries to sneak in lyrics
- "**ends on a hit**" → ensures the drop lands on the 22s mark

## Backup tracks if Suno fails

Royalty-free alternatives (drop into the same path):

- [Pixabay Music — "Cinematic Trailer"](https://pixabay.com/music/search/cinematic%20trailer/) — search "20 seconds trailer"
- [YouTube Audio Library](https://www.youtube.com/audiolibrary) → filter by "Cinematic" + 20-30 second tracks
- [Free Music Archive](https://freemusicarchive.org/) — search "epic short trailer"

## License hygiene

If you're publishing the intro publicly (YouTube, the blog, etc.),
make sure the music is either:
- Suno-generated (you own it on the paid tier; check current ToS for free tier)
- Royalty-free with attribution noted in the YouTube description
- Your own composition

For a private family forum it doesn't matter much, but a public
broadcast might trigger Content ID claims on YouTube if you grab a
copyrighted track.
