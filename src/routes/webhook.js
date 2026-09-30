const express=require("express");
const crypto=require("crypto");
const db=require("../db");
const wa=require("../services/whatsapp");
const {markJoined}=require("../services/attendance");
const router=express.Router();

function validSignature(req){
  const secret=process.env.META_APP_SECRET;
  if(!secret) return true;
  const sig=req.headers["x-hub-signature-256"];
  if(!sig) return false;
  const expected="sha256="+crypto.createHmac("sha256",secret).update(req.rawBody||"").digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));
}

router.get("/whatsapp",(req,res)=>{
  const mode=req.query["hub.mode"], token=req.query["hub.verify_token"], challenge=req.query["hub.challenge"];
  if(mode==="subscribe" && token===process.env.WEBHOOK_VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

router.post("/whatsapp",async(req,res)=>{
  if(!validSignature(req)) return res.sendStatus(401);
  res.sendStatus(200);
  try{
    const value=req.body?.entry?.[0]?.changes?.[0]?.value;
    const messages=value?.messages||[];
    for(const m of messages){
      const from=m.from;
      const type=m.type;
      if(type==="interactive"){
        const id=m.interactive?.button_reply?.id || m.interactive?.list_reply?.id;
        if(id?.startsWith("idp_joined_")){
          const idpId=Number(id.split("_").pop());
          const p=await db.query("SELECT id,name FROM players WHERE whatsapp=$1",[from]);
          if(p.rowCount) await markJoined(idpId,p.rows[0].id);
          await wa.text(from,"🟢 JOINED recorded successfully.");
          continue;
        }
        if(id?.startsWith("menu_")) {
          const cmd=id.replace("menu_","");
          await handleCommand(from,cmd);
          continue;
        }
      }
      if(type==="text") await handleCommand(from,m.text?.body?.trim()||"");
    }
  }catch(e){console.error("Webhook processing:",e)}
});

async function handleCommand(from,input){
  const cmd=input.toLowerCase();
  if(["hi","hello","menu","team bot","help","start"].includes(cmd)) return wa.menu(from);
  const p=(await db.query("SELECT * FROM players WHERE whatsapp=$1",[from])).rows[0];
  if(!p) return wa.text(from,"Your WhatsApp number is not registered with Sleppy Esports. Contact an admin.");
  if(["idp","schedule","next"].includes(cmd)){
    const r=await db.query(`SELECT * FROM idps WHERE status='SCHEDULED' ORDER BY match_date,match_time LIMIT 1`);
    return wa.text(from,r.rowCount?`NEXT IDP\n${r.rows[0].title}\n${r.rows[0].match_date} ${r.rows[0].match_time}\n${r.rows[0].details||""}`:"No upcoming IDP.");
  }
  if(["results"].includes(cmd)){
    const r=await db.query(`SELECT m.name,m.match_date,mr.team_placement,mr.total_points
      FROM matches m JOIN match_results mr ON mr.match_id=m.id WHERE mr.confirmed=true ORDER BY m.match_date DESC LIMIT 5`);
    return wa.text(from,r.rowCount?r.rows.map(x=>`${x.name} — #${x.team_placement} — ${x.total_points} pts`).join("\n"):"No confirmed results.");
  }
  if(["mystats","stats"].includes(cmd)){
    const r=await db.query(`SELECT COUNT(*) matches,COALESCE(SUM(pms.finishes),0) finishes,
      COALESCE(SUM(pms.finish_points),0) finish_points
      FROM player_match_stats pms WHERE pms.player_id=$1`,[p.id]);
    const x=r.rows[0]; return wa.text(from,`MY STATS\nMatches: ${x.matches}\nFinishes: ${x.finishes}\nFinish points: ${x.finish_points}`);
  }
  if(cmd==="history"){
    const r=await db.query(`SELECT m.name,m.match_date,pms.finishes,pms.finish_points
      FROM player_match_stats pms JOIN matches m ON m.id=pms.match_id
      WHERE pms.player_id=$1 ORDER BY m.match_date DESC LIMIT 10`,[p.id]);
    return wa.text(from,r.rowCount?r.rows.map(x=>`${x.match_date} — ${x.name}: ${x.finishes} finishes`).join("\n"):"No match history.");
  }
  if(cmd==="points"){
    const r=await db.query("SELECT * FROM official_points_tables WHERE is_current=true ORDER BY created_at DESC LIMIT 1");
    return wa.text(from,r.rowCount?`CURRENT OFFICIAL POINTS TABLE\n${r.rows[0].title}\n${r.rows[0].image_url}`:"No official PT uploaded.");
  }
  if(cmd==="leave" || cmd==="apply leave")
    return wa.text(from,"Leave application requires start date, end date, reason and a replacement player. Use the admin panel/API for structured leave creation, or contact an admin.");
  return wa.text(from,"Unknown command. Send MENU to open TEAM BOT.");
}

module.exports=router;
