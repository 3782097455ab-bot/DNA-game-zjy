const campaignRoutes = [{ name: "复制与修复", key: "replication", description: "从辨认新链的方向，到把复制后的染色体送进两个子细胞。" }];
const campaignLevels = [];
const baseTools = ["A", "T", "C", "G"];
const toolLabels = { A:"A", T:"T", C:"C", G:"G", U:"U", repair:"Shift · 校对", enzyme:"F · 加酶" };

function strand(label, start, bases, end, style = "") {
  return '<div class="strand '+style+'"><span>'+label+'</span><div class="bases"><small>'+start+'</small>'+
    Array.from(bases, base => '<b data-letter="'+base+'">'+base+'</b>').join("")+'<small>'+end+'</small></div></div>';
}

function molecule(rows, note) {
  return '<div class="molecule">'+rows.join("")+'</div><p class="figure-note">'+note+'</p>';
}

function site(id, label, tool = null, details = {}) {
  return { id, label, tool, ...details };
}
function pairSite(id, template, location) {
  const partner = BASE[template].partner;
  return site(id, location+" · 模板 "+template, partner, {
    pair:1, keySite:location+" · "+template+"–"+partner, why:"聚合酶在新链 3′ 端接入互补碱基 "+partner+"。"
  });
}

function introFork(run) {
  const n = run.step;
  const lead = "TG".slice(0,Math.max(0,n-1)).padEnd(2,"·");
  const lag = n < 4 ? "··" : n === 4 ? "·C" : "AC";
  const picture = molecule([
    strand("前导模板","3′","AC","5′"),strand("新链 →","5′",lead,"3′","daughter"),
    strand("后随模板","5′","TG","3′"),strand("← 新片段","3′",lag,"5′","daughter")
  ],"复制叉向右打开 →　前导链向右延伸，后随片段从靠近叉口的引物向左延伸。这里只显示引物外的两个待配对位点。");
  if (!n) return {title:"找到延伸端", visual:picture, hint:"看前导链的两个端点。新碱基只能接到哪一端？点选该端。", sites:[site("5","5′ 端",null,{error:"5′ 是这条新链的起始方向，找另一端。"}),site("3","3′ 端")]};
  const first=n<3, t=(first?"AC":"GT")[first?n-1:n-3];
  return {title:first?"前导链 · 朝向叉口":"后随链 · 远离叉口",visual:picture, tools:baseTools,
    hint:(first?"沿前导链向右":"沿后随片段向左")+"读模板 "+t+"。先选 "+BASE[t].partner+"，再点它的位点。",sites:[pairSite("end",t,first?"前导链 3′ 端":"片段 3′ 端")]};
}

function relay(run, final) {
  const sides=["left","right"], names={left:"左叉",right:"右叉"};
  const tracks= final ? {
    left:[site("edit","3′ 末端 · G–G","repair",{repair:1,keySite:"左叉 · G–G 末端",why:"校对移除新链末端的 G，露出可以重配的 3′ 端。"}),pairSite("l1","G","校对位点"),pairSite("l2","T","左叉末端")],
    right:[site("primer","新片段 · 引物位点","enzyme"),pairSite("r1","C","片段末端"),site("seal","已补齐 DNA · 骨架缺口","enzyme",{keySite:"右叉 · 骨架缺口",why:"引物被替换并补齐后，连接酶封合骨架。切换到左叉可以利用这段等待。"} )]
  } : {left:[pairSite("l1","C","左叉末端"),pairSite("l2","A","左叉末端")],right:[pairSite("r1","T","右叉末端"),pairSite("r2","G","右叉末端")]};
  if (run.step >= (final?6:4)) return mitosis(run);
  const branch=run.branch, d=run.data;
  const progress=side=>d[side]||0;
  const remaining=side=>Math.max(0,(d[side+"Ready"]||0)-run.elapsed);
  const current=tracks[branch][progress(branch)];
  const lane=side=>{
    const i=progress(side), t=tracks[side][i], wait=remaining(side)>0;
    return '<div class="fork-lane '+(side===branch?'selected':'')+'"><span>'+names[side]+' '+(side==="left"?"←":"→")+'</span><strong>'+(t?(wait?(t.id==="seal"?"引物替换为 DNA…":"下一个模板正露出…"):t.label):"本叉完成 ✓")+'</strong><small>'+i+' / '+tracks[side].length+'</small></div>';
  };
  const ready=current && remaining(branch)===0;
  const hint=!current?"切换到另一侧，处理剩余位点。":!ready?"这一侧正在准备下一位点，可以先切到另一叉。":
    current.tool==="repair"?"左叉有末端错配。选 Shift 校对，再点 G–G。":current.tool==="enzyme"?
    (current.id==="seal"?"右叉已补齐 DNA。选 F 加酶，再点缺口接合。":"右叉需要引物。选 F 加酶，再点引物位点。"):
    names[branch]+"模板 "+BASE[current.tool].partner+"，先选 "+current.tool+"，再点发光位点。";
  const waits=sides.map(remaining).filter(ms=>ms>0);
  return {title:"双叉工作区",hint,visual:'<div class="fork-lanes">'+sides.map(lane).join("")+'</div>',forks:true,refreshAt:waits.length?run.elapsed+Math.min(...waits):null,
    tools:final?[...baseTools,"repair","enzyme"]:baseTools,sites:ready?[{...current, effect:r=>{
      r.data[branch]=progress(branch)+1;
      r.data[branch+"Ready"]=r.elapsed+(final&&branch==="right"&&current.id==="r1"?1200:750);
    }}]:[]};
}

