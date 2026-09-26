export function excelSerialToIso(value){
  const number=Number(value);
  if(!Number.isFinite(number)||number<=0)return null;
  return new Date(Date.UTC(1899,11,30)+number*86400000).toISOString().slice(0,10);
}
export function verificationDate(value){
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  if(typeof value==='number')return excelSerialToIso(value);
  return null;
}
export function verificationDateObject(value){
  const iso=verificationDate(value);
  return iso?new Date(iso+'T00:00:00Z'):null;
}
