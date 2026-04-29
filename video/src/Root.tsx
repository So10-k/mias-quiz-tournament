import { Composition } from "remotion";
import { MainComposition } from "./MainComposition";
import { VIDEO } from "./theme";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="MiasQuiz"
        component={MainComposition}
        durationInFrames={VIDEO.durationInFrames}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
    </>
  );
};
