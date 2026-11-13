/* Transport outcomes only. No booking data is read, logged or persisted here. */
(() => {
  function classify(error,status,timedOut,offline) {
    if (timedOut) return 'timeout';
    if (offline) return 'offline';
    if (error?.message?.includes('RATE_LIMITED')) return 'rate-limit';
    if (error?.code === '23514' || error?.code === '22001') return 'validation';
    if (status === 401 || status === 403 || error?.code === '42501' || error?.code === 'PGRST301') return 'permission';
    if (status >= 500) return 'service';
    if (!status || /fetch|network|load failed|abort/i.test(error?.message || '')) return 'network';
    return 'request';
  }
  async function send(db,payload,{timeoutMs=30000,slowAfterMs=8000,onSlow=()=>{},offline=false}={}) {
    if (offline) return {ok:false,kind:'offline',status:0};
    const controller=new AbortController();
    let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
    const slowTimer=setTimeout(onSlow,slowAfterMs);
    try {
      const {error,status}=await db.from('outing_reservations').insert(payload).abortSignal(controller.signal);
      // A received acknowledgement wins even if a deadline fired at the same moment.
      if (!error) return {ok:true,duplicate:false,status};
      if (error.code === '23505') return {ok:true,duplicate:true,status};
      return {ok:false,kind:classify(error,status,timedOut,false),status:status || 0,code:error.code || ''};
    } catch (error) {
      return {ok:false,kind:classify(error,0,timedOut,false),status:0};
    } finally {
      clearTimeout(timer);clearTimeout(slowTimer);
    }
  }
  const messages={
    timeout:'连接等待超时了，还没确认是否保存。你的填写仍在，请切换 Wi-Fi / 手机流量后点「安全重试」。',
    offline:'网络好像断开了。你的填写仍在，恢复网络后点「安全重试」即可。',
    network:'暂时连不上预约服务。你的填写仍在，请切换 Wi-Fi / 手机流量，再点「安全重试」。',
    'rate-limit':'发送得有点频繁，同一联系方式每小时最多 3 份。先歇一会儿吧。',
    validation:'有一项内容未通过校验，请检查日期、联系方式和字数。',
    permission:'预约服务的访问配置出现问题，请联系发起人检查。你的填写仍在。',
    service:'预约服务暂时没有正常回应，还没确认保存结果。稍后可安全重试。',
    request:'预约服务未接受这次请求，请联系发起人检查。你的填写仍在。'
  };
  const api={send,messages};
  if(typeof window!=='undefined')window.WeekendBookingRequest=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
