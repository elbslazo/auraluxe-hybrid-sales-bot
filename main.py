import functions_framework
from flask import jsonify
from google.cloud import firestore

db = firestore.Client()

@functions_framework.http
def obtener_info_producto(request):
    request_json = request.get_json(silent=True)
    # Recibimos el nombre EXACTO desde Dialogflow
    producto_nombre = ""
    
    if request_json and 'sessionInfo' in request_json and 'parameters' in request_json['sessionInfo']:
        producto_nombre = request_json['sessionInfo']['parameters'].get('producto_a_mostrar', '')

    if not producto_nombre:
        return jsonify({"fulfillment_response": {"messages": [{"text": {"text": ["Error interno: Nombre de producto vacío."]}}]}})

    # Búsqueda EXACTA en la base de datos
    docs = db.collection('productos').where('nombre_display', '==', producto_nombre).limit(1).stream()
    
    producto_encontrado = None
    for doc in docs:
        producto_encontrado = doc.to_dict()
        break

    fulfillment_messages = []

    if producto_encontrado:
        # 1. IMÁGENES (ENVIAR TODAS PRIMERO)
        lista_imagenes = producto_encontrado.get('link_imagen', [])
        
        # Si es una lista de varios links
        if isinstance(lista_imagenes, list):
            for link in lista_imagenes:
                fulfillment_messages.append({
                    "payload": {
                        "whatsapp": {
                            "type": "image", 
                            "image": {"link": link}
                        }
                    }
                })
        # Si por casualidad es solo un texto (un solo link)
        elif isinstance(lista_imagenes, str) and lista_imagenes:
             fulfillment_messages.append({
                    "payload": {
                        "whatsapp": {
                            "type": "image", 
                            "image": {"link": lista_imagenes}
                        }
                    }
                })

        # 2. TEXTO (INFO DETALLADA)
        nombre = producto_encontrado.get('nombre_display', 'Producto')
        texto = f"🎧 *{nombre}*\n\n"
        
        if producto_encontrado.get('perfil_sonido'):
            texto += f"🔊 *Perfil:* {producto_encontrado['perfil_sonido']}\n"
            
        if producto_encontrado.get('tipo_conector'):
            desc = producto_encontrado.get('descripcion_conector', '')
            texto += f"🔌 *Conector:* {desc}\n"
            
        if producto_encontrado.get('info_color'):
            texto += f"🎨 *Color:* {producto_encontrado['info_color']}\n"

        precio_texto = "Precio Combo" if producto_encontrado.get('es_combo') else "Precio"
        precio = producto_encontrado.get('precio', '0')
        texto += f"\n💰 *{precio_texto}:* S/ {precio}"
        
        if producto_encontrado.get('link_review'):
            texto += f"\n\n🎥 *Review:* {producto_encontrado['link_review']}"

        fulfillment_messages.append({"text": {"text": [texto]}})

        # 3. BOTONES (CORTOS Y SEGUROS)
        fulfillment_messages.append({
            "payload": {
                "whatsapp": {
                    "type": "interactive",
                    "interactive": {
                        "type": "button",
                        "body": {"text": "👇 ¿Qué deseas hacer?"},
                        "action": {
                            "buttons": [
                                {"type": "reply", "reply": {"id": "coordinar_entrega_id", "title": "✅ Lo quiero"}},
                                {"type": "reply", "reply": {"id": "volver_recomendaciones_id", "title": "⬅️ Volver"}}
                            ]
                        }
                    }
                }
            }
        })
    else:
        # Mensaje de error visible para depuración
        fulfillment_messages.append({"text": {"text": [f"⚠️ ERROR: Busqué '{producto_nombre}' en Firestore y no existe. Revisa mayúsculas/espacios."]}})

    return jsonify({"fulfillment_response": {"messages": fulfillment_messages}})
