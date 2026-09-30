const db = require("../db");

async function audit({actor="SYSTEM", actorType="SYSTEM", action, objectType=null, objectId=null, oldValue=null, newValue=null, status="SUCCESS", error=null}) {
  try {
    await db.query(
      `INSERT INTO audit_logs(actor,actor_type,action,object_type,object_id,old_value,new_value,status,error)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [actor,actorType,action,objectType,objectId,oldValue,newValue,status,error]
    );
  } catch (e) {
    console.error("AUDIT ERROR", e.message);
  }
}
module.exports = { audit };
