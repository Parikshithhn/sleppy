const db = require("../db");
const wa = require("./whatsapp");
const { audit } = require("./audit");

async function playerById(id) {
  const r = await db.query("SELECT * FROM players WHERE id=$1",[id]);
  return r.rows[0];
}

async function approveLeave(id, actor) {
  const r = await db.query(`SELECT l.*,p.name,p.whatsapp,p.ign,r.name replacement_name,r.whatsapp replacement_whatsapp
    FROM leave_requests l JOIN players p ON p.id=l.player_id
    JOIN players r ON r.id=l.replacement_player_id WHERE l.id=$1`,[id]);
  const l=r.rows[0];
  if (!l) throw new Error("Leave request not found");
  if (l.status !== "PENDING") throw new Error("Only PENDING leave can be approved");

  const overlap = await db.query(`SELECT 1 FROM leave_requests l
    WHERE l.replacement_player_id=$1 AND l.status='APPROVED'
    AND daterange(l.start_date,l.end_date,'[]') && daterange($2,$3,'[]') LIMIT 1`,
    [l.replacement_player_id,l.start_date,l.end_date]);
  if (overlap.rowCount) throw new Error("Replacement player already has an active assignment in this period");

  await db.query("UPDATE leave_requests SET status='APPROVED',decided_by=$1,decided_at=NOW() WHERE id=$2",[actor,id]);
  await db.query(`INSERT INTO substitution_assignments
    (leave_id,original_player_id,substitute_player_id,start_date,end_date,active)
    VALUES($1,$2,$3,$4,$5,true)`,
    [id,l.player_id,l.replacement_player_id,l.start_date,l.end_date]);

  await wa.text(l.whatsapp,`LEAVE APPROVED\n\nDates: ${l.start_date} to ${l.end_date}\nReplacement: ${l.replacement_name}\n\nYou are excluded from attendance during approved leave.`);
  await wa.text(l.replacement_whatsapp,`SUBSTITUTION ASSIGNMENT\n\nReplacing: ${l.name}\nDates: ${l.start_date} to ${l.end_date}\nRole: ${l.ign || "Team substitute"}\n\nYou are active as the replacement during this period.`);
  await audit({actor,actorType:"ADMIN",action:"LEAVE_APPROVED",objectType:"LEAVE",objectId:id,newValue:{status:"APPROVED",replacement:l.replacement_player_id}});
  return l;
}

async function rejectLeave(id, actor) {
  const r=await db.query(`SELECT l.*,p.whatsapp FROM leave_requests l JOIN players p ON p.id=l.player_id WHERE l.id=$1`,[id]);
  const l=r.rows[0];
  if(!l) throw new Error("Leave request not found");
  if(l.status!=="PENDING") throw new Error("Only PENDING leave can be rejected");
  await db.query("UPDATE leave_requests SET status='REJECTED',decided_by=$1,decided_at=NOW() WHERE id=$2",[actor,id]);
  await wa.text(l.whatsapp,`LEAVE REJECTED\n\nYour leave request #${id} was rejected by ${actor}.`);
  await audit({actor,actorType:"ADMIN",action:"LEAVE_REJECTED",objectType:"LEAVE",objectId:id,newValue:{status:"REJECTED"}});
  return l;
}

async function revokeLeave(id, actor) {
  const r=await db.query(`SELECT l.*,p.whatsapp,r.whatsapp replacement_whatsapp,r.name replacement_name
    FROM leave_requests l JOIN players p ON p.id=l.player_id
    JOIN players r ON r.id=l.replacement_player_id WHERE l.id=$1`,[id]);
  const l=r.rows[0];
  if(!l) throw new Error("Leave request not found");
  if(!["APPROVED","REJECTED"].includes(l.status)) throw new Error("Only APPROVED or REJECTED leave can be revoked");

  const old=l.status;
  await db.query("UPDATE leave_requests SET status='PENDING',revoked_by=$1,revoked_at=NOW(),decided_by=NULL,decided_at=NULL WHERE id=$2",[actor,id]);
  if(old==="APPROVED") {
    await db.query("UPDATE substitution_assignments SET active=false WHERE leave_id=$1",[id]);
    await wa.text(l.whatsapp,`LEAVE DECISION REOPENED\n\nYour leave request #${id} is PENDING again for review.`);
    await wa.text(l.replacement_whatsapp,`REPLACEMENT ASSIGNMENT SUSPENDED\n\nThe leave request for ${l.name} was reopened. Your substitution is currently suspended.`);
  }
  await audit({actor,actorType:"ADMIN",action:"LEAVE_REVOKED",objectType:"LEAVE",objectId:id,oldValue:{status:old},newValue:{status:"PENDING"}});
  return l;
}

module.exports={approveLeave,rejectLeave,revokeLeave};
