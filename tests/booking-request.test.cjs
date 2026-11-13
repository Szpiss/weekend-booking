const test=require('node:test');
const assert=require('node:assert/strict');
const {send}=require('../assets/booking-request.js');
const payload=Object.freeze({request_id:'b5000000-0000-4000-8000-000000000001',nickname:'unit-test'});
function dbFor(respond){return {from(table){assert.equal(table,'outing_reservations');return {insert(p){assert.equal(p,payload);return {abortSignal(signal){return respond(signal,p);}};}};}};}
test('acknowledged insert succeeds without reading private rows',async()=>{
 const result=await send(dbFor(()=>Promise.resolve({error:null,status:201})),payload);
 assert.deepEqual(result,{ok:true,duplicate:false,status:201});
});
test('slow response succeeds after the slow-connection notice',async()=>{
 let slow=0;
 const result=await send(dbFor(()=>new Promise(resolve=>setTimeout(()=>resolve({error:null,status:201}),25))),payload,{slowAfterMs:3,timeoutMs:80,onSlow:()=>slow++});
 assert.equal(result.ok,true);assert.equal(slow,1);
});
test('deadline identifies timeout, retry keeps the original request UUID',async()=>{
 const received=[];
 const db=dbFor((signal,p)=>{received.push(p.request_id);if(received.length===1)return new Promise(resolve=>signal.addEventListener('abort',()=>resolve({error:{message:'AbortError: aborted'},status:0}),{once:true}));return Promise.resolve({error:{code:'23505',message:'duplicate key'},status:409});});
 const first=await send(db,payload,{timeoutMs:8,slowAfterMs:2});
 assert.equal(first.kind,'timeout');assert.equal(first.ok,false);
 const retried=await send(db,payload);assert.equal(retried.ok,true);assert.equal(retried.duplicate,true);
 assert.deepEqual(received,[payload.request_id,payload.request_id]);
});
test('offline mode sends nothing',async()=>{
 const result=await send(dbFor(()=>{throw Error('must not send');}),payload,{offline:true});
 assert.equal(result.kind,'offline');
});
test('Safari Load failed is a network error, never a success',async()=>{
 const result=await send(dbFor(()=>Promise.reject(new TypeError('Load failed'))),payload);
 assert.equal(result.kind,'network');assert.equal(result.ok,false);
});
test('HTTP authorization and service errors remain distinguishable',async()=>{
 for(const [status,kind] of [[401,'permission'],[403,'permission'],[503,'service']]){
  const result=await send(dbFor(()=>Promise.resolve({error:{message:'request failed'},status})),payload);
  assert.equal(result.kind,kind);assert.equal(result.ok,false);
 }
});
test('validation and spam protection remain in force',async()=>{
 for(const [error,kind] of [[{code:'23514',message:'check failed'},'validation'],[{code:'P0001',message:'RATE_LIMITED'},'rate-limit']]){
  const result=await send(dbFor(()=>Promise.resolve({error,status:400})),payload);assert.equal(result.kind,kind);
 }
});
test('completed request cancels slow callbacks',async()=>{
 let slow=0;
 await send(dbFor(()=>Promise.resolve({error:null,status:201})),payload,{slowAfterMs:5,onSlow:()=>slow++});
 await new Promise(resolve=>setTimeout(resolve,15));assert.equal(slow,0);
});
