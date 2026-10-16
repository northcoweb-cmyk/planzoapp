// Renders ./mila_teaser/mila_teaser_music.mp4 and mila_teaser_silent.mp4 (H.264 CRF 14, yuv420p, AAC 320k, +faststart),
// or PNG stills with:  node render.mjs --stills 0.8,2.0,3.2
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const args = process.argv.slice(2);
const V2 = args.includes('--v2'); const ID = V2 ? 'MilaTeaserV2' : 'MilaTeaser', SUF = V2 ? '_v2' : '';
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const comp = async (withAudio) => selectComposition({ serveUrl, id: ID, inputProps: { withAudio }, browserExecutable });
if (args.includes('--stills')) {
  const c = await comp(false);
  for (const s of args[args.indexOf('--stills') + 1].split(',').map(Number)) {
    const out = `previews/still${SUF}_${s.toFixed(1)}s.png`;
    await renderStill({ composition: c, serveUrl, output: out, frame: Math.min(c.durationInFrames - 1, Math.round(s * c.fps)), inputProps: { withAudio: false }, browserExecutable });
    console.log(out);
  }
} else {
  // one render (with audio); the silent file is the identical picture with the audio track removed
  for (const [withAudio, name] of [[true, `mila_teaser${SUF}_music`]]) {
    const c = await comp(withAudio), tmp = `out_${name}.mp4`;
    await renderMedia({ composition: c, serveUrl, codec: 'h264', crf: 14, pixelFormat: 'yuv420p', audioBitrate: '320k', muted: !withAudio,
      outputLocation: tmp, inputProps: { withAudio }, browserExecutable, concurrency: 4, chromiumOptions: { gl: 'swangle' },
      onProgress: ({ progress }) => { if (Math.round(progress * 100) % 10 === 0) process.stdout.write(`\r${name} ${Math.round(progress * 100)}%`); } });
    // Remotion tags the stream full-range (yuvj420p): convert to tv-range yuv420p BT.709, trim to exactly 7.000 s, AAC 320k, +faststart
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-i', V2 ? 'public/audio/mix_v2.wav' : 'public/audio/mix.wav', '-map', '0:v', '-map', '1:a', '-t', '7.0',
      '-vf', 'scale=in_range=full:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
      '-profile:v', 'high', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', `${name}.mp4`]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${name}.mp4`, '-c:v', 'copy', '-an', '-movflags', '+faststart', `mila_teaser${SUF}_silent.mp4`]);
    execFileSync('rm', [tmp]); console.log(`\nwrote ${name}.mp4 and mila_teaser${SUF}_silent.mp4`);
  }
}
