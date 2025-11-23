# 🤖 Auraluxe Hybrid Sales Bot

**Sistema de ventas automatizado para WhatsApp (Meta API) orquestado con Dialogflow CX, Google Firestore y Node.js.**

Este proyecto demuestra cómo implementar un flujo de ventas conversacional híbrido que combina la automatización de la IA con la intervención humana estratégica ("Modo Espejo").

## 🚀 Características Principales
*   **Automatización Híbrida:** El bot maneja el catálogo y cierre básico; el humano interviene comandos de administración.
*   **Gestión de Estado (Firestore):** Inventario y precios actualizados en tiempo real sin reiniciar el servidor.
*   **Carrito de Compras:** Integración nativa con el formato `Order` de WhatsApp.
*   **Modo Espejo (Admin):** Control total del bot desde el celular del administrador mediante comandos (`chat id`, `bloquear`, `fin`).

## 🛠️ Arquitectura Técnica
*   **Backend:** Node.js (Google Cloud Functions) & Python (Data Handler).
*   **Base de Datos:** Google Firestore (NoSQL).
*   **IA Conversacional:** Dialogflow CX.
*   **Canal:** WhatsApp Cloud API (Meta).

## 📸 Manual de Operaciones
Aquí se detalla el flujo de decisión y la lógica del Modo Espejo:

<img width="747" height="370" alt="Captura de pantalla 2025-11-21 154200" src="https://github.com/user-attachments/assets/e749bc43-0c23-4979-a750-bf6c428b4f90" />
<img width="733" height="743" alt="Captura de pantalla 2025-11-21 154213" src="https://github.com/user-attachments/assets/046caf90-eca7-4b4d-9679-9e747c305622" />
<img width="739" height="592" alt="Captura de pantalla 2025-11-21 154220" src="https://github.com/user-attachments/assets/28d86987-861b-4a67-a69d-88f83e470c7d" />
<img width="742" height="215" alt="Captura de pantalla 2025-11-21 154227" src="https://github.com/user-attachments/assets/c394b98c-01fd-4809-b6b1-baf657ec0718" />


## 💾 Estructura de Datos (Firestore)
Esquema NoSQL diseñado para flexibilidad en productos de audio (IEMs):

<img width="636" height="375" alt="Captura de pantalla 2025-11-23 121828" src="https://github.com/user-attachments/assets/736ebcca-347e-4778-a7eb-1dfe7bb734a8" />


## ⚙️ Instalación
1. Clonar el repositorio.
2. Instalar dependencias: `npm install`
3. Configurar variables de entorno en Google Cloud.
4. Desplegar webhook.

---
**Desarrollado por Benjamin Ventura Torres**
*Ingeniero de Software & Especialista en Automatización.*