function okazaki(run) {
  const n=run.step, seq=n===0?"····":n===1?"···r":n===2?"··Gr":n===3?"·TGr":n===4?"ATGr":"ATGC";
  const picture=molecule([strand("亲代模板","5′","TACG","3′"),strand("后随片段","3′",seq,"5′","daughter")],
    n>=5?"引物 r 已由 DNA 的 C 替换，此时骨架上还剩一个切口。":"叉口在右侧 →　r 表示 RNA 引物（此处用一个符号代表一小段）。从引物的 3′ 端向左合成。");
  const seal=site("seal","封合骨架缺口","enzyme",{keySite:"冈崎片段 · 接合处",why:"引物已替换，连接酶封合相邻 DNA 之间的切口。"});
  if(n===5) return {title:"封合最后的切口",visual:picture,hint:"引物位置已经变成 DNA。选 F 加酶，再点骨架缺口。",tools:["enzyme"],sites:[seal]};
  const premature={...seal,error:n===0?"先在右侧放置 RNA 引物。":n<4?"还要从引物末端延伸，填齐这段 DNA。":"引物替换完成后才可以连接。"};
  if(!n) return {title:"从引物起步",visual:picture,hint:"选 F 加酶，点靠近右侧叉口的引物位点。",tools:["enzyme"],sites:[site("primer","靠近叉口 · 放置引物","enzyme"),premature]};
  if(n===4) return {title:"引物替换", visual:picture,hint:"观察紫色 r 所在的位置。引物移除后，聚合酶补入 DNA。", auto:1500, tools:["enzyme"],sites:[premature]};
  const template="CAT"[n-1];
  return {title:"向左延伸片段",visual:picture,hint:"从 3′ 端向左读模板 "+template+"。选互补碱基，再点延伸端。",tools:[...baseTools,"enzyme"],sites:[pairSite("extend",template,"← 延伸端"),premature]};
}

