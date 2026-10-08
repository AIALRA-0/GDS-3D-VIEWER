import { expect, test, type Page } from "@playwright/test";
import { parseGds } from "../../src/public/gds";
import { cellMatches } from "../../src/public/cellInstances";

function record(type: number, dtype: number, data = Buffer.alloc(0)) {
  if (data.length % 2) data = Buffer.concat([data, Buffer.alloc(1)]);
  const h = Buffer.alloc(4); h.writeUInt16BE(data.length + 4); h[2] = type; h[3] = dtype; return Buffer.concat([h, data]);
}
function short(...values: number[]) { const b = Buffer.alloc(values.length * 2); values.forEach((v,i) => b.writeUInt16BE(v,i*2)); return b; }
function xy(...values: number[]) { const b = Buffer.alloc(values.length * 4); values.forEach((v,i) => b.writeInt32BE(v,i*4)); return record(16,3,b); }
function real(v: number) { let e=64; while(v>=1) {v/=16;e++;} while(v<1/16) {v*=16;e--;} const b=Buffer.alloc(8);b[0]=e;let m=BigInt(Math.round(v*2**56));for(let i=7;i>=1;i--){b[i]=Number(m&255n);m>>=8n;}return b; }
function cell(name: string) { return Buffer.concat([record(5,2,Buffer.alloc(24)),record(6,6,Buffer.from(name))]); }
const TILE = "TILE/with:marker";
function polygon(layer: number, x=0, y=0) { return Buffer.concat([record(8,0),record(13,2,short(layer)),record(14,2,short(0)),xy(x,y,x+10,y,x+10,y+10,x,y+10,x,y),record(17,0)]); }
export function instanceFixture(columns=2, rows=2, copies=1) {
  return Buffer.concat([record(0,2,short(600)),record(1,2,Buffer.alloc(24)),record(2,6,Buffer.from("SYNTHETIC")),record(3,5,Buffer.concat([real(1),real(1e-6)])),
    cell(TILE),...Array.from({length:copies},()=>polygon(7)),record(7,0),
    cell("MIDDLE"),record(10,0),record(18,6,Buffer.from(TILE)),record(28,5,real(90)),xy(10,0),record(17,0),record(7,0),
    cell("TOP"),polygon(8,columns*20+40,rows*20+40),
    record(10,0),record(18,6,Buffer.from(TILE)),xy(columns*20+20,0),record(17,0),
    record(11,0),record(18,6,Buffer.from("MIDDLE")),record(19,2,short(columns,rows)),xy(0,0,columns*20,0,0,rows*20),record(17,0),
    record(10,0),record(18,6,Buffer.from(TILE)),record(26,1,short(0x8000)),record(27,5,real(2)),record(28,5,real(90)),xy(0,rows*20+20),record(17,0),record(7,0),
    cell("OTHER_TOP"),polygon(9),record(7,0),record(4,0)]);
}
async function color(page: Page, id: string, value: string) {
  await page.getByLabel(`修改图层 ${id} 的颜色`,{exact:true}).evaluate((el:HTMLInputElement,v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(el,v); el.dispatchEvent(new Event("input",{bubbles:true}));
  },value);
}
async function load(page:Page, bytes=instanceFixture()) {
  await page.goto("/");
  await page.getByTestId("public-file-input").setInputFiles({name:"synthetic-instances.gds",mimeType:"application/octet-stream",buffer:bytes});
  await expect(page.locator(".global-status")).toContainText("本地解析完成",{timeout:45_000});
  await page.getByRole("button",{name:"二维",exact:true}).click();
  await color(page,"7/0","#ff0000"); await color(page,"8/0","#0000ff");
}
async function scan(page:Page) {
  return page.locator(".viewer-host canvas").evaluate((source:HTMLCanvasElement) => {
    const c=document.createElement("canvas");c.width=source.width;c.height=source.height;const ctx=c.getContext("2d")!;ctx.drawImage(source,0,0);
    const d=ctx.getImageData(0,0,c.width,c.height).data;
    const result={red:0,blue:0,amber:0,redPoint:null as number[]|null,bluePoint:null as number[]|null};
    const inside=(x:number,y:number,channel:number)=>[-c.width,-1,0,1,c.width].every(offset=>{
      const i=((y*c.width+x)+offset)*4;
      return d[i+channel]>d[i+(channel+1)%3]*2&&d[i+channel]>d[i+(channel+2)%3]*2;
    });
    for(let y=1;y<c.height-1;y++)for(let x=1;x<c.width-1;x++) {
      const i=(y*c.width+x)*4,[r,g,b]=d.subarray(i,i+3);
      if(r>g*2&&r>b*2){result.red++;if(!result.redPoint&&inside(x,y,0))result.redPoint=[x,y];}
      if(b>r*2&&b>g*2){result.blue++;if(!result.bluePoint&&inside(x,y,2))result.bluePoint=[x,y];}
      if(r>g*1.15&&g>b*1.5&&g>80)result.amber++;
    }
    return result;
  });
}
async function focus(page:Page, mode:string) {
  await page.getByRole("button",{name:"单元",exact:true}).click();
  await page.getByRole("button",{name:"定位 MIDDLE 的全部实例",exact:true}).first().click();
  await page.getByRole("dialog",{name:"顶层实例定位",exact:true}).getByRole("button",{name:mode,exact:true}).click();
}
async function clickPixel(page:Page, pixel:number[]) {
  const source=page.locator(".viewer-host canvas"), box=(await source.boundingBox())!;
  const size=await source.evaluate((c:HTMLCanvasElement)=>[c.width,c.height]);
  await page.mouse.click(box.x+pixel[0]*box.width/size[0],box.y+pixel[1]*box.height/size[1]);
}

