campaignRoutes.push(
  {key:"expression",name:"基因表达与表观遗传",description:"读出一条 RNA，把密码子译成肽链，再追踪复制后留下的化学标记。"},
  {key:"inheritance",name:"配子形成与后代性状",description:"观察两轮染色体分配，预测一群后代会出现哪些性状。"}
);

const rnaLesson={template:"TACCGAATT",coding:"ATGGCTTAA",rna:"AUGGCUUAA"};
function rnaView(run) {
  const n=run.step, {template,coding,rna}=rnaLesson;
  const rows=[strand("上链","5′",coding,"3′"),strand("下链","3′",template,"5′")];
  if(n)rows.push(strand("RNA →","5′",rna.slice(0,n-1).padEnd(rna.length,"·"),"3′","daughter"));
  const visual=molecule(rows,"本教学基因的转录方向 →　聚合酶沿模板 3′ → 5′ 读取，RNA 沿 5′ → 3′ 延伸。");
  if(!n)return {title:"辨认模板",visual,hint:"观察转录箭头，选择从左向右为 3′ → 5′ 的 DNA 模板链。",sites:[site("upper","上链",null,{error:"上链从左向右为 5′ → 3′。请顺着转录箭头检查下链。"}),site("lower","下链")]};
  const i=n-1, base=template[i], selected=rna[i];
  return {title:"延伸 RNA",visual,hint:"模板第 "+n+" 位是 "+base+"。选 RNA 碱基，再点正在延伸的 3′ 端。RNA 用 U 与 A 配对；踩拍可加 2 分。",
    tools:["A","U","C","G"],sites:[site("rna","RNA 3′ 端 · 模板 "+base,selected,{pair:1,rhythm:true,keySite:"模板第 "+n+" 位 · "+base+"–"+selected,why:"沿模板读取后，这个位置接入 RNA 碱基 "+selected+"。"})]};
}
const codons=[["AUG","Met","甲硫氨酸"],["GCU","Ala","丙氨酸"],["UAA","stop","终止"]];
function translation(run) {
  const n=run.step,[codon,answer,name]=codons[n];
  const visual='<div class="codon-track">'+codons.map(([c],i)=>'<b class="'+(n===i?"current":"")+'">'+c+'</b>').join("")+'</div><p class="figure-note">5′ → 3′　核糖体每次读三个碱基</p>'+
    '<div class="peptide">肽链　'+(n?codons.slice(0,n).map(c=>c[2]).join(" ─ "):"等待起始密码子")+'</div>';
  return {title:codon==="UAA"?"识别终止信号":"读取一个密码子",visual,hint:"当前 "+codon+"。对照密码表选择对应操作；踩拍可加 2 分。　AUG 甲硫氨酸 · GCU 丙氨酸 · UAA 终止",
    sites:codons.map(([,key,label])=>site(key,key==="stop"?"释放肽链":label,null,key===answer?{rhythm:true,keySite:codon+" · "+name,why:key==="stop"?"核糖体遇到 UAA 后释放肽链。终止信号没有对应的氨基酸。":"这个密码子指定了肽链中的一个氨基酸。"}:{error:"再看高亮的三个字母，把这个完整密码子与提示中的一项对上。"}))};
}

const marksTemplate="CGACGTCG",marksNew="GCTGCAGC";
function markedRow(label,start,seq,marked,end,daughter) {
  return '<div class="strand '+(daughter?"daughter":"")+'"><span>'+label+'</span><div class="bases marks"><small>'+start+'</small>'+
    Array.from(seq,(base,i)=>'<b>'+base+(marked.includes(i)?'<sup aria-label="甲基标记">●</sup>':'')+'</b>').join("")+'<small>'+end+'</small></div></div>';
}
function marksDiagram(filled) {
  return molecule([markedRow("亲代链","5′",marksTemplate,[0,6],"3′",false),markedRow("新链","3′",marksNew,filled,"5′",true)],
    "紫点表示胞嘧啶上的甲基。每对 CpG 中，两条反向平行链各有一个 C，分别在相邻两列。");
}
function methylation(run) {
  const filled=run.data.marks||[];
  const choices=[1,4,7].map((col,index)=>{
    const valid=col!==4 && !filled.includes(col);
    return site("mark"+col,"第 "+(index+1)+" 组 · 新链 C",null,valid?{
      effect:r=>{r.data.marks=[...filled,col];},keySite:"第 "+(index+1)+" 组 CpG · 新链 C",
      why:"亲代链在这组 CpG 带有标记，复制后对应的新链 C 补上甲基。上下两条链的碱基序列保持原样。"
    }:{error:filled.includes(col)?"这组的两条链已经都有标记。":"这组亲代链的 C 没有标记。请比较两端的 CpG。"});
  });
  if(!run.step)return {title:"回到刚复制的双链",visual:marksDiagram([]),hint:"青色为保留的亲代链，金色为合成的新链。观察哪两组亲代 CpG 上有紫点，然后检查新链。",sites:[site("inspect","对照新链")]};
  return {title:"维持 CpG 甲基标记",visual:marksDiagram(filled),hint:"从左数三组 CpG，点亲代 C 有紫点、对应新链 C 尚无紫点的一组。",sites:choices};
}
function expressionGallery(open) {
  if(!open)return '<div class="key-site"><strong>LCT · 乳糖酶功能动画</strong><p>完成「拼出蛋白质」解锁。</p></div>';
  return '<figure class="enzyme-film"><figcaption>LCT · 乳糖酶如何分解乳糖</figcaption><div class="enzyme-action"><span class="lactase">乳糖酶</span><span class="sugar glucose">葡萄糖</span><span class="sugar galactose">半乳糖</span></div><p>乳糖由葡萄糖和半乳糖相连而成。小肠中的乳糖酶催化水解，释放这两种单糖。</p><small>关卡中的短肽用于练习读码。这里展示真实蛋白质的一种功能。</small></figure>';
}

