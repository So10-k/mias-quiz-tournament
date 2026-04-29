import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Backdrop } from "./components/Backdrop";
import { Title } from "./scenes/Title";
import { Signup } from "./scenes/Signup";
import { EmailFlow } from "./scenes/EmailFlow";
import { PlayTour } from "./scenes/PlayTour";
import { EmailUpdate } from "./scenes/EmailUpdate";
import { RoundIntro } from "./scenes/RoundIntro";
import { Question } from "./scenes/Question";
import { Strike } from "./scenes/Strike";
import { Strike3Restart } from "./scenes/Strike3Restart";
import { ReplaySubmit } from "./scenes/ReplaySubmit";
import { Review } from "./scenes/Review";
import { Outro } from "./scenes/Outro";
import { SCENES, SFX_CUES } from "./timeline";

export const MainComposition: React.FC = () => {
  return (
    <AbsoluteFill>
      <Backdrop />

      {/* Continuous chill pad — sits beneath every scene. */}
      <Audio src={staticFile("music.wav")} volume={0.55} />

      {/* SFX cues, exact frame positions from timeline.ts */}
      {SFX_CUES.map((cue, i) => (
        <Sequence key={i} from={cue.frame} durationInFrames={120}>
          <Audio
            src={staticFile(`sfx/${cue.sfx}.wav`)}
            volume={
              cue.sfx === "alarm" || cue.sfx === "thud"
                ? 0.95
                : cue.sfx === "tick"
                ? 0.55
                : 0.85
            }
          />
        </Sequence>
      ))}

      <Sequence from={SCENES.title.from} durationInFrames={SCENES.title.duration}>
        <Title />
      </Sequence>

      <Sequence
        from={SCENES.signup.from}
        durationInFrames={SCENES.signup.duration}
      >
        <Signup />
      </Sequence>

      <Sequence
        from={SCENES.email.from}
        durationInFrames={SCENES.email.duration}
      >
        <EmailFlow />
      </Sequence>

      <Sequence
        from={SCENES.playTour.from}
        durationInFrames={SCENES.playTour.duration}
      >
        <PlayTour />
      </Sequence>

      <Sequence
        from={SCENES.emailUpdate.from}
        durationInFrames={SCENES.emailUpdate.duration}
      >
        <EmailUpdate />
      </Sequence>

      <Sequence
        from={SCENES.roundIntro.from}
        durationInFrames={SCENES.roundIntro.duration}
      >
        <RoundIntro />
      </Sequence>

      <Sequence
        from={SCENES.question.from}
        durationInFrames={SCENES.question.duration}
      >
        <Question />
      </Sequence>

      <Sequence
        from={SCENES.strike1.from}
        durationInFrames={SCENES.strike1.duration}
      >
        <Strike which={1} />
      </Sequence>

      <Sequence
        from={SCENES.strike2.from}
        durationInFrames={SCENES.strike2.duration}
      >
        <Strike which={2} />
      </Sequence>

      <Sequence
        from={SCENES.strike3.from}
        durationInFrames={SCENES.strike3.duration}
      >
        <Strike3Restart />
      </Sequence>

      <Sequence
        from={SCENES.replay.from}
        durationInFrames={SCENES.replay.duration}
      >
        <ReplaySubmit />
      </Sequence>

      <Sequence
        from={SCENES.review.from}
        durationInFrames={SCENES.review.duration}
      >
        <Review />
      </Sequence>

      <Sequence
        from={SCENES.outro.from}
        durationInFrames={SCENES.outro.duration}
      >
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
