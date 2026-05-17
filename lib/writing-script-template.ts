// Curated finals script template — hand-written (not AI-generated)
// and tied to the actual runbook (event-runbook.ts) + the actual ads
// (eventVideos.ts) + the actual finalist names.
//
// The host gets a "Use the curated finals template" button next to
// the AI generator. Picking it skips Groq and seeds the script with
// this exact structure. Sam then edits anything he wants before
// passing to Mia for delegation.

import type {
  GeneratedScript,
  GeneratedPart,
  GeneratedLine,
} from "@/lib/writing-script-generator";

const line = (
  character: GeneratedLine["character"],
  text: string,
  cue?: string
): GeneratedLine => ({ character, text, cue: cue ?? null });

const part = (
  title: string,
  description: string | null,
  lines: GeneratedLine[]
): GeneratedPart => ({ title, description, lines });

export const FINALS_TEMPLATE: GeneratedScript = {
  title: "Finals · Saturday May 16 (curated template)",
  parts: [
    part(
      "Cold open + welcome",
      "Pre-show banner up, then welcome reel, then hosts on camera. Mia + Juliette introduce themselves by name.",
      [
        line("narrator", "Tonight: eight weeks. Eleven players. One champion.", "Pre-show banner up; welcome reel cued."),
        line("narrator", "Mia's Quiz Tournament — the Grand Final.", "Welcome reel ends; cut to hosts."),
        line("mia", "Hi! I'm Mia."),
        line("juliette", "And I'm Juliette."),
        line("both", "Welcome to the Grand Final."),
        line(
          "juliette",
          "If you're new tonight — welcome. This is the last night of an eight-week tournament my family started in March."
        ),
        line("mia", "Tonight we get a champion."),
        line("juliette", "First — here's how the night works.", "Cue: bracket graphic comes up."),
      ]
    ),
    part(
      "Tournament recap + bracket reveal",
      "Walk the audience through the season's journey. Name the finalists.",
      [
        line("mia", "Eleven people started. Tonight, four are left."),
        line(
          "juliette",
          "Karen and Marc are still alive in the winners' bracket — they each won their first three matches without losing."
        ),
        line("mia", "Karen is my grandma. She's really good at the geography ones."),
        line(
          "juliette",
          "Marc has only missed two questions all season. He's the favorite."
        ),
        line(
          "juliette",
          "Grandpa and Sam fought their way back through the losers' bracket. They lost early, but they kept winning since."
        ),
        line("mia", "Grandpa is my grandpa. He beat three people in a row."),
        line(
          "juliette",
          "Sam is the host of this whole thing. He is also somehow one of the finalists. Don't ask."
        ),
        line(
          "juliette",
          "Tonight: Grandpa versus Sam first. Then Karen versus Marc. The winners face off in the championship.",
          "Hosts step aside; bracket fills the screen."
        ),
      ]
    ),
    part(
      "Sponsor break 1 — Bracket Insurance + Trivia Pillow",
      "Quick transition into the first two pre-produced ads. Hosts don't perform the ads.",
      [
        line("juliette", "We're going to take a quick break.", "Cue: roll AD — Bracket Insurance."),
        line("narrator", "", "AD: Bracket Insurance plays (20s)."),
        line("narrator", "", "AD: Trivia Pillow plays (20s)."),
        line("mia", "Okay, we're back."),
      ]
    ),
    part(
      "Losers' Bracket Final — Grandpa vs Sam",
      "Open with intro slide, meet the contenders, host runs the 15-question round live. Hosts mainly frame + react between questions.",
      [
        line("juliette", "First up: the losers' bracket final.", "Cue: Losers' bracket intro slide rolls."),
        line(
          "mia",
          "Grandpa versus Sam. One of them is going home. The other plays in the championship."
        ),
        line("juliette", "Both of you — are you ready?", "Wait for a clear nod from both players before continuing."),
        line(
          "juliette",
          "Fifteen questions. Thirty seconds each. Most correct wins."
        ),
        line("mia", "If you tie, we have a tiebreaker question ready."),
        line("juliette", "Let's play.", "Sam triggers Start on the losers' final round from Finals Control."),
        line(
          "mia",
          "Whoa, that was close.",
          "Only deliver this between questions when the running score is within one — improv otherwise."
        ),
        line(
          "juliette",
          "And that's the losers' final. Final score on screen.",
          "Cue: scoreboard scene. Wait for the room to settle."
        ),
        line(
          "mia",
          "Congratulations, {LOSERS_WINNER}. You're going to the championship."
        ),
        line(
          "juliette",
          "And {LOSERS_RUNNER_UP} — that was an incredible run. Take a bow.",
          "Cue: light applause overlay."
        ),
      ]
    ),
    part(
      "Sponsor break 2 — Hot Take Hotline + Strike Cream + Mia's School",
      "Three back-to-back ads between bracket finals.",
      [
        line(
          "juliette",
          "We're back in a minute. First, a word from our sponsors.",
          "Cue: roll AD — Hot Take Hotline."
        ),
        line("narrator", "", "AD: Hot Take Hotline (20s)."),
        line("narrator", "", "AD: Strike Cream (20s)."),
        line("narrator", "", "AD: Mia's School of Quiz (20s)."),
        line("mia", "Did you know I run a school now?"),
        line("juliette", "You don't actually run a school."),
        line("mia", "Not yet."),
      ]
    ),
    part(
      "Winners' Bracket Final — Karen vs Marc",
      "Same shape as the losers' bracket final, but the winners' bracket.",
      [
        line("juliette", "Welcome back. The winners' bracket final.", "Cue: Winners' bracket intro slide."),
        line(
          "mia",
          "Karen versus Marc. Whoever wins meets {LOSERS_WINNER} in the championship."
        ),
        line("juliette", "Same format. Fifteen questions, thirty seconds each."),
        line("mia", "Karen, Marc — good luck."),
        line("juliette", "Let's play.", "Sam triggers Start on the winners' final round."),
        line(
          "mia",
          "And that's the winners' bracket. Final score on screen.",
          "Cue: scoreboard scene."
        ),
        line(
          "juliette",
          "Congratulations, {WINNERS_WINNER}. You're in the championship."
        ),
      ]
    ),
    part(
      "Mega sponsor break before championship",
      "Eight ads in a row, then a single hosting beat before the championship tease.",
      [
        line(
          "juliette",
          "Before we crown a champion, a quick break.",
          "Cue: roll AD — BracketMate."
        ),
        line("narrator", "", "AD: BracketMate (20s)."),
        line("narrator", "", "AD: Quiz Vitamins (20s)."),
        line("narrator", "", "AD: The Buzzer App (20s)."),
        line("narrator", "", "AD: Discourse Cat (20s)."),
        line("narrator", "", "AD: Rewrite History (20s)."),
        line("narrator", "", "AD: Wrong Answer Insurance (20s)."),
        line("narrator", "", "AD: Internal Monologue Insurance (20s)."),
        line("narrator", "", "AD: Sam & Mia: The Aftershow tease (20s)."),
        line("mia", "Wow, that was a lot of ads."),
        line("juliette", "Stay with us. Championship in sixty seconds."),
      ]
    ),
    part(
      "Championship tease",
      "Bridge from the ad block into the title match.",
      [
        line("narrator", "Two finalists. One crown.", "Cue: roll championship tease slide."),
        line("juliette", "{LOSERS_WINNER} versus {WINNERS_WINNER}."),
        line("mia", "First to eight wins."),
        line("juliette", "Let's go."),
      ]
    ),
    part(
      "Championship round",
      "Climax. Hosts speak less here — let the round breathe. Pre-question intros only.",
      [
        line("juliette", "Welcome to the championship."),
        line(
          "mia",
          "Eight questions. Whoever gets to five first is the champion. If you tie, we go to sudden death."
        ),
        line("juliette", "Hands above the buzzers."),
        line("juliette", "Let's play.", "Sam triggers Start on the championship round."),
        line(
          "juliette",
          "And our champion is —",
          "Cue: trigger Drumroll effect. Hold the beat."
        ),
        line("mia", "{CHAMPION}!", "Cue: trigger Confetti + Fanfare effect together."),
      ]
    ),
    part(
      "Champion ceremony + closing credits",
      "Crown the champion. Acknowledge every finalist + every player. Hand off to the closing reel.",
      [
        line("mia", "Champion of Season One!"),
        line(
          "juliette",
          "{CHAMPION} — congratulations. You're the first Mia's Quiz Tournament champion."
        ),
        line(
          "juliette",
          "To the other finalists — Karen, Marc, Grandpa, Sam — incredible season. You all played at a level we couldn't have predicted in week one."
        ),
        line(
          "mia",
          "And to everyone who played, even the people who got out early — thank you. You made this whole thing."
        ),
        line("juliette", "Stay tuned for the aftershow on the forum tomorrow morning."),
        line("mia", "Bedtime for me. Goodnight!"),
        line(
          "juliette",
          "See you next season.",
          "Cue: roll closing credits slide; full music up; fade to black."
        ),
      ]
    ),
  ],
};
