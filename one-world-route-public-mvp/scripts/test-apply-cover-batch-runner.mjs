import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const script=await readFile(resolve('scripts/apply-cover-batch.ps1'),'utf8');

test('Windows cover runner uses detached worktree and remote-only target branch',()=>{
  assert.match(script,/worktree add --detach/);
  assert.doesNotMatch(script,/worktree add -b \$Branch/);
  assert.doesNotMatch(script,/branch -D \$Branch/);
  assert.match(script,/push -u origin \("HEAD:" \+ \$Branch\)/);
});

test('Windows cover runner uses direct Node release invocation',()=>{
  assert.match(script,/node\.exe scripts\/release-cover-batch\.mjs/);
  assert.doesNotMatch(script,/npm\.cmd run covers:release/);
});
