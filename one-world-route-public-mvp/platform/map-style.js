(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};

  function localize(style,locale='en'){
    const supported=['en','de','it','es','fr','pt'];
    const lang=supported.includes(String(locale||'').toLowerCase())?String(locale).toLowerCase():'en';
    const nameExpr=['coalesce',['get',`name:${lang}`],['get',`name_${lang}`],['get','name:latin'],['get','name_en'],['get','name']];
    for(const layer of style?.layers||[]){
      if(layer?.type!=='symbol'||!layer.layout)continue;
      if(/^(label_(country|city|state|other)|water_name)/.test(String(layer.id||'')))layer.layout['text-field']=nameExpr;
    }
    return style;
  }

  function brandDark(style){
    for(const layer of style?.layers||[]){
      const id=String(layer.id||'').toLowerCase(),type=layer.type;
      layer.paint=layer.paint||{};
      if(type==='background'){
        layer.paint['background-color']='#071019';
        continue;
      }
      if(type==='fill'){
        if(/water|ocean|lake|river/.test(id)){
          layer.paint['fill-color']='#071b2a';layer.paint['fill-opacity']=.98;
        }else if(/park|wood|forest|grass|nature|landcover/.test(id)){
          layer.paint['fill-color']='#102018';layer.paint['fill-opacity']=.72;
        }else if(/building/.test(id)){
          layer.paint['fill-color']='#16232d';layer.paint['fill-outline-color']='#20333e';layer.paint['fill-opacity']=.78;
        }else{
          layer.paint['fill-color']='#0d1720';
          if(layer.paint['fill-opacity']===undefined)layer.paint['fill-opacity']=.94;
        }
      }else if(type==='line'){
        if(/boundary|admin/.test(id)){
          layer.paint['line-color']='#466076';layer.paint['line-opacity']=.5;
        }else if(/motorway|trunk|primary/.test(id)){
          layer.paint['line-color']='#5b6571';layer.paint['line-opacity']=.66;
        }else if(/road|street|transport/.test(id)){
          layer.paint['line-color']='#33424f';layer.paint['line-opacity']=.52;
        }else if(/water|river/.test(id)){
          layer.paint['line-color']='#234f65';layer.paint['line-opacity']=.7;
        }else{
          layer.paint['line-color']=layer.paint['line-color']||'#2e3d49';
          if(layer.paint['line-opacity']===undefined)layer.paint['line-opacity']=.48;
        }
      }else if(type==='symbol'){
        layer.paint['text-color']=/water|marine/.test(id)?'#7098ae':(/country/.test(id)?'#dfeaf2':'#aebfcb');
        layer.paint['text-halo-color']='#071019';
        layer.paint['text-halo-width']=1.2;
        layer.paint['text-halo-blur']=.45;
        if(layer.paint['icon-opacity']===undefined)layer.paint['icon-opacity']=.72;
      }else if(type==='fill-extrusion'){
        layer.paint['fill-extrusion-color']='#172630';layer.paint['fill-extrusion-opacity']=.72;
      }else if(type==='hillshade'){
        layer.paint['hillshade-shadow-color']='#02070b';
        layer.paint['hillshade-highlight-color']='#50606b';
        layer.paint['hillshade-accent-color']='#1f3440';
        layer.paint['hillshade-exaggeration']=.42;
      }
    }
    return style;
  }

  root.mapStyle={localize,brandDark};
})();