const gametes=["AB","Ab","aB","ab"];
function gameteCells(items,caption) {
  return '<div class="gamete-cells">'+items.map((x,i)=>'<div><small>'+String(i+1)+'</small><b>'+x+'</b></div>').join("")+'</div><p class="figure-note">'+caption+'</p>';
}
function meiosis(run) {
  const n=run.step,d=run.data;
  if(n<2) {
    const pair=n?"B":"A",lower=pair.toLowerCase(), before=n?cellPair(d.long,d.otherLong,"第一对同源染色体已朝相反两极排列。"):"";
    return {title:"减数第一次分裂 · 分开同源染色体",visual:before+'<div class="chromosomes"><b>Ⅹ<small>'+pair+' · 双染色单体</small></b><b>Ⅹ<small>'+lower+' · 双染色单体</small></b></div>',
      hint:"为第 "+(n+1)+" 对同源染色体选择朝左极的一条，另一条将朝右极。每条的两姐妹仍连在一起。",
      sites:[pair,lower].map((a,i)=>site(a,a+" 朝左极",null,{effect:r=>{
        const other=i?pair:lower;
        if(!n){r.data.long=a;r.data.otherLong=other;}
        else {r.data.left=d.long+a;r.data.right=d.otherLong+other;}
      }}))};
  }
  const left=n<4, target=left?d.left:d.right, field=left?"poleOne":"poleTwo", first=d[field];
  const visual=left?cellPair(d.left+" ×2",d.right+" ×2","第一次分裂完成。每个细胞各有两条染色体，每条仍有两姐妹。"):
    gameteCells([d.left,d.left,d.right+" ×2"],"第一侧已完成第二次分裂；另一侧的姐妹仍连在一起。");
  return {title:"减数第二次分裂 · "+(left?"第一":"第二")+"个细胞",visual:visual+spindleDiagram(first,"放大这个细胞的动粒连接。图中两条染色体的姐妹连接用一次操作代表。"),
    hint:"检查含 "+target+" 的细胞。"+(first?"点相反的一极，把姐妹 Ⅱ 连过去。":"为姐妹 Ⅰ 选择任一极。"),
    sites:poleSites(first,field,"第一次分裂分开同源染色体，第二次分裂分开姐妹染色单体。这里忽略交换，单次分裂得到两种组合的四个配子。")};
}

