const cron=require("node-cron");
const db=require("../db");
const wa=require("./whatsapp");

function startScheduler(){
  cron.schedule("* * * * *", async()=>{
    try{
      const r=await db.query(`SELECT * FROM reminders WHERE status='SCHEDULED' AND send_at <= NOW() LIMIT 50`);
      for(const rem of r.rows){
        let players=[];
        if(rem.audience==="SELECTED" && rem.player_ids?.length)
          players=(await db.query("SELECT * FROM players WHERE id=ANY($1)",[rem.player_ids])).rows;
        else
          players=(await db.query("SELECT * FROM players WHERE active=true")).rows;
        for(const p of players) await wa.text(p.whatsapp,`${rem.title}\n\n${rem.message}`);
        await db.query("UPDATE reminders SET status='SENT' WHERE id=$1",[rem.id]);
      }
      await db.query(`UPDATE substitution_assignments SET active=false WHERE active=true AND end_date < CURRENT_DATE`);
    }catch(e){console.error("Scheduler:",e.message)}
  },{timezone:process.env.TIMEZONE||"Asia/Kolkata"});
}
module.exports={startScheduler};
