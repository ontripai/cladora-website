-- Fixed exposed-schema transport. No caller-selected schema/role/SQL/target.
-- Underlying canonical bodies remain byte-identical. NO exception wrapper.
SET LOCAL ROLE cladora_service_quote_store_owner;
CREATE FUNCTION platform_dev.reserve_service_quote_command_v1(p_request jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $facade$ SELECT customer_api.reserve_service_quote_command_v1(p_request) $facade$;
CREATE FUNCTION platform_dev.read_service_quote_history_v1(p_context_id uuid,p_workspace_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $facade$ SELECT customer_api.read_service_quote_history_v1(p_context_id,p_workspace_id) $facade$;
REVOKE ALL ON FUNCTION platform_dev.reserve_service_quote_command_v1(jsonb),platform_dev.read_service_quote_history_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION platform_dev.reserve_service_quote_command_v1(jsonb),platform_dev.read_service_quote_history_v1(uuid,uuid) TO authenticated;
-- No authenticated customer_api USAGE/EXECUTE or exposure is added.
SET LOCAL ROLE cladora_core_installer;
