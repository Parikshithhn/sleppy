const axios = require("axios");

const API = () => `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

async function send(payload) {
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("WhatsApp credentials are not configured");
  }
  const r = await axios.post(API(), payload, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    timeout: 15000
  });
  return r.data;
}

async function text(to, body) {
  return send({ messaging_product:"whatsapp", to, type:"text", text:{body} });
}

async function buttons(to, body, buttons) {
  return send({
    messaging_product:"whatsapp", to, type:"interactive",
    interactive:{
      type:"button",
      body:{text:body},
      action:{buttons:buttons.map(b=>({type:"reply",reply:{id:b.id,title:b.title}}))}
    }
  });
}

async function menu(to) {
  return send({
    messaging_product:"whatsapp", to, type:"interactive",
    interactive:{
      type:"list",
      body:{text:"SLEPPY ESPORTS\nSelect an option:"},
      action:{button:"TEAM BOT",sections:[{title:"Player Menu",rows:[
        {id:"menu_idp",title:"📅 IDP",description:"Upcoming IDP"},
        {id:"menu_results",title:"🏆 RESULTS",description:"Latest results"},
        {id:"menu_points",title:"📊 POINTS TABLE",description:"Official PT"},
        {id:"menu_mystats",title:"📈 MY STATS",description:"Your performance"},
        {id:"menu_history",title:"📜 MATCH HISTORY",description:"Match history"},
        {id:"menu_reminders",title:"⏰ REMINDERS",description:"Your reminders"},
        {id:"menu_leave",title:"🟡 APPLY LEAVE",description:"Request leave"},
        {id:"menu_scrims",title:"🎮 SCRIMS",description:"Scrim schedule"},
        {id:"menu_tournaments",title:"🏆 TOURNAMENTS",description:"Tournament info"}
      ]}]}
    }
  });
}

module.exports = { send, text, buttons, menu };
