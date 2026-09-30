require("dotenv").config();
const express=require("express");
const helmet=require("helmet");
const webhook=require("./routes/webhook");
const admin=require("./routes/admin");
const legal=require("./routes/legal");
const {startScheduler}=require("./services/scheduler");

const app=express();
app.use(helmet());
app.use(express.json({verify:(req,res,buf)=>{req.rawBody=buf}}));
app.use(express.urlencoded({extended:true}));

app.get("/",(req,res)=>res.json({service:"Sleppy Esports WhatsApp Bot",status:"online"}));
app.use("/webhook",webhook);
app.use("/api/admin",admin);
app.use("/",legal);

app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).json({error:"Internal server error"});
});

const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`Sleppy WhatsApp Bot listening on ${port}`));
startScheduler();
