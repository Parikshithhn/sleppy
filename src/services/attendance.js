const db=require("../db");
const wa=require("./whatsapp");
const {audit}=require("./audit");

async function createIdp({title,matchDate,matchTime,details,actor}) {
  const r=await db.query(`INSERT INTO idps(title,match_date,match_time,details,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [title,matchDate,matchTime,details||"",actor]);
  const idp=r.rows[0];
  const players=await db.query("SELECT id,whatsapp,name FROM players WHERE active=true AND roster_status IN ('ACTIVE','SUBSTITUTE')");
  for(const p of players.rows){
    await db.query("INSERT INTO idp_attendance(idp_id,player_id,status) VALUES($1,$2,'NO RESPONSE') ON CONFLICT DO NOTHING",[idp.id,p.id]);
    await wa.buttons(p.whatsapp,
      `IDP — ${idp.title}\nDate: ${idp.match_date}\nTime: ${idp.match_time}\n${idp.details||""}\n\nConfirm your participation.`,
      [{id:`idp_joined_${idp.id}`,title:"🟢 JOINED"}]);
  }
  await audit({actor,actorType:"ADMIN",action:"IDP_CREATED",objectType:"IDP",objectId:idp.id});
  return idp;
}

async function markJoined(idpId,playerId) {
  const leave=await db.query(`SELECT 1 FROM leave_requests WHERE player_id=$1 AND status='APPROVED'
    AND CURRENT_DATE BETWEEN start_date AND end_date LIMIT 1`,[playerId]);
  if(leave.rowCount) return {ignored:true,reason:"APPROVED_LEAVE"};

  const r=await db.query(`UPDATE idp_attendance SET status='JOINED',joined_at=NOW()
    WHERE idp_id=$1 AND player_id=$2 RETURNING *`,[idpId,playerId]);
  if(!r.rowCount) throw new Error("IDP attendance record not found");
  await audit({actor:String(playerId),actorType:"PLAYER",action:"IDP_JOINED",objectType:"IDP_ATTENDANCE",objectId:r.rows[0].id});
  return r.rows[0];
}

async function finalizeIdp(idpId) {
  const r=await db.query(`SELECT a.*,p.name,p.whatsapp FROM idp_attendance a JOIN players p ON p.id=a.player_id
    WHERE a.idp_id=$1`,[idpId]);
  for(const a of r.rows){
    if(a.status!=="JOINED"){
      const leave=await db.query(`SELECT 1 FROM leave_requests WHERE player_id=$1 AND status='APPROVED'
        AND (SELECT match_date FROM idps WHERE id=$2) BETWEEN start_date AND end_date LIMIT 1`,[a.player_id,idpId]);
      if(leave.rowCount) await db.query("UPDATE idp_attendance SET status='ON LEAVE' WHERE id=$1",[a.id]);
      else await db.query("UPDATE idp_attendance SET status='MISSED' WHERE id=$1",[a.id]);
    }
  }
  await db.query("UPDATE idps SET status='COMPLETED' WHERE id=$1",[idpId]);
  return true;
}

module.exports={createIdp,markJoined,finalizeIdp};
