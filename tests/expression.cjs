module.exports=async function({p,el,press,get,site,act,level,home,map,done,mobile,assert}) {
  const expression=async()=>{
    await map();await level("transcribe");await site("upper");assert.match(await get("#mission-feedback"),/下链/);await site("lower");
    await press("#mission-sound");assert.equal(await el("#mission-sound").getAttribute("aria-pressed"),"true");
    for(const base of "AUGGCUUAA")await act(base,"rna");
    await done("读出 RNA");assert.equal((await el("#mission-result .bases b").allTextContents()).join(""),"AUGGCUUAA");
    await level("translate");await site("Ala");await site("Met");await site("Ala");await site("stop");await done("拼出蛋白质");
    await press('#mission-result [data-dialog="genes"]');assert(await el(".enzyme-film .sugar").first().isVisible());await press("#info-close");
    await level("marks");await site("inspect");await site("mark4");assert.match(await get("#mission-feedback"),/没有标记/);await site("mark7");await site("mark7");await site("mark1");
    await done("保留甲基标记",["2","2"]);assert.equal(await el("#mission-result .daughter sup").count(),2);await home();
  };
  const inheritance=async()=>{
    await map();await level("meiosis");await site(mobile?"a":"A");await site("b");await site("right");await site("right");await site("left");await site("left");await site("right");
    await done("形成配子",["4","1"]);const cells=await el("#mission-result .gamete-cells b").allTextContents();
    assert.deepEqual(cells,mobile?["ab","ab","AB","AB"]:["Ab","Ab","aB","aB"]);
    await level("offspring");await site(mobile?"predict0":"predict1");assert.equal(await el(".punnett td").count(),16);
    for(const [i,expected] of [9,3,3,1].entries())assert.equal(await el('.punnett td[data-trait="'+i+'"]').count(),expected);
    await site("compare");assert.match(await get("#mission-feedback"),/抽取/);await site("large");await site("small");await site("grid");assert(await el(".punnett").isVisible());await site("samples");
    await site("compare");await done("观察后代");assert.match(await get("#mission-result"),mobile?/与理论有差异/:/符合理论/);
    for(const [col,sum] of [[3,16],[4,1600]]){
      assert.equal((await el("#mission-result tbody tr td:nth-child("+col+") b").allTextContents()).reduce((a,x)=>a+Number(x),0),sum);
    }
    await home();
  };
  await map();assert(await el('[data-level="meiosis"]').isEnabled());assert(await el('[data-level="transcribe"]').isEnabled());assert(await el('[data-level="marks"]').isDisabled());await home();
  if(mobile){await inheritance();await expression();}else{await expression();await inheritance();}
  await p.reload();await press('[data-dialog="genes"]:visible');assert(await el(".enzyme-film").isVisible());await press("#info-close");
  await map();assert.equal(await el(".route").nth(1).locator("button:disabled").count(),0);assert.equal(await el(".route").nth(2).locator("button:disabled").count(),0);await home();
  console.log((mobile?"touch":"desktop")+" passed independent V3 routes, methyl marks, four gametes, theory and samples, persistent animated gallery");
};

