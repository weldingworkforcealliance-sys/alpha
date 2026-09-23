// Future trusted entitlement provider belongs here. Preview never grants ownership.
export function isUnlocked(id,entitlements=[]){return id==='living-kingdoms'||entitlements.includes(id);}