function fidelity(run) {
  const n=run.step;
  if(n<2) return {title:"复制中 · 末端校对",visual:molecule([strand("模板","3′","ACG","5′"),strand("正在延伸","5′",n?"TG·":"TGG","3′","daughter")],"聚合酶停在新链的最末端。"),
    hint:n?"模板末端是 G。选互补的 C，补回刚才校对的位置。":"在新链的 3′ 末端发现 G–G。选 Shift 校对，再点末端。",
    tools:n?baseTools:["repair"],sites:n?[pairSite("end","G","新链 3′ 端")]:[site("edit","移除 3′ 末端 G","repair",{repair:1,keySite:"3′ 末端 · G–G",why:"聚合酶校对在继续延伸前移除了一个末端错配。"})]};
  const sequence=n<4?"TCCA":n===4?"T··A":n===5?"TG·A":"TGCA";
  const visual=molecule([strand("亲代链","3′","ACGT","5′"),strand("新链","5′",sequence,"3′","daughter")],
    "复制后再检查双链。亲代链保留，这次修复处理新链内部的一小段。");
  if(n===2) return {title:"复制后 · 扫描双链",visual,hint:"逐列比较上下碱基，点出已复制区域里不互补的一列。",sites:["A–T","C–C","G–C","T–A"].map((label,i)=>site("col"+i,"位点 "+(i+1)+" · "+label,null,i===1?{}:{error:"这列是标准配对。继续比较新链与亲代模板。"}))};
  if(n===3) return {title:"定位含错配的片段",visual,hint:"选 F 加酶，切除新链中含 C–C 错配的一段。亲代链用来指导补合。",tools:["enzyme"],sites:[site("old","亲代链 · 位点 2–3","enzyme",{error:"请保留亲代链作模板。"}),site("cut","新链 · 位点 2–3","enzyme")]};
  if(n<6) {const t=n===4?"C":"G";return {title:"按模板补合",visual,hint:"缺口对应的下一个模板碱基是 "+t+"。选互补碱基，再点缺口。",tools:baseTools,sites:[pairSite("fill",t,"新链内部缺口")]};}
  return {title:"封合修复区",visual,hint:"选 F 加酶，再点切口，完成复制后的错配修复。",tools:["enzyme"],sites:[site("seal","修复区 · 切口","enzyme",{repair:1,keySite:"新链内部 · 位点 2–3",why:"含错配的一段新链被移除，按亲代链补回 G、C 后，连接酶封好了切口。"})]};
}

function mitosis(run) {
  const n=run.step-6, first=run.data.firstPole;
  if(n>=2) return {title:"两个子细胞",division:true,auto:6000,hint:"观察姐妹染色单体分离。每个子细胞各获得一份。",sites:[]};
  return {title:"时间跳转 · 有丝分裂中期",visual:'<div class="spindle"><span>左极 '+(n&&first==="left"?"━━":"")+'</span><strong>Ⅰ · Ⅱ</strong><span>'+(n&&first==="right"?"━━":"")+' 右极</span></div><p class="figure-note">'+(n?"姐妹 Ⅰ 已接到"+(first==="left"?"左":"右")+"极":"姐妹 Ⅰ、Ⅱ 来自同一条复制后的染色体")+'</p>',
    hint:n?"姐妹 Ⅰ 已连好。将姐妹 Ⅱ 的动粒连到相反一极。":"局部复制完成，镜头跳到分裂期。为姐妹 Ⅰ 的动粒选择任一纺锤体极。",sites:["left","right"].map(p=>site(p,(p==="left"?"左":"右")+"极",null,n&&p===first?{error:"两个姐妹动粒需要分别连接相反的两极。"}:{effect:r=>{if(!n)r.data.firstPole=p;},keySite:"姐妹动粒 · "+(p==="left"?"左极":"右极"),why:"姐妹染色单体与相反两极建立连接后，分离时各进入一个子细胞。"}))};
}
function cellPair(left,right,caption) {
  return '<div class="cell-pair"><div><i>'+left+'</i></div><span>⟷</span><div><i>'+right+'</i></div></div><p class="figure-note">'+caption+'</p>';
}

campaignLevels.push(
  {id:"fork",name:"认识复制叉",summary:"沿 5′ / 3′ 标记为两条新链找到延伸端。",steps:5,view:introFork},
  {id:"relay",name:"双叉接力",summary:"同时观察两个叉口，在等待时换手。",steps:4,view:r=>relay(r,false)},
  {id:"okazaki",name:"冈崎片段",summary:"放置引物、延伸、替换，再封合一个切口。",steps:6,view:okazaki},
  {id:"fidelity",name:"保真实验",summary:"修正新链末端，再寻找藏在双链内部的错配。",steps:7,view:fidelity},
  {id:"division",name:"分裂前的接力",summary:"限时接管双叉，随后为姐妹染色单体连向两极。",steps:9,limit:60000,view:r=>relay(r,true)}
);
campaignLevels.forEach(level=>level.route="replication");

