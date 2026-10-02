import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGitStatusPath,classifyCoverReleaseChanges} from './cover-release-policy.mjs';

const ROOT='C:\\Users\\stefa\\AppData\\Local\\Temp\\one-world-route-cover-batch-0002\\one-world-route-public-mvp';
const tripIds=['alaska-inside-passage-ferry','sri-lanka-hill-country-rail'];

test('normalizes repo-root-relative paths from a subdirectory worktree',()=>{
  assert.equal(
    normalizeGitStatusPath(' M one-world-route-public-mvp/GRAPHICS_NEEDED.md',ROOT),
    'GRAPHICS_NEEDED.md'
  );
  assert.equal(
    normalizeGitStatusPath('?? one-world-route-public-mvp/assets/media/journeys/alaska-inside-passage-ferry/cover/v001/file.webp',ROOT),
    'assets/media/journeys/alaska-inside-passage-ferry/cover/v001/file.webp'
  );
});

test('normalizes Windows separators and rename targets',()=>{
  assert.equal(
    normalizeGitStatusPath(' M one-world-route-public-mvp\\data\\platform\\generated-media.json',ROOT),
    'data/platform/generated-media.json'
  );
  assert.equal(
    normalizeGitStatusPath('R  old.txt -> one-world-route-public-mvp/data/platform/generated-media.json',ROOT),
    'data/platform/generated-media.json'
  );
});

test('allows only expected cover release outputs',()=>{
  const lines=[
    ' M one-world-route-public-mvp/GRAPHICS_NEEDED.md',
    ' M one-world-route-public-mvp/data/platform/generated-media.json',
    ' M one-world-route-public-mvp/data/platform/trips/alaska-inside-passage-ferry.json',
    '?? one-world-route-public-mvp/assets/media/journeys/alaska-inside-passage-ferry/cover/v001/journey--alaska-inside-passage-ferry--cover--16x9--v001--w1600.webp',
    ' M one-world-route-public-mvp/core.bundle.js',
    '?? one-world-route-public-mvp/random-output.txt'
  ];
  const classified=classifyCoverReleaseChanges({statusLines:lines,root:ROOT,tripIds});
  const byPath=Object.fromEntries(classified.map(x=>[x.path,x]));
  assert.equal(byPath['GRAPHICS_NEEDED.md'].allowed,true);
  assert.equal(byPath['data/platform/generated-media.json'].allowed,true);
  assert.equal(byPath['data/platform/trips/alaska-inside-passage-ferry.json'].allowed,true);
  assert.equal(byPath['assets/media/journeys/alaska-inside-passage-ferry/cover/v001/journey--alaska-inside-passage-ferry--cover--16x9--v001--w1600.webp'].allowed,true);
  assert.equal(byPath['core.bundle.js'].knownBuildDrift,true);
  assert.equal(byPath['random-output.txt'].allowed,false);
  assert.equal(byPath['random-output.txt'].knownBuildDrift,false);
});

test('handles accidentally trimmed first porcelain line defensively',()=>{
  assert.equal(
    normalizeGitStatusPath('M one-world-route-public-mvp/GRAPHICS_NEEDED.md',ROOT),
    'GRAPHICS_NEEDED.md'
  );
});
