const express=require("express");
const db=require("../db");
const {audit}=require("../services/audit");
const {createIdp}=require("../services/attendance");
const {approveLeave,rejectLeave,revokeLeave}=require("../services/leave");
const {calculateTeamScore}=require("../services/scoring");
const router=express.Router();

router.use((req,res,next)=>{
  if(req.path==="/health") return next();
  if(!process.env.ADMIN_API_KEY || req.headers["x-admin-key"]!==process.env.ADMIN_API_KEY) return res.status(401).json({error:"Unauthorized"});
  next();
});

router.get("/health",(req,res)=>res.json({ok:true,service:"sleppy-esports-whatsapp"}));

router.get("/dashboard",async(req,res)=>{
  const q=await Promise.all([
    db.query("SELECT COUNT(*) FROM players WHERE active=true"),
    db.query("SELECT COUNT(*) FROM idps"),
    db.query("SELECT COUNT(*) FROM matches"),
    db.query("SELECT COUNT(*) FROM leave_requests WHERE status='PENDING'"),
    db.query("SELECT COUNT(*) FROM audit_logs")
  ]);
  res.json({activePlayers:Number(q[0].rows[0].count),idps:Number(q[1].rows[0].count),matches:Number(q[2].rows[0].count),pendingLeaves:Number(q[3].rows[0].count),auditLogs:Number(q[4].rows[0].count)});
});

router.post("/players",async(req,res)=>{
  try{
    const {name,ign,bgmi_uid,whatsapp,role="PLAYER",roster_status="ACTIVE"}=req.body;
    const r=await db.query(`INSERT INTO players(name,ign,bgmi_uid,whatsapp,role,roster_status)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[name,ign,bgmi_uid,whatsapp,role,roster_status]);
    await audit({actor:"ADMIN",actorType:"ADMIN",action:"PLAYER_CREATED",objectType:"PLAYER",objectId:r.rows[0].id,newValue:r.rows[0]});
    res.json(r.rows[0]);
  }catch(e){res.status(400).json({error:e.message})}
});

router.get("/players",async(req,res)=>res.json((await db.query("SELECT * FROM players ORDER BY active DESC,name")).rows));

router.post("/idp",async(req,res)=>{
  try{res.json(await createIdp({...req.body,actor:"ADMIN"}))}
  catch(e){res.status(400).json({error:e.message})}
});

router.get("/leaves",async(req,res)=>res.json((await db.query(`SELECT l.*,p.name,p.ign,r.name replacement_name
  FROM leave_requests l JOIN players p ON p.id=l.player_id JOIN players r ON r.id=l.replacement_player_id
  ORDER BY l.created_at DESC`)).rows));

router.post("/leaves/:id/approve",async(req,res)=>{
  try{res.json(await approveLeave(req.params.id,req.body.actor||"ADMIN"))}catch(e){res.status(400).json({error:e.message})}
});
router.post("/leaves/:id/reject",async(req,res)=>{
  try{res.json(await rejectLeave(req.params.id,req.body.actor||"ADMIN"))}catch(e){res.status(400).json({error:e.message})}
});
router.post("/leaves/:id/revoke",async(req,res)=>{
  try{res.json(await revokeLeave(req.params.id,req.body.actor||"ADMIN"))}catch(e){res.status(400).json({error:e.message})}
});

router.post("/leaves",async(req,res)=>{
  try{
    const {player_id,start_date,end_date,reason,replacement_player_id}=req.body;
    if(!player_id||!start_date||!end_date||!reason||!replacement_player_id) throw new Error("player_id, start_date, end_date, reason and replacement_player_id are mandatory");
    if(new Date(start_date)>new Date(end_date)) throw new Error("Start date cannot be after end date");
    if(Number(player_id)===Number(replacement_player_id)) throw new Error("Replacement must be another player");
    const rp=await db.query("SELECT active,roster_status FROM players WHERE id=$1",[replacement_player_id]);
    if(!rp.rowCount || !rp.rows[0].active || !["ACTIVE","SUBSTITUTE"].includes(rp.rows[0].roster_status)) throw new Error("Replacement player is inactive/unavailable");
    const overlap=await db.query(`SELECT 1 FROM leave_requests WHERE player_id=$1 AND status IN ('PENDING','APPROVED')
      AND daterange(start_date,end_date,'[]') && daterange($2,$3,'[]') LIMIT 1`,[player_id,start_date,end_date]);
    if(overlap.rowCount) throw new Error("Player already has an overlapping leave request");
    const r=await db.query(`INSERT INTO leave_requests(player_id,start_date,end_date,reason,replacement_player_id)
      VALUES($1,$2,$3,$4,$5) RETURNING *`,[player_id,start_date,end_date,reason,replacement_player_id]);
    const mode=(await db.query("SELECT value FROM settings WHERE key='leave_approval_mode'")).rows[0]?.value||"MANUAL";
    if(mode==="AUTO") {
      const l=await approveLeave(r.rows[0].id,"AUTO");
      return res.json(l);
    }
    res.json(r.rows[0]);
  }catch(e){res.status(400).json({error:e.message})}
});

router.post("/matches",async(req,res)=>{
  try{
    const {name,match_date,match_type="MATCH",map,screenshot_url}=req.body;
    const r=await db.query(`INSERT INTO matches(name,match_date,match_type,map,screenshot_url) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [name,match_date,match_type,map,screenshot_url]);
    res.json(r.rows[0]);
  }catch(e){res.status(400).json({error:e.message})}
});