test("occurrence parents locate descendants without parsing names, including transformed arrays and reuse",()=>{
  const flat=parseGds(Uint8Array.from(instanceFixture()).buffer,"synthetic.gds");
  expect(flat.occurrences).toHaveLength(flat.instances);
  expect(cellMatches(flat,"MIDDLE").instances).toHaveLength(4);
  expect(cellMatches(flat,"MIDDLE").owners.size).toBe(8);
  expect(cellMatches(flat,TILE).instances).toHaveLength(6);
  expect(cellMatches(flat,"OTHER_TOP").instances).toEqual([]);
  flat.occurrences!.forEach((o,i)=>expect(o.parent).toBeLessThan(i));
  const reused=parseGds(Uint8Array.from(instanceFixture(25,41,200)).buffer,"synthetic.gds");
  expect(reused.rendering?.kind).toBe("instanced");
  expect(reused.occurrences).toHaveLength(reused.instances);
  expect(cellMatches(reused,"MIDDLE").instances).toHaveLength(1025);
  expect(cellMatches(reused,"MIDDLE").owners.size).toBe(2050);
});

test("flat descendant highlight, isolation and hiding preserve picking, layers and restore to the selected top",async({page})=>{
  const transfers:string[]=[];page.on("request",r=>{if(r.method()!=="GET")transfers.push(r.url());});
  await load(page);await expect.poll(async()=> (await scan(page)).blue).toBeGreaterThan(50);
  const initial=await scan(page);
  await focus(page,"高亮全部实例");await expect(page.locator("canvas")).toHaveAttribute("data-cell-highlight-count","4");
  await expect.poll(async()=> (await scan(page)).amber).toBeGreaterThan(50);
  await page.getByRole("button",{name:"图层",exact:true}).click();
  await page.getByLabel("显示 Layer 7/0",{exact:true}).uncheck();await expect(page.locator("canvas")).toHaveAttribute("data-cell-highlight-count","0");
  await page.getByLabel("显示 Layer 7/0",{exact:true}).check();await expect(page.locator("canvas")).toHaveAttribute("data-cell-highlight-count","4");
  await focus(page,"只看该单元实例");await expect.poll(async()=> (await scan(page)).blue).toBe(0);
  const isolated=await scan(page);expect(isolated.red).toBeGreaterThan(50);expect(isolated.red).toBeLessThan(initial.red);
  await focus(page,"隐藏该单元实例");await expect.poll(async()=> (await scan(page)).blue).toBeGreaterThan(50);
  const hidden=await scan(page);expect(hidden.red).toBeGreaterThan(50);expect(hidden.red).toBeLessThan(initial.red);
  await clickPixel(page,hidden.bluePoint!);await expect(page.locator(".object-inspection")).toContainText("TOP");
  await clickPixel(page,hidden.redPoint!);await expect(page.locator(".object-inspection .instance-path")).toContainText("ref-3[");
  await page.getByRole("button",{name:"导出",exact:true}).click();
  const pending=page.waitForEvent("download");await page.getByRole("button",{name:"导出审阅记录",exact:true}).click();
  const stream=await (await pending).createReadStream(), chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(chunk);
  const review=Buffer.concat(chunks);expect(review.toString()).not.toContain("cellFocus");expect(review.toString()).not.toContain("occurrences");
  await page.getByTestId("review-file-input").setInputFiles({name:"review.json",mimeType:"application/json",buffer:review});
  await expect(page.locator("canvas")).toHaveAttribute("data-cell-focus","none");
  await focus(page,"隐藏该单元实例");
  await page.getByRole("button",{name:"恢复实例显示",exact:true}).click();await expect.poll(async()=> (await scan(page)).red).toBe(initial.red);
  await page.getByRole("button",{name:"单元",exact:true}).click();
  await page.locator("button.cell-row[title=MIDDLE]").click();await expect(page.locator(".main-foot")).toContainText("MIDDLE");
  await page.getByRole("button",{name:"定位 MIDDLE 的全部实例",exact:true}).first().click();
  const modal=page.getByRole("dialog",{name:"顶层实例定位",exact:true});await expect(modal.locator(".instance-count")).toContainText("4");
  await expect(page.locator(".main-foot")).toContainText("TOP");await modal.getByRole("button",{name:"高亮全部实例",exact:true}).click();
  await page.getByRole("button",{name:"单元",exact:true}).click();await page.getByLabel("定位顶层",{exact:true}).selectOption("OTHER_TOP");
  await expect(page.locator(".main-foot")).toContainText("OTHER_TOP");
  await page.getByRole("button",{name:"定位 MIDDLE 的全部实例",exact:true}).first().click();await expect(modal.locator(".instance-count")).toContainText("0");
  await expect(modal.getByRole("button",{name:"高亮全部实例",exact:true})).toBeDisabled();
  expect(transfers).toEqual([]);
});

