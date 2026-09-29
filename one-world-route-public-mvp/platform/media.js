(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const SAFE_ASSET=/^\.\/assets\/[a-z0-9_./-]+$/i;

  function descriptor(entry,fallbackTheme='ocean'){
    const theme=String(entry?.theme||fallbackTheme||'ocean').replace(/[^a-z0-9-]/gi,'')||'ocean';
    if(entry?.type==='image'&&SAFE_ASSET.test(String(entry.asset||''))){
      const asset=String(entry.asset);
      return {
        type:'image',
        theme,
        className:'platform-media-image visual-'+theme,
        style:'background-image:linear-gradient(180deg,rgba(5,10,17,.08),rgba(5,10,17,.5)),url("'+asset.replace(/"/g,'')+'")',
        attribution:String(entry.attribution||''),
        license:String(entry.license||'')
      };
    }
    return {type:'art-directed',theme,className:'visual-'+theme,style:'',attribution:'',license:String(entry?.license||'original-ui-art')};
  }

  function credit(entry,esc=value=>String(value??'')){
    const media=descriptor(entry);
    if(media.type!=='image'||!media.attribution)return '';
    return '<small class="platform-media-credit">'+esc(media.attribution)+(media.license?' · '+esc(media.license):'')+'</small>';
  }

  root.media={descriptor,credit};
})();