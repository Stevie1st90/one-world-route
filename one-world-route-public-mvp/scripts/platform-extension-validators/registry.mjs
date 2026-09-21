const legacyExtensionKeys={
  cruise:'cruise',
  roadTrip:'roadTrip',
  road:'roadContext',
  border:'borderContext',
  cruiseCall:'call',
  port:'port'
};

const extensionValidators=new Map();

export const getPlatformExtension=(node,id)=>{
  if(!node)return null;
  if(node.extensions&&Object.prototype.hasOwnProperty.call(node.extensions,id))return node.extensions[id];
  const key=legacyExtensionKeys[id];
  return key&&Object.prototype.hasOwnProperty.call(node,key)?node[key]:null;
};

export function registerPlatformExtensionValidator(id,validator){
  if(!id||typeof validator!=='function')throw new Error('Invalid platform extension validator');
  if(extensionValidators.has(id))throw new Error('Duplicate platform extension validator: '+id);
  extensionValidators.set(id,validator);
  return validator;
}

export function listPlatformExtensionValidators(){
  return [...extensionValidators.keys()];
}

export function validatePlatformExtensions(ctx){
  for(const validator of extensionValidators.values())validator(ctx);
}

export const platformExtensionCompatibility={
  legacyExtensionKeys,
  registeredValidators:listPlatformExtensionValidators
};
