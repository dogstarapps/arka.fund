import {afterEach,describe,expect,it,vi} from "vitest";
import {loadArkaDetailBundle,loadDashboardBundle} from "@/lib/catalog/api";
import {resolveCatalogFixture,fixtureArkasPage} from "@/lib/catalog/testFixtures";

afterEach(()=>vi.unstubAllGlobals());
describe("catalog NAV recovery queries",()=>{
  it("does not silently restrict every dashboard mode to curated Arkas",async()=>{
    const requests:URL[]=[];
    vi.stubGlobal("fetch",vi.fn(async(input:string)=>{
      const url=new URL(input,"http://localhost");requests.push(url);
      const path=url.pathname.replace(/^\/api\/catalog/,"");
      return new Response(JSON.stringify(resolveCatalogFixture(path,url.searchParams)),{status:200,headers:{"content-type":"application/json"}});
    }));
    await loadDashboardBundle();
    const query=requests.find(url=>url.pathname.endsWith("/v1/arkas"));
    expect(query?.searchParams.has("curated")).toBe(false);
    expect(query?.searchParams.get("limit")).toBe("12");
  });
  it("requests the newest history page and presents it chronologically, including a missing NAV gap",async()=>{
    const original=fixtureArkasPage({curated:true}).items[0];
    const arka={...original,nav:null};
    const newest={arkaId:arka.arkaId,syncedAt:"2026-10-06T16:00:00Z",nav:null};
    const older={...newest,syncedAt:"2026-09-14T16:00:00Z",nav:"100"};
    vi.stubGlobal("fetch",vi.fn(async(input:string)=>{
      const url=new URL(input,"http://localhost");let result:unknown=[];
      if(url.pathname.endsWith("/history")){
        expect(url.searchParams.get("order")).toBe("desc");
        result={total:200,offset:0,limit:12,items:[newest,older]};
      }else if(url.pathname.endsWith(arka.arkaId)){result=arka;}
      else if(url.pathname.endsWith("/portfolio")){result={items:[]};}
      else if(url.pathname.endsWith("/activity")){result={items:[]};}
      return new Response(JSON.stringify(result),{status:200,headers:{"content-type":"application/json"}});
    }));
    const bundle=await loadArkaDetailBundle(arka.arkaId);
    expect(bundle.arka.nav).toBeNull();
    expect(bundle.history.items.map(p=>p.nav)).toEqual(["100",null]);
    expect(bundle.history.total).toBe(200);
  });
});
