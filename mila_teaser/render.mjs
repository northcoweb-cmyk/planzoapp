// Renders ./mila_teaser/mila_teaser_music.mp4 and mila_teaser_silent.mp4 (H.264 CRF 14, yuv420p, AAC 320k, +faststart),
// or PNG stills with:  node render.mjs --stills 0.8,2.0,3.2
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const args = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const comp = async (withAudio) => selectComposition({ serveUrl, id: 'MilaTeaser', inputProps: { withAudio }, browserExecutable });
if (args[0] === '--stills') {
  const c = await comp(false);
  for (const s of args[1].split(',').map(Number)) {
    const out = `previews/still_${s.toFixed(1)}s.png`;
    await renderStill({ composition: c, serveUrl, output: out, frame: Math.min(c.durationInFrames - 1, Math.round(s * c.fps)), inputProps: { withAudio: false }, browserExecutable });
    console.log(out);
  }
} else {
  for (const [withAudio, name] of [[true, 'mila_teaser_music'], [false, 'mila_teaser_silent']]) {
    const c = await comp(withAudio), tmp = `out_${name}.mp4`;
    await renderMedia({ composition: c, serveUrl, codec: 'h264', crf: 14, pixelFormat: 'yuv420p', audioBitrate: '320k', muted: !withAudio,
      outputLocation: tmp, inputProps: { withAudio }, browserExecutable, concurrency: 4, chromiumOptions: { gl: 'swangle' },
      onProgress: ({ progress }) => { if (Math.round(progress * 100) % 10 === 0) process.stdout.write(`\r${name} ${Math.round(progress * 100)}%`); } });
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-c', 'copy', '-movflags', '+faststart', `${name}.mp4`]);
    execFileSync('rm', [tmp]); console.log(`\nwrote ${name}.mp4`);
  }
}
