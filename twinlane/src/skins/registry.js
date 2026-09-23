import living from './living-kingdoms/manifest.js';
import ironhold from './ironhold/manifest.js';
import {isUnlocked} from '../commerce/entitlements.js';
const skins=new Map([[living.id,living],[ironhold.id,ironhold]]);
export const categories=Object.freeze(Object.keys(living.assets));
export function resolveSkin(id,{devPreview=false,entitlements=[]}={}){
  const skin=skins.get(id);
  if(!skin || (!devPreview&&!isUnlocked(id,entitlements)))return living;
  return Object.freeze({...skin,assets:Object.freeze(Object.fromEntries(categories.map(key=>[key,skin.assets[key]??living.assets[key]])))});
}
