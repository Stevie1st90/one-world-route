export const normalizeGitStatusPath=(statusLine,root)=>{
  let path=String(statusLine||'').slice(3).trim().replaceAll('\\','/');
  if(path.includes(' -> '))path=path.split(' -> ').at(-1);
  path=path.replace(/^\.\//,'');
  const normalizedRoot=String(root||'').replaceAll('\\','/').replace(/\/+$/,'');
  const rootName=normalizedRoot.split('/').at(-1)||'';
  const marker=rootName+'/';
  if(path.startsWith(marker))path=path.slice(marker.length);
  else{
    const nested=path.lastIndexOf('/'+marker);
    if(nested>=0)path=path.slice(nested+marker.length+1);
  }
  return path;
};

export const classifyCoverReleaseChanges=({statusLines,root,tripIds})=>{
  const canonicalPrefixes=tripIds.map(id=>`assets/media/journeys/${id}/cover/`);
  const exactAllowed=new Set([
    'data/platform/generated-media.json',
    'data/platform/trip-index.json',
    'data/platform/visual-briefs.json',
    'data/platform/visual-coverage.json',
    'data/platform/graphics-backlog.json',
    'data/platform/media-manifest.json',
    'GRAPHICS_NEEDED.md',
    'sitemap.xml',
    ...tripIds.map(id=>`data/platform/trips/${id}.json`)
  ]);
  const buildDrift=new Set(['features.bundle.js','features.bundle.css','core.bundle.js','core.bundle.css']);
  return statusLines.filter(Boolean).map(line=>{
    const path=normalizeGitStatusPath(line,root);
    const allowed=exactAllowed.has(path)||canonicalPrefixes.some(prefix=>path.startsWith(prefix));
    return {line,path,allowed,knownBuildDrift:buildDrift.has(path)};
  });
};
