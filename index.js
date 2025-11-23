/**
 * AURALUXE SALES BOT - WHATSAPP BRIDGE
 * Descripción: Orquestador que conecta la API de WhatsApp Business con Dialogflow CX.
 * Maneja lógica de "Modo Espejo" y detección de Carritos de Compra.
 */

const functions = require('@google-cloud/functions-framework');
const { SessionsClient } = require('@google-cloud/dialogflow-cx');
const axios = require('axios');

// --- CONFIGURACIÓN (Variables de Entorno) ---
// En producción, usa process.env.VARIABLE
const PROJECT_ID = 'TU_PROJECT_ID';
const LOCATION = 'us-central1';
const AGENT_ID = 'TU_AGENT_ID';
const LANGUAGE_CODE = 'es';

const PHONE_NUMBER_ID = "TU_PHONE_NUMBER_ID"; 
const VERIFY_TOKEN = "TU_VERIFY_TOKEN"; // Token para validar webhook en Meta

// Token de larga duración de Meta
const WHATSAPP_TOKEN = "TU_ACCESS_TOKEN"; 

// Número del Administrador para el Modo Espejo
const ADMIN_NUMBER = "519XXXXXXXX"; 

const client = new SessionsClient({apiEndpoint: 'us-central1-dialogflow.googleapis.com'});

// --- MEMORIA TEMPORAL (RUNTIME) ---
let currentChatWith = null; // Cliente conectado actualmente con el Admin
let blockedUsers = [];      // Lista negra
let pausedUsers = [];       // Usuarios atendidos por humano (Bot en pausa)

// Utilidad: Convertir Protobuf de Dialogflow a JSON
function structProtoToJson(proto) {
    if (!proto || !proto.fields) return proto;
    const json = {};
    for (const key in proto.fields) {
        const field = proto.fields[key];
        if (field.stringValue) json[key] = field.stringValue;
        else if (field.numberValue) json[key] = field.numberValue;
        else if (field.boolValue) json[key] = field.boolValue;
        else if (field.structValue) json[key] = structProtoToJson(field.structValue);
        else if (field.listValue) json[key] = field.listValue.values.map(v => structProtoToJson(v.structValue || v));
        else if (field.nullValue) json[key] = null;
    }
    return json;
}

