import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Heebo';
import {DIALOGUE_END, INTRO, ITEMS, OUTRO, starts} from './timeline';
import {Bubble} from './components/Bubble';
import {Intro} from './scenes/Intro';
import {LivingRoom} from './scenes/LivingRoom';
import {PhoneScreen} from './scenes/PhoneScreen';
import {Outro} from './scenes/Outro';

const {fontFamily} = loadFont('normal', {
  weights: ['400', '500', '700', '800', '900'],
  subsets: ['hebrew', 'latin'],
});

export const PromoVideo = () => {
  const frame = useCurrentFrame();

  let currentIdx = -1;
  ITEMS.forEach((it, i) => {
    if (frame >= starts[i] && frame < starts[i] + it.dur) {
      currentIdx = i;
    }
  });
  const current = currentIdx >= 0 ? ITEMS[currentIdx] : null;
  const talking = current && current.kind === 'line' ? current.speaker : null;
  const inCutaway = current?.kind === 'cutaway';

  return (
    <AbsoluteFill style={{fontFamily, backgroundColor: '#FFFFFF'}}>
      {!inCutaway && frame < DIALOGUE_END && <LivingRoom talking={talking} frame={frame} />}
      {ITEMS.map((it, i) =>
        it.kind === 'line' ? (
          <Sequence key={i} from={starts[i]} durationInFrames={it.dur}>
            <Bubble speaker={it.speaker} text={it.text} dur={it.dur} />
          </Sequence>
        ) : it.kind === 'cutaway' ? (
          <Sequence key={i} from={starts[i]} durationInFrames={it.dur}>
            <PhoneScreen dur={it.dur} />
          </Sequence>
        ) : null
      )}
      <Sequence from={0} durationInFrames={INTRO}>
        <Intro />
      </Sequence>
      <Sequence from={DIALOGUE_END} durationInFrames={OUTRO}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
