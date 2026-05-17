// Remotion render config. Defaults are fine for the picture-book look;
// override here for codec/quality tuning.

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setEntryPoint("remotion/index.ts");
