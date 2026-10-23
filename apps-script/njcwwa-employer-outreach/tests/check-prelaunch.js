'use strict';
const {assert,context:c,sheets}=require('./mock-runtime');
function set(name,value){const r=sheets.Configuration.grid.find(r=>r[0]===name);assert.ok(r);r[1]=value;}
let sent=0,installed=0;
c.Gmail.Users.Messages.send=()=>{sent++;throw Error('Verification attempted email');};
c.ScriptApp.newTrigger=()=>{installed++;throw Error('Verification attempted trigger install');};
const quiet={...console,log:()=>{}};c.console=quiet;
set('Daily New Outreach Target',50);assert.throws(()=>c.verifyAllianceSetup(),/Target must equal 100/);
set('Daily New Outreach Target',100);set('Daily Total Send Cap',50);assert.throws(()=>c.verifyAllianceSetup(),/Cap must equal 100/);
set('Daily Total Send Cap',100);assert.match(c.verifyAllianceSetup(),/Verification result: PASS/);
for(const value of [101,150,1000,'125']){set('Daily New Outreach Target',value);set('Daily Total Send Cap',value);assert.equal(c.getConfig_().dailyNewTarget,100);assert.equal(c.getConfig_().dailyTotalCap,100);assert.match(c.verifyAllianceSetup(),/Verification result: PASS/);}
for(const value of [undefined,null,'','invalid',0,-5,NaN,Infinity,0.5,99.5,true,{},[]]){set('Daily New Outreach Target',value);set('Daily Total Send Cap',value);assert.equal(c.getConfig_().dailyNewTarget,100);assert.equal(c.getConfig_().dailyTotalCap,100);}
set('Daily New Outreach Target',100);set('Daily Total Send Cap',100);
for(const [name,bad,good,pattern] of [['Campaign Enabled','Yes','No',/Campaign Enabled must be No/],['Test Mode','No','Yes',/Test Mode must be Yes/],['Live Launch Authorized','Yes','No',/Live Launch Authorized must be No/]]){set(name,bad);assert.throws(()=>c.verifyAllianceSetup(),pattern);set(name,good);}
const effectiveUser=c.Session.getEffectiveUser;c.Session.getEffectiveUser=()=>({getEmail:()=> 'wrong@example.com'});assert.throws(()=>c.verifyAllianceSetup(),/Wrong authenticated/);c.Session.getEffectiveUser=effectiveUser;
const triggers=c.ScriptApp.getProjectTriggers;c.ScriptApp.getProjectTriggers=()=>[{getHandlerFunction:()=> 'runOutreachCycle',getEventType:()=> 'CLOCK',getTriggerSource:()=> 'CLOCK',getUniqueId:()=> 'mock-trigger'}];assert.throws(()=>c.verifyAllianceSetup(),/Managed triggers must be absent/);c.ScriptApp.getProjectTriggers=triggers;
assert.throws(()=>c.assertLiveSendingAllowed_(c.getConfig_()),/Campaign Enabled must be Yes/);
const result=c.verifyAllianceSetup();assert.match(result,/Automation version: 2026-10-08.1/);assert.match(result,/Managed triggers installed: 0/);assert.match(result,/Test messages sent: 0/);assert.match(result,/Live employer messages sent: 0/);
assert.equal(sent,0);assert.equal(installed,0);
console.log('PASS exact 100/100 verification, 50 rejection, clamps, invalid fallbacks, all pre-launch gates, wrong-account rejection, zero emails and zero trigger installations');