const traits=["亮翅 · 长尾","亮翅 · 短尾","暗翅 · 长尾","暗翅 · 短尾"];
function offspring(g1,g2) {
  const locus=i=>[g1[i],g2[i]].sort().join("");
  const geno=locus(0)+locus(1);
  return {geno,trait:(geno.includes("A")?0:2)+(geno.includes("B")?0:1)};
}
function sampleOffspring(size) {
  const counts=[0,0,0,0];
  const randomGamete=()=>gametes[Math.floor(Math.random()*gametes.length)];
  for(let i=0;i<size;i++) {
    counts[offspring(randomGamete(),randomGamete()).trait]++;
  }
  return counts;
}
function punnett() {
  return '<div class="punnett"><table><caption>AaBb × AaBb · 双亲各产生四类等概率配子</caption><thead><tr><th>配子</th>'+gametes.map(g=>'<th>'+g+'</th>').join("")+'</tr></thead><tbody>'+
    gametes.map(g=>'<tr><th>'+g+'</th>'+gametes.map(h=>{const o=offspring(g,h);return '<td data-trait="'+o.trait+'"><b>'+o.geno+'</b><small>'+traits[o.trait]+'</small></td>';}).join("")+'</tr>').join("")+'</tbody></table></div>';
}
function sampleChart(d) {
  const percent=(count,total)=>(count/total*100).toFixed(1)+"%";
  const rows=traits.map((t,i)=>{
    const theory=[9,3,3,1][i];
    const observed=["small","large"].map(k=>{
      if(!d[k]) return "<td>待抽样</td>";
      const count=d[k][i],total=k==="small"?16:1600;
      return '<td><b>'+count+'</b><small>'+percent(count,total)+'</small></td>';
    });
    return '<tr><th>'+t+'</th><td>'+theory+'/16<small>'+percent(theory,16)+'</small></td>'+observed.join("")+'</tr>';
  });
  return '<table class="sample-chart"><caption>理论分布与本次随机观察</caption><thead><tr><th>性状</th><th>理论</th><th>16 只</th><th>1600 只</th></tr></thead><tbody>'+rows.join("")+'</tbody></table>';
}
function offspringView(run) {
  const n=run.step,d=run.data;
  if(!n) return {title:"预测两种性状的组合",visual:'<div class="cross-parents"><strong>AaBb</strong> × <strong>AaBb</strong></div><p class="figure-note">虚构生物的亮翅 A 对暗翅 a 完全显性，长尾 B 对短尾 b 完全显性。两个位点独立分配，配子随机结合，后代存活机会相同。</p>',
    hint:"按「亮长、亮短、暗长、暗短」的次序预测理论比例，随后用组合图检验。",sites:["3∶1∶3∶1","9∶3∶3∶1","1∶1∶1∶1"].map((v,i)=>site("predict"+i,v,null,{effect:r=>{r.data.prediction=v;},feedback:"已记录预测 "+v}))};
  const choices=[];
  for(const [id,label] of [["grid","看 16 格组合"],["samples","看抽样对照"]])
    choices.push(site(id,label,null,{inspect:true,effect:r=>{r.data.tab=id;}}));
  for(const [id,size] of [["small",16],["large",1600]])
    choices.push(site(id,"抽样 "+size+" 只",null,{inspect:true,effect:r=>{r.data[id]=sampleOffspring(size);r.data.tab="samples";}}));
  choices.push(site("compare","完成观察",null,d.small&&d.large&&d.gridSeen?{keySite:"AaBb × AaBb · 16 种等概率配子组合",why:"其中 9 格亮长、3 格亮短、3 格暗长、1 格暗短。实际后代是随机样本，即使数量较大也可能偏离理论比例。"}:{error:"请查看 16 格组合，并各抽取 16 只和 1600 只后再结算。"}));
  const isGrid=d.tab!=="samples";
  if(isGrid)d.gridSeen=true;
  return {title:"对照组合图与随机后代",visual:isGrid?punnett():sampleChart(d),hint:"你的预测为 "+d.prediction+"。切换图表，比较两种抽样规模；可以重复抽样观察波动。",sites:choices};
}
campaignLevels.push(
  {id:"transcribe",route:"expression",name:"读出 RNA",summary:"辨认模板，把 DNA 转录成含 U 的 RNA。",steps:10,beat:true,view:rnaView,stats:r=>[["正确配对",r.pairs],["踩拍加分",r.beats*2]],product:()=>molecule([strand("RNA","5′",rnaLesson.rna,"3′","daughter")],"转录产物将在下一关作为读码模板。")},
  {id:"translate",route:"expression",name:"拼出蛋白质",summary:"从 AUG 开始，逐个密码子读到终止信号。",steps:3,beat:true,view:translation,stats:r=>[["已读密码子",r.step],["踩拍加分",r.beats*2]],product:()=>'<p class="peptide">释放的教学短肽　甲硫氨酸 ─ 丙氨酸</p>'},
  {id:"marks",route:"expression",name:"保留甲基标记",summary:"在半保留复制的产物中找回亲代 CpG 标记。",steps:3,view:methylation,stats:r=>[["恢复标记",r.data.marks.length],["误选",r.errors]],product:r=>marksDiagram(r.data.marks)},
  {id:"meiosis",route:"inheritance",name:"形成配子",summary:"先分同源，再分姐妹，追踪两对染色体的去向。",steps:6,view:meiosis,stats:r=>[["形成配子",4],["分配误选",r.errors]],product:r=>gameteCells([r.data.left,r.data.left,r.data.right,r.data.right],"本次分裂得到四个配子。重复选择两对同源染色体的朝向，可以观察其他组合。")},
  {id:"offspring",route:"inheritance",name:"观察后代",summary:"先预测，再用 16 格组合图和随机样本检验。",steps:2,view:offspringView,stats:r=>[["你的预测",r.data.prediction],["预测结果",r.data.prediction==="9∶3∶3∶1"?"符合理论":"与理论有差异"]],product:r=>sampleChart(r.data)}
);

