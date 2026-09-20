export const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function distanceKm(a,b){
  const r=Math.PI/180,h=Math.sin((b[1]-a[1])*r/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin((b[0]-a[0])*r/2)**2;
  return 12742*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
export function inventory(route,waypoints,flights){
  const geometry=s=>flights.geometries[String(s.id)]?.coordinates||waypoints[String(s.id)];
  return route.segments.slice(0,-1).map((a,i)=>{
    const b=route.segments[i+1],ap=geometry(a),bp=geometry(b),start=ap?.at(-1),end=bp?.[0];
    const distance=start&&end?distanceKm(start,end):null;
    const classification=norm(a.to)!==norm(b.from)?'country-mismatch':distance===null?'unresolved-endpoint':distance>0.1?'transfer-required':'shared-endpoint';
    return {id:`connection-${a.id}-${b.id}`,after:a.id,before:b.id,country:a.to,from:a.corridor.split('→').at(-1).trim(),to:b.corridor.split('→')[0].trim(),coordinates:start&&end?[start,end]:null,distanceKm:distance===null?null:Math.round(distance*10)/10,classification};
  });
}
