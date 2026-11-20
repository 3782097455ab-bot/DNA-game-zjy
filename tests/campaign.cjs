// Run with playwright-core and its Chromium installed. No game server is required.
const assert = require("node:assert/strict");
const {pathToFileURL} = require("node:url");
const path = require("node:path");
const {chromium} = require("playwright-core");
const entry=process.env.GAME_URL || pathToFileURL(path.resolve(__dirname,"../index.html")).href;
async function check(browser,mobile) {
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:860},hasTouch:mobile,isMobile:mobile,reducedMotion:"reduce"});
  const p=await ctx.newPage(), errors=[];
  p.on("pageerror",e=>errors.push(e.message));
  p.setDefaultTimeout(5000);
  p.setDefaultNavigationTimeout(90000);
  await p.goto(entry);
  await p.clock.install();
  const el=s=>p.locator(s);
  const press=async s=>{if(mobile)await el(s).tap();else await el(s).click();};
  const get=s=>el(s).innerText();
  const site=id=>press('[data-site="'+id+'"]');
  const tool=async t=>{if(mobile)await press('[data-mtool="'+t+'"]');else await p.keyboard.press(t==="repair"?"Shift":t==="enzyme"?"f":t);};
  const act=async(t,id)=>{await tool(t);await site(id);};
  const branch=async b=>{if(mobile)await press('[data-branch="'+b+'"]');else await p.keyboard.press(b==="left"?"q":"e");};
  const level=id=>press('button[data-level="'+id+'"]:visible');
  const home=()=>press("#home-button");
  const map=()=>press('[data-action="map"]:visible');
  const done=async(name,counts)=>{assert.match(await get("#mission-result h3"),new RegExp(name));assert(await el(".key-site strong").isVisible());if(counts)assert.deepEqual((await el("#mission-result dd").allTextContents()).slice(0,2),counts);};
  await require("./expression.cjs")({p,el,press,get,site,tool,act,level,home,map,done,mobile,assert});
  await map();assert(await el('[data-level="relay"]').isDisabled());await level("fork");
  await site("5");assert.match(await get("#mission-feedback"),/另一端/);
  await press("#mission-pause");assert(await el("#mission-board").isHidden());await press("#mission-pause");
  await site("3");for(const t of ["T","G","C","A"])await act(t,"end");
  await done("认识复制叉",["4","0"]);await level("relay");
  await act("A","r1");await branch("left");await act("G","l1");
  await p.clock.runFor(900);await act("T","l2");await branch("right");await act("C","r2");
  await done("双叉接力",["4","0"]);await level("okazaki");
  await site("seal");assert.match(await get("#mission-feedback"),/引物/);
  await act("enzyme","primer");for(const t of ["G","T","A"])await act(t,"extend");
  await p.clock.runFor(1550);assert.match(await get("#mission-board"),/DNA 的 C/);await act("enzyme","seal");
  await done("冈崎片段",["3","0"]);await level("fidelity");
  await act("repair","edit");await act("C","end");await site("col0");await site("col1");await act("enzyme","old");await act("enzyme","cut");
  await act("G","fill");await act("C","fill");await act("enzyme","seal");await done("保真实验",["3","2"]);
  await level("division");await press("#mission-sound");assert.equal(await el("#mission-sound").getAttribute("aria-pressed"),"true");await press("#mission-sound");
  await press("#mission-pause");const paused=await get("#mission-time");await p.clock.fastForward(65000);assert.equal(await get("#mission-time"),paused);
  await press("#mission-pause");await p.clock.runFor(40);await p.clock.fastForward(61000);assert.match(await get("#mission-result h3"),/计时结束/);
  await level("division");await act("enzyme","primer");await branch("left");await act("repair","edit");
  await p.clock.runFor(850);await act("C","l1");await branch("right");await act("G","r1");
  await p.clock.runFor(1300);await act("enzyme","seal");await branch("left");await act("A","l2");
  await site("right");await site("right");assert.match(await get("#mission-feedback"),/相反/);await site("left");
  assert(await el("#mission-division").isVisible());await p.clock.runFor(6100);await done("分裂前的接力",["3","1"]);
  await home();await p.reload();await map();assert.equal(await el(".route").first().locator("button:disabled").count(),0);
  await home();
  await press('[data-action="play"]:visible');await p.clock.runFor(2100);
  await press("#pause");assert.match(await get("#pause"),/继续/);await press("#pause");
  for(const [i,seq] of ["TCAGTGCA","ACGTCGTA","GTACTCAG"].entries()){
    if(i)await p.clock.runFor(2100);
    for(const t of seq){await press('[data-base="'+t+'"]');await p.clock.runFor(720);}
    await p.clock.runFor(2200);assert(await el("#segment-dialog").isVisible());await press("#continue");
  }
  assert.match(await get("#result-title"),/复制完成/);
  await home();await p.reload();await press('[data-dialog="genes"]:visible');assert.equal((await get("#info-content")).match(/已解锁/g).length>=3,true);await press("#info-close");
  await press('[data-action="demo"]:visible');await p.clock.runFor(16000);assert.match(await get("#result-title"),/一条旧链/);await home();
  await press('[data-action="challenge"]:visible');await press("#challenge-fast");await p.clock.runFor(600);assert.match(await get("#challenge-clock"),/38/);await p.clock.fastForward(39500);assert.match(await get("#challenge-card-title"),/时间到/);
  await press("#challenge-begin");await p.clock.runFor(750);assert.match(await get("#challenge-clock"),/60/);
  await press("#challenge-sound");assert.equal(await el("#challenge-sound").getAttribute("aria-pressed"),"true");await press("#challenge-sound");
  await press("#challenge-pause");assert.match(await get("#challenge-pause"),/继续/);await press("#challenge-pause");
  // Operate on actual rendered site buttons. The model supplies template identity and current lane.
  for(let cycle=0;cycle<65;cycle++){
    await p.clock.runFor(190);
    if(await p.evaluate(()=>challenge.mode!=="play"))break;
    const targets=await p.evaluate(()=>["right","left"].flatMap(side=>challenge.round.targets(side).map(t=>({side,id:t.id,tool:t.kind==="pair"?BASE[t.template].partner:t.kind==="repair"?"repair":"enzyme"}))));
    if(!targets.length)continue;
    const target=targets[0];
    await press('[data-fork="'+target.side+'"]');
    const hit=el('[data-target="'+target.id+'"]');
    await p.clock.runFor(120);
    if(!await hit.isVisible())continue;
    await press('[data-tool="'+target.tool+'"]');
    await press('[data-target="'+target.id+'"]');
    if(await el('[data-tool="'+target.tool+'"]').getAttribute("aria-pressed")==="true")await press('[data-tool="'+target.tool+'"]');
  }
  await p.clock.runFor(8000);assert.match(await get("#challenge-card-title"),/双叉接力完成/);
  await home();assert(await el("#home").isVisible());assert.deepEqual(errors,[]);
  console.log((mobile?"touch 390px":"desktop 1280px")+" passed campaign, storage, old gallery, practice, demo, challenge, audio and navigation");
  await ctx.close();
}
(async()=>{
  const proxy=process.env.GAME_PROXY?{server:process.env.GAME_PROXY}:undefined;
  const b=await chromium.launch({proxy});
  try {await Promise.all([check(b,false),check(b,true)]);}
  finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

