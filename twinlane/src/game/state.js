import {LANES,UNIT} from './rules.js';
export function createState(){
  return {version:1,tick:0,time:0,mode:'ball',running:false,
    ball:{id:'ball',x:100,y:400,vx:160,radius:14},
    castles:[{owner:1,x:35,y:400,health:1000},{owner:2,x:965,y:400,health:1000}],
    resources:{1:{wood:0,stone:0,iron:0},2:{wood:0,stone:0,iron:0}},units:[]};
}
export function createUnit(owner,lane){
  return {id:`unit-${owner}`,type:'scout',owner,lane,x:owner===1?70:930,y:LANES[lane],...UNIT,target:null,attackRemaining:0};
}