test("reused descendant filtering compacts placements but preserves original instance identity and complete outlines",async({page})=>{
  test.setTimeout(90_000); // Full large-layout load plus several independent GPU display changes.
  await load(page,instanceFixture(25,41,200));
  await focus(page,"高亮全部实例");await expect(page.locator("canvas")).toHaveAttribute("data-cell-highlight-count","1025");
  await focus(page,"只看该单元实例");await expect.poll(async()=> (await scan(page)).blue).toBe(0);
  const image=await scan(page);expect(image.red).toBeGreaterThan(100);await clickPixel(page,image.redPoint!);
  await expect(page.locator(".object-inspection")).toContainText(TILE);
  await expect(page.locator(".object-inspection .instance-path")).toContainText("ref-2[");
  await focus(page,"隐藏该单元实例");await expect.poll(async()=> (await scan(page)).blue).toBeGreaterThan(0);
  await page.getByRole("button",{name:"恢复实例显示",exact:true}).click();await expect(page.locator("canvas")).toHaveAttribute("data-cell-focus","none");
  await expect(page.locator(".incomplete-banner")).toHaveCount(0);
});

test("dimensions are adjacent, selects share controls, spacing fits mobile and comparison explains its scope",async({page})=>{
  await load(page);
  const modes=page.getByRole("group",{name:"显示维度",exact:true});
  await expect(modes.getByRole("button")).toHaveCount(2);
  const order=await modes.getByRole("button").evaluateAll(buttons=>buttons.map(b=>b.getAttribute("aria-label")));expect(order).toEqual(["二维","三维"]);
  expect(await modes.getByRole("button",{name:"二维",exact:true}).evaluate(el=>getComputedStyle(el).boxShadow)).toBe("none");
  await page.getByRole("tab",{name:"显示",exact:true}).click();
  const comparison=page.getByRole("region",{name:"统计对比",exact:true});await expect(comparison).toContainText("不检查图形移动");
  await comparison.getByRole("button",{name:"设为比较基线",exact:true}).click();await expect(comparison.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("button",{name:"单元",exact:true}).click();await page.getByLabel("定位顶层",{exact:true}).selectOption("OTHER_TOP");
  await expect(comparison.locator("tbody tr").first()).toHaveText(/图层\s*2\s*1\s*-1/);
  await comparison.getByRole("button",{name:"清除比较基线",exact:true}).click();await expect(comparison.locator("table")).toHaveCount(0);
  await page.getByRole("tab",{name:"AI",exact:true}).click();await expect(page.getByLabel("讲解对象",{exact:true})).toHaveCSS("appearance","none");
  await page.setViewportSize({width:390,height:844});await page.getByRole("button",{name:"图层",exact:true}).click();await page.getByRole("button",{name:"配色组合",exact:true}).click();
  const modal=page.getByRole("dialog",{name:"配色组合",exact:true});await modal.getByRole("button",{name:"复制配色 原始柔和",exact:true}).click();
  expect(await modal.getByLabel("组合颜色 1",{exact:true}).evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(50);
  expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
