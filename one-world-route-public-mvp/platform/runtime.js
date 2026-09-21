(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const extensions=new Map();
  root.runtime={
    version:1,
    registerExtension(id,extension){
      if(!id||typeof extension!=='object')throw new Error('Invalid platform extension');
      if(extensions.has(id))throw new Error('Duplicate platform extension: '+id);
      extensions.set(id,Object.freeze({...extension,id}));
      return extensions.get(id);
    },
    getExtension(id){return extensions.get(id)||null},
    listExtensions(){return [...extensions.values()]}
  };
})();
