import React from 'react';
import { Composition } from 'remotion';
import { Teaser } from './Teaser';
import beats from './beats.json';
import { TeaserV2 } from './TeaserV2';

export const RemotionRoot: React.FC = () => (<>
  <Composition id="MilaTeaser" component={Teaser} width={1080} height={1920} fps={beats.fps}
    durationInFrames={Math.round(beats.duration * beats.fps)} defaultProps={{ withAudio: true }} />
  <Composition id="MilaTeaserV2" component={TeaserV2} width={1080} height={1920} fps={60} durationInFrames={420} defaultProps={{ withAudio: true }} />
</>);
