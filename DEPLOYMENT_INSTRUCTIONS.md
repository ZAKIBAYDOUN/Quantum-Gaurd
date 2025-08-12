# 🚀 INSTRUCCIONES DE DESPLIEGUE - ADAPTER DEX 5470

## ✅ PASO 1: CREAR NUEVO REPL

1. **Ir a Replit:** https://replit.com
2. **Crear nuevo Repl:**
   - Nombre: `dex-adapter-5470`
   - Template: Node.js
   - Public: ✅ (necesario para que agregadores accedan)

## 📁 PASO 2: SUBIR ARCHIVOS

**Archivos necesarios del adapter:**
```
adapter/
├── package.json
├── server.js
├── .env
└── demo.js
```

**Copiar estos archivos a tu nuevo Repl:**
1. Crear carpeta `adapter/` en el root
2. Subir todos los archivos de la carpeta `adapter/`
3. Opcional: También subir `OPENAPI.yaml` al root

## ⚙️ PASO 3: CONFIGURAR ENVIRONMENT

**Editar archivo `.env`:**
```env
# Cambiar localhost por tu URL real
NATIVE_BASE_API=https://[tu-app-principal].[tu-usuario].replit.app/api
```

**Ejemplo:**
```env
NATIVE_BASE_API=https://super-core.ramibaydoun5.replit.app/api
```

## 🔧 PASO 4: INSTALAR Y EJECUTAR

**En la consola de tu nuevo Repl:**
```bash
cd adapter
npm install
node server.js
```

**O usar el demo:**
```bash
cd adapter
node demo.js
```

## ✅ PASO 5: VERIFICAR FUNCIONAMIENTO

**Probar endpoints:**
```
https://dex-adapter-5470.[tu-usuario].replit.app/health
https://dex-adapter-5470.[tu-usuario].replit.app/swap/v1/pairs
```

**Debería responder:**
```json
{
  "ok": true,
  "service": "5470-dex-adapter",
  "version": "1.0.0"
}
```

## 📧 PASO 6: ACTUALIZAR EMAILS

**Antes de enviar a los agregadores:**

1. **Abrir cada plantilla de email**
2. **Buscar y reemplazar:**
   - `https://dex-adapter-5470.<username>.replit.app`
   - **Por:** `https://dex-adapter-5470.[tu-usuario].replit.app`

3. **Verificar URLs funcionan** antes de enviar

## 🎯 PASO 7: ENVIAR SOLICITUDES

### Para DefiLlama (MÁS RÁPIDO):
1. **Unirse a Discord:** https://discord.defillama.com/
2. **Ir a canal #listings**
3. **Escribir mensaje:**
```
Hi! I'd like to list my new DEX protocol "5470 Core" on DefiLlama.

- Protocol: 5470 Core DEX (Bitcoin-compatible AMM with ZK privacy)
- API: https://dex-adapter-5470.[mi-usuario].replit.app
- Docs: OpenAPI 3.0 spec available
- Unique features: PoW consensus + DeFi + AI validation

API endpoints ready for TVL tracking. Can provide adapter code if needed.
```

### Para 1inch:
1. **Email a:** partnerships@1inch.io
2. **Asunto:** Integration Request: 5470 Core DEX - Bitcoin-Compatible AMM
3. **Adjuntar:** `email_templates/1inch_integration_request.md` + `OPENAPI.yaml`

### Para OpenOcean:
1. **Twitter DM a:** @OpenOceanGlobal
2. **O formulario:** https://openocean.finance/
3. **Adjuntar:** `email_templates/openocean_integration_request.md`

## 🔍 MONITOREO

**URLs para compartir con agregadores:**
```
Health: https://dex-adapter-5470.[usuario].replit.app/health
Pairs: https://dex-adapter-5470.[usuario].replit.app/swap/v1/pairs
Price: https://dex-adapter-5470.[usuario].replit.app/swap/v1/price?sellToken=5470&buyToken=BTC&sellAmount=10
Pools: https://dex-adapter-5470.[usuario].replit.app/dex/pools
Tokens: https://dex-adapter-5470.[usuario].replit.app/tokens
```

## ⚠️ NOTAS IMPORTANTES

1. **El adapter debe estar siempre online** - Replit lo mantiene activo
2. **URLs deben ser públicas** - Los agregadores necesitan acceso
3. **API nativa debe funcionar** - El adapter proxy-a hacia tu app principal
4. **Verificar CORS** - Ya está configurado para todos los orígenes

¡Tu DEX 5470 estará integrado en el ecosistema DeFi en pocos días! 🎉