router.post("/matches/:id/result",async(req,res)=>{
  try{
    const {team_placement,players=[],confirmed=false,extracted_text=null}=req.body;
    const score=calculateTeamScore(team_placement,players);
    const r=await db.query(`INSERT INTO match_results(match_id,team_placement,total_team_finishes,placement_points,finish_points,total_points,confirmed,extracted_text)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id,team_placement,players.reduce((a,b)=>a+Number(b.finishes||0),0),score.placementPoints,score.finishPoints,score.totalPoints,confirmed,extracted_text]);
    for(const p of players) await db.query(`INSERT INTO player_match_stats(match_id,player_id,finishes,finish_points)
      VALUES($1,$2,$3,$3) ON CONFLICT(match_id,player_id) DO UPDATE SET finishes=EXCLUDED.finishes,finish_points=EXCLUDED.finish_points`,
      [req.params.id,p.player_id,Number(p.finishes||0)]);
    await db.query("UPDATE matches SET status=$1 WHERE id=$2",[confirmed?"CONFIRMED":"PENDING",req.params.id]);
    await audit({actor:"ADMIN",actorType:"ADMIN",action:"MATCH_RESULT_SAVED",objectType:"MATCH_RESULT",objectId:r.rows[0].id,newValue:{...score,confirmed}});
    res.json({...r.rows[0],score});
  }catch(e){res.status(400).json({error:e.message})}
});

router.post("/official-pt",async(req,res)=>{
  try{
    const {title,image_url}=req.body;
    await db.query("UPDATE official_points_tables SET is_current=false");
    const r=await db.query("INSERT INTO official_points_tables(title,image_url,uploaded_by) VALUES($1,$2,'ADMIN') RETURNING *",[title,image_url]);
    res.json(r.rows[0]);
  }catch(e){res.status(400).json({error:e.message})}
});

router.post("/settings/leave-mode",async(req,res)=>{
  const mode=String(req.body.mode||"").toUpperCase();
  if(!["MANUAL","AUTO"].includes(mode)) return res.status(400).json({error:"Mode must be MANUAL or AUTO"});
  await db.query(`INSERT INTO settings(key,value) VALUES('leave_approval_mode',$1)
    ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,[mode]);
  res.json({mode});
});

router.get("/logs",async(req,res)=>res.json((await db.query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500")).rows));

module.exports=router;
