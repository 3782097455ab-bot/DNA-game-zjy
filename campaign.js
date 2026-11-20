const campaign = (() => {
  const key = "dna-builder-campaign-v1";
  const node = name => byId("mission-"+name);
  const button = (attr, value, label, more="") => '<button type="button" '+attr+'="'+value+'" '+more+'>'+label+'</button>';
  const routeLevels = route => campaignLevels.filter(l=>l.route===route);
  const audio = new ChallengeAudio();
  const division = new ChallengeScene(node("division"));
  let progress = {}, run = null, timer = 0, previous = null, view = null;
  function read() {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "{}");
      if(stored && typeof stored==="object" && !Array.isArray(stored)) Object.assign(progress,stored);
    } catch { /* Keep session progress when storage is unavailable. */ }
  }
  function accessible(level) {
    const levels=routeLevels(level.route), i=levels.indexOf(level);
    return i===0 || Boolean(progress[levels[i-1].id]);
  }
  function stop() {
    cancelAnimationFrame(timer);
    timer=0; previous=null; run=null; view=null; audio.reset();
  }
  function map() {
    stop(); stopFrame(); challenge.stop(); read();
    byId("campaign-routes").innerHTML=campaignRoutes.map(route=>{
      const levels=routeLevels(route.key), done=levels.filter(l=>progress[l.id]).length;
      return '<section class="route"><div class="route-head"><div><p class="section-label">已完成 '+done+' / '+levels.length+'</p><h3>'+route.name+'</h3><p>'+route.description+'</p></div></div><ol>'+
        levels.map((l,i)=>'<li>'+button("data-level",l.id,'<i>'+String(i+1).padStart(2,"0")+'</i><span><strong>'+l.name+'</strong><small>'+l.summary+'</small></span><em>'+(progress[l.id]?"重玩 ↗":accessible(l)?"进入 ↗":"完成上一关解锁")+'</em>',accessible(l)?'':'disabled')+'</li>').join("")+'</ol></section>';
    }).join("");
    showPage("map","map-title");
  }
  function startLevel(id) {
    const level=campaignLevels.find(l=>l.id===id);
    if(!level || !accessible(level)) return;
    stop();
    run={level,step:0,elapsed:0,stageAt:0,branch:"right",data:{},pairs:0,repairs:0,beats:0,errors:0,tool:null,lastSite:null,paused:false,ended:false};
    node("title").textContent=level.name;
    node("route").textContent=campaignRoutes.find(r=>r.key===level.route).name;
    node("pause").hidden=false;
    node("sound").hidden=!level.beat && !level.limit;
    node("result").innerHTML="";
    node("feedback").textContent="";
    node("guide").dataset.kind="hint";
    showPage("mission","mission-title");
    render();
    tick(performance.now());
  }
  function render() {
    if(!run || run.ended) return;
    view=run.level.view(run);
    const paused=run.paused;
    node("pause").textContent=paused?"继续":"暂停";
    node("pause").setAttribute("aria-pressed",String(paused));
    node("stage").textContent=(run.step+1)+" / "+run.level.steps+"　"+view.title;
    node("hint").textContent=paused?"已暂停，点「继续」回到这个位点。":view.hint;
    node("guide").hidden=false;
    node("board").hidden=paused || !!view.division;
    node("division").hidden=paused || !view.division;
    const forkButtons=view.forks?'<div class="mission-forks">'+["left","right"].map((s,i)=>button("data-branch",s,i?"E · 右叉":"Q · 左叉",'aria-pressed="'+(s===run.branch)+'"')).join("")+'</div>':"";
    node("board").innerHTML=(view.visual||"")+forkButtons+'<div class="mission-sites">'+view.sites.map(s=>button("data-site",s.id,s.label)).join("")+'</div>';
    node("tools").hidden=paused || !view.tools?.length;
    node("tools").innerHTML=(view.tools||[]).map(t=>button("data-mtool",t,toolLabels[t]||t,'aria-pressed="'+(t===run.tool)+'"')).join("");
    clock();
  }
  function clock() {
    const limit=run.level.limit;
    const counting=limit && run.step<6;
    let label=counting?"剩余 "+Math.max(0,Math.ceil((limit-run.elapsed)/1000))+" 秒":"用时 "+Math.floor(run.elapsed/1000)+" 秒";
    if(run.level.beat) label+="　·　踩拍 +"+run.beats*2;
    if(node("time").textContent!==label) node("time").textContent=label;
    node("time").classList.toggle("pulse",!!run.level.beat && run.elapsed%CHALLENGE_BEAT<95 && !run.paused);
  }
  function message(s,wrong=false) {
    node("feedback").textContent=s;
    node("guide").dataset.kind=wrong?"mismatch":"correct";
  }
  function next() {
    run.step++; run.stageAt=run.elapsed; run.tool=null;
    if(run.step>=run.level.steps) finish(true);
    else render();
  }
  function live() {return run && !run.ended && !run.paused && !infoDialog.open;}
  function hit(id) {
    if(!live()) return;
    const s=view.sites.find(s=>s.id===id);
    if(!s) return;
    if(s.error || (s.tool && s.tool!==run.tool)) {
      run.errors++;
      message(s.error || ("这一位点需要 "+(toolLabels[s.tool]||s.tool)+"。先选工具，再点位点。"),true);
      return;
    }
    if(s.effect) s.effect(run);
    run.pairs+=s.pair||0;
    run.repairs+=s.repair||0;
    const phase=run.elapsed%CHALLENGE_BEAT;
    const beat=run.level.beat && s.rhythm && Math.min(phase,CHALLENGE_BEAT-phase)<=CHALLENGE_BEAT*.16;
    if(beat) run.beats++;
    if(s.keySite) run.lastSite={label:s.keySite,why:s.why};
    message((s.feedback || s.label+" ✓")+(beat?" · 踩拍 +2":""));
    if(s.inspect) render(); else next();
  }
  function tool(t) {
    if(!live() || !view.tools?.includes(t)) return;
    run.tool=t;
    for(const b of node("tools").querySelectorAll("button")) b.setAttribute("aria-pressed",String(b.dataset.mtool===t));
  }
  function selectBranch(side) {
    if(!live() || !view.forks) return;
    run.branch=side;run.tool=null;render();
  }
  function togglePause() {
    if(!run || run.ended) return;
    run.paused=!run.paused;run.tool=null;previous=null;audio.reset();render();
  }
  function tick(now) {
    if(!run || run.ended) return;
    const delta=previous===null?0:now-previous;
    previous=now;
    if(live()) {
      run.elapsed+=delta;
      if(run.level.limit && run.step<6 && run.elapsed>=run.level.limit) return finish(false);
      if(view.division) division.draw({elapsed:run.elapsed-run.stageAt,divisionAt:0},"right","division",delta);
      if(view.auto && run.elapsed-run.stageAt>=view.auto) {next();if(run.ended)return;}
      if(view.refreshAt!=null && run.elapsed>=view.refreshAt) render();
      if(!node("sound").hidden && audio.enabled) audio.sync(run.elapsed);
      clock();
    }
    timer=requestAnimationFrame(tick);
  }
  function finish(won) {
    run.ended=true;cancelAnimationFrame(timer);audio.reset();
    const l=run.level;
    if(won) {
      read();
      progress[l.id]={cleared:true,errors:run.errors,elapsed:Math.round(run.elapsed)};
      try{localStorage.setItem(key,JSON.stringify(progress));}catch{ /* Session still works. */ }
    }
    node("stage").textContent=won?"本关完成":"本关时间到";
    for(const id of ["board","division","tools","guide","pause","sound"])node(id).hidden=true;
    const nextLevel=routeLevels(l.route)[routeLevels(l.route).indexOf(l)+1];
    const record=run.lastSite;
    const stats=l.stats?l.stats(run):[["正确配对",run.pairs],["完成修复",run.repairs]];
    stats.push(["用时",Math.ceil(run.elapsed/1000)+" 秒"]);
    node("result").innerHTML='<div class="settlement"><h3 tabindex="-1">'+(won?"完成 · "+l.name:"计时结束")+'</h3><dl class="result-stats">'+stats.map(([a,b])=>'<div><dt>'+a+'</dt><dd>'+b+'</dd></div>').join("")+'</dl>'+
      (record?'<figure class="key-site"><figcaption>本局关键位点</figcaption><strong>'+record.label+'</strong><p>'+record.why+'</p></figure>':'')+
      (won && l.product?l.product(run):'')+'<div class="mission-nav">'+(won&&nextLevel?button("data-level",nextLevel.id,"下一关 · "+nextLevel.name):"")+button("data-level",l.id,"重试本关")+button("data-action","map","关卡地图")+'</div></div>';
    node("result").querySelector("h3").focus();
  }
  node("pause").addEventListener("click",togglePause);
  node("sound").addEventListener("click",async()=>{
    await audio.toggle();
    node("sound").textContent="节拍音："+(audio.enabled?"开":"关");
    node("sound").setAttribute("aria-pressed",String(audio.enabled));
  });
  document.addEventListener("click",e=>{
    const b=e.target.closest("button");
    if(!b || b.disabled) return;
    if(b.dataset.level)startLevel(b.dataset.level);
    else if(b.dataset.site)hit(b.dataset.site);
    else if(b.dataset.branch)selectBranch(b.dataset.branch);
    else if(b.dataset.mtool)tool(b.dataset.mtool);
  });
  document.addEventListener("keydown",e=>{
    if(!live() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k=e.key.toUpperCase();
    if(view.forks && (k==="Q" || k==="E")){e.preventDefault();selectBranch(k==="Q"?"left":"right");}
    else {
      const t=k==="SHIFT"?"repair":k==="F"?"enzyme":k;
      if(view.tools?.includes(t)){e.preventDefault();tool(t);}
    }
  });
  document.addEventListener("visibilitychange",()=>{if(document.hidden && live())togglePause();});
  infoDialog.addEventListener("close",()=>{previous=null;});
  read();
  return {map,stop,cleared:id=>Boolean(progress[id])};
})();
