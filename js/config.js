// Configuración pública. Estos dos valores NO son secretos: la seguridad la imponen las
// políticas de la base de datos (supabase/01_schema.sql). Nunca pongas aquí la clave "service_role".
//
// Supabase > Project Settings > API:
//   url      -> "Project URL"
//   anonKey  -> "anon public"
//
// Si los dejas vacíos, la app arranca en MODO LOCAL DE PRUEBA: los datos se guardan solo en este
// navegador y no hay usuarios. Útil para probarla antes de conectar la base de datos.
export const CONFIG = {
  url: 'https://zazhbpacszkmgxmpsqnx.supabase.co/rest/v1/',
  anonKey: 'sb_publishable_fhoZjx74srrLWCgBfOLvrw_bhT6ojni'
};
