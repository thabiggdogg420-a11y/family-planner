const EVENTS=new Set(['landing','start','complete']);
export async function usage(request,env,now=new Date()){
 const empty=status=>new Response(null,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST')return empty(405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return empty(403);
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return empty(415);
 if(Number(request.headers.get('content-length'))>64)return empty(413);
 let bytes=0,chunks=[];try{const reader=request.body?.getReader();if(!reader)return empty(400);for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>64){await reader.cancel();return empty(413);}chunks.push(value);}const all=new Uint8Array(bytes);let i=0;for(const c of chunks){all.set(c,i);i+=c.length;}const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));if(!data||Array.isArray(data)||Object.keys(data).length!==1||!EVENTS.has(data.event))return empty(400);
 if(!env.DB)return empty(503);
 const day=now.toISOString().slice(0,10),cutoff=new Date(now.getTime()-90*86400000).toISOString().slice(0,10);
 await env.DB.batch([env.DB.prepare('DELETE FROM usage_daily WHERE day < ?').bind(cutoff),env.DB.prepare('INSERT INTO usage_daily(day,event,count) VALUES(?,?,1) ON CONFLICT(day,event) DO UPDATE SET count=min(count+1,10000)').bind(day,data.event)]);return empty(204);
 }catch{return empty(503);}
}