functions.http('webhook', async (req, res) => {
  // 1. VERIFICACIÓN DEL WEBHOOK (Handshake con Meta)
  if (req.method === 'GET') {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
      res.status(200).send(req.query['hub.challenge']);
    } else {
      res.sendStatus(403);
    }
    return;
  }

  // 2. PROCESAMIENTO DE MENSAJES (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body;
      if (body.object === 'whatsapp_business_account') {
        const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (message) {
          const sender = message.from; 
          
          // --- DETECCIÓN DE CONTENIDO ---
          let userText = "";
          let mediaId = null;
          let mediaType = null;

          // CASO 1: CARRITO DE COMPRAS (ORDER)
          // Si el usuario envía un pedido, forzamos la intención de compra
          if (message.type === 'order') {
              userText = "🛒 Comprar (Stock)"; 
          } 
          // CASO 2: TEXTO NORMAL
          else if (message.type === 'text') {
              userText = message.text.body;
          } 
          // CASO 3: INTERACTIVO (BOTONES / LISTAS)
          else if (message.type === 'interactive') {
              userText = message.interactive.button_reply?.title || message.interactive.list_reply?.title || "";
          } 
          // CASO 4: MULTIMEDIA
          else if (['image', 'audio', 'document', 'video', 'sticker'].includes(message.type)) {
              mediaType = message.type;
              mediaId = message[mediaType].id;
              userText = `[Archivo: ${mediaType}]`;
          }

          // --- LOGICA DE BLOQUEO ---
          if (blockedUsers.includes(sender)) { res.sendStatus(200); return; }

          // --- LOGICA MODO ESPEJO (ADMIN) ---
          if (sender === ADMIN_NUMBER) {
              const cmd = userText.toLowerCase();

              // Comandos de control
              if (cmd.startsWith("chat ")) {
                  const target = userText.split(" ")[1];
                  currentChatWith = target;
                  if (!pausedUsers.includes(target)) pausedUsers.push(target); 
                  await sendToWhatsApp(ADMIN_NUMBER, { text: { text: [`✅ Conectado con ${target}.\n🤖 Bot PAUSADO.`] } });
              }
              else if (cmd.startsWith("bloquear ")) {
                  const target = userText.split(" ")[1];
                  blockedUsers.push(target);
                  await sendToWhatsApp(ADMIN_NUMBER, { text: { text: [`🚫 Usuario ${target} bloqueado.`] } });
              }
              else if (cmd === "fin") {
                  if (currentChatWith) {
                      pausedUsers = pausedUsers.filter(u => u !== currentChatWith);
                      await sendToWhatsApp(ADMIN_NUMBER, { text: { text: [`🛑 Desconectado.\n🤖 Bot REACTIVADO.`] } });
                  }
                  currentChatWith = null;
              }
              // Reenvío de mensajes Admin -> Cliente
              else if (currentChatWith) {
                  if (mediaId) await sendMediaToWhatsApp(currentChatWith, mediaType, mediaId);
                  else await sendToWhatsApp(currentChatWith, { text: { text: [userText] } });
              } 
              else {
                  await sendToWhatsApp(ADMIN_NUMBER, { text: { text: ["⚠️ No estás conectado. Comandos: chat [num], fin"] } });
              }
              res.sendStatus(200);
              return;
          }

          // --- LOGICA CLIENTE ---
          // 1. Notificar al Admin (Espejo)
          await sendToWhatsApp(ADMIN_NUMBER, { text: { text: [`📩 [${sender}]: ${userText}`] } });

          // 2. Si el bot está pausado, no responder (dejar al humano)
          if (pausedUsers.includes(sender)) {
              res.sendStatus(200);
              return;
          }

          // 3. Enviar a Dialogflow CX
          if (userText && !mediaId) { 
            const sessionPath = client.projectLocationAgentSessionPath(PROJECT_ID, LOCATION, AGENT_ID, sender);
            const request = {
              session: sessionPath,
              queryInput: { text: { text: userText }, languageCode: LANGUAGE_CODE },
            };
            const [response] = await client.detectIntent(request);

            if (response.queryResult.responseMessages) {
              for (const msg of response.queryResult.responseMessages) {
                await sendToWhatsApp(sender, msg);
                // Copia al Admin de lo que respondió el bot
                let botRes = msg.text ? msg.text.text[0] : "[Multimedia/Botón]";
                await sendToWhatsApp(ADMIN_NUMBER, { text: { text: [`🤖: ${botRes}`] } });
              }
            }
          }
        }
        res.sendStatus(200);
      } else {
        res.sendStatus(404);
      }
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  }
});

// --- FUNCIONES AUXILIARES DE ENVÍO ---

async function sendToWhatsApp(to, dfMessage) {
  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
  const headers = { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' };
  let body = { messaging_product: "whatsapp", to: to };

  if (dfMessage.text) { 
      body.type = "text"; 
      body.text = { body: dfMessage.text.text[0] }; 
  } else if (dfMessage.payload) {
    let raw = dfMessage.payload.fields ? structProtoToJson(dfMessage.payload) : dfMessage.payload;
    if (raw.whatsapp) Object.assign(body, raw.whatsapp);
    else if (raw.twilio?.mediaUrl) { body.type = "image"; body.image = { link: raw.twilio.mediaUrl }; }
  }

  if (body.type) {
      try { await axios.post(url, body, { headers }); } 
      catch (err) { if(to !== ADMIN_NUMBER) console.error("Error Meta:", err.message); }
  }
}

async function sendMediaToWhatsApp(to, type, mediaId) {
    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
    const headers = { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' };
    let body = { messaging_product: "whatsapp", to: to, type: type };
    body[type] = { id: mediaId };

    try { await axios.post(url, body, { headers }); } 
    catch (err) { console.error("Error Media:", err.message); }
}
