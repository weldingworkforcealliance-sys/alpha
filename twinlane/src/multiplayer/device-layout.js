import {WORLD} from '../game/rules.js';
export function viewport(device){
  if(![1,2].includes(device))throw new Error('Expected Phone A (1) or Phone B (2)');
  return {x0:(device-1)*500,x1:device*500,y0:0,y1:WORLD.height};
}
export function worldToLocal(point,device,width,height){
  const v=viewport(device);return {x:(point.x-v.x0)/(v.x1-v.x0)*width,y:point.y/WORLD.height*height};
}
export function visible(point,device){const v=viewport(device);return point.x+(point.radius||0)>=v.x0 && point.x-(point.radius||0)<=v.x1;}
